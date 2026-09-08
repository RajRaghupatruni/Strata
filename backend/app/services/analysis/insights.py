from __future__ import annotations

from collections import defaultdict
from datetime import timezone
from math import sqrt

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Match


def _normalize_result(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized == "win":
        return "win"
    if normalized == "loss":
        return "loss"
    if normalized == "draw":
        return "draw"
    return "other"


def _round(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value, 2)


def _mean(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def _std_dev(values: list[float]) -> float | None:
    if len(values) < 2:
        return None
    avg = sum(values) / len(values)
    variance = sum((value - avg) ** 2 for value in values) / len(values)
    return sqrt(variance)


def _match_sort_key(match: Match) -> tuple[int, int]:
    if match.played_at is None:
        return (0, match.id)

    played_at = match.played_at
    if played_at.tzinfo is None:
        played_at = played_at.replace(tzinfo=timezone.utc)
    return (int(played_at.timestamp()), match.id)


def _kda(match: Match) -> float | None:
    if match.kills is None or match.deaths is None:
        return None
    assists = match.assists or 0
    return (match.kills + assists) / max(match.deaths, 1)


def _aggregate(matches: list[Match]) -> dict:
    wins = 0
    losses = 0
    draws = 0
    acs_values: list[float] = []
    adr_values: list[float] = []
    kda_values: list[float] = []
    hs_values: list[float] = []
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
        if match.hs_percent is not None:
            hs_values.append(float(match.hs_percent))
        if match.rr_change is not None:
            rr_values.append(float(match.rr_change))

        kda = _kda(match)
        if kda is not None:
            kda_values.append(kda)

    total_matches = len(matches)
    return {
        "matches": total_matches,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "win_rate": _round((wins / total_matches) * 100) if total_matches else None,
        "avg_acs": _round(_mean(acs_values)),
        "avg_adr": _round(_mean(adr_values)),
        "avg_kda": _round(_mean(kda_values)),
        "avg_hs_percent": _round(_mean(hs_values)),
        "avg_rr_change": _round(_mean(rr_values)),
    }


def _build_breakdowns(matches: list[Match], key: str) -> list[dict]:
    groups: dict[str, list[Match]] = defaultdict(list)
    for match in matches:
        value = getattr(match, key, None)
        label = value if value else "Unknown"
        groups[label].append(match)

    entries: list[dict] = []
    for label, items in groups.items():
        aggregate = _aggregate(items)
        entries.append({"label": label, **aggregate})

    entries.sort(
        key=lambda item: (
            item["matches"],
            item["win_rate"] if item["win_rate"] is not None else -1.0,
        ),
        reverse=True,
    )
    return entries


def _trend_summary(recent_form: dict, baseline_form: dict, recent_window: int, baseline_window: int) -> dict:
    metric_keys = [
        "win_rate",
        "avg_acs",
        "avg_adr",
        "avg_kda",
        "avg_hs_percent",
        "avg_rr_change",
    ]
    comparisons: list[dict] = []

    for key in metric_keys:
        recent_value = recent_form.get(key)
        baseline_value = baseline_form.get(key)
        delta = None
        direction = "flat"
        if recent_value is not None and baseline_value is not None:
            delta = round(recent_value - baseline_value, 2)
            if delta > 0:
                direction = "up"
            elif delta < 0:
                direction = "down"

        comparisons.append(
            {
                "metric": key,
                "recent": recent_value,
                "baseline": baseline_value,
                "delta": delta,
                "direction": direction,
            }
        )

    return {
        "recent_window": recent_window,
        "baseline_window": baseline_window,
        "comparisons": comparisons,
    }


def _streak_summary(matches: list[Match]) -> dict:
    if not matches:
        return {
            "current_streak_type": "none",
            "current_streak_length": 0,
            "longest_win_streak": 0,
            "longest_loss_streak": 0,
        }

    results = [_normalize_result(match.result) for match in matches]

    longest_win = 0
    longest_loss = 0
    active_win = 0
    active_loss = 0

    for result in results:
        if result == "win":
            active_win += 1
            active_loss = 0
        elif result == "loss":
            active_loss += 1
            active_win = 0
        else:
            active_win = 0
            active_loss = 0

        longest_win = max(longest_win, active_win)
        longest_loss = max(longest_loss, active_loss)

    current_type = results[-1]
    current_length = 1
    for index in range(len(results) - 2, -1, -1):
        if results[index] != current_type:
            break
        current_length += 1

    return {
        "current_streak_type": current_type,
        "current_streak_length": current_length,
        "longest_win_streak": longest_win,
        "longest_loss_streak": longest_loss,
    }


def _volatility_summary(matches: list[Match]) -> dict:
    if len(matches) < 2:
        return {
            "acs_std_dev": None,
            "rr_std_dev": None,
            "result_switch_rate": None,
            "level": "insufficient_data",
        }

    acs_values = [float(match.acs) for match in matches if match.acs is not None]
    rr_values = [float(match.rr_change) for match in matches if match.rr_change is not None]
    results = [_normalize_result(match.result) for match in matches]
    transitions = len(results) - 1
    changes = sum(1 for index in range(1, len(results)) if results[index] != results[index - 1])
    switch_rate = changes / transitions if transitions else None

    acs_std = _std_dev(acs_values)
    rr_std = _std_dev(rr_values)

    if switch_rate is None:
        level = "insufficient_data"
    elif switch_rate < 0.25 and (acs_std is None or acs_std < 18):
        level = "low"
    elif switch_rate < 0.5 and (acs_std is None or acs_std < 35):
        level = "moderate"
    else:
        level = "high"

    return {
        "acs_std_dev": _round(acs_std),
        "rr_std_dev": _round(rr_std),
        "result_switch_rate": _round(switch_rate * 100) if switch_rate is not None else None,
        "level": level,
    }


def compute_insights(db: Session, recent_window: int = 10) -> dict:
    all_matches = db.scalars(select(Match)).all()
    all_matches.sort(key=_match_sort_key)

    if not all_matches:
        empty_aggregate = _aggregate([])
        return {
            "recent_form": empty_aggregate,
            "baseline_form": empty_aggregate,
            "trend_summary": {
                "recent_window": recent_window,
                "baseline_window": 0,
                "comparisons": [],
            },
            "streaks": _streak_summary([]),
            "volatility": _volatility_summary([]),
            "map_breakdowns": [],
            "agent_breakdowns": [],
            "role_breakdowns": [],
        }

    recent = all_matches[-recent_window:]
    baseline = all_matches[:-recent_window] if len(all_matches) > recent_window else []

    # Fall back to total history when there is no prior baseline yet.
    if not baseline:
        baseline = list(all_matches)

    recent_form = _aggregate(recent)
    baseline_form = _aggregate(baseline)

    return {
        "recent_form": recent_form,
        "baseline_form": baseline_form,
        "trend_summary": _trend_summary(
            recent_form=recent_form,
            baseline_form=baseline_form,
            recent_window=len(recent),
            baseline_window=len(baseline),
        ),
        "streaks": _streak_summary(all_matches),
        "volatility": _volatility_summary(recent),
        "map_breakdowns": _build_breakdowns(all_matches, "map_name"),
        "agent_breakdowns": _build_breakdowns(all_matches, "agent"),
        "role_breakdowns": _build_breakdowns(all_matches, "role"),
    }

