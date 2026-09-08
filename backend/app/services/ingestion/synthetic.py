"""Supported offline adapter: fixed fictional payloads, shared Riot normalization."""

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.match import MatchImportItem
from app.services.ingestion.payloads import RiotMatchPayload
from app.services.ingestion.riot import normalize_riot_match


DEMO_FIXTURE = Path(__file__).resolve().parents[3] / "seeds" / "sample_matches.json"


class SyntheticFixture(BaseModel):
    source: Literal["synthetic"]
    dataset_version: Literal[1]
    description: str
    player_puuid: Literal["demo-na-player-0001"]
    region: Literal["na"]
    matches: list[RiotMatchPayload] = Field(min_length=30)


class SyntheticMatchProvider:
    def __init__(self, fixture_path: Path = DEMO_FIXTURE) -> None:
        self.fixture_path = fixture_path

    def load_matches(self) -> list[MatchImportItem]:
        fixture = SyntheticFixture.model_validate(
            json.loads(self.fixture_path.read_text(encoding="utf-8"))
        )
        items: list[MatchImportItem] = []
        seen: set[str] = set()
        for payload in fixture.matches:
            match_id = payload.matchInfo.matchId
            if not match_id.startswith("demo-na-match-") or match_id in seen:
                raise ValueError("Synthetic fixture must contain unique demo match IDs.")
            seen.add(match_id)
            item = normalize_riot_match(
                payload.model_dump(exclude_none=True),
                puuid=fixture.player_puuid,
                game_name="DemoPlayer",
                tag_line="DEMO",
                region=fixture.region,
                source="synthetic",
            )
            if item is None:
                raise ValueError("Synthetic match is missing the fictional focal player.")
            item.metadata["dataset_version"] = fixture.dataset_version
            items.append(item)
        return items
