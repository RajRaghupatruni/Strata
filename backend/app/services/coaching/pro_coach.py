from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from urllib import error, request

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import IssueTag, Match, ReviewNote, UserProfile
from app.services.analysis.insights import compute_insights


def _match_sort_key(match: Match) -> tuple[int, int]:
    if match.played_at is None:
        return (0, match.id)
    played_at = match.played_at
    if played_at.tzinfo is None:
        played_at = played_at.replace(tzinfo=timezone.utc)
    return (int(played_at.timestamp()), match.id)


def _openai_chat_completion(payload: dict[str, Any]) -> dict[str, Any]:
    base_url = settings.openai_base_url.rstrip("/")
    url = f"{base_url}/chat/completions"
    req = request.Request(
        url=url,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        data=json.dumps(payload).encode("utf-8"),
    )
    with request.urlopen(req, timeout=35) as response:
        content = response.read().decode("utf-8")
    return json.loads(content)


def _extract_json_object(text: str) -> dict[str, Any] | None:
    text = text.strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    candidate = text[start : end + 1]
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _top_recurring_issues(db: Session, limit: int = 8) -> list[dict[str, Any]]:
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


def _serialize_match(match: Match) -> dict[str, Any]:
    return {
        "id": match.id,
        "played_at": match.played_at.isoformat() if match.played_at else None,
        "map_name": match.map_name,
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


def _recent_notes(db: Session, limit: int = 20) -> list[dict[str, Any]]:
    notes = db.scalars(
        select(ReviewNote).order_by(ReviewNote.created_at.desc(), ReviewNote.id.desc()).limit(limit)
    ).all()
    return [
        {
            "id": note.id,
            "match_id": note.match_id,
            "note_type": note.note_type,
            "summary": note.summary,
            "full_note": note.full_note,
        }
        for note in notes
    ]


def _list_of_strings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned = [str(item).strip() for item in value if str(item).strip()]
    return cleaned[:8]


def _best_role_fit_from_insights(insights: dict[str, Any]) -> str:
    role_breakdowns = insights.get("role_breakdowns")
    if not isinstance(role_breakdowns, list) or not role_breakdowns:
        return "Role fit unavailable"
    first = role_breakdowns[0]
    if not isinstance(first, dict):
        return "Role fit unavailable"
    label = str(first.get("label") or "Unknown")
    win_rate = first.get("win_rate")
    if isinstance(win_rate, (int, float)):
        return f"{label} ({float(win_rate):.1f}% win rate)"
    return label


def _fallback_pro_brief(
    *,
    recent_window: int,
    insights: dict[str, Any],
    recurring: list[dict[str, Any]],
    target_match: Match | None,
) -> dict[str, Any]:
    recent = insights.get("recent_form", {})
    win_rate = recent.get("win_rate")
    avg_acs = recent.get("avg_acs")
    avg_rr = recent.get("avg_rr_change")

    strengths = []
    if isinstance(win_rate, (int, float)) and win_rate >= 55:
        strengths.append(f"You are converting games at {float(win_rate):.1f}% win rate in recent form.")
    if isinstance(avg_rr, (int, float)) and avg_rr > 0:
        strengths.append(f"Your RR trend is positive ({float(avg_rr):.2f} average change).")
    if isinstance(avg_acs, (int, float)) and avg_acs >= 200:
        strengths.append(f"Your frag impact is stable with ~{float(avg_acs):.1f} ACS.")
    if not strengths:
        strengths.append("Your sample is still stabilizing, but effort consistency is a positive sign.")

    weaknesses = []
    if recurring:
        weaknesses.append(
            f"Recurring issue `{recurring[0]['category']}` appears too often and is holding consistency back."
        )
    if isinstance(win_rate, (int, float)) and win_rate < 50:
        weaknesses.append("You are below stable climb pace, so your floor must improve first.")
    if isinstance(avg_acs, (int, float)) and avg_acs < 190:
        weaknesses.append("You are not creating enough consistent round impact on average.")
    if not weaknesses:
        weaknesses.append("Your inconsistency between games is currently the main blocker.")

    harsh_truths = [
        "Mechanical confidence without repeatable round structure will cap your rank.",
        "If your first 6 rounds are random, the rest of the match is damage control.",
        "You do not need more tricks; you need fewer mistakes repeated less often.",
    ]

    game_breakdown = None
    if target_match is not None:
        game_breakdown = {
            "match_id": target_match.id,
            "summary": "Specific match review is limited in fallback mode; enable AI for deeper tactical language.",
            "did_well": [
                f"Result: {target_match.result or 'N/A'}",
                f"K/D/A: {target_match.kills or 0}/{target_match.deaths or 0}/{target_match.assists or 0}",
            ],
            "cost_you_rounds": [
                "No round timeline data provided for detailed swing-round diagnosis.",
            ],
            "fix_next_time": [
                "Annotate 3 key lost rounds in Review to unlock better post-match coaching.",
            ],
        }

    return {
        "generated_at": datetime.now(tz=timezone.utc),
        "recent_window": recent_window,
        "profile_focus": "Professional baseline coaching (fallback mode).",
        "best_role_fit": _best_role_fit_from_insights(insights),
        "what_you_do_well": strengths,
        "what_is_holding_you_back": weaknesses,
        "harsh_truths": harsh_truths,
        "priority_improvements": [
            "Track first-death rounds and target a 20% reduction this week.",
            "Play one primary role for a full session block to reduce volatility.",
            "After each loss, write one tactical correction before queueing again.",
        ],
        "next_match_plan": [
            "Warmup: 15 minutes with one clear focus (crosshair placement or peek timing).",
            "In game: run a consistent opening protocol for first 4 rounds each side.",
            "Post game: log 2 good decisions and 2 repeated mistakes immediately.",
        ],
        "weekly_program": [
            "Mon-Tue: 3 ranked games/day with one focus metric tracked.",
            "Wed: 30-minute VOD and utility review.",
            "Thu-Fri: apply one tactical adjustment from review.",
            "Weekend: compare outcomes against your tracked metric and adjust.",
        ],
        "evidence_points": [
            f"Recent win rate: {win_rate if win_rate is not None else 'N/A'}",
            f"Recent avg ACS: {avg_acs if avg_acs is not None else 'N/A'}",
            f"Recent avg RR change: {avg_rr if avg_rr is not None else 'N/A'}",
        ],
        "specific_game_breakdown": game_breakdown,
    }


def generate_pro_coaching_brief(
    db: Session,
    *,
    recent_window: int = 10,
    match_id: int | None = None,
) -> dict[str, Any]:
    all_matches = db.scalars(select(Match)).all()
    all_matches.sort(key=_match_sort_key)
    if not all_matches:
        raise ValueError("No matches available. Import match data before generating pro coaching.")

    recent_matches = all_matches[-recent_window:]
    insights = compute_insights(db=db, recent_window=recent_window)
    recurring = _top_recurring_issues(db=db, limit=8)
    profile = db.scalar(select(UserProfile).order_by(UserProfile.id.asc()).limit(1))
    notes = _recent_notes(db=db, limit=20)

    target_match = None
    target_notes: list[dict[str, Any]] = []
    target_tags: list[dict[str, Any]] = []

    if match_id is not None:
        target_match = db.scalar(select(Match).where(Match.id == match_id))
        if target_match is None:
            raise ValueError(f"Match id {match_id} not found.")

        note_rows = db.scalars(
            select(ReviewNote)
            .where(ReviewNote.match_id == match_id)
            .order_by(ReviewNote.created_at.desc(), ReviewNote.id.desc())
            .limit(20)
        ).all()
        target_notes = [
            {
                "id": row.id,
                "note_type": row.note_type,
                "summary": row.summary,
                "full_note": row.full_note,
            }
            for row in note_rows
        ]

        tag_rows = db.scalars(
            select(IssueTag)
            .where(IssueTag.match_id == match_id)
            .order_by(IssueTag.created_at.desc(), IssueTag.id.desc())
            .limit(25)
        ).all()
        target_tags = [
            {
                "category": row.category,
                "severity": row.severity,
                "round_reference": row.round_reference,
                "description": row.description,
            }
            for row in tag_rows
        ]

    if not settings.coaching_ai_enabled or not settings.openai_api_key:
        return _fallback_pro_brief(
            recent_window=recent_window,
            insights=insights,
            recurring=recurring,
            target_match=target_match,
        )

    profile_summary = {
        "display_name": profile.display_name if profile else "Player",
        "target_rank": profile.target_rank if profile else None,
        "preferred_agents": profile.preferred_agents if profile else None,
        "preferred_roles": profile.preferred_roles if profile else None,
        "notes": profile.notes if profile else None,
    }

    context = {
        "profile": profile_summary,
        "insights": insights,
        "recurring_issues": recurring,
        "recent_matches": [_serialize_match(match) for match in recent_matches],
        "recent_review_notes": notes,
        "specific_game": _serialize_match(target_match) if target_match else None,
        "specific_game_notes": target_notes,
        "specific_game_issue_tags": target_tags,
    }

    instruction = (
        "You are an elite professional VALORANT coach. "
        "Give specific, personal, direct feedback like a coach speaking to one player. "
        "Be honest and include harsh truths, but keep it constructive and actionable. "
        "Avoid generic advice and avoid repeating obvious stats without interpretation. "
        "Ground every point in the provided context. "
        "Return STRICT JSON with these keys exactly: "
        "profile_focus (string), best_role_fit (string), what_you_do_well (array of strings), "
        "what_is_holding_you_back (array of strings), harsh_truths (array of strings), "
        "priority_improvements (array of strings), next_match_plan (array of strings), "
        "weekly_program (array of strings), evidence_points (array of strings), "
        "specific_game_breakdown (object or null). "
        "If specific_game is present, specific_game_breakdown object must include: match_id, summary, did_well, cost_you_rounds, fix_next_time."
    )

    payload = {
        "model": settings.openai_model,
        "temperature": 0.5,
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": json.dumps(context)},
        ],
        "max_tokens": 1300,
    }

    try:
        response = _openai_chat_completion(payload)
        choices = response.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ValueError("AI response missing choices.")
        message = choices[0].get("message", {})
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str):
            raise ValueError("AI response missing text content.")
        parsed = _extract_json_object(content)
        if not parsed:
            raise ValueError("AI response is not valid JSON.")

        result = {
            "generated_at": datetime.now(tz=timezone.utc),
            "recent_window": recent_window,
            "profile_focus": str(parsed.get("profile_focus") or "").strip(),
            "best_role_fit": str(parsed.get("best_role_fit") or "").strip(),
            "what_you_do_well": _list_of_strings(parsed.get("what_you_do_well")),
            "what_is_holding_you_back": _list_of_strings(parsed.get("what_is_holding_you_back")),
            "harsh_truths": _list_of_strings(parsed.get("harsh_truths")),
            "priority_improvements": _list_of_strings(parsed.get("priority_improvements")),
            "next_match_plan": _list_of_strings(parsed.get("next_match_plan")),
            "weekly_program": _list_of_strings(parsed.get("weekly_program")),
            "evidence_points": _list_of_strings(parsed.get("evidence_points")),
            "specific_game_breakdown": None,
        }

        breakdown = parsed.get("specific_game_breakdown")
        if isinstance(breakdown, dict):
            result["specific_game_breakdown"] = {
                "match_id": int(breakdown.get("match_id") or (match_id or 0)),
                "summary": str(breakdown.get("summary") or "").strip(),
                "did_well": _list_of_strings(breakdown.get("did_well")),
                "cost_you_rounds": _list_of_strings(breakdown.get("cost_you_rounds")),
                "fix_next_time": _list_of_strings(breakdown.get("fix_next_time")),
            }

        if not result["profile_focus"] or not result["best_role_fit"]:
            raise ValueError("AI response missing core guidance fields.")

        return result
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise ValueError(f"OpenAI API error ({exc.code}): {details}") from exc
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Failed to generate pro coaching brief: {exc}") from exc
