# ADR 0003: PostgreSQL and Alembic

## Status

Accepted and implemented in the merged backend. PostgreSQL is supported for hosted and
production persistence, and Alembic is the schema migration path. No live PostgreSQL
validation is claimed by this ADR.

## Context

The public-release baseline uses SQLAlchemy and supports SQLite for local/test workflows
and PostgreSQL for hosted/production persistence. Hosted operation needs explicit schema
evolution and a database target that matches production deployment expectations.

SQLite remains useful for lightweight local and test workflows, but it should not be the
primary hosted/production persistence target.

## Decision

Use PostgreSQL for hosted/production persistence and Alembic for schema evolution.
Retain SQLite optionally for lightweight local development and tests where it keeps
setup simple and does not distort behavior being validated.

## Consequences

- Hosted environments get a production-oriented relational database.
- Schema changes become explicit, reviewable migrations rather than implicit table
  creation.
- Release and rollback procedures must include migration ordering and failure handling.
- Deployed environments must apply Alembic migrations before serving code that expects
  the migrated schema.
- Live PostgreSQL validation, deployment-specific connection settings, and rollback
  procedures remain environment-level release work rather than claims made here.
