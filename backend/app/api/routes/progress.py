import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_writable_demo
from app.core.database import get_db
from app.models import ProgressSnapshot
from app.schemas.progress import (
    LatestProgressResponse,
    ProgressGenerateRequest,
    ProgressSnapshotListResponse,
    ProgressSnapshotRead,
)
from app.services.progress.snapshots import generate_progress_snapshot


router = APIRouter()


def _safe_load(value: str | None) -> list | dict:
    if isinstance(value, (list, dict)):
        return value
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, (list, dict)) else []


def _to_read(snapshot: ProgressSnapshot) -> ProgressSnapshotRead:
    issue_trends = _safe_load(snapshot.issue_trends_json)
    performance_change = _safe_load(snapshot.performance_change_json)
    recommendation = _safe_load(snapshot.recommendation_effectiveness_json)
    if not isinstance(issue_trends, list):
        issue_trends = []
    if not isinstance(performance_change, list):
        performance_change = []
    if not isinstance(recommendation, dict):
        recommendation = {}

    return ProgressSnapshotRead(
        id=snapshot.id,
        snapshot_date=snapshot.snapshot_date,
        metric_window=snapshot.metric_window,
        summary=snapshot.summary,
        issue_trends=issue_trends,
        performance_change=performance_change,
        recommendation_effectiveness=recommendation,
    )


@router.post(
    "/generate",
    response_model=ProgressSnapshotRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_writable_demo)],
)
def generate_snapshot(
    payload: ProgressGenerateRequest, db: Session = Depends(get_db)
) -> ProgressSnapshotRead:
    try:
        snapshot = generate_progress_snapshot(
            db=db,
            recent_window=payload.recent_window,
            previous_window=payload.previous_window,
            recommendation_id=payload.recommendation_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_read(snapshot)


@router.get("/latest", response_model=LatestProgressResponse)
def latest_snapshot(db: Session = Depends(get_db)) -> LatestProgressResponse:
    snapshot = db.scalar(
        select(ProgressSnapshot)
        .order_by(ProgressSnapshot.snapshot_date.desc(), ProgressSnapshot.id.desc())
        .limit(1)
    )
    return LatestProgressResponse(snapshot=_to_read(snapshot) if snapshot else None)


@router.get("", response_model=ProgressSnapshotListResponse)
def get_progress(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ProgressSnapshotListResponse:
    total = db.scalar(select(func.count(ProgressSnapshot.id))) or 0
    rows = db.scalars(
        select(ProgressSnapshot)
        .order_by(ProgressSnapshot.snapshot_date.desc(), ProgressSnapshot.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return ProgressSnapshotListResponse(total=total, snapshots=[_to_read(row) for row in rows])
