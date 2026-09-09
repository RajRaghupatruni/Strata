from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST
from sqlalchemy import text

from app.api.routes import api_router
from app.core.config import settings
from app.core.database import engine
from app.models import Base
from app.core.observability import (
    RequestObservabilityMiddleware,
    configure_logging,
    log_event,
    metrics_payload,
)


configure_logging(settings.log_level, settings.log_format)


def cors_origins() -> list[str]:
    defaults = ["http://localhost:5173", "http://127.0.0.1:5173"]
    configured = [
        origin.strip()
        for origin in settings.cors_allowed_origins.split(",")
        if origin.strip() and origin.strip() != "*"
    ]
    return list(dict.fromkeys(defaults + configured))


def initialize_local_schema() -> None:
    if (
        settings.database_url.startswith("sqlite")
        and settings.environment.strip().lower() in {"local", "development", "test"}
    ):
        Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_local_schema()
    yield


app = FastAPI(
    title="Strata API",
    version="0.1.0",
    description="Local-first Valorant improvement backend",
    lifespan=lifespan,
)

app.add_middleware(RequestObservabilityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready", responses={503: {"description": "Database is unavailable"}})
def readiness() -> Response:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        log_event(
            40,
            "Readiness check failed",
            operation="readiness",
            error_category="database",
        )
        return JSONResponse(status_code=503, content={"status": "not_ready"})
    return JSONResponse(status_code=200, content={"status": "ready"})


@app.get("/metrics", include_in_schema=False)
def metrics() -> Response:
    return Response(content=metrics_payload(), media_type=CONTENT_TYPE_LATEST)
