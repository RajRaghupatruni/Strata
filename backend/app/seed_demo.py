"""Seed the supported offline demo: python -m app.seed_demo (from backend)."""

import argparse
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import Base
from app.services.ingestion.persistence import insert_match_items
from app.services.ingestion.synthetic import SyntheticMatchProvider


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
    engine = create_engine(config.database_url)
    try:
        Base.metadata.create_all(bind=engine)
        with Session(engine) as db:
            return insert_match_items(db, items)
    finally:
        engine.dispose()


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
