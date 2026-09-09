# Continuous integration

The GitHub Actions workflow at `.github/workflows/ci.yml` runs for pull requests and pushes to `main`. It checks the backend, frontend, PostgreSQL migrations, runtime dependencies, and repository history for accidentally committed secrets.

Recommended repository settings:

- Require the CI status checks to pass before merging.
- Protect `main` from force pushes and direct changes as appropriate for the team.
- Require pull requests for collaborative work, with at least one review when practical.

The workflow does not deploy, require application credentials, or configure branch
protection automatically. A GitHub-hosted runner is required for the PostgreSQL
service, Gitleaks action, and workflow-status checks.
