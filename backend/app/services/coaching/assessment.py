from __future__ import annotations

from typing import Any


def _clamp(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
    return max(lower, min(upper, value))


def _delta(insights: dict[str, Any], metric: str) -> float | None:
    for comparison in insights.get("trend_summary", {}).get("comparisons", []):
        if comparison.get("metric") == metric:
            value = comparison.get("delta")
            return float(value) if isinstance(value, (int, float)) else None
    return None


def _issue_penalty(recurring: list[dict[str, Any]], keywords: set[str]) -> float:
    penalty = 0.0
    for issue in recurring:
        category = str(issue.get("category") or "").lower()
        if not any(keyword in category for keyword in keywords):
            continue
        occurrences = float(issue.get("occurrences") or 0)
        high = float(issue.get("high_severity_occurrences") or 0)
        penalty += occurrences * 3.0 + high * 5.0
    return penalty


def build_performance_assessment(
    insights: dict[str, Any], recurring_issues: list[dict[str, Any]]
) -> dict[str, Any]:
    recent = insights.get("recent_form", {})
    win_rate = float(recent.get("win_rate") or 0)
    avg_acs = float(recent.get("avg_acs") or 0)
    avg_adr = float(recent.get("avg_adr") or 0)
    avg_rr = float(recent.get("avg_rr_change") or 0)
    volatility_level = str(insights.get("volatility", {}).get("level") or "insufficient_data")
    result_switch_rate = float(insights.get("volatility", {}).get("result_switch_rate") or 0)

    win_delta = _delta(insights, "win_rate") or 0.0
    acs_delta = _delta(insights, "avg_acs") or 0.0
    adr_delta = _delta(insights, "avg_adr") or 0.0
    rr_delta = _delta(insights, "avg_rr_change") or 0.0

    survivability_penalty = _issue_penalty(
        recurring_issues, {"early_death", "overpeek", "position", "trade"}
    )
    utility_penalty = _issue_penalty(recurring_issues, {"utility", "ability"})
    discipline_penalty = _issue_penalty(
        recurring_issues, {"tilt", "decision", "timeout", "discipline"}
    )

    consistency_score = 50 + win_delta * 2.0 + rr_delta * 4.0 - result_switch_rate * 0.45
    if volatility_level == "high":
        consistency_score -= 15
    elif volatility_level == "low":
        consistency_score += 8

    mechanics_score = 35 + avg_acs * 0.15 + avg_adr * 0.08 + acs_delta * 1.2 + adr_delta * 0.8
    survivability_score = 70 - survivability_penalty + win_rate * 0.2
    discipline_score = 68 - discipline_penalty - utility_penalty * 0.5 + rr_delta * 3
    impact_score = 35 + win_rate * 0.45 + avg_rr * 2.5 + rr_delta * 3.5

    dimensions = {
        "consistency": round(_clamp(consistency_score), 2),
        "mechanics": round(_clamp(mechanics_score), 2),
        "survivability": round(_clamp(survivability_score), 2),
        "discipline": round(_clamp(discipline_score), 2),
        "impact": round(_clamp(impact_score), 2),
    }

    weakest_dimension = min(dimensions.items(), key=lambda item: item[1])[0]
    strongest_dimension = max(dimensions.items(), key=lambda item: item[1])[0]

    return {
        "model": "strata_assessment_v1",
        "dimensions": dimensions,
        "weakest_dimension": weakest_dimension,
        "strongest_dimension": strongest_dimension,
        "inputs": {
            "win_rate": win_rate,
            "avg_acs": avg_acs,
            "avg_adr": avg_adr,
            "avg_rr_change": avg_rr,
            "win_delta": win_delta,
            "acs_delta": acs_delta,
            "adr_delta": adr_delta,
            "rr_delta": rr_delta,
            "volatility_level": volatility_level,
            "result_switch_rate": result_switch_rate,
            "recurring_issue_count": len(recurring_issues),
        },
    }

