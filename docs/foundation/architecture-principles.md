# architecture-principles.md

**Version:** 1.0
**Status:** Foundation document
**Editorial note:** See the boundary note in [engineering-principles.md](engineering-principles.md). This document covers *system structure* — how the software itself is organized — not workflow or process.
**Part of:** [Engineering Handbook](README.md)

---

## Purpose

This document defines the principles that govern how the Andes Engineering Platform is structured. These principles apply before any specific technology or module decision is made — they are the filter every architecture decision must pass through.

## Architectural Philosophy

* **Engineering before implementation.** Understand the engineering problem before writing code.
* **Domain before UI.** The domain model is designed first; screens are a consequence of it, never the starting point.
* **Documentation before coding.** A design that cannot be written down clearly is not ready to be built. See [project-principles.md](project-principles.md).
* **Reuse before creation.** Check for an existing solution — in the platform, in a library, or in a prior ADR — before building something new.
* **Modularity over monolithic design.** Each product (Andes Core, Projects, CRM, Structures, Geo, BIM, AI, Analytics) must be able to evolve independently. See [VISION.md](VISION.md).
* **Simplicity over cleverness.** See [engineering-philosophy.md](engineering-philosophy.md) — the same idea applied at the architecture level.
* **Architecture over speed.** Shipping fast at the cost of structural integrity is treated as a false economy on a 10-year platform.
* **Long-term maintainability.** Every decision is evaluated against "will this still make sense in year eight," not just "does this ship this sprint."
* **Single Source of Truth.** One schema, one authoritative model, one place a fact about the system lives.
* **AI assists but does not replace engineering judgment.** Applies both to AI features in the product and to AI assistants building the platform. See [ai-principles.md](ai-principles.md).

## Domain-Driven Design Workflow

The platform is designed from the engineering domain outward. The required sequence is:

```
Business → Processes → Domain → Entities → Relationships → Database → API → Frontend
```

**Screens are never designed first.** Every module's design must be traceable back through this chain to an actual engineering business process — not the other way around.

This is the architectural counterpart to the Development Workflow in [engineering-principles.md](engineering-principles.md) (Idea → PRD → DDD → ADR → RFC → ...): DDD is the "D" step in that sequence, expanded.

## Ratified Since This Document Was Drafted

* **Technology stack** — [ADR-001](../adr/0001-technology-stack.md).
* **Authentication provider** — [ADR-002](../adr/0002-authentication-provider.md).
* **API layer** — [ADR-003](../adr/0003-api-layer.md).
* **Repository structure** — [ADR-004](../adr/0004-repository-structure.md).
* **Multi-tenancy strategy** — [RFC-001](../rfc/0001-multi-tenant-architecture.md): tenant = engineering firm, shared DB with row-level isolation via `tenantId` + PostgreSQL RLS.
* **Sprint 0 domain model** (Tenant, User, Role, Membership) — `docs/architecture/sprint-0-domain-model.md`.

## What Is Still Not Yet Decided

* Module/service boundaries and ownership beyond the vision-level grouping (see [VISION.md](VISION.md)) — the mapping in [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md) is indicative, not ratified.
* Full database schema beyond the Sprint 0 domain sketch, exact RLS policy syntax, and migration conventions.
* Full API design (procedure-level conventions, error handling shape) beyond "tRPC" as the chosen layer.
* Authorization model beyond role-level checks — permission granularity within a role is explicitly deferred (see `docs/architecture/sprint-0-domain-model.md`).
* Security architecture and infrastructure beyond the Vercel direction (not yet its own ADR — see [ADR-004](../adr/0004-repository-structure.md) references).

Any AI assistant asked to implement one of the still-open areas must stop and request or draft the corresponding ADR/RFC first, per [project-principles.md](project-principles.md) — it must not infer an architecture from this document alone.

## Related Documents

* `docs/architecture/` (planned) — Architecture Overview, DDD detail, Module Definitions, Database Design, API Design, Authentication, Authorization, Security, Infrastructure.
* `docs/adr/` (planned) — individual ratified decisions.
* [engineering-principles.md](engineering-principles.md) — the process by which these principles get turned into ratified decisions.
