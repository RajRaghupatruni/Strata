from __future__ import annotations

import json
from typing import Any
from urllib import error, request

from app.core.config import settings


REQUIRED_REPORT_KEYS = (
    "priority_issue",
    "stop_doing",
    "keep_doing",
    "improve_next",
    "next_session_focus",
    "weekly_plan",
)


def _extract_json_object(text: str) -> dict[str, Any] | None:
    text = text.strip()
    if not text:
        return None

    # Attempt direct parse first.
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Fallback: parse first JSON object-like segment.
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


def _normalize_required_content(parsed: dict[str, Any]) -> dict[str, str] | None:
    if not set(REQUIRED_REPORT_KEYS).issubset(parsed.keys()):
        return None
    return {key: str(parsed.get(key) or "").strip() for key in REQUIRED_REPORT_KEYS}


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
    with request.urlopen(req, timeout=25) as response:
        content = response.read().decode("utf-8")
    return json.loads(content)


def _parse_chat_content(response: dict[str, Any]) -> tuple[dict[str, str] | None, str | None]:
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        return None, "invalid_response_no_choices"

    message = choices[0].get("message", {})
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str):
        return None, "invalid_response_no_content"

    parsed = _extract_json_object(content)
    if not parsed:
        return None, "invalid_json_content"

    normalized = _normalize_required_content(parsed)
    if not normalized:
        return None, "missing_required_keys"

    return normalized, None


def _guard_ai_configuration() -> dict[str, Any] | None:
    if not settings.coaching_ai_enabled:
        return {"used_ai": False, "reason": "ai_disabled"}
    if not settings.openai_api_key:
        return {"used_ai": False, "reason": "missing_openai_api_key"}
    return None


def maybe_refine_coaching_report(
    *,
    base_report: dict[str, Any],
    assessment: dict[str, Any],
    recurring_issues: list[dict[str, Any]],
    insights_summary: dict[str, Any],
) -> dict[str, Any]:
    guard = _guard_ai_configuration()
    if guard is not None:
        return guard

    instruction = (
        "You are a VALORANT performance coach. Improve the coaching guidance quality while staying grounded in data. "
        "Return STRICT JSON only with keys: priority_issue, stop_doing, keep_doing, improve_next, "
        "next_session_focus, weekly_plan. Keep each field concise and actionable."
    )
    context = {
        "base_report": base_report,
        "assessment": assessment,
        "top_recurring_issues": recurring_issues[:5],
        "recent_form": insights_summary.get("recent_form"),
        "baseline_form": insights_summary.get("baseline_form"),
        "trend_summary": insights_summary.get("trend_summary"),
        "volatility": insights_summary.get("volatility"),
    }
    payload = {
        "model": settings.openai_model,
        "temperature": 0.25,
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": json.dumps(context)},
        ],
        "max_tokens": 700,
    }

    try:
        response = _openai_chat_completion(payload)
        normalized, reason = _parse_chat_content(response)
        if normalized is None:
            return {"used_ai": False, "reason": reason}

        return {
            "used_ai": True,
            "provider": "openai",
            "model": settings.openai_model,
            "mode": "hybrid",
            "content": normalized,
        }
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        return {"used_ai": False, "reason": f"http_error_{exc.code}", "details": details}
    except Exception as exc:  # noqa: BLE001 - keep fallback robust for local use
        return {"used_ai": False, "reason": "exception", "details": str(exc)}


def generate_ai_first_coaching_report(
    *,
    recent_window: int,
    profile_summary: dict[str, Any],
    insights_summary: dict[str, Any],
    recurring_issues: list[dict[str, Any]],
    assessment: dict[str, Any],
    recent_matches: list[dict[str, Any]],
    recent_review_notes: list[dict[str, Any]],
) -> dict[str, Any]:
    guard = _guard_ai_configuration()
    if guard is not None:
        reason = str(guard.get("reason") or "ai_not_configured")
        raise ValueError(
            "AI-first coaching requires coaching_ai_enabled=true and a valid openai_api_key "
            f"(current: {reason})."
        )

    instruction = (
        "You are Strata, an elite VALORANT improvement coach. "
        "You must generate real-time insights from provided match and review evidence only. "
        "No generic filler. No references to hidden data. "
        "Return STRICT JSON with keys: priority_issue, stop_doing, keep_doing, improve_next, "
        "next_session_focus, weekly_plan."
    )

    context = {
        "request": {
            "recent_window": recent_window,
            "mode": "ai_first",
        },
        "profile": profile_summary,
        "insights": insights_summary,
        "assessment": assessment,
        "recurring_issues": recurring_issues[:8],
        "recent_matches": recent_matches[:20],
        "recent_review_notes": recent_review_notes[:20],
    }

    payload = {
        "model": settings.openai_model,
        "temperature": 0.45,
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": json.dumps(context)},
        ],
        "max_tokens": 900,
    }

    try:
        response = _openai_chat_completion(payload)
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise ValueError(f"OpenAI API error ({exc.code}): {details}") from exc
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"AI-first coaching failed: {exc}") from exc

    normalized, reason = _parse_chat_content(response)
    if normalized is None:
        raise ValueError(f"AI-first coaching returned invalid content ({reason}).")

    return {
        "used_ai": True,
        "provider": "openai",
        "model": settings.openai_model,
        "mode": "ai_first",
        "content": normalized,
    }
