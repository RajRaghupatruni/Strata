FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN groupadd --system --gid 10001 strata \
    && useradd --system --uid 10001 --gid strata --create-home strata

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY --chown=strata:strata alembic.ini ./
COPY --chown=strata:strata alembic ./alembic
COPY --chown=strata:strata app ./app
COPY --chown=strata:strata seeds ./seeds
COPY --chown=strata:strata scripts/smoke_test_postgres.py ./scripts/smoke_test_postgres.py
COPY --chown=strata:strata docker-entrypoint.sh ./docker-entrypoint.sh

USER strata

EXPOSE 8000

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
