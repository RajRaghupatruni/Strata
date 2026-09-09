from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import IssueTag, Match, Recommendation, ReviewNote
from app.schemas.recommendation import RecommendationRead
from app.core.observability import RECOMMENDATION_EVALUATION_DURATION, timed


MIN_DIRECTIONAL_SAMPLES = 3
MIN_SUPPORTED_SAMPLES = 5


def recommendation_to_read(row: Recommendation) -> RecommendationRead:
    return RecommendationRead(
        id=row.id,
        coaching_report_id=row.coaching_report_id,
        code=row.code,
        category=row.category,
        title=row.title,
        action=row.action,
        evidence_summary=row.evidence_summary,
        target_issue_category=row.target_issue_category,
        target_metric=row.target_metric,
        status=row.status,
        active_at=row.active_at,
        created_at=row.created_at,
        completed_at=row.completed_at,
        evaluated_at=row.evaluated_at,
        evaluation_summary=row.evaluation_summary_json,
    )


def _match_sort_key(match: Match) -> tuple[int, int]:
    if match.played_at is None:
        return (0, match.id)
    played_at = match.played_at
    if played_at.tzinfo is None:
        played_at = played_at.replace(tzinfo=timezone.utc)
    return (int(played_at.timestamp()), match.id)


def _as_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _round(value: float | None) -> float | None:
    return round(value, 2) if value is not None else None


def _sample_level(before_size: int, after_size: int) -> str:
    if before_size < MIN_DIRECTIONAL_SAMPLES or after_size < MIN_DIRECTIONAL_SAMPLES:
        return "insufficient_data"
    if before_size >= MIN_SUPPORTED_SAMPLES and after_size >= MIN_SUPPORTED_SAMPLES:
        return "supported"
    return "directional"


def _windowed_matches(
    matches: list[Match], active_at: datetime, sample_window: int
) -> tuple[list[Match], list[Match]]:
    active_at = _as_aware(active_at)
    before = [
        match
        for match in matches
        if match.played_at is not None and _as_aware(match.played_at) < active_at
    ]
    after = [
        match
        for match in matches
        if match.played_at is not None and _as_aware(match.played_at) >= active_at
    ]
    return before[-sample_window:], after[:sample_window]


def _issue_recurrence_evaluation(
    db: Session, recommendation: Recommendation, matches: list[Match], sample_window: int
) -> dict[str, Any]:
    category = (recommendation.target_issue_category or "").strip().lower()
    before, after = _windowed_matches(matches, recommendation.active_at, sample_window)
    reviewed_ids = {
        value
        for value in db.scalars(select(ReviewNote.match_id).where(ReviewNote.match_id.is_not(None))).all()
        if value is not None
    }
    before_reviewed = [match for match in before if match.id in reviewed_ids]
    after_reviewed = [match for match in after if match.id in reviewed_ids]

    before_ids = {match.id for match in before_reviewed}
    after_ids = {match.id for match in after_reviewed}
    tagged_ids = {
        value
        for value in db.scalars(
            select(IssueTag.match_id).where(
                IssueTag.match_id.is_not(None),
                IssueTag.category == category,
            )
        ).all()
        if value is not None
    }
    before_occurrences = len(before_ids & tagged_ids)
    after_occurrences = len(after_ids & tagged_ids)
    before_size = len(before_reviewed)
    after_size = len(after_reviewed)
    before_value = before_occurrences / before_size if before_size else None
    after_value = after_occurrences / after_size if after_size else None
    evidence_level = _sample_level(before_size, after_size)

    delta = None
    outcome = "insufficient_data"
    if evidence_level != "insufficient_data" and before_value is not None and after_value is not None:
        delta = after_value - before_value
        if delta <= -0.15:
            outcome = "effective"
        elif delta >= 0.15:
            outcome = "ineffective"
        else:
            outcome = "inconclusive"

    before_pct = _round(before_value * 100) if before_value is not None else None
    after_pct = _round(after_value * 100) if after_value is not None else None
    if outcome == "insufficient_data":
        explanation = (
            f"Need at least {MIN_DIRECTIONAL_SAMPLES} reviewed matches before and after "
            f"the recommendation; found {before_size} before and {after_size} after."
        )
    else:
        explanation = (
            f"{category} occurred in {before_occurrences}/{before_size} reviewed matches "
            f"before ({before_pct}%) and {after_occurrences}/{after_size} after ({after_pct}%)."
        )

    return {
        "recommendation_id": recommendation.id,
        "recommendation": recommendation.title,
        "evaluation_metric": f"issue_recurrence:{category}",
        "before_sample_size": before_size,
        "after_sample_size": after_size,
        "before_value": _round(before_value),
        "after_value": _round(after_value),
        "delta": _round(delta),
        "evidence_level": evidence_level,
        "outcome": outcome,
        "explanation": explanation,
        "before_occurrences": before_occurrences,
        "after_occurrences": after_occurrences,
        "details": {
            "sample_window": sample_window,
            "minimum_directional_samples": MIN_DIRECTIONAL_SAMPLES,
            "minimum_supported_samples": MIN_SUPPORTED_SAMPLES,
        },
    }


def _metric_value(metric: str, matches: list[Match]) -> tuple[float | None, int]:
    values: list[float] = []
    if metric == "win_rate":
        eligible = [m for m in matches if (m.result or "").strip().lower() in {"win", "loss", "draw"}]
        wins = sum(1 for match in eligible if (match.result or "").strip().lower() == "win")
        return ((wins / len(eligible)) * 100 if eligible else None), len(eligible)
    if metric == "avg_acs":
        values = [float(match.acs) for match in matches if match.acs is not None]
    elif metric == "avg_adr":
        values = [float(match.adr) for match in matches if match.adr is not None]
    elif metric in {"avg_kda", "kda", "kd", "kill_death_ratio"}:
        for match in matches:
            if match.kills is not None and match.deaths is not None:
                values.append(float(match.kills) / max(float(match.deaths), 1.0))
    elif metric == "avg_rr_change":
        values = [float(match.rr_change) for match in matches if match.rr_change is not None]
    return (sum(values) / len(values) if values else None), len(values)


def _metric_threshold(metric: str) -> float:
    if metric == "win_rate":
        return 5.0
    if metric == "avg_acs":
        return 8.0
    if metric == "avg_adr":
        return 5.0
    if metric in {"avg_kda", "kda", "kd", "kill_death_ratio"}:
        return 0.1
    if metric == "avg_rr_change":
        return 2.0
    return 0.0


def _performance_metric_evaluation(
    recommendation: Recommendation, matches: list[Match], sample_window: int
) -> dict[str, Any]:
    metric = (recommendation.target_metric or "win_rate").strip().lower()
    before, after = _windowed_matches(matches, recommendation.active_at, sample_window)
    before_value, before_size = _metric_value(metric, before)
    after_value, after_size = _metric_value(metric, after)
    evidence_level = _sample_level(before_size, after_size)

    delta = None
    outcome = "insufficient_data"
    if evidence_level != "insufficient_data" and before_value is not None and after_value is not None:
        delta = after_value - before_value
        threshold = _metric_threshold(metric)
        if delta >= threshold:
            outcome = "effective"
        elif delta <= -threshold:
            outcome = "ineffective"
        else:
            outcome = "inconclusive"

    if outcome == "insufficient_data":
        explanation = (
            f"Need at least {MIN_DIRECTIONAL_SAMPLES} matches with {metric} before and after "
            f"the recommendation; found {before_size} before and {after_size} after."
        )
    else:
        explanation = (
            f"{metric} moved from {_round(before_value)} before to {_round(after_value)} "
            f"after, a delta of {_round(delta)}."
        )

    return {
        "recommendation_id": recommendation.id,
        "recommendation": recommendation.title,
        "evaluation_metric": metric,
        "before_sample_size": before_size,
        "after_sample_size": after_size,
        "before_value": _round(before_value),
        "after_value": _round(after_value),
        "delta": _round(delta),
        "evidence_level": evidence_level,
        "outcome": outcome,
        "explanation": explanation,
        "before_occurrences": None,
        "after_occurrences": None,
        "details": {
            "sample_window": sample_window,
            "minimum_directional_samples": MIN_DIRECTIONAL_SAMPLES,
            "minimum_supported_samples": MIN_SUPPORTED_SAMPLES,
        },
    }


@timed(RECOMMENDATION_EVALUATION_DURATION)
def evaluate_recommendation_effectiveness(
    db: Session, recommendation_id: int, sample_window: int = 10
) -> dict[str, Any]:
    recommendation = db.get(Recommendation, recommendation_id)
    if recommendation is None:
        raise ValueError("Recommendation not found.")

    matches = db.scalars(select(Match)).all()
    matches.sort(key=_match_sort_key)

    if recommendation.target_issue_category:
        result = _issue_recurrence_evaluation(
            db=db,
            recommendation=recommendation,
            matches=matches,
            sample_window=sample_window,
        )
    else:
        result = _performance_metric_evaluation(
            recommendation=recommendation, matches=matches, sample_window=sample_window
        )

    recommendation.evaluated_at = datetime.now(tz=timezone.utc)
    recommendation.evaluation_summary_json = result
    if result["outcome"] in {"effective", "ineffective", "inconclusive"}:
        recommendation.status = result["outcome"]
    db.add(recommendation)
    return result
