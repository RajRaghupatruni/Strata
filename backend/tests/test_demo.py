"""Offline regression checks; no test-only dependencies or persistent database needed."""

import copy
import asyncio
import json
import os
import socket
import unittest
from pathlib import Path
from statistics import mean
from unittest.mock import patch

from fastapi.routing import APIRoute
from pydantic import ValidationError
from sqlalchemy import create_engine, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.dependencies import require_writable_demo
from app.core.database import get_db, normalize_database_url
from app.core.config import Settings, settings
from app.models import Base, CoachingReport, IssueTag, Match, ProgressSnapshot, Recommendation, ReviewNote, UserProfile
from app.seed_demo import check_demo_target, seed_demo
from app.services.analysis.insights import compute_insights
from app.services.coaching.engine import generate_coaching_report
from app.services.coaching.pro_coach import generate_pro_coaching_brief
from app.services.ingestion.persistence import insert_match_items
from app.services.ingestion.riot import (
    fetch_riot_matches_by_riot_id, normalize_riot_match,
)
from app.services.ingestion.synthetic import DEMO_FIXTURE, SyntheticMatchProvider
from app.services.progress.snapshots import generate_progress_snapshot
from app.services.recommendations import evaluate_recommendation_effectiveness
from scripts.generate_demo_fixture import build_fixture


REAL_SOCKET_CONNECT = socket.socket.connect


async def _asgi_request(app, method: str, path: str, payload: dict | None = None):
    body = json.dumps(payload).encode("utf-8") if payload is not None else b""
    messages = [{"type": "http.request", "body": body, "more_body": False}]
    sent: list[dict] = []

    async def receive():
        if messages:
            return messages.pop(0)
        return {"type": "http.disconnect"}

    async def send(message):
        sent.append(message)

    headers = []
    if payload is not None:
        headers.append((b"content-type", b"application/json"))

    await app(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": b"",
            "headers": headers,
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
        },
        receive,
        send,
    )
    status_code = next(message["status"] for message in sent if message["type"] == "http.response.start")
    response_body = b"".join(
        message.get("body", b"") for message in sent if message["type"] == "http.response.body"
    )
    return status_code, json.loads(response_body) if response_body else None


def asgi_request(app, method: str, path: str, payload: dict | None = None):
    with patch("socket.socket.connect", REAL_SOCKET_CONNECT):
        return asyncio.run(_asgi_request(app, method, path, payload))


class DemoTests(unittest.TestCase):
    def setUp(self):
        self.network = self.enterContext(patch("urllib.request.urlopen", side_effect=AssertionError("Unexpected HTTP call")))
        self.socket = self.enterContext(patch("socket.socket.connect", side_effect=AssertionError("Unexpected network call")))
        for name, value in {
            "coaching_mode": "deterministic", "coaching_ai_enabled": False,
            "riot_api_key": None, "openai_api_key": None, "public_demo_mode": False,
        }.items():
            self.enterContext(patch.object(settings, name, value))
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.addCleanup(self.engine.dispose)
        Base.metadata.create_all(self.engine)
        self.db = self.enterContext(Session(self.engine, autoflush=False))
        self.items = SyntheticMatchProvider().load_matches()

    def scratch_path(self, filename: str) -> Path:
        directory = Path.cwd() / ".test-output"
        directory.mkdir(exist_ok=True)
        path = directory / filename
        if path.exists():
            path.unlink()
        self.addCleanup(lambda: path.exists() and path.unlink())
        return path

    def test_fixture_reproducible_and_fictional(self):
        fixture = json.loads(DEMO_FIXTURE.read_text(encoding="utf-8"))
        self.assertEqual(fixture, build_fixture())
        self.assertEqual(len(self.items), 40)
        self.assertEqual(len({item.session_id for item in self.items}), 20)
        self.assertEqual({item.role for item in self.items}, {"Controller", "Duelist", "Initiator", "Sentinel"})
        self.assertEqual({item.result for item in self.items}, {"win", "loss"})
        for item in self.items:
            self.assertTrue(item.external_match_id.startswith("demo-na-match-"))
            self.assertEqual(item.metadata["source"], "synthetic")
            self.assertTrue(item.metadata["is_demo"])
            self.assertIsNone(item.rr_change)
            self.assertIsNone(item.rank_at_time)

    def test_shared_riot_adapter_normalizes_same_payload(self):
        fixture = build_fixture()
        payload = fixture["matches"][0]
        with patch("app.services.ingestion.riot._request_json", side_effect=[
            {"puuid": fixture["player_puuid"]},
            {"history": [{"matchId": payload["matchInfo"]["matchId"], "gameStartTimeMillis": 1}]},
            payload,
        ]) as transport:
            result = fetch_riot_matches_by_riot_id(
                game_name="DemoPlayer", tag_line="DEMO", region="na", max_matches=1, api_key="",
            )
        self.assertEqual(transport.call_count, 3)
        actual = result.mapped_matches[0]
        self.assertEqual(actual.metadata["source"], "riot_api")
        self.assertEqual(
            actual.model_dump(exclude={"metadata", "session_id"}),
            self.items[0].model_dump(exclude={"metadata", "session_id"}),
        )

    def test_round_derivation_and_missing_evidence(self):
        payload = copy.deepcopy(build_fixture()["matches"][0])
        focal = "demo-na-player-0001"
        payload["players"][0]["stats"].update(roundsPlayed=2, score=451)
        payload["roundResults"] = [
            {"roundNum": 0, "playerStats": [{"puuid": focal, "damage": [
                {"receiver": "demo-na-player-0006", "damage": 173, "headshots": 1, "bodyshots": 3, "legshots": 1},
            ]}]},
            {"roundNum": 1, "playerStats": [{"puuid": focal, "damage": []}]},
        ]
        def normalize():
            return normalize_riot_match(payload, focal, "DemoPlayer", "DEMO", "na")
        item = normalize()
        self.assertEqual((item.acs, item.adr, item.hs_percent), (226, 86.5, 20.0))
        payload["roundResults"].pop()
        self.assertIsNone(normalize().adr)
        self.assertIsNone(normalize().hs_percent)
        del payload["matchInfo"]["gameStartMillis"]
        with self.assertRaises(ValidationError):
            normalize()

    def test_bad_fixture_rejected_before_any_write(self):
        payload = build_fixture()
        payload["matches"][-1]["players"][0]["stats"]["kills"] = -1
        path = self.scratch_path("bad_fixture.json")
        path.write_text(json.dumps(payload), encoding="utf-8")
        provider = SyntheticMatchProvider(path)
        with patch("app.seed_demo.SyntheticMatchProvider", return_value=provider), patch("app.seed_demo.create_engine") as create:
            with self.assertRaises(ValidationError):
                seed_demo(Settings(_env_file=None, database_url="sqlite:///:memory:"))
            create.assert_not_called()

    def test_duplicate_import_preserves_history_and_skips_same_batch(self):
        self.assertEqual(insert_match_items(self.db, self.items + [self.items[0]]), (40, 1))
        match_id = self.db.scalar(select(Match.id))
        note = ReviewNote(match_id=match_id, summary="Fictional test review")
        self.db.add(note)
        self.db.commit()
        self.assertEqual(insert_match_items(self.db, self.items), (0, 40))
        self.assertEqual(self.db.scalar(select(func.count(Match.id))), 40)
        self.assertEqual(self.db.scalar(select(func.count(ReviewNote.id))), 1)
        self.assertEqual(self.db.scalar(select(func.count(CoachingReport.id))), 0)
        self.assertEqual(self.db.scalar(select(func.count(ProgressSnapshot.id))), 0)

    def test_database_enforces_external_match_uniqueness(self):
        insert_match_items(self.db, [self.items[0]])
        duplicate = Match(
            external_match_id=self.items[0].external_match_id,
            played_at=self.items[1].played_at,
            map_name=self.items[1].map_name,
            agent=self.items[1].agent,
            result=self.items[1].result,
        )
        self.db.add(duplicate)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

    def test_seed_refuses_production_and_arbitrary_targets_before_connecting(self):
        for environment, url in [
            ("production", "sqlite:///:memory:"),
            ("local", "postgresql://localhost/strata"),
            ("local", "sqlite:///another-database.db"),
            ("local", "sqlite:///file:remote.db?uri=true"),
        ]:
            with self.subTest(environment=environment, url=url):
                config = Settings(_env_file=None, environment=environment, database_url=url)
                with patch("app.seed_demo.create_engine") as create:
                    with self.assertRaises(ValueError):
                        seed_demo(config)
                    create.assert_not_called()
                check_demo_target(config, allow_nonlocal=True)

    def test_seed_cli_service_repeatable_on_explicit_test_target(self):
        db_path = self.scratch_path("demo_seed.db")
        config = Settings(_env_file=None, environment="test", database_url=f"sqlite:///{db_path.as_posix()}")
        self.assertEqual(seed_demo(config, allow_nonlocal=True), (40, 0))
        self.assertEqual(seed_demo(config, allow_nonlocal=True), (0, 40))
        engine = create_engine(config.database_url)
        try:
            with Session(engine) as db:
                self.assertEqual(db.scalar(select(func.count(Match.id))), 40)
                self.assertEqual(db.scalar(select(func.count(ReviewNote.id))), 13)
                self.assertEqual(db.scalar(select(func.count(Recommendation.id))), 1)
                recommendation = db.scalar(select(Recommendation))
                self.assertEqual(recommendation.target_issue_category, "positioning")
                self.assertEqual(recommendation.status, "effective")
                snapshot = db.scalar(select(ProgressSnapshot))
                evidence = snapshot.recommendation_effectiveness_json
                self.assertEqual(evidence["recommendation_id"], recommendation.id)
                self.assertEqual(evidence["evidence_level"], "supported")
                self.assertEqual(evidence["outcome"], "effective")
                self.assertLess(evidence["after_value"], evidence["before_value"])
        finally:
            engine.dispose()
        self.network.assert_not_called()
        self.socket.assert_not_called()

    def test_default_startup_needs_no_credentials(self):
        with patch.dict(os.environ, {}, clear=True):
            config = Settings(_env_file=None)
        self.assertIsNone(config.riot_api_key)
        self.assertIsNone(config.openai_api_key)
        self.assertFalse(config.coaching_ai_enabled)
        self.assertFalse(config.public_demo_mode)
        self.assertEqual(config.coaching_mode, "deterministic")
        from app import main
        with patch.object(main, "engine", self.engine):
            main.initialize_local_schema()
        self.assertEqual(main.health(), {"status": "ok"})
        self.assertTrue(main.app.openapi()["paths"])
        self.network.assert_not_called()

    def test_analytics_and_coaching_expose_real_fixture_patterns_offline(self):
        insert_match_items(self.db, self.items)
        insights = compute_insights(self.db)
        self.assertGreater(insights["recent_form"]["avg_acs"], insights["baseline_form"]["avg_acs"])
        weak = [item for item in self.items if item.map_name == "Bind"]
        self.assertLess(mean(item.acs for item in weak[-5:]), mean(item.acs for item in weak[:5]))
        report = generate_coaching_report(self.db)
        supporting = report.supporting_data_json
        self.assertFalse(supporting["ai_metadata"]["used_ai"])
        self.assertEqual(supporting["weakest_map"]["label"], "Bind")
        self.assertIn("Bind", report.improve_next)
        self.assertEqual(self.db.scalar(select(func.count(Recommendation.id))), 1)
        recommendation = self.db.scalar(select(Recommendation).where(Recommendation.coaching_report_id == report.id))
        self.assertEqual(recommendation.category, "performance_metric")
        self.assertEqual(recommendation.target_metric, "avg_acs")
        again = generate_coaching_report(self.db)
        self.assertEqual(report.priority_issue, again.priority_issue)
        self.assertEqual(report.weekly_plan, again.weekly_plan)
        brief = generate_pro_coaching_brief(self.db, recent_window=10)
        self.assertTrue(brief["priority_improvements"])
        snapshot = generate_progress_snapshot(self.db, recent_window=10, previous_window=10)
        evidence = snapshot.recommendation_effectiveness_json
        self.assertEqual(evidence["outcome"], "insufficient_data")
        self.assertEqual(evidence["evidence_level"], "insufficient_data")
        self.network.assert_not_called()
        self.socket.assert_not_called()

    def test_recommendation_issue_recurrence_can_be_inconclusive(self):
        insert_match_items(self.db, self.items[:10])
        report = CoachingReport(
            generated_at=self.items[4].played_at,
            priority_issue="Fictional positioning issue",
        )
        self.db.add(report)
        self.db.flush()
        recommendation = Recommendation(
            coaching_report_id=report.id,
            code="reduce_positioning",
            category="issue_recurrence",
            title="Reduce positioning mistakes",
            action="Track positioning discipline.",
            evidence_summary="Manual test recommendation.",
            target_issue_category="positioning",
            status="active",
            active_at=self.items[4].played_at,
        )
        self.db.add(recommendation)
        self.db.flush()
        before_ids = [match.id for match in self.db.scalars(select(Match).order_by(Match.played_at.asc()).limit(4)).all()]
        after_ids = [match.id for match in self.db.scalars(select(Match).order_by(Match.played_at.asc()).offset(5).limit(4)).all()]
        for index, match_id in enumerate(before_ids + after_ids):
            note = ReviewNote(match_id=match_id, summary=f"Inconclusive sample {index}")
            self.db.add(note)
            self.db.flush()
            if index in {0, 1, 4, 5}:
                self.db.add(IssueTag(review_note_id=note.id, match_id=match_id, category="positioning"))
        self.db.commit()

        evidence = evaluate_recommendation_effectiveness(self.db, recommendation.id, sample_window=10)
        self.assertEqual(evidence["evidence_level"], "directional")
        self.assertEqual(evidence["outcome"], "inconclusive")
        self.assertEqual(evidence["before_value"], evidence["after_value"])

    def test_recommendation_patch_cannot_fabricate_evaluation_evidence(self):
        from app.main import app

        report = CoachingReport(generated_at=self.items[0].played_at, priority_issue="Test")
        self.db.add(report)
        self.db.flush()
        recommendation = Recommendation(
            coaching_report_id=report.id,
            code="test_action",
            category="performance_metric",
            title="Test action",
            action="Complete the action.",
            evidence_summary="Computed evidence stays owned by the backend.",
            target_metric="avg_acs",
            status="active",
            active_at=self.items[0].played_at,
            evaluation_summary_json={"outcome": "insufficient_data"},
        )
        self.db.add(recommendation)
        self.db.commit()

        def override_get_db():
            yield self.db

        app.dependency_overrides[get_db] = override_get_db
        self.addCleanup(app.dependency_overrides.clear)

        status_code, _ = asgi_request(
                app,
                "PATCH",
                f"/api/v1/recommendations/{recommendation.id}",
                {
                    "status": "completed",
                    "evaluation_summary": {"outcome": "effective"},
                },
        )
        self.assertEqual(status_code, 422)
        self.db.refresh(recommendation)
        self.assertEqual(recommendation.status, "active")
        self.assertEqual(recommendation.evaluation_summary_json, {"outcome": "insufficient_data"})

        status_code, _ = asgi_request(
                app,
                "PATCH",
                f"/api/v1/recommendations/{recommendation.id}",
                {"status": "effective"},
        )
        self.assertEqual(status_code, 422)

        status_code, payload = asgi_request(
                app,
                "PATCH",
                f"/api/v1/recommendations/{recommendation.id}",
                {"status": "completed"},
        )
        self.assertEqual(status_code, 200)
        self.assertEqual(payload["status"], "completed")
        self.db.refresh(recommendation)
        self.assertEqual(recommendation.evaluation_summary_json, {"outcome": "insufficient_data"})
        self.assertIsNotNone(recommendation.completed_at)

        recommendation.status = "effective"
        recommendation.evaluation_summary_json = {"outcome": "effective"}
        self.db.add(recommendation)
        self.db.commit()
        status_code, payload = asgi_request(
                app,
                "PATCH",
                f"/api/v1/recommendations/{recommendation.id}",
                {"status": "completed"},
        )
        self.assertEqual(status_code, 400)
        self.assertEqual(payload["detail"], "Evaluated recommendation status is owned by backend evaluation.")
        self.db.refresh(recommendation)
        self.assertEqual(recommendation.status, "effective")
        self.assertEqual(recommendation.evaluation_summary_json, {"outcome": "effective"})

    def test_public_demo_mode_allows_reads_and_rejects_mutations(self):
        from app.main import app

        def override_get_db():
            yield self.db

        app.dependency_overrides[get_db] = override_get_db
        self.addCleanup(app.dependency_overrides.clear)
        self.enterContext(patch.object(settings, "public_demo_mode", True))

        read_status, read_payload = asgi_request(app, "GET", "/api/v1/matches")
        self.assertEqual(read_status, 200)
        self.assertEqual(read_payload["total"], 0)

        profile_status, profile_payload = asgi_request(app, "GET", "/api/v1/settings/profile")
        self.assertEqual(profile_status, 200)
        self.assertEqual(profile_payload["id"], 0)
        self.assertEqual(self.db.scalar(select(func.count(UserProfile.id))), 0)

        write_status, write_payload = asgi_request(
                app,
                "POST",
                "/api/v1/review/notes",
                {"summary": "Hosted demo mutation", "issue_tags": []},
        )
        self.assertEqual(write_status, 403)
        self.assertEqual(write_payload["detail"], "Hosted demo is read-only.")
        self.assertEqual(self.db.scalar(select(func.count(ReviewNote.id))), 0)

    def test_mutations_work_when_public_demo_mode_is_disabled(self):
        from app.main import app

        def override_get_db():
            yield self.db

        app.dependency_overrides[get_db] = override_get_db
        self.addCleanup(app.dependency_overrides.clear)
        self.enterContext(patch.object(settings, "public_demo_mode", False))

        status_code, payload = asgi_request(
                app,
                "POST",
                "/api/v1/review/notes",
                {"summary": "Local writable review", "issue_tags": []},
        )
        self.assertEqual(status_code, 201)
        self.assertEqual(payload["summary"], "Local writable review")
        self.assertEqual(self.db.scalar(select(func.count(ReviewNote.id))), 1)

    def test_public_demo_write_routes_are_guarded(self):
        from app.main import app

        expected = {
            ("POST", "/api/v1/matches/import"),
            ("POST", "/api/v1/matches/import/riot"),
            ("POST", "/api/v1/review/notes"),
            ("PUT", "/api/v1/review/notes/{note_id}"),
            ("DELETE", "/api/v1/review/notes/{note_id}"),
            ("POST", "/api/v1/review/notes/{note_id}/tags"),
            ("DELETE", "/api/v1/review/tags/{tag_id}"),
            ("POST", "/api/v1/coach/generate"),
            ("PATCH", "/api/v1/recommendations/{recommendation_id}"),
            ("POST", "/api/v1/progress/generate"),
            ("PUT", "/api/v1/settings/profile"),
        }
        guarded = set()
        for route in app.routes:
            if not isinstance(route, APIRoute):
                continue
            if any(dep.call is require_writable_demo for dep in route.dependant.dependencies):
                for method in route.methods or set():
                    guarded.add((method, route.path))
        self.assertTrue(expected.issubset(guarded))

    def test_existing_review_and_home_workflows(self):
        from app.api.routes.home import home_summary
        from app.api.routes.review import create_note, delete_note, recurring_issues, update_note
        from app.schemas.review import IssueTagCreate, ReviewNoteCreate, ReviewNoteUpdate
        insert_match_items(self.db, self.items)
        note = create_note(ReviewNoteCreate(
            match_id=self.db.scalar(select(Match.id)), summary="Fictional review test",
            issue_tags=[IssueTagCreate(category="positioning", severity="high")],
        ), self.db)
        self.assertEqual(note.issue_tags[0].category, "positioning")
        self.assertEqual(recurring_issues(limit=20, match_id=None, db=self.db).issues[0].occurrences, 1)
        updated = update_note(note.id, ReviewNoteUpdate(summary="Updated fictional review"), self.db)
        self.assertEqual(updated.summary, "Updated fictional review")
        self.assertEqual(home_summary(recent_window=10, db=self.db).counters.total_matches, 40)
        delete_note(note.id, self.db)
        self.assertEqual(self.db.scalar(select(func.count(ReviewNote.id))), 0)


if __name__ == "__main__":
    unittest.main()
