"""Validate the Riot-like projection consumed by Strata, not the full Riot API DTO."""

from pydantic import BaseModel, Field


class MatchInfo(BaseModel):
    matchId: str = Field(min_length=1)
    gameStartMillis: int = Field(ge=0, le=253402300799999)
    mapId: str = Field(min_length=1)
    queueID: str | None = None
    gameMode: str | None = None
    seasonId: str | None = None


class PlayerStats(BaseModel):
    roundsPlayed: int = Field(gt=0)
    score: int | None = Field(default=None, ge=0)
    kills: int | None = Field(default=None, ge=0)
    deaths: int | None = Field(default=None, ge=0)
    assists: int | None = Field(default=None, ge=0)
    # Retain support for the earlier aggregate import projection.
    headshots: int | None = Field(default=None, ge=0)
    bodyshots: int | None = Field(default=None, ge=0)
    legshots: int | None = Field(default=None, ge=0)


class Player(BaseModel):
    puuid: str = Field(min_length=1)
    teamId: str
    characterId: str | None = None
    competitiveTier: int | None = None
    stats: PlayerStats | None = None


class Team(BaseModel):
    teamId: str
    won: bool | None = None
    roundsWon: int = Field(ge=0)
    roundsLost: int | None = Field(default=None, ge=0)


class Damage(BaseModel):
    receiver: str
    damage: int = Field(ge=0)
    headshots: int = Field(ge=0)
    bodyshots: int = Field(ge=0)
    legshots: int = Field(ge=0)


class RoundPlayerStats(BaseModel):
    puuid: str
    damage: list[Damage] | None = None


class RoundResult(BaseModel):
    roundNum: int = Field(ge=0)
    playerStats: list[RoundPlayerStats]


class RiotMatchPayload(BaseModel):
    matchInfo: MatchInfo
    players: list[Player] = Field(min_length=1)
    teams: list[Team] = Field(min_length=2)
    roundResults: list[RoundResult] | None = None
