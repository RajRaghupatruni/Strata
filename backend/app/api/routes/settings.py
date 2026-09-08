import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import UserProfile
from app.schemas.settings import UserProfileRead, UserProfileUpdate


router = APIRouter()


def _normalize_list(values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = raw.strip()
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(value)
    return normalized


def _safe_parse_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item).strip() for item in parsed if str(item).strip()]


def _safe_parse_notes(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {"personal_notes": raw}
    if not isinstance(parsed, dict):
        return {}
    return parsed


def _serialize_notes(
    personal_notes: str | None, known_weak_areas: list[str], improvement_priorities: list[str]
) -> str:
    payload = {
        "personal_notes": personal_notes,
        "known_weak_areas": known_weak_areas,
        "improvement_priorities": improvement_priorities,
    }
    return json.dumps(payload)


def _get_or_create_profile(db: Session) -> UserProfile:
    profile = db.scalar(select(UserProfile).order_by(UserProfile.id.asc()).limit(1))
    if profile is not None:
        return profile

    profile = UserProfile(display_name="Player")
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def _to_read(profile: UserProfile) -> UserProfileRead:
    notes = _safe_parse_notes(profile.notes)
    return UserProfileRead(
        id=profile.id,
        display_name=profile.display_name or "Player",
        target_rank=profile.target_rank,
        preferred_agents=_safe_parse_list(profile.preferred_agents),
        preferred_roles=_safe_parse_list(profile.preferred_roles),
        known_weak_areas=_normalize_list(
            [str(item) for item in notes.get("known_weak_areas", [])]
            if isinstance(notes.get("known_weak_areas"), list)
            else []
        ),
        improvement_priorities=_normalize_list(
            [str(item) for item in notes.get("improvement_priorities", [])]
            if isinstance(notes.get("improvement_priorities"), list)
            else []
        ),
        personal_notes=notes.get("personal_notes")
        if isinstance(notes.get("personal_notes"), str)
        else None,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get("/profile", response_model=UserProfileRead)
def get_profile(db: Session = Depends(get_db)) -> UserProfileRead:
    profile = _get_or_create_profile(db)
    return _to_read(profile)


@router.put("/profile", response_model=UserProfileRead)
def update_profile(payload: UserProfileUpdate, db: Session = Depends(get_db)) -> UserProfileRead:
    profile = _get_or_create_profile(db)

    preferred_agents = _normalize_list(payload.preferred_agents)
    preferred_roles = _normalize_list(payload.preferred_roles)
    known_weak_areas = _normalize_list(payload.known_weak_areas)
    improvement_priorities = _normalize_list(payload.improvement_priorities)

    profile.display_name = payload.display_name.strip()
    profile.target_rank = payload.target_rank.strip() if payload.target_rank else None
    profile.preferred_agents = json.dumps(preferred_agents)
    profile.preferred_roles = json.dumps(preferred_roles)
    profile.notes = _serialize_notes(
        personal_notes=payload.personal_notes.strip() if payload.personal_notes else None,
        known_weak_areas=known_weak_areas,
        improvement_priorities=improvement_priorities,
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _to_read(profile)
