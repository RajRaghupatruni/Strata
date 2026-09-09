"""Small, process-local observability primitives for the Strata API."""

from __future__ import annotations

import contextvars
import json
import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import wraps
from typing import Any

from prometheus_client import CollectorRegistry, Counter, Histogram, generate_latest


REQUEST_ID_HEADER = b"x-request-id"
_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
_request_id_context: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "strata_request_id", default=None
)

METRICS_REGISTRY = CollectorRegistry()
HTTP_REQUESTS = Counter(
    "strata_http_requests_total",
    "Total HTTP requests handled by the Strata API.",
    labelnames=("method", "route", "status_class"),
    registry=METRICS_REGISTRY,
)
HTTP_REQUEST_DURATION = Histogram(
    "strata_http_request_duration_seconds",
    "HTTP request duration in seconds.",
    labelnames=("method", "route"),
    registry=METRICS_REGISTRY,
)
ANALYTICS_CALCULATION_DURATION = Histogram(
    "strata_analytics_calculation_duration_seconds",
    "Time spent calculating deterministic analytics in seconds.",
    registry=METRICS_REGISTRY,
)
COACHING_GENERATION_DURATION = Histogram(
    "strata_coaching_generation_duration_seconds",
    "Time spent generating a coaching report in seconds.",
    registry=METRICS_REGISTRY,
)
RECOMMENDATION_EVALUATION_DURATION = Histogram(
    "strata_recommendation_evaluation_duration_seconds",
    "Time spent evaluating recommendation effectiveness in seconds.",
    registry=METRICS_REGISTRY,
)
PROGRESS_EVALUATION_DURATION = Histogram(
    "strata_progress_evaluation_duration_seconds",
    "Time spent generating a progress snapshot in seconds.",
    registry=METRICS_REGISTRY,
)


class JsonFormatter(logging.Formatter):
    """Format application records as compact JSON without request data."""

    _known_fields = (
        "request_id",
        "method",
        "path",
        "endpoint",
        "status_code",
        "duration_ms",
        "operation",
        "error_category",
        "recommendation_id",
        "match_id",
    )

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        request_id = get_request_id()
        for field in self._known_fields:
            value = getattr(record, field, None)
            if field == "request_id" and value is None:
                value = request_id
            if value is not None:
                payload[field] = value
        return json.dumps(payload, separators=(",", ":"), default=str)


logger = logging.getLogger("strata")


def configure_logging(level: str = "INFO", log_format: str = "json") -> None:
    """Install the one application handler used by Strata."""

    logger.setLevel(getattr(logging, (level or "INFO").upper(), logging.INFO))
    logger.propagate = False
    # RequestObservabilityMiddleware is the canonical concise access event.
    logging.getLogger("uvicorn.access").disabled = True
    if not any(getattr(handler, "_strata_handler", False) for handler in logger.handlers):
        handler = logging.StreamHandler()
        handler._strata_handler = True  # type: ignore[attr-defined]
        handler.setFormatter(
            JsonFormatter()
            if (log_format or "json").lower() == "json"
            else logging.Formatter("%(message)s")
        )
        logger.addHandler(handler)


def log_event(level: int, message: str, **fields: Any) -> None:
    """Write a safe structured event; callers only pass explicitly safe fields."""

    logger.log(level, message, extra=fields)


def get_request_id() -> str | None:
    return _request_id_context.get()


def _valid_request_id(value: str) -> bool:
    return bool(_REQUEST_ID_PATTERN.fullmatch(value))


def request_id_from_scope(scope: dict[str, Any]) -> str:
    for key, value in scope.get("headers", []):
        if key.lower() == REQUEST_ID_HEADER:
            try:
                candidate = value.decode("ascii")
            except UnicodeDecodeError:
                break
            if _valid_request_id(candidate):
                return candidate
            break
    return uuid.uuid4().hex


def route_label(scope: dict[str, Any]) -> str:
    """Return a bounded route label, preferring FastAPI's templated route."""

    route = scope.get("route")
    route_path = getattr(route, "path", None)
    if isinstance(route_path, str) and route_path:
        return route_path
    path = scope.get("path", "")
    if path in {"/health", "/ready", "/metrics"}:
        return path
    return "/unmatched"


def error_category(error: BaseException) -> str:
    name = type(error).__name__.lower()
    if "database" in name or "sql" in name:
        return "database"
    if isinstance(error, ValueError) or "validation" in name:
        return "validation"
    if "http" in name:
        return "http"
    return "internal"


@contextmanager
def observe_duration(metric: Histogram):
    started = time.perf_counter()
    try:
        yield
    finally:
        metric.observe(time.perf_counter() - started)


def timed(metric: Histogram) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def decorator(function: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(function)
        def wrapped(*args: Any, **kwargs: Any) -> Any:
            with observe_duration(metric):
                return function(*args, **kwargs)

        return wrapped

    return decorator


class RequestObservabilityMiddleware:
    """ASGI middleware for request IDs, metrics, timing, and one completion event."""

    def __init__(self, app: Callable[..., Awaitable[None]]):
        self.app = app

    async def __call__(
        self,
        scope: dict[str, Any],
        receive: Callable[..., Awaitable[Any]],
        send: Callable[..., Awaitable[None]],
    ) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        request_id = request_id_from_scope(scope)
        token = _request_id_context.set(request_id)
        started = time.perf_counter()
        status_code = 500
        response_started = False

        async def send_with_request_id(message: dict[str, Any]) -> None:
            nonlocal status_code, response_started
            if message.get("type") == "http.response.start":
                response_started = True
                status_code = int(message.get("status", 500))
                headers = [
                    (key, value)
                    for key, value in message.get("headers", [])
                    if key.lower() != REQUEST_ID_HEADER
                ]
                headers.append((REQUEST_ID_HEADER, request_id.encode("ascii")))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception as exc:
            category = error_category(exc)
            log_event(
                logging.ERROR,
                "Unhandled request exception",
                request_id=request_id,
                method=scope.get("method"),
                path=route_label(scope),
                endpoint=route_label(scope),
                operation="http_request",
                error_category=category,
            )
            if not response_started:
                await send_with_request_id(
                    {
                        "type": "http.response.start",
                        "status": 500,
                        "headers": [(b"content-type", b"application/json")],
                    }
                )
                await send_with_request_id(
                    {
                        "type": "http.response.body",
                        "body": b'{"detail":"Internal server error"}',
                    }
                )
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            route = route_label(scope)
            status_class = f"{status_code // 100}xx"
            HTTP_REQUESTS.labels(scope.get("method", "UNKNOWN"), route, status_class).inc()
            HTTP_REQUEST_DURATION.labels(scope.get("method", "UNKNOWN"), route).observe(
                duration_ms / 1000
            )
            log_event(
                logging.INFO if status_code < 500 else logging.ERROR,
                "HTTP request completed",
                request_id=request_id,
                method=scope.get("method"),
                path=route,
                endpoint=route,
                status_code=status_code,
                duration_ms=duration_ms,
                operation="http_request",
            )
            _request_id_context.reset(token)


def metrics_payload() -> bytes:
    return generate_latest(METRICS_REGISTRY)
