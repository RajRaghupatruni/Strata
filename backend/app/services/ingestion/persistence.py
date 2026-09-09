"""Shared persistence for normalized manual, synthetic, and Riot imports."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Match
from app.schemas.match import MatchImportItem


def insert_match_items(db: Session, items: list[MatchImportItem]) -> tuple[int, int]:
    inserted = 0
    skipped_duplicates = 0

    for item in items:
        normalized_result = item.result.strip().lower()

        if item.external_match_id:
            existing_id = db.scalar(
                select(Match.id).where(Match.external_match_id == item.external_match_id)
            )
            if existing_id is not None:
                skipped_duplicates += 1
                continue

        record = Match(
            external_match_id=item.external_match_id,
            played_at=item.played_at,
            map_name=item.map_name,
            mode=item.mode,
            agent=item.agent,
            role=item.role,
            result=normalized_result,
            scoreline=item.scoreline,
            kills=item.kills,
            deaths=item.deaths,
            assists=item.assists,
            adr=item.adr,
            acs=item.acs,
            hs_percent=item.hs_percent,
            rr_change=item.rr_change,
            rank_at_time=item.rank_at_time,
            session_id=item.session_id,
            metadata_json=item.metadata,
        )
        try:
            with db.begin_nested():
                db.add(record)
                db.flush()
        except IntegrityError:
            if not item.external_match_id:
                raise
            skipped_duplicates += 1
        else:
            inserted += 1

    db.commit()
    return inserted, skipped_duplicates

