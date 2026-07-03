# ADR-006: CI Provider — GitHub Actions

**Status:** Accepted — ratified by CTO 2026-07-03
**Date:** 2026-07-03
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[PROJECT_RULES.md](../foundation/PROJECT_RULES.md) lists the CI provider as "Not Yet Decided," noting GitHub Actions as the reasonable default given the monorepo ([ADR-004](0004-repository-structure.md)) and Vercel direction ([ADR-005](0005-deployment-target.md), proposed). ADR-004 already commits to CI running against the whole repository with Turborepo affected-package detection — it just doesn't say _where_ CI runs. The repository currently has no remote; pushing to GitHub is a prerequisite for both the PR workflow in PROJECT_RULES and any hosted CI.

## Problem

Which CI provider runs the checks (typecheck, lint, tests, build) that gate merges to `main`, in a way that integrates with the PR-based workflow and Vercel preview deployments already assumed by PROJECT_RULES?

## Decision

**GitHub Actions**, with the repository hosted on GitHub.

- One workflow triggered on pull requests and pushes to `main`.
- Steps: pnpm install → `turbo run typecheck lint test build`, relying on Turborepo caching/affected detection per ADR-004.
- Tenant-isolation tests ([RFC-001](../rfc/0001-multi-tenant-architecture.md), PROJECT_RULES testing strategy) run against a disposable PostgreSQL service container in the workflow, so the security-critical tier is exercised on every PR, not just locally.
- Branch protection on `main` requires the workflow to pass before merge.

## Alternatives

- **GitLab CI / Bitbucket Pipelines** — comparable capability, but the project's tooling ecosystem (Vercel integration, Claude Code's `gh` CLI support, community actions for pnpm/Turborepo) is strongest on GitHub.
- **CircleCI / Buildkite** — more powerful for very large build fleets; overkill and an extra vendor for a foundation-phase monorepo.
- **Vercel-only checks (no separate CI)** — Vercel builds already gate previews, but they don't run tests; relying on them alone would leave the mandatory tenant-isolation tests unenforced.

## Trade-offs

GitHub Actions couples CI to GitHub as the repo host and has slower cold runners than paid specialists — accepted in exchange for zero-setup PR integration, the largest actions ecosystem, and first-class Vercel/`gh` interoperability. Costs are free-tier friendly at this team size.

## Consequences

- The repository gains a GitHub remote; the solo self-review allowance in PROJECT_RULES remains, but the PR mechanism becomes real rather than aspirational.
- A `.github/workflows/ci.yml` is added to the monorepo root; keeping it green becomes part of the Definition of Done.
- CI provides the PostgreSQL instance for integration tests, removing the "no local database" excuse for skipping the mandatory tenant-isolation tier.
- Secrets used by CI (e.g. test database URL) live in GitHub Actions secrets, distinct from Vercel runtime secrets ([ADR-005](0005-deployment-target.md)).

## Examples

A PR for `sprint-0/auth-tenant-scoping` triggers the workflow: Turborepo detects `@andes/db`, `@andes/auth`, and `@andes/api` as affected, runs their typechecks and tests (tenant-isolation integration tests against the service-container Postgres), and blocks merge on any failure — while Vercel independently builds the preview deployment.

## Exceptions

Heavy scheduled jobs (e.g. future nightly analysis over engineering models) may justify a different execution environment later; that is workload infrastructure, not PR gating, and would be decided separately.

## References

- [PROJECT_RULES.md](../foundation/PROJECT_RULES.md) — "Not Yet Decided" item this ADR resolves; testing strategy this ADR enforces
- [ADR-004](0004-repository-structure.md) — Turborepo affected-package CI requirement
- [ADR-005](0005-deployment-target.md) — Vercel previews running alongside CI
- [RFC-001](../rfc/0001-multi-tenant-architecture.md) — the tenant-isolation testing mandate
