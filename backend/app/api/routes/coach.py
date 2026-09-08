import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import CoachingReport
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


router = APIRouter()


def _to_read(report: CoachingReport) -> CoachingReportRead:
    supporting_data = None
    if report.supporting_data_json:
        try:
            supporting_data = json.loads(report.supporting_data_json)
        except json.JSONDecodeError:
            supporting_data = None

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
    )


@router.get("/latest", response_model=LatestCoachingResponse)
def latest_coaching_report(db: Session = Depends(get_db)) -> LatestCoachingResponse:
    report = db.scalar(
        select(CoachingReport)
        .order_by(CoachingReport.generated_at.desc(), CoachingReport.id.desc())
        .limit(1)
    )
    return LatestCoachingResponse(report=_to_read(report) if report else None)


@router.post(
    "/generate", response_model=CoachingReportRead, status_code=status.HTTP_201_CREATED
)
def generate_report(
    payload: CoachingGenerateRequest, db: Session = Depends(get_db)
) -> CoachingReportRead:
    try:
        report = generate_coaching_report(db=db, recent_window=payload.recent_window)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_read(report)


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
    return CoachingReportListResponse(total=total, reports=[_to_read(report) for report in reports])


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
