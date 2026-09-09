import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_writable_demo
from app.core.database import get_db
from app.models import CoachingReport, Recommendation
from app.schemas.coach import (
    CoachingGenerateRequest,
    CoachingReportListResponse,
    CoachingReportRead,
    LatestCoachingResponse,
    ProCoachingRequest,
    ProCoachingResponse,
)
from app.services.coaching.engine import generate_coaching_report
from app.services.coaching.pro_coach import generate_pro_coaching_brief
from app.services.recommendations import recommendation_to_read


router = APIRouter()


def _to_read(report: CoachingReport, db: Session | None = None) -> CoachingReportRead:
    supporting_data = None
    if isinstance(report.supporting_data_json, dict):
        supporting_data = report.supporting_data_json
    elif report.supporting_data_json:
        try:
            supporting_data = json.loads(report.supporting_data_json)
        except json.JSONDecodeError:
            supporting_data = None
    recommendations = []
    if db is not None:
        rows = db.scalars(
            select(Recommendation)
            .where(Recommendation.coaching_report_id == report.id)
            .order_by(Recommendation.id.asc())
        ).all()
        recommendations = [recommendation_to_read(row) for row in rows]

    return CoachingReportRead(
        id=report.id,
        generated_at=report.generated_at,
        time_window_start=report.time_window_start,
        time_window_end=report.time_window_end,
        priority_issue=report.priority_issue,
        stop_doing=report.stop_doing,
        keep_doing=report.keep_doing,
        improve_next=report.improve_next,
        next_session_focus=report.next_session_focus,
        weekly_plan=report.weekly_plan,
        supporting_data=supporting_data,
        recommendations=recommendations,
    )


@router.get("/latest", response_model=LatestCoachingResponse)
def latest_coaching_report(db: Session = Depends(get_db)) -> LatestCoachingResponse:
    report = db.scalar(
        select(CoachingReport)
        .order_by(CoachingReport.generated_at.desc(), CoachingReport.id.desc())
        .limit(1)
    )
    return LatestCoachingResponse(report=_to_read(report, db) if report else None)


@router.post(
    "/generate",
    response_model=CoachingReportRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_writable_demo)],
)
def generate_report(
    payload: CoachingGenerateRequest, db: Session = Depends(get_db)
) -> CoachingReportRead:
    try:
        report = generate_coaching_report(db=db, recent_window=payload.recent_window)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_read(report, db)


@router.get("/reports", response_model=CoachingReportListResponse)
def list_reports(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> CoachingReportListResponse:
    total = db.scalar(select(func.count(CoachingReport.id))) or 0
    reports = db.scalars(
        select(CoachingReport)
        .order_by(CoachingReport.generated_at.desc(), CoachingReport.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return CoachingReportListResponse(total=total, reports=[_to_read(report, db) for report in reports])


@router.post("/pro-brief", response_model=ProCoachingResponse)
def generate_pro_brief(
    payload: ProCoachingRequest, db: Session = Depends(get_db)
) -> ProCoachingResponse:
    try:
        result = generate_pro_coaching_brief(
            db=db, recent_window=payload.recent_window, match_id=payload.match_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ProCoachingResponse(**result)
