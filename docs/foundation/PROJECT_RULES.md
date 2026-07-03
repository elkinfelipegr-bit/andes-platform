# PROJECT_RULES.md

**Version:** 1.0
**Status:** Foundation document
**Part of:** [Engineering Handbook](README.md)

---

## Purpose

This is the operational rulebook: how code moves from idea to `main`, what "done" means, and how any contributor — human or AI assistant — is expected to behave inside this repository. It consolidates [project-principles.md](project-principles.md) (governance) and [engineering-principles.md](engineering-principles.md) (workflow) into concrete, actionable rules.

## Git Workflow

**Trunk-based development with short-lived feature branches.**

* `main` is always deployable. Nothing broken is ever merged into it.
* Every change is made on a feature branch, named after the sprint task or ADR/RFC it implements (e.g. `sprint-0/tenant-membership-schema`).
* Branches are short-lived — days, not weeks. If a branch is getting large, it should be split.
* Every merge to `main` goes through a pull request with at least one review before merge. If working solo, self-review explicitly against the Definition of Done below before merging.
* Vercel preview deployments run per pull request (per [ADR-004](../adr/0004-repository-structure.md)), and should be checked before requesting review.

## Definition of Done

A change is done when:

1. It implements a documented decision (an ADR, RFC, or domain model in `docs/architecture/`) — not an invented one. If no such document exists yet for what's being built, stop and write it first, per [engineering-principles.md](engineering-principles.md).
2. It passes the tests required by the Testing Strategy below.
3. Documentation is updated if the change affects behavior, architecture, or a decision already recorded in the handbook — an outdated handbook is treated as a bug.
4. It has been reviewed (or self-reviewed against this checklist) and the PR is scoped to one objective, per [engineering-principles.md](engineering-principles.md) Sprint Philosophy — no unrelated refactors bundled in.

## Testing Strategy

**Pragmatic, risk-weighted — not blanket coverage.**

* **Unit tests are required** for: domain/business logic, Zod validation schemas, permission and tenant-scoping logic, and any calculation logic (structural, geotechnical, etc. as those modules are built).
* **Integration tests are required** for critical tRPC procedures — authentication, tenant-scoping middleware, and core CRUD paths for whatever module is being built.
* **No mandated coverage percentage.** Coverage expectations are revisited per module as the domain stabilizes, rather than enforced uniformly from Sprint 0.
* **Tenant-isolation logic is the one deliberate exception to "pragmatic."** Because a scoping bug is a cross-customer data leak (see [RFC-001](../rfc/0001-multi-tenant-architecture.md)), this logic must be tested more rigorously than the pragmatic default — treat it like the strict tier even though the project overall is not.

## Roles & Permissions (Sprint 0)

See `docs/architecture/sprint-0-domain-model.md` for the full model. Summary: `OWNER_ADMIN` and `ENGINEER` are the two seed roles for Sprint 0; `REVIEWER` and `CLIENT_VIEWER` are anticipated but deferred, not rejected.

## Rules for AI Coding Assistants Working in This Repository

These apply in addition to the operating rules in [ai-principles.md](ai-principles.md):

1. **Read the Foundation layer and the relevant ADR/RFC/domain model before writing code.** Do not infer architecture from partial context.
2. **Do not create new ADRs or RFCs unilaterally.** Propose one and stop, per [ai-principles.md](ai-principles.md) rule 3 — architecture is ratified by the CTO, not assumed by the assistant.
3. **Do not skip tests for tenant-isolation logic**, even when other code in the same change could reasonably follow the pragmatic default.
4. **One PR, one objective.** Do not bundle drive-by refactors, dependency bumps, or unrelated fixes into a feature PR.
5. **Commit messages and PR descriptions reference the driving document** — the ADR, RFC, or sprint task — not just a description of the code change.
6. **If a requested task conflicts with a documented decision,** stop and flag the inconsistency rather than silently resolving it in either direction.

## Not Yet Decided

The following are intentionally left open rather than assumed, and should be resolved before or during Sprint 0 implementation:

* Linting/formatting tooling (ESLint/Prettier/Biome configuration specifics).
* CI provider and pipeline configuration (GitHub Actions is a reasonable default given the monorepo/Vercel direction, but has not been explicitly ratified).
* Vercel as the formal, ratified deployment target — currently direction, not a standalone ADR (see [ADR-004](../adr/0004-repository-structure.md) references).

## Related Documents

* [project-principles.md](project-principles.md) — the governance rules this rulebook operationalizes.
* [engineering-principles.md](engineering-principles.md) — the workflow and decision-documentation standard.
* [ai-principles.md](ai-principles.md) — AI assistant session protocol.
* `docs/adr/`, `docs/rfc/` — ratified decisions this rulebook enforces.
