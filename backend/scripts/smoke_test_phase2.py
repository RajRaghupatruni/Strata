import json
import urllib.error
import urllib.request


API_BASE = "http://127.0.0.1:8000"


def http_get(path: str) -> dict:
    request = urllib.request.Request(f"{API_BASE}{path}", method="GET")
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> None:
    try:
        health = http_get("/health")
    except urllib.error.URLError as exc:
        raise SystemExit(
            "Backend is not reachable at http://127.0.0.1:8000. "
            "Start FastAPI first (uvicorn app.main:app --reload --port 8000)."
        ) from exc

    print(f"Health: {health}")

    list_result = http_get("/api/v1/matches?limit=10")
    print(f"List total: {list_result.get('total')}")

    matches = list_result.get("matches", [])
    if matches:
        sample = matches[0]
        print(
            "Latest match:",
            {
                "id": sample.get("id"),
                "played_at": sample.get("played_at"),
                "map_name": sample.get("map_name"),
                "agent": sample.get("agent"),
                "result": sample.get("result"),
            },
        )
    else:
        raise SystemExit("No matches found. From backend, run: python -m app.seed_demo")


if __name__ == "__main__":
    main()

