"""Regenerate fictional fixture v1 from constants; never reads player data or APIs."""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from random import Random


def build_fixture() -> dict:
    rng = Random(84017)
    start = datetime(2026, 8, 10, 19, 17, tzinfo=timezone.utc)
    focal = "demo-na-player-0001"
    # Ten appearances per segment: improving controller/initiator/sentinel play,
    # with a contrasting declining duelist segment on Bind.
    segments = [("Ascent", "Omen"), ("Bind", "Jett"), ("Haven", "Sova"), ("Lotus", "Killjoy")]
    outcomes = [
        "LLWL", "WLLW", "LWWL", "WLWW", "WLLW",
        "WLWW", "WLWL", "WLWW", "WLWW", "WLWW",
    ]
    matches = []
    for index in range(40):
        phase, segment = divmod(index, 4)
        map_name, agent = segments[segment]
        won = outcomes[phase][segment] == "W"
        losing_rounds = rng.choice([6, 7, 8, 9, 10, 11])
        own, enemy = (13, losing_rounds) if won else (losing_rounds, 13)
        rounds = own + enemy
        weak = segment == 1
        kills = round((19 - phase * .75 if weak else 13 + phase * .95) + rng.uniform(-2.4, 2.4))
        deaths = min(rounds, round((15 + phase * .5 if weak else 18 - phase * .55) + rng.uniform(-1.8, 1.8)))
        assists = rng.randint(2, 6) if weak else rng.randint(5, 11)
        score = round((238 - phase * 7.4 if weak else 179 + phase * 8.9) * rounds + rng.randint(-151, 169))
        target_damage = round((152 - phase * 3.9 if weak else 119 + phase * 5.7) * rounds + rng.randint(-123, 137))
        weights = [rng.uniform(.15, 2.1) for _ in range(rounds)]
        damage_by_round = [int(target_damage * weight / sum(weights)) for weight in weights]
        damage_by_round[-1] += target_damage - sum(damage_by_round)
        round_results = []
        head_probability = .23 - phase * .008 if weak else .15 + phase * .014
        for round_num, damage in enumerate(damage_by_round):
            hit_count = max(1, round(damage / rng.uniform(33, 46)))
            head = body = leg = 0
            for _ in range(hit_count):
                roll = rng.random()
                if roll < head_probability:
                    head += 1
                elif roll > .94:
                    leg += 1
                else:
                    body += 1
            round_results.append({
                "roundNum": round_num,
                "playerStats": [{
                    "puuid": focal,
                    "damage": [{
                        "receiver": f"demo-na-player-{rng.randint(6, 10):04d}",
                        "damage": damage,
                        "headshots": head,
                        "bodyshots": body,
                        "legshots": leg,
                    }],
                }],
            })
        # Two games/session, across twenty separate dates. All times are fixed.
        played_at = start + timedelta(days=index // 2, minutes=(index % 2) * 57 + rng.randint(0, 9))
        players = [
            {"puuid": f"demo-na-player-{number:04d}", "teamId": "Blue" if number <= 5 else "Red"}
            for number in range(1, 11)
        ]
        players[0].update({
            "characterId": agent,
            "stats": {"roundsPlayed": rounds, "score": score, "kills": kills, "deaths": deaths, "assists": assists},
        })
        matches.append({
            "matchInfo": {
                "matchId": f"demo-na-match-{index + 1:04d}",
                "gameStartMillis": int(played_at.timestamp() * 1000),
                "mapId": f"/Game/Maps/{map_name}/{map_name}",
                "queueID": "competitive",
            },
            "players": players,
            "teams": [
                {"teamId": "Blue", "won": won, "roundsWon": own},
                {"teamId": "Red", "won": not won, "roundsWon": enemy},
            ],
            "roundResults": round_results,
        })
    return {
        "source": "synthetic",
        "dataset_version": 1,
        "description": "Entirely fictional deterministic demo. Reduced Riot-like payloads, not recorded gameplay or benchmarks.",
        "player_puuid": focal,
        "region": "na",
        "matches": matches,
    }


if __name__ == "__main__":
    destination = Path(__file__).resolve().parents[1] / "seeds" / "sample_matches.json"
    destination.write_text(json.dumps(build_fixture(), indent=2) + "\n", encoding="utf-8")
    print("Wrote 40 fictional Riot-like matches (fixture v1).")
