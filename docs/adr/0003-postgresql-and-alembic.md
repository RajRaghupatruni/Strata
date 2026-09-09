# ADR 0003: PostgreSQL and Alembic

## Status

Accepted and implemented in the merged backend. PostgreSQL 16 is the validated durable
database architecture, and Alembic is the schema migration path. The public portfolio
demo intentionally uses ephemeral SQLite for cost and operational simplicity.

## Context

The public-release baseline uses SQLAlchemy and supports SQLite for local/test/demo
workflows and PostgreSQL for durable production-style persistence. Durable operation
needs explicit schema evolution and a database target that matches production deployment
expectations.

SQLite remains useful for lightweight local, test, and read-only public demo workflows,
but it should not be the primary durable multi-user persistence target.

## Decision

Use PostgreSQL for durable production-style persistence and Alembic for schema
evolution. Retain SQLite for lightweight local development, tests, and the read-only
public demo where it keeps setup simple and does not distort the domain behavior being
shown.

## Consequences

- Durable deployments get a production-oriented relational database.
- Schema changes become explicit, reviewable migrations rather than implicit table
  creation.
- Release and rollback procedures must include migration ordering and failure handling.
- Deployed environments must apply Alembic migrations before serving code that expects
  the migrated schema.
- Local Docker PostgreSQL 16 and GitHub Actions migration validation exercise the
  current schema path. This is not a production cloud load-testing claim.
- Deployment-specific connection settings and rollback procedures remain
  environment-level release work.
