"""Validate the production PostgreSQL schema and repeat-safe demo persistence."""

from __future__ import annotations

import argparse
from collections.abc import Iterable
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import create_engine, func, inspect, insert, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database import normalize_database_url
from app.models import Match, ProgressSnapshot, Recommendation, ReviewNote
from app.seed_demo import seed_demo


REQUIRED_TABLES = {
    "matches",
    "coaching_reports",
    "progress_snapshots",
    "user_profiles",
    "recommendations",
    "review_notes",
    "issue_tags",
}
REQUIRED_INDEXES = {
    "ix_matches_external_match_id",
    "ix_matches_played_at_id",
    "ix_matches_session_id",
    "ix_recommendations_report_id",
    "ix_recommendations_status_active_at",
    "ix_recommendations_target_issue",
    "ix_recommendations_target_metric",
    "ix_progress_snapshots_snapshot_date_id",
}


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def _assert_jsonb(inspector, table: str, columns: Iterable[str]) -> None:
    actual = {column["name"]: column["type"] for column in inspector.get_columns(table)}
    for column in columns:
        _assert(isinstance(actual[column], JSONB), f"{table}.{column} is not PostgreSQL JSONB")


def _assert_duplicate_rejected(engine, external_match_id: str) -> None:
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(
                insert(Match).values(
                    external_match_id=external_match_id,
                    metadata_json={"probe": "duplicate"},
                )
            )
        except IntegrityError:
            transaction.rollback()
            return
        transaction.rollback()
    raise RuntimeError("external_match_id uniqueness was not enforced")


def _assert_foreign_key_rejected(engine) -> None:
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(insert(ReviewNote).values(match_id=2_147_000_000, summary="probe"))
        except IntegrityError:
            transaction.rollback()
            return
        transaction.rollback()
    raise RuntimeError("review_notes.match_id foreign key was not enforced")


def validate_postgres(*, repeat_seed: bool) -> None:
    settings = Settings()
    database_url = normalize_database_url(settings.database_url)
    _assert(database_url.startswith("postgresql+psycopg://"), "DATABASE_URL must target PostgreSQL")

    if repeat_seed:
        first = seed_demo(settings, allow_nonlocal=True)
        second = seed_demo(settings, allow_nonlocal=True)
        _assert(first[0] + first[1] == 40, f"first seed did not account for 40 demo matches: {first}")
        _assert(second[0] == 0, f"expected 0 repeat inserts, got {second[0]}")
        _assert(second[1] >= 40, f"expected repeat skips, got {second[1]}")
        print(f"Repeat seed: first={first}, second={second}")

    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        _assert(REQUIRED_TABLES.issubset(tables), f"missing tables: {REQUIRED_TABLES - tables}")
        _assert_jsonb(inspector, "matches", ["metadata_json"])
        _assert_jsonb(inspector, "coaching_reports", ["supporting_data_json"])
        _assert_jsonb(inspector, "progress_snapshots", [
            "issue_trends_json",
            "performance_change_json",
            "recommendation_effectiveness_json",
        ])
        _assert_jsonb(inspector, "recommendations", ["evaluation_summary_json"])

        indexes = {
            index["name"]
            for table in REQUIRED_TABLES
            for index in inspector.get_indexes(table)
        }
        _assert(REQUIRED_INDEXES.issubset(indexes), f"missing indexes: {REQUIRED_INDEXES - indexes}")
        unique_constraints = {
            constraint["name"]
            for constraint in inspector.get_unique_constraints("matches")
        }
        _assert("uq_matches_external_match_id" in unique_constraints, "external_match_id constraint missing")
        _assert(inspector.get_foreign_keys("review_notes"), "review_notes foreign key metadata missing")
        _assert(inspector.get_foreign_keys("recommendations"), "recommendations foreign key metadata missing")

        _assert_duplicate_rejected(engine, "demo-na-match-0001")
        _assert_foreign_key_rejected(engine)

        with Session(engine) as db:
            match_count = db.scalar(select(func.count()).select_from(Match)) or 0
            recommendation_count = db.scalar(select(func.count()).select_from(Recommendation)) or 0
            progress_count = db.scalar(select(func.count()).select_from(ProgressSnapshot)) or 0
            evidence_count = db.scalar(select(func.count()).select_from(ProgressSnapshot).where(
                ProgressSnapshot.recommendation_effectiveness_json.is_not(None)
            )) or 0
            _assert(match_count == 40, f"expected 40 matches, got {match_count}")
            _assert(recommendation_count > 0, "recommendation did not persist")
            _assert(progress_count > 0 and evidence_count > 0, "progress evidence did not persist/read")
            print(
                "PostgreSQL validation: "
                f"tables={len(tables)}, indexes={len(indexes)}, matches={match_count}, "
                f"recommendations={recommendation_count}, progress={progress_count}, "
                f"progress_with_evidence={evidence_count}, jsonb=ok, unique=ok, foreign_keys=ok"
            )
    finally:
        engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repeat-seed",
        action="store_true",
        help="Run the deterministic demo seed twice before validating persistence.",
    )
    args = parser.parse_args()
    validate_postgres(repeat_seed=args.repeat_seed)


if __name__ == "__main__":
    main()
