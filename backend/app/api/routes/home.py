from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import CoachingReport, Match, ProgressSnapshot, ReviewNote, UserProfile
from app.schemas.home import (
    CoachingHighlight,
    HomeCounters,
    HomeSummaryRead,
    PatternHighlight,
    ProgressHighlight,
)
from app.services.analysis.insights import compute_insights


router = APIRouter()


def _match_sort_key(match: Match) -> tuple[int, int]:
    if match.played_at is None:
        return (0, match.id)
    played_at = match.played_at
    if played_at.tzinfo is None:
        played_at = played_at.replace(tzinfo=timezone.utc)
    return (int(played_at.timestamp()), match.id)


def _pattern(entry: dict | None) -> PatternHighlight | None:
    if not entry:
        return None
    label = str(entry.get("label") or "Unknown")
    matches = int(entry.get("matches") or 0)
    win_rate = entry.get("win_rate")
    return PatternHighlight(label=label, matches=matches, win_rate=win_rate)


def _best_entry(entries: list[dict], min_matches: int = 2) -> dict | None:
    candidates = [entry for entry in entries if (entry.get("matches") or 0) >= min_matches]
    if not candidates:
        candidates = entries
    if not candidates:
        return None
    return max(
        candidates,
        key=lambda entry: (
            entry.get("win_rate") if entry.get("win_rate") is not None else -1,
            entry.get("matches") or 0,
        ),
    )


def _worst_entry(entries: list[dict], min_matches: int = 2) -> dict | None:
    candidates = [entry for entry in entries if (entry.get("matches") or 0) >= min_matches]
    if not candidates:
        candidates = entries
    if not candidates:
        return None
    return min(
        candidates,
        key=lambda entry: (
            entry.get("win_rate") if entry.get("win_rate") is not None else 10_000,
            -(entry.get("matches") or 0),
        ),
    )


def _safe_load_dict(raw: str | None) -> dict:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _recent_trend_text(insights: dict) -> str:
    comparisons = insights.get("trend_summary", {}).get("comparisons", [])
    win_rate = next((c for c in comparisons if c.get("metric") == "win_rate"), None)
    rr_delta = next((c for c in comparisons if c.get("metric") == "avg_rr_change"), None)

    if win_rate and win_rate.get("delta") is not None:
        delta = float(win_rate["delta"])
        if delta > 0:
            return f"Win rate is improving (+{delta:.2f} percentage points vs baseline)."
        if delta < 0:
            return f"Win rate is slipping ({delta:.2f} percentage points vs baseline)."

    if rr_delta and rr_delta.get("delta") is not None:
        delta = float(rr_delta["delta"])
        if delta > 0:
            return f"Average RR change is improving (+{delta:.2f})."
        if delta < 0:
            return f"Average RR change is declining ({delta:.2f})."

    return "Trend is stable. Keep tracking session quality and recurring issues."


def _rank_context_text(profile: UserProfile | None, insights: dict, total_matches: int) -> str:
    target = profile.target_rank if profile and profile.target_rank else None
    if total_matches == 0:
        return (
            f"No match history yet. Import matches to start climbing toward {target}."
            if target
            else "No match history yet. Import matches to initialize climb context."
        )

    rr_change = insights.get("recent_form", {}).get("avg_rr_change")
    if rr_change is None:
        return (
            f"Recent ranked trend not available yet. Target rank: {target}."
            if target
            else "Recent ranked trend not available yet."
        )

    if rr_change > 0:
        base = f"Climb trend is positive (recent avg RR {rr_change:.2f})."
    elif rr_change < 0:
        base = f"Climb trend is negative (recent avg RR {rr_change:.2f})."
    else:
        base = "Climb trend is flat (recent avg RR 0.00)."

    if target:
        return f"{base} Target rank: {target}."
    return base


def _next_review_suggestion(db: Session, all_matches: list[Match]) -> str | None:
    if not all_matches:
        return "Import matches and generate your first review note."

    reviewed_match_ids = {
        match_id
        for match_id in db.scalars(select(ReviewNote.match_id).where(ReviewNote.match_id.is_not(None))).all()
        if match_id is not None
    }

    sorted_recent = sorted(all_matches, key=_match_sort_key, reverse=True)
    candidate = next((match for match in sorted_recent if match.id not in reviewed_match_ids), None)
    if candidate:
        return (
            f"Review untagged match #{candidate.id} "
            f"({candidate.map_name or 'Unknown map'} - {candidate.agent or 'Unknown agent'})."
        )

    return "All recent matches have notes. Revisit your most recurring issue in Review."


@router.get("/summary", response_model=HomeSummaryRead)
def home_summary(
    recent_window: int = Query(default=10, ge=3, le=50),
    db: Session = Depends(get_db),
) -> HomeSummaryRead:
    all_matches = db.scalars(select(Match)).all()
    insights = compute_insights(db=db, recent_window=recent_window)

    profile = db.scalar(select(UserProfile).order_by(UserProfile.id.asc()).limit(1))
    latest_report = db.scalar(
        select(CoachingReport)
        .order_by(CoachingReport.generated_at.desc(), CoachingReport.id.desc())
        .limit(1)
    )
    latest_progress = db.scalar(
        select(ProgressSnapshot)
        .order_by(ProgressSnapshot.snapshot_date.desc(), ProgressSnapshot.id.desc())
        .limit(1)
    )

    strongest_map = _pattern(_best_entry(insights.get("map_breakdowns", [])))
    weakest_map = _pattern(_worst_entry(insights.get("map_breakdowns", [])))
    strongest_agent = _pattern(_best_entry(insights.get("agent_breakdowns", [])))
    weakest_agent = _pattern(_worst_entry(insights.get("agent_breakdowns", [])))

    coaching_summary = None
    current_focus_area = None
    if latest_report is not None:
        current_focus_area = latest_report.priority_issue
        coaching_summary = CoachingHighlight(
            report_id=latest_report.id,
            generated_at=latest_report.generated_at,
            priority_issue=latest_report.priority_issue,
            stop_doing=latest_report.stop_doing,
            keep_doing=latest_report.keep_doing,
            next_action=latest_report.next_session_focus,
        )

    progress_highlight = None
    if latest_progress is not None:
        recommendation = _safe_load_dict(latest_progress.recommendation_effectiveness_json)
        progress_highlight = ProgressHighlight(
            snapshot_id=latest_progress.id,
            snapshot_date=latest_progress.snapshot_date,
            summary=latest_progress.summary,
            effectiveness_status=recommendation.get("status")
            if isinstance(recommendation.get("status"), str)
            else None,
        )

    counters = HomeCounters(
        total_matches=db.scalar(select(func.count(Match.id))) or 0,
        total_review_notes=db.scalar(select(func.count(ReviewNote.id))) or 0,
        total_coaching_reports=db.scalar(select(func.count(CoachingReport.id))) or 0,
        total_progress_snapshots=db.scalar(select(func.count(ProgressSnapshot.id))) or 0,
    )

    return HomeSummaryRead(
        generated_at=datetime.now(tz=timezone.utc),
        current_rank_context=_rank_context_text(profile, insights, counters.total_matches),
        recent_trend=_recent_trend_text(insights),
        strongest_map=strongest_map,
        weakest_map=weakest_map,
        strongest_agent=strongest_agent,
        weakest_agent=weakest_agent,
        current_focus_area=current_focus_area,
        next_review_suggestion=_next_review_suggestion(db, all_matches),
        coaching_summary=coaching_summary,
        progress_highlight=progress_highlight,
        counters=counters,
        quick_links=["/matches", "/insights", "/review", "/coach", "/progress", "/settings"],
    )
