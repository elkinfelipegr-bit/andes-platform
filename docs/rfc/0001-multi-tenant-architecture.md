# RFC-001: Multi-Tenant Architecture

**Status:** Accepted
**Date:** 2026-07-03
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[VISION.md](../foundation/VISION.md) states the platform must work both as Andes Engineering's internal operating system and, eventually, as a commercial SaaS product sold to other engineering consulting firms. This RFC was flagged as required before any schema or auth work could begin (see [architecture-principles.md](../foundation/architecture-principles.md)).

## Problem

Multi-tenancy touches every table, every API procedure, and the authentication model from day one. It cannot be retrofitted cheaply. Two things must be decided before Sprint 0 implementation: who counts as a "tenant," and how tenant data is isolated.

## Proposal

**A tenant is an engineering firm** — a company that subscribes to the platform. Andes Engineering itself is Tenant #1, dogfooding its own product. Each tenant has its own users, clients, and projects. This is a true multi-tenant model built from the start, not a mono-tenant build with multi-tenancy bolted on later — retrofitting tenant isolation onto an already-built single-tenant schema was explicitly rejected as too costly.

**Data isolation: shared database, row-level isolation via `tenantId`.** Every tenant-scoped table carries a `tenantId` column. Isolation is enforced in two layers:

1. **Application layer:** every tRPC procedure ([ADR-003](../adr/0003-api-layer.md)) that touches tenant-scoped data receives `tenantId` from the authenticated session ([ADR-002](../adr/0002-authentication-provider.md)) via shared middleware — no procedure queries the database without it.
2. **Database layer:** PostgreSQL Row-Level Security (RLS) policies enforce `tenantId` scoping as a defense-in-depth backstop, so a bug in application-layer scoping cannot leak cross-tenant data.

This distinguishes two separate concepts that must not be conflated in the domain model: a **Tenant** (the subscribing engineering firm) and a **Client** (a tenant's own customer — e.g. the construction company Andes does a project for). Clients are tenant-scoped data, not tenants themselves.

## Alternatives

* **Schema-per-tenant** — stronger isolation, but migrations and any cross-tenant admin/analytics query become significantly more complex to run and to keep in sync across potentially hundreds of tenants.
* **Database-per-tenant** — maximum isolation and the easiest story for regulatory compliance, but the most expensive to operate and the hardest to scale to hundreds of small-to-mid-size engineering firms, which is the expected customer profile.
* **Mono-tenant now, multi-tenant later** — rejected. Retrofitting `tenantId` and RLS onto an already-built single-tenant schema, plus migrating Andes Engineering's own live data into the new model, was judged more expensive than building tenant-aware from Sprint 0.

## Trade-offs

Shared DB with row-level isolation is the standard, cost-effective approach for SaaS platforms with many small-to-mid tenants, and it is the natural fit for [ADR-001](../adr/0001-technology-stack.md)'s PostgreSQL + Prisma choice. The trade-off is that a mistake in scoping logic is a data leak between customers, not just a bug — which is why RLS exists as a second layer rather than relying on application code alone.

## Consequences

* Every table in the Sprint 0 domain model (`docs/architecture/sprint-0-domain-model.md`) that is not itself the Tenant table carries a `tenantId` foreign key.
* Tenant-scoping middleware for tRPC is Sprint 0, Andes Core work — it is a hard prerequisite for every other product's data layer.
* Seed/dev data must include at least one seed tenant record representing Andes Engineering itself.
* Tenant-isolation logic (middleware + RLS policies) is security-critical and must be covered by tests per `PROJECT_RULES.md`, not left to the "pragmatic" default coverage level.

## Rollout

Implemented as part of Sprint 0 (Andes Core), alongside authentication ([ADR-002](../adr/0002-authentication-provider.md)) and the Tenant/User/Role/Membership entities defined in `docs/architecture/sprint-0-domain-model.md`. No migration path is needed since there is no pre-existing single-tenant data — Andes Engineering's own onboarding as Tenant #1 is the first real usage of this model, not a migration.

## Open Questions

* **Billing/subscription model per tenant** — not decided. Needed before the platform can actually onboard a second, paying tenant firm. Should become its own future ADR ("Billing & Subscription Model") once commercialization is closer.
* **Can a user belong to more than one tenant** (e.g. an independent consultant working across firms)? Sprint 0's domain model assumes one active tenant membership per user for simplicity — see the open question noted in `docs/architecture/sprint-0-domain-model.md`. Revisit if this becomes a real requirement.

## References

* [VISION.md](../foundation/VISION.md)
* [ADR-001](../adr/0001-technology-stack.md), [ADR-002](../adr/0002-authentication-provider.md), [ADR-003](../adr/0003-api-layer.md)
* `docs/architecture/sprint-0-domain-model.md`
