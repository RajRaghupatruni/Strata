from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib import error, parse, request

from pydantic import ValidationError

from app.schemas.match import MatchImportItem
from app.services.ingestion.payloads import RiotMatchPayload


VAL_REGIONS = {"na", "eu", "ap", "kr", "latam", "br", "esports"}
AGENT_ROLES = {
    "Jett": "Duelist",
    "Omen": "Controller",
    "Sova": "Initiator",
    "Killjoy": "Sentinel",
}


class RiotApiError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


@dataclass
class RiotIngestionResult:
    player_puuid: str
    fetched_match_ids: list[str]
    mapped_matches: list[MatchImportItem]


def _normalize_region(region: str) -> str:
    normalized = (region or "").strip().lower()
    if normalized not in VAL_REGIONS:
        raise RiotApiError(
            status_code=400,
            message=(
                "Invalid region. Allowed regions: na, eu, ap, kr, latam, br, esports."
            ),
        )
    return normalized


def _account_route_for_region(val_region: str) -> str:
    if val_region in {"na", "latam", "br", "esports"}:
        return "americas"
    if val_region in {"eu"}:
        return "europe"
    return "asia"


def _request_json(url: str, api_key: str) -> dict[str, Any]:
    req = request.Request(
        url,
        method="GET",
        headers={
            "X-Riot-Token": api_key,
            "User-Agent": "Strata/0.1.0 (local)",
        },
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload) if payload else {}
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="ignore")
        details = raw.strip() or exc.reason
        raise RiotApiError(status_code=exc.code, message=f"Riot API error ({exc.code}): {details}")
    except error.URLError as exc:
        raise RiotApiError(status_code=502, message=f"Unable to reach Riot API: {exc.reason}")


def _extract_history_ids(matchlist_response: dict[str, Any]) -> list[str]:
    if isinstance(matchlist_response.get("history"), list):
        return [
            str(entry["matchId"] if isinstance(entry, dict) else entry)
            for entry in matchlist_response["history"]
            if (isinstance(entry, dict) and entry.get("matchId"))
            or isinstance(entry, str)
        ]
    if isinstance(matchlist_response.get("matchIds"), list):
        return [str(match_id) for match_id in matchlist_response["matchIds"]]
    return []


def _find_player(match_payload: dict[str, Any], puuid: str) -> dict[str, Any] | None:
    players = match_payload.get("players")
    if not isinstance(players, list):
        return None
    for player in players:
        if isinstance(player, dict) and str(player.get("puuid")) == puuid:
            return player
    return None


def _extract_name(resource_id: str | None, fallback: str) -> str:
    if not resource_id:
        return fallback
    value = resource_id.split("/")[-1].replace("%20", " ").replace("_", " ").strip()
    return value or fallback


def _player_result_and_scoreline(match_payload: dict[str, Any], player: dict[str, Any]) -> tuple[str, str | None]:
    teams = match_payload.get("teams")
    if not isinstance(teams, list):
        return ("draw", None)

    team_id = str(player.get("teamId") or "")
    own_team = None
    enemy_team = None
    for team in teams:
        if not isinstance(team, dict):
            continue
        if str(team.get("teamId")) == team_id:
            own_team = team
        else:
            enemy_team = team

    if own_team is None:
        return ("draw", None)

    won = own_team.get("won")
    if won is True:
        result = "win"
    elif won is False:
        result = "loss"
    else:
        result = "draw"

    own_won = own_team.get("roundsWon")
    own_lost = own_team.get("roundsLost")
    if isinstance(own_won, int) and isinstance(own_lost, int):
        return (result, f"{own_won}-{own_lost}")

    if enemy_team and isinstance(own_won, int) and isinstance(enemy_team.get("roundsWon"), int):
        return (result, f"{own_won}-{enemy_team['roundsWon']}")

    return (result, None)


def normalize_riot_match(
    match_payload: dict[str, Any],
    puuid: str,
    game_name: str,
    tag_line: str,
    region: str,
    *,
    source: str = "riot_api",
) -> MatchImportItem | None:
    # Both adapters validate here before deriving any internal fields. Unknown
    # upstream fields are ignored; this is a consumed projection of the Riot DTO.
    match_payload = RiotMatchPayload.model_validate(match_payload).model_dump(exclude_none=True)
    metadata = match_payload.get("matchInfo") if isinstance(match_payload.get("matchInfo"), dict) else {}
    player = _find_player(match_payload, puuid)
    if player is None:
        return None

    stats = player.get("stats") if isinstance(player.get("stats"), dict) else {}
    rounds_played = stats.get("roundsPlayed")
    score = stats.get("score")
    headshots = stats.get("headshots")
    bodyshots = stats.get("bodyshots")
    legshots = stats.get("legshots")
    total_shots = 0
    if isinstance(headshots, int):
        total_shots += headshots
    if isinstance(bodyshots, int):
        total_shots += bodyshots
    if isinstance(legshots, int):
        total_shots += legshots

    hs_percent = None
    if isinstance(headshots, int) and total_shots > 0:
        hs_percent = round((headshots / total_shots) * 100, 2)

    adr = None
    round_results = match_payload.get("roundResults", [])
    # Only derive round metrics when every played round has this player's data.
    # Missing round evidence remains unknown, rather than becoming an invented zero.
    round_numbers = [round_result["roundNum"] for round_result in round_results]
    round_stats = [
        next((entry for entry in row["playerStats"] if entry["puuid"] == puuid), None)
        for row in round_results
    ]
    if (
        rounds_played
        and len(round_stats) == rounds_played
        and len(set(round_numbers)) == rounds_played
        and all(row is not None and "damage" in row for row in round_stats)
    ):
        damage = [hit for row in round_stats for hit in row["damage"]]
        adr = round(sum(hit["damage"] for hit in damage) / rounds_played, 2)
        landed_hits = sum(hit["headshots"] + hit["bodyshots"] + hit["legshots"] for hit in damage)
        hs_percent = (
            round(sum(hit["headshots"] for hit in damage) / landed_hits * 100, 2)
            if landed_hits else None
        )

    # Required by payload validation: never substitute the wall clock for missing evidence.
    played_at = datetime.fromtimestamp(metadata["gameStartMillis"] / 1000, tz=timezone.utc)

    result, scoreline = _player_result_and_scoreline(match_payload, player)
    agent = _extract_name(player.get("characterId"), "Unknown Agent")
    map_name = _extract_name(metadata.get("mapId"), "Unknown Map")
    mode = (
        str(metadata.get("queueID"))
        if metadata.get("queueID") is not None
        else str(metadata.get("gameMode") or "Unknown")
    )

    acs = None
    if isinstance(score, int) and isinstance(rounds_played, int) and rounds_played > 0:
        acs = round(score / rounds_played)

    rank_value = player.get("competitiveTier")
    rank_at_time = str(rank_value) if rank_value is not None else None

    match_id = str(metadata.get("matchId") or "")
    if not match_id:
        return None

    session_id = f"{'demo' if source == 'synthetic' else 'riot'}-{played_at.date().isoformat()}"

    return MatchImportItem(
        external_match_id=match_id,
        played_at=played_at,
        map_name=map_name,
        mode=mode,
        agent=agent,
        role=AGENT_ROLES.get(agent),
        result=result,
        scoreline=scoreline,
        kills=stats.get("kills") if isinstance(stats.get("kills"), int) else None,
        deaths=stats.get("deaths") if isinstance(stats.get("deaths"), int) else None,
        assists=stats.get("assists") if isinstance(stats.get("assists"), int) else None,
        adr=adr,
        acs=acs,
        hs_percent=hs_percent,
        rr_change=None,
        rank_at_time=rank_at_time,
        session_id=session_id,
        metadata={
            "source": source,
            "is_demo": source == "synthetic",
            "region": region,
            "game_name": game_name,
            "tag_line": tag_line,
            "raw_map_id": metadata.get("mapId"),
            "raw_character_id": player.get("characterId"),
            "queue_id": metadata.get("queueID"),
            "season_id": metadata.get("seasonId"),
        },
    )


def fetch_riot_matches_by_riot_id(
    *,
    game_name: str,
    tag_line: str,
    region: str,
    max_matches: int,
    api_key: str,
) -> RiotIngestionResult:
    normalized_region = _normalize_region(region)
    account_route = _account_route_for_region(normalized_region)
    encoded_name = parse.quote(game_name, safe="")
    encoded_tag = parse.quote(tag_line, safe="")

    account_url = (
        f"https://{account_route}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/"
        f"{encoded_name}/{encoded_tag}"
    )
    account = _request_json(account_url, api_key=api_key)
    puuid = str(account.get("puuid") or "")
    if not puuid:
        raise RiotApiError(status_code=404, message="Player not found for provided Riot ID.")

    matchlist_url = (
        f"https://{normalized_region}.api.riotgames.com/val/match/v1/matchlists/by-puuid/{puuid}"
    )
    matchlist = _request_json(matchlist_url, api_key=api_key)
    history_ids = _extract_history_ids(matchlist)[: max(1, min(max_matches, 50))]

    mapped: list[MatchImportItem] = []
    for match_id in history_ids:
        match_url = f"https://{normalized_region}.api.riotgames.com/val/match/v1/matches/{parse.quote(match_id, safe='')}"
        match_payload = _request_json(match_url, api_key=api_key)
        try:
            item = normalize_riot_match(
                match_payload=match_payload,
                puuid=puuid,
                game_name=game_name,
                tag_line=tag_line,
                region=normalized_region,
            )
        except ValidationError as exc:
            raise RiotApiError(502, "Riot match payload failed validation.") from exc
        if item is not None:
            mapped.append(item)

    return RiotIngestionResult(
        player_puuid=puuid,
        fetched_match_ids=history_ids,
        mapped_matches=mapped,
    )
