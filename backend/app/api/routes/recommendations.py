from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_writable_demo
from app.core.database import get_db
from app.models import Recommendation
from app.schemas.recommendation import (
    RecommendationListResponse,
    RecommendationRead,
    RecommendationUpdate,
)
from app.services.recommendations import recommendation_to_read


router = APIRouter()


@router.get("", response_model=RecommendationListResponse)
def list_recommendations(
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> RecommendationListResponse:
    filters = []
    if status:
        filters.append(Recommendation.status == status.strip().lower())

    total = db.scalar(select(func.count(Recommendation.id)).where(*filters)) or 0
    rows = db.scalars(
        select(Recommendation)
        .where(*filters)
        .order_by(Recommendation.active_at.desc(), Recommendation.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return RecommendationListResponse(
        total=total,
        recommendations=[recommendation_to_read(row) for row in rows],
    )


@router.get("/{recommendation_id}", response_model=RecommendationRead)
def get_recommendation(
    recommendation_id: int, db: Session = Depends(get_db)
) -> RecommendationRead:
    row = db.get(Recommendation, recommendation_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return recommendation_to_read(row)


SYSTEM_EVALUATED_STATUSES = {"effective", "ineffective", "inconclusive"}


@router.patch(
    "/{recommendation_id}",
    response_model=RecommendationRead,
    dependencies=[Depends(require_writable_demo)],
)
def update_recommendation(
    recommendation_id: int,
    payload: RecommendationUpdate,
    db: Session = Depends(get_db),
) -> RecommendationRead:
    row = db.get(Recommendation, recommendation_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    updates = payload.model_dump(exclude_unset=True)
    if row.status in SYSTEM_EVALUATED_STATUSES and "status" in updates:
        raise HTTPException(
            status_code=400,
            detail="Evaluated recommendation status is owned by backend evaluation.",
        )
    if "status" in updates and updates["status"] is not None:
        row.status = updates["status"]
        if row.status == "completed" and row.completed_at is None:
            row.completed_at = updates.get("completed_at") or datetime.now(tz=timezone.utc)
        elif row.status in {"active", "superseded"}:
            row.completed_at = None
    if "completed_at" in updates and updates["completed_at"] is not None:
        if row.status != "completed":
            raise HTTPException(
                status_code=400,
                detail="completed_at can only be set for completed recommendations.",
            )
        row.completed_at = updates["completed_at"]

    db.add(row)
    db.commit()
    db.refresh(row)
    return recommendation_to_read(row)
