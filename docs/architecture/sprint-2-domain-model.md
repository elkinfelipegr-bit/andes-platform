# Sprint 2 Domain Model — Projects

**Version:** 1.0
**Status:** Accepted — ratified by the CTO on 2026-07-07, including the three recommendations in Open Questions (minimal `Client` entity; `status` as Prisma enum; human-assigned per-tenant-unique `code`).
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the required DDD sequence — Business → Processes → Domain → Entities → Relationships — for the minimum Projects slice ([PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md), Sprint 2: Projects / Andes Projects). It stops before database and API design, which Claude Code produces from this model after ratification, mirroring [sprint-0-domain-model.md](sprint-0-domain-model.md).

## Business

An engineering firm (tenant) organizes all its work around **projects**: a structural design for a building, a geotechnical study, an inspection campaign. The project is the container every later module hangs off — structures, geo, BIM, inspections, documents all attach to a project. A firm must be able to register its projects, know which client each one is for, and track each project's lifecycle state.

## Processes

1. A staff member registers a new project, identifying it (name, per-tenant code) and optionally linking the client it is for.
2. Staff browse the tenant's project list, filtered by lifecycle status.
3. Staff open a project to see its details.
4. A project's data and lifecycle status are updated as work progresses (e.g. draft → active → completed).
5. A project is archived when no longer active — never hard-deleted, since later modules will attach engineering records to it.
6. (Later sprints) product modules attach their artifacts — designs, studies, inspections, documents — to the project.

## Domain Concepts

- **Project** — a unit of engineering work a tenant performs, usually for a client. Tenant-scoped.
- **Client** — the tenant's own customer (RFC-001 draws this line explicitly: a Client is tenant data, never a Tenant). Owned conceptually by the CRM module (Sprint 3), but Projects needs to reference it now.
- **Project lifecycle status** — DRAFT, ACTIVE, ON_HOLD, COMPLETED, ARCHIVED.

## Entities (draft sketch)

| Entity    | Key Fields                                                                                                                                 | Notes                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Client`  | `id`, `tenantId`, `name`, `createdAt`                                                                                                      | **Deliberately minimal** — a named reference, creatable inline from the project form. Sprint 3 (CRM) enriches it (contacts, addresses, pipeline) without touching `Project`. See open question 1.                    |
| `Project` | `id`, `tenantId`, `clientId?`, `code`, `name`, `description?`, `status`, `startDate?`, `endDate?`, `createdById`, `createdAt`, `updatedAt` | `code` unique per tenant (`@@unique([tenantId, code])`), human-assigned (e.g. `P-2026-014`). `clientId` optional — internal/R&D work has no client. `status` defaults to `DRAFT`. `createdById` → `User`, for audit. |

Both tables carry `tenantId` and fall under RLS per [RFC-001](../rfc/0001-multi-tenant-architecture.md) — same two-layer isolation as Sprint 0 (tenantProcedure middleware + RLS policies).

## Relationships

```
Tenant 1 ──── N Client 1 ──── N Project N ──── 1 User (createdBy)
   │                              │
   └──────────── 1 ──── N ───────┘        (Project.tenantId, direct)
```

- A `Tenant` has many `Client`s and many `Project`s.
- A `Client` has many `Project`s; a `Project` has zero or one `Client` — **both must belong to the same tenant** (enforced in application logic and by RLS; the FK alone cannot express it).
- `createdById` references the global `User`; authorization still flows from `Membership`, not from this audit field.

## Roles & Permissions (Sprint 2, role-level only)

Consistent with Sprint 0's deferral of permission granularity:

- `OWNER_ADMIN` and `ENGINEER`: create, read, update projects and create/read clients.
- `ARCHIVED` transition (and any future delete): `OWNER_ADMIN` only — the one role-gated action this sprint, exercising `roleProcedure` beyond tests for the first time.

## Open Questions for Ratification

1. **Minimal `Client` now vs. free-text client name on `Project`.** Recommendation: **minimal `Client` entity now.** A free-text field would demand a messy backfill-and-dedupe migration in Sprint 3; a named entity costs one small table and gives CRM a stable FK target. Rejected third option (build full CRM Client now) violates one-sprint-one-objective.
2. **`status` as Prisma enum vs. data table.** Recommendation: **Prisma enum.** Unlike roles (tenant-customizable by design, hence data), lifecycle states are platform workflow constants; an enum is simpler and type-safe end-to-end. If tenant-customizable workflows ever become a requirement, that is a new domain design, not a config tweak.
3. **Project `code` assignment.** Recommendation: human-assigned with per-tenant uniqueness enforced, no auto-numbering this sprint — firms have existing numbering conventions; auto-suggestion can layer on later.

## What This Document Does Not Cover

Exact Prisma schema, index/RLS policy syntax, tRPC procedure signatures, and screen design — implementation, produced from this model after ratification ([engineering-principles.md](../foundation/engineering-principles.md)). UI follows [docs/design/navigation.md](../design/navigation.md) (Projects route exists as a disabled stub to enable).

## References

- [sprint-0-domain-model.md](sprint-0-domain-model.md) — the pattern and the identity model this builds on.
- [RFC-001](../rfc/0001-multi-tenant-architecture.md) — Tenant vs. Client distinction; isolation requirements.
- [sprint-2.md](../sprints/sprint-2.md) — the sprint plan this model belongs to.
