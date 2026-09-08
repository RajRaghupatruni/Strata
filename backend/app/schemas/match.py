from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_match_id: str | None = None
    played_at: datetime | None = None
    map_name: str | None = None
    mode: str | None = None
    agent: str | None = None
    role: str | None = None
    result: str | None = None
    scoreline: str | None = None
    kills: int | None = None
    deaths: int | None = None
    assists: int | None = None
    adr: float | None = None
    acs: int | None = None
    hs_percent: float | None = None
    rr_change: int | None = None
    rank_at_time: str | None = None
    session_id: str | None = None
    metadata: dict[str, Any] | None = None
    review_note_count: int | None = None


class MatchImportItem(BaseModel):
    external_match_id: str | None = None
    played_at: datetime
    map_name: str
    mode: str | None = None
    agent: str
    role: str | None = None
    result: str
    scoreline: str | None = None
    kills: int | None = Field(default=None, ge=0)
    deaths: int | None = Field(default=None, ge=0)
    assists: int | None = Field(default=None, ge=0)
    adr: float | None = Field(default=None, ge=0)
    acs: int | None = Field(default=None, ge=0)
    hs_percent: float | None = Field(default=None, ge=0, le=100)
    rr_change: int | None = None
    rank_at_time: str | None = None
    session_id: str | None = None
    metadata: dict[str, Any] | None = None


class MatchImportRequest(BaseModel):
    matches: list[MatchImportItem]


class MatchImportResponse(BaseModel):
    total_received: int
    inserted: int
    skipped_duplicates: int


class MatchListResponse(BaseModel):
    total: int
    matches: list[MatchRead]


class RiotImportRequest(BaseModel):
    game_name: str = Field(min_length=1, max_length=32)
    tag_line: str = Field(min_length=1, max_length=8)
    region: str = Field(default="na", min_length=2, max_length=16)
    max_matches: int = Field(default=10, ge=1, le=50)


class RiotImportResponse(BaseModel):
    game_name: str
    tag_line: str
    region: str
    player_puuid: str
    total_fetched_match_ids: int
    total_mapped_matches: int
    inserted: int
    skipped_duplicates: int
