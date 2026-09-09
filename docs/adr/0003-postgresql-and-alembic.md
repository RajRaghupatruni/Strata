# ADR 0003: PostgreSQL and Alembic

## Status

Intended decision; active backend branch in progress. Not yet claimed as merged in this
documentation workstream.

## Context

The current public-release baseline works locally with SQLAlchemy and SQLite. Hosted
operation needs stronger persistence behavior, explicit schema evolution, and a database
target that matches production deployment expectations.

SQLite remains useful for lightweight local and test workflows, but it should not be the
primary hosted/production persistence target.

## Intended Decision

Use PostgreSQL for hosted/production persistence and Alembic for schema evolution.
Retain SQLite optionally for lightweight local development and tests where it keeps
setup simple and does not distort behavior being validated.

## Consequences

- Hosted environments get a production-oriented relational database.
- Schema changes become explicit, reviewable migrations rather than implicit table
  creation.
- Release and rollback procedures must include migration ordering and failure handling.
- Tests should cover migration behavior once Alembic is merged.
- Documentation must be updated after the backend branch lands with exact commands and
  environment variables.
- Until merge, public docs must not claim PostgreSQL/Alembic are implemented in the main
  baseline.
