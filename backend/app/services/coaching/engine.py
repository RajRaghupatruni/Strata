from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import CoachingReport, IssueTag, Match, ReviewNote, UserProfile
from app.services.analysis.insights import compute_insights
from app.services.coaching.ai_refiner import (
    generate_ai_first_coaching_report,
    maybe_refine_coaching_report,
)
from app.services.coaching.assessment import build_performance_assessment

ALLOWED_COACHING_MODES = {"deterministic", "hybrid", "ai_first"}


def _coaching_mode() -> str:
    mode = (settings.coaching_mode or "deterministic").strip().lower()
    if mode not in ALLOWED_COACHING_MODES:
        return "deterministic"
    return mode


def _match_sort_key(match: Match) -> tuple[int, int]:
    if match.played_at is None:
        return (0, match.id)
    played_at = match.played_at
    if played_at.tzinfo is None:
        played_at = played_at.replace(tzinfo=timezone.utc)
    return (int(played_at.timestamp()), match.id)


def _top_recurring_issues(db: Session, limit: int = 5) -> list[dict]:
    rows = db.execute(
        select(
            IssueTag.category,
            func.count(IssueTag.id).label("occurrences"),
            func.sum(case((IssueTag.severity.in_(["high", "critical"]), 1), else_=0)).label(
                "high_severity_occurrences"
            ),
        )
        .group_by(IssueTag.category)
        .order_by(func.count(IssueTag.id).desc(), IssueTag.category.asc())
        .limit(limit)
    ).all()
    return [
        {
            "category": row.category,
            "occurrences": int(row.occurrences or 0),
            "high_severity_occurrences": int(row.high_severity_occurrences or 0),
        }
        for row in rows
    ]


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


def _find_metric_delta(insights: dict, metric: str) -> float | None:
    for comparison in insights.get("trend_summary", {}).get("comparisons", []):
        if comparison.get("metric") == metric:
            return comparison.get("delta")
    return None


def _priority_issue(
    insights: dict, recurring: list[dict], assessment: dict | None = None
) -> tuple[str, str]:
    recent = insights.get("recent_form", {})
    win_rate = recent.get("win_rate")
    rr_delta = _find_metric_delta(insights, "avg_rr_change")
    win_delta = _find_metric_delta(insights, "win_rate")
    volatility = insights.get("volatility", {}).get("level")

    if assessment:
        weakest_dimension = assessment.get("weakest_dimension")
        if weakest_dimension in {"discipline", "consistency", "survivability"}:
            return (
                f"Assessment flags `{weakest_dimension}` as your weakest performance dimension right now.",
                f"assessment_{weakest_dimension}",
            )

    if recurring and recurring[0]["occurrences"] >= 2:
        issue = recurring[0]
        return (
            f"Recurring `{issue['category']}` mistakes ({issue['occurrences']} occurrences) are the top current leak.",
            issue["category"],
        )

    if win_rate is not None and win_rate < 50:
        return (
            f"Recent win rate is {win_rate:.1f}%, which is below stable climb pace.",
            "results_decline",
        )

    if rr_delta is not None and rr_delta < 0:
        return (
            f"Average RR delta is trending down ({rr_delta:.2f} vs baseline).",
            "rr_decline",
        )

    if win_delta is not None and win_delta < 0:
        return (
            f"Recent win rate trend is negative ({win_delta:.2f} percentage points).",
            "winrate_decline",
        )

    if volatility == "high":
        return (
            "Performance volatility is high, making ranked sessions inconsistent.",
            "high_volatility",
        )

    return (
        "No critical single leak detected; focus on preserving strengths while tightening consistency.",
        "consistency",
    )


def _stop_doing(priority_code: str, weakest_map: dict | None, recurring: list[dict]) -> str:
    if priority_code == "results_decline":
        return "Stop autopiloting queue sessions after back-to-back losses; pause after two losses and review one round."
    if priority_code == "rr_decline":
        return "Stop high-variance role/agent swapping between games until RR trend stabilizes."
    if priority_code == "winrate_decline":
        return "Stop forcing coin-flip fights in early rounds when utility/trade support is not ready."
    if priority_code == "high_volatility":
        return "Stop changing your game plan every match; commit to one opening plan and one fallback plan per half."
    if recurring:
        category = recurring[0]["category"]
        return f"Stop repeating `{category}` patterns without a pre-round checkpoint."
    if weakest_map:
        return f"Stop blind-queueing {weakest_map['label']} without a specific map plan."
    return "Stop queuing without defining one measurable focus before the first game."


def _keep_doing(strongest_agent: dict | None, strongest_map: dict | None, insights: dict) -> str:
    lines: list[str] = []
    if strongest_agent and strongest_agent.get("win_rate") is not None:
        lines.append(
            f"Keep leaning on {strongest_agent['label']} ({strongest_agent['win_rate']:.1f}% win rate over {strongest_agent['matches']} matches)."
        )
    if strongest_map and strongest_map.get("win_rate") is not None:
        lines.append(
            f"Keep your prep routine for {strongest_map['label']} ({strongest_map['win_rate']:.1f}% win rate)."
        )
    if not lines:
        lines.append(
            f"Keep your current baseline discipline: recent avg ACS {insights['recent_form'].get('avg_acs') or 'N/A'}."
        )
    return " ".join(lines)


def _improve_next(priority_code: str, weakest_map: dict | None, recurring: list[dict]) -> str:
    if recurring:
        category = recurring[0]["category"]
        return (
            f"Run a focused correction block on `{category}` in your next 5 games and log each occurrence in Review."
        )
    if weakest_map:
        return (
            f"Build a 3-point checklist for {weakest_map['label']} (default setup, first-contact rule, retake trigger)."
        )
    if priority_code == "high_volatility":
        return "Standardize your first 4 rounds on each side to reduce variance."
    return "Tighten decision quality in opening fights and track first-death patterns for one session."


def _next_session_focus(priority_code: str, recurring: list[dict]) -> str:
    focus_lines = [
        "1) Play one primary agent for the entire session.",
        "2) Queue only with a written focus objective.",
        "3) Review one loss immediately after session end.",
    ]

    if recurring:
        focus_lines[1] = (
            f"2) Hard-focus `{recurring[0]['category']}` prevention in every buy phase."
        )
    elif priority_code == "high_volatility":
        focus_lines[0] = "1) Use the same warmup + opening protocol each game."
    return "\n".join(focus_lines)


def _weekly_plan(priority_code: str, recurring: list[dict], profile: UserProfile | None) -> str:
    target_rank = profile.target_rank if profile and profile.target_rank else "your target rank"
    main_issue = recurring[0]["category"] if recurring else priority_code
    return (
        f"Mon-Tue: play 3 games/day with explicit `{main_issue}` tracking.\n"
        "Wed: VOD or round-note review session (minimum 30 min).\n"
        "Thu-Fri: apply one tactical adjustment from review notes.\n"
        f"Weekend: evaluate RR trend and consistency progress toward {target_rank}."
    )


def _serialize_match_for_ai(match: Match) -> dict[str, Any]:
    return {
        "id": match.id,
        "played_at": match.played_at.isoformat() if match.played_at else None,
        "map": match.map_name,
        "mode": match.mode,
        "agent": match.agent,
        "role": match.role,
        "result": match.result,
        "scoreline": match.scoreline,
        "kills": match.kills,
        "deaths": match.deaths,
        "assists": match.assists,
        "acs": match.acs,
        "adr": match.adr,
        "hs_percent": match.hs_percent,
        "rr_change": match.rr_change,
        "rank_at_time": match.rank_at_time,
    }


def _recent_review_notes_for_ai(db: Session, limit: int = 20) -> list[dict[str, Any]]:
    notes = db.scalars(
        select(ReviewNote)
        .order_by(ReviewNote.created_at.desc(), ReviewNote.id.desc())
        .limit(limit)
    ).all()
    payload: list[dict[str, Any]] = []
    for note in notes:
        payload.append(
            {
                "id": note.id,
                "match_id": note.match_id,
                "note_type": note.note_type,
                "summary": note.summary,
                "full_note": note.full_note,
                "created_at": note.created_at.isoformat() if note.created_at else None,
            }
        )
    return payload


def _profile_summary(profile: UserProfile | None) -> dict[str, Any]:
    if profile is None:
        return {"display_name": "Player", "target_rank": None, "preferred_agents": None, "preferred_roles": None, "notes": None}
    return {
        "display_name": profile.display_name,
        "target_rank": profile.target_rank,
        "preferred_agents": profile.preferred_agents,
        "preferred_roles": profile.preferred_roles,
        "notes": profile.notes,
    }


def _serialize_supporting_data(
    insights: dict,
    recurring: list[dict],
    priority_code: str,
    strongest_agent: dict | None,
    strongest_map: dict | None,
    weakest_map: dict | None,
    assessment: dict | None,
    ai_metadata: dict | None,
    generation_mode: str,
) -> str:
    payload = {
        "generator": "strata_coaching_v3",
        "generation_mode": generation_mode,
        "priority_code": priority_code,
        "recent_form": insights.get("recent_form"),
        "baseline_form": insights.get("baseline_form"),
        "trend_summary": insights.get("trend_summary"),
        "volatility": insights.get("volatility"),
        "top_recurring_issues": recurring,
        "strongest_agent": strongest_agent,
        "strongest_map": strongest_map,
        "weakest_map": weakest_map,
        "assessment": assessment,
        "ai_metadata": ai_metadata or {"used_ai": False},
    }
    return json.dumps(payload)


def generate_coaching_report(db: Session, recent_window: int = 10) -> CoachingReport:
    all_matches = db.scalars(select(Match)).all()
    all_matches.sort(key=_match_sort_key)
    if not all_matches:
        raise ValueError("No matches available. Import match data before generating coaching.")

    generation_mode = _coaching_mode()
    insights = compute_insights(db=db, recent_window=recent_window)
    recurring = _top_recurring_issues(db=db, limit=8)
    profile = db.scalar(select(UserProfile).order_by(UserProfile.id.asc()).limit(1))

    strongest_agent = _best_entry(insights.get("agent_breakdowns", []))
    strongest_map = _best_entry(insights.get("map_breakdowns", []))
    weakest_map = _worst_entry(insights.get("map_breakdowns", []))
    assessment = build_performance_assessment(insights=insights, recurring_issues=recurring)

    priority_issue_text: str
    stop_doing: str
    keep_doing: str
    improve_next: str
    next_session_focus: str
    weekly_plan: str
    ai_metadata: dict[str, Any]

    if generation_mode == "ai_first":
        recent_matches = [
            _serialize_match_for_ai(match) for match in all_matches[-recent_window:]
        ]
        review_notes = _recent_review_notes_for_ai(db=db, limit=20)
        ai_metadata = generate_ai_first_coaching_report(
            recent_window=recent_window,
            profile_summary=_profile_summary(profile),
            insights_summary=insights,
            recurring_issues=recurring,
            assessment=assessment,
            recent_matches=recent_matches,
            recent_review_notes=review_notes,
        )
        content = ai_metadata.get("content") if isinstance(ai_metadata, dict) else None
        if not isinstance(content, dict):
            raise ValueError("AI-first mode failed to return coaching content.")
        priority_issue_text = str(content.get("priority_issue") or "")
        stop_doing = str(content.get("stop_doing") or "")
        keep_doing = str(content.get("keep_doing") or "")
        improve_next = str(content.get("improve_next") or "")
        next_session_focus = str(content.get("next_session_focus") or "")
        weekly_plan = str(content.get("weekly_plan") or "")
        priority_code = "ai_primary"
    else:
        priority_issue_text, priority_code = _priority_issue(
            insights=insights, recurring=recurring, assessment=assessment
        )
        stop_doing = _stop_doing(
            priority_code=priority_code, weakest_map=weakest_map, recurring=recurring
        )
        keep_doing = _keep_doing(
            strongest_agent=strongest_agent, strongest_map=strongest_map, insights=insights
        )
        improve_next = _improve_next(
            priority_code=priority_code, weakest_map=weakest_map, recurring=recurring
        )
        next_session_focus = _next_session_focus(priority_code=priority_code, recurring=recurring)
        weekly_plan = _weekly_plan(priority_code=priority_code, recurring=recurring, profile=profile)

        ai_metadata = {
            "used_ai": False,
            "reason": "deterministic_mode",
            "mode": "deterministic",
        }
        if generation_mode == "hybrid":
            base_report = {
                "priority_issue": priority_issue_text,
                "stop_doing": stop_doing,
                "keep_doing": keep_doing,
                "improve_next": improve_next,
                "next_session_focus": next_session_focus,
                "weekly_plan": weekly_plan,
            }
            ai_refinement = maybe_refine_coaching_report(
                base_report=base_report,
                assessment=assessment,
                recurring_issues=recurring,
                insights_summary=insights,
            )
            ai_metadata = ai_refinement
            if ai_refinement.get("used_ai") and isinstance(ai_refinement.get("content"), dict):
                refined = ai_refinement["content"]
                priority_issue_text = refined.get("priority_issue") or priority_issue_text
                stop_doing = refined.get("stop_doing") or stop_doing
                keep_doing = refined.get("keep_doing") or keep_doing
                improve_next = refined.get("improve_next") or improve_next
                next_session_focus = refined.get("next_session_focus") or next_session_focus
                weekly_plan = refined.get("weekly_plan") or weekly_plan

    recent_matches = all_matches[-recent_window:]
    time_window_start = recent_matches[0].played_at if recent_matches else None
    time_window_end = recent_matches[-1].played_at if recent_matches else None
    if time_window_end is None:
        time_window_end = datetime.now(tz=timezone.utc)
    if time_window_start is None:
        time_window_start = time_window_end

    report = CoachingReport(
        time_window_start=time_window_start,
        time_window_end=time_window_end,
        priority_issue=priority_issue_text,
        stop_doing=stop_doing,
        keep_doing=keep_doing,
        improve_next=improve_next,
        next_session_focus=next_session_focus,
        weekly_plan=weekly_plan,
        supporting_data_json=_serialize_supporting_data(
            insights=insights,
            recurring=recurring,
            priority_code=priority_code,
            strongest_agent=strongest_agent,
            strongest_map=strongest_map,
            weakest_map=weakest_map,
            assessment=assessment,
            ai_metadata=ai_metadata,
            generation_mode=generation_mode,
        ),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
