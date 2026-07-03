# ADR-005: Deployment Target — Vercel

**Status:** Accepted — ratified by CTO 2026-07-03
**Date:** 2026-07-03
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

Vercel has been the assumed deployment direction since [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md), and both [ADR-001](0001-technology-stack.md) and [ADR-004](0004-repository-structure.md) reference it — but always with the caveat that it is "direction, not a standalone ADR." ADR-004 explicitly recommends ratifying it before Sprint 0 implementation begins, because it affects environment/secrets structure in the monorepo. [PROJECT_RULES.md](../foundation/PROJECT_RULES.md) already assumes Vercel preview deployments per pull request.

## Problem

Where does the platform deploy, and what does that imply for environment configuration, secrets, and the database's network position — decided formally, so Sprint 0 auth and tenant-scoping work can configure environments against a ratified target rather than an assumption?

## Decision

**Vercel**, deploying the Next.js apps in the monorepo directly (one Vercel project per app as apps are added, starting with Andes Core), with preview deployments per pull request.

Implications made explicit by this decision:

* Environment variables and secrets are managed in Vercel per project/environment (Development, Preview, Production), with `.env.example` files in the repo documenting required keys — never actual values.
* PostgreSQL ([ADR-001](0001-technology-stack.md)) is hosted on a Vercel-compatible managed provider (e.g. Neon or Vercel Postgres); serverless function connection behavior requires connection pooling (e.g. the provider's pooler or Prisma Accelerate) — the specific provider is a follow-up operational choice within this ADR's frame, not a new ADR.
* Better Auth ([ADR-002](0002-authentication-provider.md)) runs inside the Next.js app on Vercel — no separate auth infrastructure.

## Alternatives

* **Self-managed VPS / container platform (Railway, Fly.io, Render)** — more infrastructure control and steadier costs at scale, but adds ops burden a small AI-assisted team should not carry during foundation-phase sprints.
* **AWS (Amplify or custom)** — maximum flexibility and enterprise credibility, at the cost of significant configuration surface that would slow every sprint now.

## Trade-offs

Vercel optimizes for shipping speed, per-PR preview deployments, and zero ops overhead — at the cost of infrastructure control, exposure to Vercel's pricing model as usage grows, and serverless constraints (execution time limits, connection pooling requirements) that shape how long-running work (e.g. future heavy structural computation) must be architected. That last constraint is already anticipated by ADR-001's exception for a dedicated numerical service.

## Consequences

* Sprint 0 environment/secrets layout in the monorepo is structured around Vercel's Development/Preview/Production model from the start.
* The database provider must be serverless-friendly; long-lived direct connections cannot be assumed anywhere in the platform.
* Preview deployments per PR become part of the Definition of Done checks in [PROJECT_RULES.md](../foundation/PROJECT_RULES.md) as soon as a deployable app exists.
* If a future module outgrows serverless constraints, extracting it is an architectural change requiring its own ADR (consistent with ADR-001's exception clause).

## Examples

A PR implementing a tRPC procedure in Andes Core triggers a Vercel preview deployment; the reviewer exercises the change against the Preview environment's database branch before approving the merge to `main`, which deploys to Production.

## Exceptions

Specialized computation services (per ADR-001's exception) and any future self-hosted enterprise deployment for a customer with data-residency requirements would sit outside Vercel — each requiring its own ADR.

## References

* [ADR-001](0001-technology-stack.md), [ADR-004](0004-repository-structure.md) — both defer this decision here
* [PROJECT_RULES.md](../foundation/PROJECT_RULES.md) — "Not Yet Decided" item this ADR resolves
* [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) — original tentative direction
