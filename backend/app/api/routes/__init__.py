from fastapi import APIRouter

from app.api.routes import coach, home, insights, matches, progress, recommendations, review, settings


api_router = APIRouter()
api_router.include_router(home.router, prefix="/home", tags=["home"])
api_router.include_router(matches.router, prefix="/matches", tags=["matches"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
api_router.include_router(review.router, prefix="/review", tags=["review"])
api_router.include_router(coach.router, prefix="/coach", tags=["coach"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
api_router.include_router(progress.router, prefix="/progress", tags=["progress"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
