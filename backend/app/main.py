from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.core.config import settings
from app.core.database import engine
from app.models import Base


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
