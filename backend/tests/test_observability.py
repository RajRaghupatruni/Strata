"""Focused checks for the backend observability contract."""

import asyncio
import io
import json
import logging
import unittest
from unittest.mock import patch

from app.main import app
from app.core.observability import logger, metrics_payload


async def _request(path: str, headers: list[tuple[bytes, bytes]] | None = None):
    sent: list[dict] = []
    messages = [{"type": "http.request", "body": b"", "more_body": False}]

    async def receive():
        return messages.pop(0) if messages else {"type": "http.disconnect"}

    async def send(message):
        sent.append(message)

    await app(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": b"",
            "headers": headers or [],
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
        },
        receive,
        send,
    )
    start = next(message for message in sent if message["type"] == "http.response.start")
    body = b"".join(message.get("body", b"") for message in sent if message["type"] == "http.response.body")
    response_headers = dict(start.get("headers", []))
    return start["status"], response_headers, body


class ObservabilityTests(unittest.TestCase):
    def request(self, path: str, headers: list[tuple[bytes, bytes]] | None = None):
        return asyncio.run(_request(path, headers))

    def test_request_id_is_generated_and_returned(self):
        status, headers, _ = self.request("/health")
        self.assertEqual(status, 200)
        self.assertRegex(headers[b"x-request-id"].decode(), r"^[0-9a-f]{32}$")

    def test_well_formed_caller_request_id_is_preserved(self):
        status, headers, _ = self.request("/health", [(b"x-request-id", b"client-1234")])
        self.assertEqual(status, 200)
        self.assertEqual(headers[b"x-request-id"], b"client-1234")

    def test_invalid_caller_request_id_is_replaced(self):
        status, headers, _ = self.request("/health", [(b"x-request-id", b"contains spaces")])
        self.assertEqual(status, 200)
        self.assertNotEqual(headers[b"x-request-id"], b"contains spaces")

    def test_health_contract(self):
        status, _, body = self.request("/health")
        self.assertEqual((status, json.loads(body)), (200, {"status": "ok"}))

    def test_readiness_succeeds_with_database(self):
        status, _, body = self.request("/ready")
        self.assertEqual((status, json.loads(body)), (200, {"status": "ready"}))

    def test_readiness_fails_safely_when_database_check_fails(self):
        class FailingEngine:
            def connect(self):
                raise RuntimeError("postgresql://secret-user:secret-password@db/strata")

        with patch("app.main.engine", FailingEngine()):
            status, _, body = self.request("/ready")
        self.assertEqual((status, json.loads(body)), (503, {"status": "not_ready"}))
        self.assertNotIn(b"secret-password", body)

    def test_metrics_are_prometheus_text_and_request_labels_are_bounded(self):
        self.request("/health", [(b"x-request-id", b"request-abc")])
        status, headers, body = self.request("/metrics")
        self.assertEqual(status, 200)
        self.assertIn(b"text/plain", headers[b"content-type"])
        self.assertIn(b"strata_http_requests_total", body)
        self.assertIn(b'route="/health"', body)
        self.assertNotIn(b"request_id", body)
        self.assertNotIn(b"request-abc", body)

    def test_logging_does_not_expose_secret_headers(self):
        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
        self.addCleanup(logger.removeHandler, handler)
        self.request(
            "/health",
            [
                (b"authorization", b"Bearer fictional-secret"),
                (b"x-api-key", b"fictional-api-key"),
            ],
        )
        output = stream.getvalue()
        self.assertNotIn("fictional-secret", output)
        self.assertNotIn("fictional-api-key", output)

    def test_service_metrics_are_registered(self):
        payload = metrics_payload()
        for metric in (
            b"strata_analytics_calculation_duration_seconds",
            b"strata_coaching_generation_duration_seconds",
            b"strata_recommendation_evaluation_duration_seconds",
            b"strata_progress_evaluation_duration_seconds",
        ):
            self.assertIn(metric, payload)


if __name__ == "__main__":
    unittest.main()
