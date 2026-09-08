from __future__ import annotations

import json
from collections import defaultdict
from datetime import timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CoachingReport, IssueTag, Match, ProgressSnapshot


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


def _recommendation_effectiveness(db: Session, all_matches: list[Match], window: int) -> dict:
    report = db.scalar(
        select(CoachingReport)
        .order_by(CoachingReport.generated_at.desc(), CoachingReport.id.desc())
        .limit(1)
    )
    if report is None:
        return {
            "evaluated": False,
            "status": "no_report",
            "report_id": None,
            "before_window_matches": 0,
            "after_window_matches": 0,
            "details": [],
            "note": "Generate at least one coaching report to evaluate effectiveness.",
        }

    before = [m for m in all_matches if m.played_at and report.generated_at and m.played_at < report.generated_at]
    after = [m for m in all_matches if m.played_at and report.generated_at and m.played_at >= report.generated_at]

    before = before[-window:]
    after = after[:window]

    if len(before) < 3 or len(after) < 3:
        return {
            "evaluated": False,
            "status": "insufficient_data",
            "report_id": report.id,
            "before_window_matches": len(before),
            "after_window_matches": len(after),
            "details": [],
            "note": "Need at least 3 matches before and after the latest coaching report.",
        }

    before_stats = _aggregate(before)
    after_stats = _aggregate(after)
    details = _metric_changes(after_stats, before_stats)

    positive = sum(1 for d in details if d["delta"] is not None and d["delta"] > 0)
    negative = sum(1 for d in details if d["delta"] is not None and d["delta"] < 0)

    status = "mixed"
    if positive > negative:
        status = "improving"
    elif negative > positive:
        status = "declining"

    return {
        "evaluated": True,
        "status": status,
        "report_id": report.id,
        "before_window_matches": len(before),
        "after_window_matches": len(after),
        "details": details,
        "note": "Compares matches immediately before vs after the latest coaching report.",
    }


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
    db: Session, recent_window: int = 10, previous_window: int = 10
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
    recommendation = _recommendation_effectiveness(db=db, all_matches=all_matches, window=recent_window)
    summary = _summary_text(metric_changes, issue_trends, recommendation)

    snapshot = ProgressSnapshot(
        metric_window=f"recent:{len(recent)}|previous:{len(previous)}",
        summary=summary,
        issue_trends_json=json.dumps(issue_trends),
        performance_change_json=json.dumps(metric_changes),
        recommendation_effectiveness_json=json.dumps(recommendation),
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot

