# Sprint 3 Domain Model — CRM (Clients & Contacts)

**Version:** 1.0
**Status:** Accepted — ratified by the CTO on 2026-07-08, including the three recommendations in Open Questions (archival does not cascade to projects; contact hard-delete; taxId as free text).
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence — Business → Processes → Domain → Entities → Relationships — for the CRM slice ([PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md), Sprint 3: CRM / Andes CRM). Sprint 2 deliberately created `Client` as a minimal FK target ([sprint-2-domain-model.md](sprint-2-domain-model.md), open question 1) so this sprint could enrich it **without touching `Project`** — this document cashes that in.

## Business

An engineering firm's revenue comes from a stable of clients — construction companies, real-estate developers, public entities, industrial owners. The firm needs to know who its clients are (identification, fiscal data, location), **who to talk to at each one** (the people: technical counterparts, procurement, management), and see each client's engagement history (its projects) in one place. In Colombia, client identification carries a NIT (tax id); the platform must store it but stays country-agnostic in shape.

## Processes

1. A staff member registers or enriches a client: legal name, tax id (NIT), industry, location, general contact data, free-form notes.
2. Staff register the people at a client — contacts with a role/title, email, phone — and keep them current as counterparts rotate.
3. Staff open a client and see everything about the relationship: its data, its contacts, and its projects (the Sprint 2 registry, joined from the other side).
4. A client that no longer works with the firm is archived — never deleted, since projects reference it and history must survive.
5. (Sprint 4, explicitly out of scope here) commercial opportunities and proposal generation build on these clients and contacts.

## Domain Concepts

- **Client** — the tenant's customer (exists since Sprint 2; enriched here). Still tenant data, never a Tenant (RFC-001).
- **Contact** — a person at a client: the firm's counterpart. Belongs to exactly one client. Not a platform `User` — contacts don't log in; a future client-portal (`CLIENT_VIEWER` role, deferred since Sprint 0) would be a separate linkage, not this entity.
- **Client archival** — lifecycle flag, mirroring the Project pattern: archived clients stay readable and keep their projects, but stop appearing in active pickers.

## Entities (draft sketch)

| Entity    | Key Fields                                                                                                                                                          | Notes                                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Client`  | _(existing)_ `id`, `tenantId`, `name`, `createdAt` — **adds:** `taxId?`, `industry?`, `address?`, `city?`, `phone?`, `email?`, `notes?`, `archivedAt?`, `updatedAt` | All additions nullable → additive migration, zero impact on `Project`. `taxId` free text (NIT format validation deferred — see open question 3). `archivedAt` timestamp doubles as the flag and the audit datum.                                   |
| `Contact` | `id`, `tenantId`, `clientId`, `name`, `title?`, `email?`, `phone?`, `notes?`, `createdAt`, `updatedAt`                                                              | Tenant-scoped AND client-owned; carries its own `tenantId` (RFC-001: every tenant-scoped table) even though it is reachable via `clientId` — RLS must not depend on a join. Delete follows client archival semantics: contacts are never orphaned. |

Both tables under RLS, strictly `app.tenant_id`-scoped, no bootstrap branch — the `client`/`project` pattern from Sprint 2 applies verbatim to `contact`.

## Relationships

```
Tenant 1 ──── N Client 1 ──── N Contact
                 │
                 1 ──── N Project        (Sprint 2, unchanged)
```

- A `Client` has many `Contact`s; a `Contact` belongs to exactly one `Client` — and `contact.tenantId` must equal its client's `tenantId` (application-layer check + RLS, same reasoning as `Project.clientId` in Sprint 2).
- Client detail joins both sides: its contacts (this sprint) and its projects (Sprint 2's data, read from the CRM side).

## Roles & Permissions (role-level only, consistent with Sprints 0–2)

- `OWNER_ADMIN` and `ENGINEER`: create, read, update clients and contacts.
- **Archive client**: `OWNER_ADMIN` only — same gate as project archival.
- Contact deletion: allowed to both roles (a contact is address-book data, not an engineering record); hard delete is acceptable here — see open question 2.

## Open Questions for Ratification

1. **Client archival semantics vs. project references.** Recommendation: archiving a client does **not** touch its projects (they keep their `clientId` and render normally); archived clients disappear from the project form's client picker only. Alternative (cascade-archive projects) rejected — a client relationship ending doesn't erase engineering history.
2. **Contact hard-delete vs. soft-delete.** Recommendation: **hard delete.** Contacts are address-book entries with no engineering artifacts hanging off them; soft-delete machinery would be speculative. Revisit when proposals (Sprint 4) start referencing contacts — flagged there, not built now.
3. **NIT/tax-id validation.** Recommendation: store free text now; a Colombia-aware validator (check digit) is a UX nicety that can land later without migration. The field name stays generic (`taxId`) per the SaaS path (VISION: other firms, eventually other jurisdictions).

## What This Document Does Not Cover

Prisma schema syntax, RLS policy text, tRPC signatures, screen design — implementation after ratification. UI follows [docs/design/navigation.md](../design/navigation.md): the `/crm` stub becomes live.

## References

- [sprint-2-domain-model.md](sprint-2-domain-model.md) — the minimal `Client` this enriches; the isolation pattern `Contact` copies.
- [RFC-001](../rfc/0001-multi-tenant-architecture.md) — Tenant ≠ Client; every tenant-scoped table carries `tenantId`.
- [sprint-3.md](../sprints/sprint-3.md) — the sprint plan this model belongs to.
