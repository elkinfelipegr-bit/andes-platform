# Sprint 0 Domain Model — Andes Core

**Version:** 1.0
**Status:** Draft — entity sketch ready for Claude Code to implement as a Prisma schema; not yet a locked schema.
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

This document walks the required DDD sequence — Business → Processes → Domain → Entities → Relationships — for the minimum slice needed to start Sprint 0 (Foundation, Authentication, per [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md)). It stops before Database and API design, which are implementation details for Claude Code to produce from this model, consistent with "Domain before UI" and "never design screens first."

## Business

Andes Engineering Platform must let an engineering firm (a tenant, per [RFC-001](../rfc/0001-multi-tenant-architecture.md)) onboard onto the platform, invite its own staff, and control what each staff member is allowed to do — before any product-specific feature (Projects, CRM, etc.) can be built on top.

## Processes

1. A tenant (engineering firm) is provisioned on the platform. For Sprint 0, the only tenant is Andes Engineering itself (dogfooding, per RFC-001).
2. A user is created or invited into that tenant.
3. The user is assigned a role within the tenant.
4. The user logs in (via [ADR-002](../adr/0002-authentication-provider.md)) and their session carries their tenant and role.
5. Every subsequent action anywhere in the platform is scoped by that tenant and gated by that role.

## Domain Concepts

* **Tenant** — an engineering firm subscribed to the platform.
* **User** — a person with a login.
* **Role** — a named set of permissions a user can hold within a tenant.
* **Membership** — the fact that a specific user holds a specific role within a specific tenant. This is what makes the system multi-tenant-aware at the identity level, not just at the data level.

## Entities (draft sketch)

| Entity | Key Fields | Notes |
|---|---|---|
| `Tenant` | `id`, `name`, `slug`, `createdAt` | Not itself tenant-scoped — it *is* the scope. |
| `User` | `id`, `email`, `name`, `authProviderId`, `createdAt` | Global identity; a user's tenant access is via `Membership`, not a direct field on `User` — see open question below. |
| `Role` | `id`, `tenantId`, `key`, `label` | Modeled as **data (a table), not a hardcoded enum** — recommended so that adding roles later (Reviewer, Client viewer — explicitly deferred, not rejected, per your Sprint 0 scope answer) is a data change, not a schema migration. Confirm before implementation; this is a reversible, low-risk modeling choice, not a platform-wide commitment. |
| `Membership` | `id`, `tenantId`, `userId`, `roleId`, `createdAt` | Join entity binding a user to a tenant with a role. |

**Sprint 0 seed roles:** `OWNER_ADMIN`, `ENGINEER` — the two roles selected for this phase. `REVIEWER` and `CLIENT_VIEWER` are anticipated (see [ai-principles.md](../foundation/ai-principles.md) product context and [RFC-001](../rfc/0001-multi-tenant-architecture.md)) but out of scope for Sprint 0; the `Role`-as-data approach above exists specifically so adding them later doesn't require a migration.

## Relationships

```
Tenant 1 ──── N Membership N ──── 1 User
                    │
                    N
                    │
                    1
                  Role
```

* A `Tenant` has many `Membership` records.
* A `User` has many `Membership` records (see open question below on whether this is capped at one active tenant for now).
* Each `Membership` points to exactly one `Role`, which itself belongs to a `Tenant` (roles are tenant-scoped so a tenant could eventually customize its own role set, though Sprint 0 only needs the two seed roles above, identical across tenants).

## Open Questions for Implementation

* **Can a `User` hold `Membership`s in more than one `Tenant`?** RFC-001 assumes one active tenant membership per user for Sprint 0 simplicity (e.g. an independent consultant working across firms is out of scope). The schema above (`User` 1-to-N `Membership`) does not technically block multiple memberships — Claude Code should enforce "one active tenant per user" at the application layer for now rather than the schema layer, so this can be relaxed later without a migration.
* **Permission granularity within a `Role`** (e.g. can `ENGINEER` create projects but not delete them?) is not modeled yet — Sprint 0 only needs role-level, not permission-level, checks. A `Permission` entity can be layered on top of `Role` later without breaking this model.

## What This Document Does Not Cover

Database schema (exact Prisma model, indexes, RLS policy syntax) and API design (exact tRPC procedure signatures) are implementation, not domain modeling — they belong to Claude Code's Sprint 0 work, built directly from this document, per [engineering-principles.md](../foundation/engineering-principles.md) workflow (DDD → ADR → ... → Implementation).

## References

* [RFC-001: Multi-Tenant Architecture](../rfc/0001-multi-tenant-architecture.md)
* [ADR-002: Authentication Provider](../adr/0002-authentication-provider.md)
* [architecture-principles.md](../foundation/architecture-principles.md)
