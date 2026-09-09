import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_writable_demo
from app.core.config import settings
from app.core.database import get_db
from app.models import Match, ReviewNote
from app.schemas.match import (
    MatchImportRequest,
    MatchImportResponse,
    MatchListResponse,
    MatchRead,
    RiotImportRequest,
    RiotImportResponse,
)
from app.services.ingestion.persistence import insert_match_items
from app.services.ingestion.riot import RiotApiError, fetch_riot_matches_by_riot_id


router = APIRouter()


def _to_match_read(record: Match, review_note_count: int | None = None) -> MatchRead:
    metadata = None
    if isinstance(record.metadata_json, dict):
        metadata = record.metadata_json
    elif record.metadata_json:
        try:
            metadata = json.loads(record.metadata_json)
        except json.JSONDecodeError:
            metadata = None

    return MatchRead(
        id=record.id,
        external_match_id=record.external_match_id,
        played_at=record.played_at,
        map_name=record.map_name,
        mode=record.mode,
        agent=record.agent,
        role=record.role,
        result=record.result,
        scoreline=record.scoreline,
        kills=record.kills,
        deaths=record.deaths,
        assists=record.assists,
        adr=record.adr,
        acs=record.acs,
        hs_percent=record.hs_percent,
        rr_change=record.rr_change,
        rank_at_time=record.rank_at_time,
        session_id=record.session_id,
        metadata=metadata,
        review_note_count=review_note_count,
    )


@router.post(
    "/import",
    response_model=MatchImportResponse,
    dependencies=[Depends(require_writable_demo)],
)
def import_matches(payload: MatchImportRequest, db: Session = Depends(get_db)) -> MatchImportResponse:
    inserted, skipped_duplicates = insert_match_items(db, payload.matches)
    return MatchImportResponse(
        total_received=len(payload.matches),
        inserted=inserted,
        skipped_duplicates=skipped_duplicates,
    )


@router.post(
    "/import/riot",
    response_model=RiotImportResponse,
    dependencies=[Depends(require_writable_demo)],
)
def import_matches_from_riot(
    payload: RiotImportRequest, db: Session = Depends(get_db)
) -> RiotImportResponse:
    if not settings.riot_api_key:
        raise HTTPException(
            status_code=400,
            detail=(
                "RIOT_API_KEY is not configured. Add `riot_api_key=...` to backend/.env."
            ),
        )

    try:
        ingestion = fetch_riot_matches_by_riot_id(
            game_name=payload.game_name.strip(),
            tag_line=payload.tag_line.strip(),
            region=payload.region.strip().lower(),
            max_matches=payload.max_matches,
            api_key=settings.riot_api_key,
        )
    except RiotApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    inserted, skipped_duplicates = insert_match_items(db, ingestion.mapped_matches)
    return RiotImportResponse(
        game_name=payload.game_name.strip(),
        tag_line=payload.tag_line.strip(),
        region=payload.region.strip().lower(),
        player_puuid=ingestion.player_puuid,
        total_fetched_match_ids=len(ingestion.fetched_match_ids),
        total_mapped_matches=len(ingestion.mapped_matches),
        inserted=inserted,
        skipped_duplicates=skipped_duplicates,
    )


@router.get("", response_model=MatchListResponse)
def list_matches(
    map_name: str | None = Query(default=None, alias="map"),
    agent: str | None = None,
    role: str | None = None,
    result: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> MatchListResponse:
    filters = []

    if map_name:
        filters.append(Match.map_name == map_name)
    if agent:
        filters.append(Match.agent == agent)
    if role:
        filters.append(Match.role == role)
    if result:
        filters.append(Match.result == result.strip().lower())
    if start_date:
        filters.append(func.date(Match.played_at) >= start_date.isoformat())
    if end_date:
        filters.append(func.date(Match.played_at) <= end_date.isoformat())

    total = db.scalar(select(func.count(Match.id)).where(*filters)) or 0

    rows = db.scalars(
        select(Match)
        .where(*filters)
        .order_by(Match.played_at.desc(), Match.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    return MatchListResponse(total=total, matches=[_to_match_read(row) for row in rows])


@router.get("/{match_id}", response_model=MatchRead)
def get_match(match_id: int, db: Session = Depends(get_db)) -> MatchRead:
    row = db.scalar(select(Match).where(Match.id == match_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Match not found")
    note_count = (
        db.scalar(select(func.count(ReviewNote.id)).where(ReviewNote.match_id == match_id)) or 0
    )
    return _to_match_read(row, review_note_count=note_count)
