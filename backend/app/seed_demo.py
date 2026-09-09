"""Seed the supported offline demo: python -m app.seed_demo (from backend)."""

import argparse
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database import normalize_database_url
from app.models import Base, IssueTag, Match, ProgressSnapshot, Recommendation, ReviewNote
from app.services.coaching.engine import generate_coaching_report
from app.services.ingestion.persistence import insert_match_items
from app.services.ingestion.synthetic import SyntheticMatchProvider
from app.services.progress.snapshots import generate_progress_snapshot


def check_demo_target(config: Settings, *, allow_nonlocal: bool = False) -> None:
    if allow_nonlocal:
        return
    url = make_url(config.database_url)
    default_database = Path(__file__).resolve().parents[1] / "strata.db"
    is_local_file = (
        url.get_backend_name() == "sqlite"
        and not url.host
        and not url.query
        and url.database is not None
        and (url.database == ":memory:" or Path(url.database).resolve() == default_database)
    )
    if config.environment.strip().lower() not in {"local", "development", "test"} or not is_local_file:
        raise ValueError(
            "Demo seeding is restricted to local/development/test and backend/strata.db "
            "(or in-memory SQLite). Use --allow-nonlocal only to explicitly allow another target."
        )


def seed_demo(config: Settings, *, allow_nonlocal: bool = False) -> tuple[int, int]:
    # Guard and validate the entire fixture before creating tables or writing rows.
    check_demo_target(config, allow_nonlocal=allow_nonlocal)
    items = SyntheticMatchProvider().load_matches()
    items.sort(key=lambda item: item.played_at)
    midpoint = len(items) // 2
    earlier_items = items[:midpoint]
    later_items = items[midpoint:]
    database_url = normalize_database_url(config.database_url)
    engine = create_engine(database_url)
    try:
        if make_url(database_url).get_backend_name() == "sqlite":
            Base.metadata.create_all(bind=engine)
        with Session(engine) as db:
            inserted_earlier, skipped_earlier = insert_match_items(db, earlier_items)
            _seed_demo_reviews(db, phase="before")
            _seed_demo_coaching(db)
            inserted_later, skipped_later = insert_match_items(db, later_items)
            _seed_demo_reviews(db, phase="after")
            _seed_demo_progress(db)
            return inserted_earlier + inserted_later, skipped_earlier + skipped_later
    finally:
        engine.dispose()


def _matches_by_external_id(db: Session) -> dict[str, Match]:
    rows = db.scalars(
        select(Match).where(Match.external_match_id.like("demo-na-match-%"))
    ).all()
    return {row.external_match_id: row for row in rows if row.external_match_id}


def _review_exists(db: Session, summary: str) -> bool:
    return db.scalar(select(ReviewNote.id).where(ReviewNote.summary == summary)) is not None


def _seed_demo_reviews(db: Session, *, phase: str) -> None:
    matches = _matches_by_external_id(db)
    if phase == "before":
        plan = [
            (f"demo-na-match-{index:04d}", "positioning", "medium")
            for index in range(11, 19)
        ]
    else:
        plan = [
            ("demo-na-match-0022", "positioning", "medium"),
            ("demo-na-match-0024", "utility_timing", "medium"),
            ("demo-na-match-0026", "trade_timing", "medium"),
            ("demo-na-match-0028", "positioning", "low"),
            ("demo-na-match-0030", "utility_timing", "low"),
        ]

    for external_id, category, severity in plan:
        match = matches.get(external_id)
        if match is None:
            continue
        summary = f"Demo {phase} review: {category} on {external_id}"
        if _review_exists(db, summary):
            continue
        note = ReviewNote(
            match_id=match.id,
            note_type="demo_review",
            summary=summary,
            full_note=(
                "Fictional demo review note created through normal persistence "
                "to demonstrate recommendation evidence over time."
            ),
            created_at=match.played_at,
            updated_at=match.played_at,
        )
        db.add(note)
        db.flush()
        db.add(
            IssueTag(
                review_note_id=note.id,
                match_id=match.id,
                category=category,
                severity=severity,
                description="Fictional demo issue tag for closed-loop evidence.",
                created_at=match.played_at,
            )
        )
    db.commit()


def _seed_demo_coaching(db: Session) -> None:
    from datetime import timedelta

    existing = db.scalar(
        select(Recommendation.id).where(Recommendation.target_issue_category == "positioning")
    )
    if existing is not None:
        return
    latest_earlier = db.scalar(
        select(Match)
        .where(Match.external_match_id <= "demo-na-match-0020")
        .order_by(Match.played_at.desc(), Match.id.desc())
        .limit(1)
    )
    if latest_earlier is None or latest_earlier.played_at is None:
        return
    generate_coaching_report(
        db=db,
        recent_window=10,
        generated_at=latest_earlier.played_at + timedelta(hours=1),
    )


def _seed_demo_progress(db: Session) -> None:
    recommendation = db.scalar(
        select(Recommendation)
        .where(Recommendation.target_issue_category == "positioning")
        .order_by(Recommendation.active_at.asc(), Recommendation.id.asc())
        .limit(1)
    )
    if recommendation is None:
        return
    exists = db.scalar(select(ProgressSnapshot.id).where(ProgressSnapshot.recommendation_effectiveness_json.is_not(None)))
    if exists is not None:
        return
    generate_progress_snapshot(db=db, recent_window=10, previous_window=10, recommendation_id=recommendation.id)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--allow-nonlocal", action="store_true",
        help="Explicitly allow seeding outside the default local database/environment.",
    )
    args = parser.parse_args()
    try:
        inserted, skipped = seed_demo(Settings(), allow_nonlocal=args.allow_nonlocal)
    except ValueError:
        # Never echo configuration values or payloads from validation exceptions.
        parser.exit(2, "Demo seed rejected: check the fixture and local database configuration. "
                    "Run from backend; use --help for target restrictions.\n")
    print(f"Synthetic demo ready: {inserted} inserted, {skipped} existing matches skipped. No API calls.")


if __name__ == "__main__":
    main()
