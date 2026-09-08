from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.insights import InsightsSummary
from app.services.analysis.insights import compute_insights


router = APIRouter()


@router.get("", response_model=InsightsSummary)
def get_insights(
    recent_window: int = Query(default=10, ge=3, le=50),
    db: Session = Depends(get_db),
) -> InsightsSummary:
    data = compute_insights(db=db, recent_window=recent_window)
    return InsightsSummary(**data)
