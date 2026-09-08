"""Offline regression checks; no test-only dependencies or persistent database needed."""

import copy
import json
import os
import unittest
from pathlib import Path
from statistics import mean
from tempfile import TemporaryDirectory
from unittest.mock import patch

from pydantic import ValidationError
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings, settings
from app.models import Base, CoachingReport, Match, ProgressSnapshot, ReviewNote
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
from scripts.generate_demo_fixture import build_fixture


class DemoTests(unittest.TestCase):
    def setUp(self):
        self.network = self.enterContext(patch("urllib.request.urlopen", side_effect=AssertionError("Unexpected HTTP call")))
        self.socket = self.enterContext(patch("socket.socket.connect", side_effect=AssertionError("Unexpected network call")))
        for name, value in {
            "coaching_mode": "deterministic", "coaching_ai_enabled": False,
            "riot_api_key": None, "openai_api_key": None,
        }.items():
            self.enterContext(patch.object(settings, name, value))
        self.engine = create_engine("sqlite:///:memory:")
        self.addCleanup(self.engine.dispose)
        Base.metadata.create_all(self.engine)
        self.db = self.enterContext(Session(self.engine, autoflush=False))
        self.items = SyntheticMatchProvider().load_matches()

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
        with TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.json"
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
        with TemporaryDirectory() as directory:
            config = Settings(_env_file=None, environment="test", database_url=f"sqlite:///{Path(directory).as_posix()}/demo.db")
            self.assertEqual(seed_demo(config, allow_nonlocal=True), (40, 0))
            self.assertEqual(seed_demo(config, allow_nonlocal=True), (0, 40))
        self.network.assert_not_called()
        self.socket.assert_not_called()

    def test_default_startup_needs_no_credentials(self):
        with patch.dict(os.environ, {}, clear=True):
            config = Settings(_env_file=None)
        self.assertIsNone(config.riot_api_key)
        self.assertIsNone(config.openai_api_key)
        self.assertFalse(config.coaching_ai_enabled)
        self.assertEqual(config.coaching_mode, "deterministic")
        from app import main
        with patch.object(main, "engine", self.engine):
            main.on_startup()
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
        supporting = json.loads(report.supporting_data_json)
        self.assertFalse(supporting["ai_metadata"]["used_ai"])
        self.assertEqual(supporting["weakest_map"]["label"], "Bind")
        self.assertIn("Bind", report.improve_next)
        again = generate_coaching_report(self.db)
        self.assertEqual(report.priority_issue, again.priority_issue)
        self.assertEqual(report.weekly_plan, again.weekly_plan)
        brief = generate_pro_coaching_brief(self.db, recent_window=10)
        self.assertTrue(brief["priority_improvements"])
        snapshot = generate_progress_snapshot(self.db, recent_window=10, previous_window=10)
        evidence = json.loads(snapshot.recommendation_effectiveness_json)
        self.assertFalse(evidence["evaluated"])
        self.network.assert_not_called()
        self.socket.assert_not_called()

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
