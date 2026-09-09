from fastapi import HTTPException, status

from app.core.config import settings


PUBLIC_DEMO_READ_ONLY_MESSAGE = "Hosted demo is read-only."


def require_writable_demo() -> None:
    if settings.public_demo_mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=PUBLIC_DEMO_READ_ONLY_MESSAGE,
        )

