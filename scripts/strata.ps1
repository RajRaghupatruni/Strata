param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "seed", "migrate", "test-backend", "build-frontend", "logs", "reset-demo-db", "validate-postgres")]
    [string]$Command = "start"
)

$ErrorActionPreference = "Stop"

switch ($Command) {
    "start" { docker compose up --build }
    "stop" { docker compose down }
    "seed" { docker compose run --rm backend python -m app.seed_demo --allow-nonlocal }
    "migrate" { docker compose run --rm backend alembic upgrade head }
    "test-backend" {
        Push-Location (Join-Path $PSScriptRoot "..\backend")
        try { python -B -m unittest discover -s tests -v }
        finally { Pop-Location }
    }
    "build-frontend" { docker compose build frontend }
    "logs" { docker compose logs -f }
    "reset-demo-db" {
        Write-Host "Removing the disposable Strata Postgres volume..."
        docker compose down -v
    }
    "validate-postgres" { docker compose run --rm backend python scripts/smoke_test_postgres.py --repeat-seed }
}
