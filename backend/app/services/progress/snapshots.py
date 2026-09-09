from __future__ import annotations

from collections import defaultdict
from datetime import timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import IssueTag, Match, ProgressSnapshot, Recommendation
from app.services.recommendations import evaluate_recommendation_effectiveness


def _match_sort_key(match: Match) -> tuple[int, int]:
    if match.played_at is None:
        return (0, match.id)
    played_at = match.played_at
    if played_at.tzinfo is None:
        played_at = played_at.replace(tzinfo=timezone.utc)
    return (int(played_at.timestamp()), match.id)


def _round(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value, 2)


def _mean(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def _normalize_result(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"win", "loss", "draw"}:
        return normalized
    return "other"


def _aggregate(matches: list[Match]) -> dict:
    wins = 0
    losses = 0
    draws = 0
    acs_values: list[float] = []
    adr_values: list[float] = []
    rr_values: list[float] = []

    for match in matches:
        result = _normalize_result(match.result)
        if result == "win":
            wins += 1
        elif result == "loss":
            losses += 1
        elif result == "draw":
            draws += 1

        if match.acs is not None:
            acs_values.append(float(match.acs))
        if match.adr is not None:
            adr_values.append(float(match.adr))
        if match.rr_change is not None:
            rr_values.append(float(match.rr_change))

    total = len(matches)
    return {
        "matches": total,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "win_rate": _round((wins / total) * 100) if total else None,
        "avg_acs": _round(_mean(acs_values)),
        "avg_adr": _round(_mean(adr_values)),
        "avg_rr_change": _round(_mean(rr_values)),
    }


def _metric_changes(recent: dict, previous: dict) -> list[dict]:
    metrics = ["win_rate", "avg_acs", "avg_adr", "avg_rr_change"]
    out: list[dict] = []
    for metric in metrics:
        recent_value = recent.get(metric)
        previous_value = previous.get(metric)
        delta = None
        direction = "flat"
        if recent_value is not None and previous_value is not None:
            delta = round(recent_value - previous_value, 2)
            if delta > 0:
                direction = "up"
            elif delta < 0:
                direction = "down"
        out.append(
            {
                "metric": metric,
                "recent": recent_value,
                "previous": previous_value,
                "delta": delta,
                "direction": direction,
            }
        )
    return out


def _issue_trends(db: Session, recent_match_ids: list[int], previous_match_ids: list[int]) -> list[dict]:
    rows = db.scalars(select(IssueTag).where(IssueTag.match_id.is_not(None))).all()
    recent_counts: dict[str, int] = defaultdict(int)
    previous_counts: dict[str, int] = defaultdict(int)
    recent_set = set(recent_match_ids)
    previous_set = set(previous_match_ids)

    for tag in rows:
        category = (tag.category or "unknown").strip().lower()
        if tag.match_id in recent_set:
            recent_counts[category] += 1
        elif tag.match_id in previous_set:
            previous_counts[category] += 1

    categories = sorted(set(recent_counts.keys()) | set(previous_counts.keys()))
    trends: list[dict] = []
    for category in categories:
        recent_count = recent_counts.get(category, 0)
        previous_count = previous_counts.get(category, 0)
        delta = recent_count - previous_count
        direction = "flat"
        if delta > 0:
            direction = "up"
        elif delta < 0:
            direction = "down"
        trends.append(
            {
                "category": category,
                "recent_count": recent_count,
                "previous_count": previous_count,
                "delta": delta,
                "direction": direction,
            }
        )
    trends.sort(key=lambda item: (item["recent_count"], item["previous_count"]), reverse=True)
    return trends


def _latest_recommendation(db: Session) -> Recommendation | None:
    return db.scalar(
        select(Recommendation)
        .order_by(Recommendation.active_at.desc(), Recommendation.id.desc())
        .limit(1)
    )


def _recommendation_effectiveness(db: Session, recommendation_id: int | None, window: int) -> dict:
    recommendation = db.get(Recommendation, recommendation_id) if recommendation_id else _latest_recommendation(db)
    if recommendation is None:
        return {
            "recommendation_id": None,
            "recommendation": "",
            "evaluation_metric": "none",
            "before_sample_size": 0,
            "after_sample_size": 0,
            "before_value": None,
            "after_value": None,
            "delta": None,
            "evidence_level": "insufficient_data",
            "outcome": "insufficient_data",
            "explanation": "Generate at least one coaching report to create a recommendation.",
            "status": "no_report",
        }

    result = evaluate_recommendation_effectiveness(
        db=db, recommendation_id=recommendation.id, sample_window=window
    )
    return {"status": result["outcome"], **result}


def _summary_text(metric_changes: list[dict], issue_trends: list[dict], recommendation: dict) -> str:
    win_rate_change = next((m for m in metric_changes if m["metric"] == "win_rate"), None)
    rr_change = next((m for m in metric_changes if m["metric"] == "avg_rr_change"), None)
    top_issue = issue_trends[0]["category"] if issue_trends else "none"
    recommendation_status = recommendation.get("status", "insufficient_data")

    return (
        f"Win rate delta: {win_rate_change['delta'] if win_rate_change else 'N/A'}; "
        f"RR delta: {rr_change['delta'] if rr_change else 'N/A'}; "
        f"Top recurring issue: {top_issue}; "
        f"Coaching effectiveness: {recommendation_status}."
    )


def generate_progress_snapshot(
    db: Session,
    recent_window: int = 10,
    previous_window: int = 10,
    recommendation_id: int | None = None,
) -> ProgressSnapshot:
    all_matches = db.scalars(select(Match)).all()
    all_matches.sort(key=_match_sort_key)
    if len(all_matches) < 3:
        raise ValueError("Need at least 3 matches to generate progress snapshot.")

    recent = all_matches[-recent_window:]
    previous = all_matches[-(recent_window + previous_window) : -recent_window]
    if len(previous) < 3:
        midpoint = max(1, len(all_matches) // 2)
        previous = all_matches[:midpoint]

    recent_aggregate = _aggregate(recent)
    previous_aggregate = _aggregate(previous)
    metric_changes = _metric_changes(recent_aggregate, previous_aggregate)
    issue_trends = _issue_trends(
        db=db,
        recent_match_ids=[m.id for m in recent],
        previous_match_ids=[m.id for m in previous],
    )
    recommendation = _recommendation_effectiveness(
        db=db, recommendation_id=recommendation_id, window=recent_window
    )
    summary = _summary_text(metric_changes, issue_trends, recommendation)

    snapshot = ProgressSnapshot(
        metric_window=f"recent:{len(recent)}|previous:{len(previous)}",
        summary=summary,
        issue_trends_json=issue_trends,
        performance_change_json=metric_changes,
        recommendation_effectiveness_json=recommendation,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot
