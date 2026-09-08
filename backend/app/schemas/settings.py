from datetime import datetime

from pydantic import BaseModel, Field


class UserProfileRead(BaseModel):
    id: int
    display_name: str
    target_rank: str | None = None
    preferred_agents: list[str] = Field(default_factory=list)
    preferred_roles: list[str] = Field(default_factory=list)
    known_weak_areas: list[str] = Field(default_factory=list)
    improvement_priorities: list[str] = Field(default_factory=list)
    personal_notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UserProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    target_rank: str | None = Field(default=None, max_length=50)
    preferred_agents: list[str] = Field(default_factory=list)
    preferred_roles: list[str] = Field(default_factory=list)
    known_weak_areas: list[str] = Field(default_factory=list)
    improvement_priorities: list[str] = Field(default_factory=list)
    personal_notes: str | None = None

