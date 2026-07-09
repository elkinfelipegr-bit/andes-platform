# Sprint 4 Domain Model — Proposal Generator

**Version:** 1.0
**Status:** Draft — awaiting CTO ratification alongside [sprint-4.md](../sprints/sprint-4.md).
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence — Business → Processes → Domain → Entities → Relationships — for the Proposal Generator slice ([PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md), Sprint 4: Proposal Generator / Andes CRM). The proposal is the bridge between the modules already built: it is **sent to** a CRM client (Sprint 3) and, when won, **becomes** a project (Sprint 2).

## Business

An engineering firm wins work by sending commercial proposals (propuestas/cotizaciones) to its clients: scope of services, itemized pricing, validity period. Today this lives in Word/Excel with no link to the client record or to the project that follows a win. The platform must make the proposal a first-class record: drafted against a client, itemized, tracked through its commercial lifecycle, and converted into a project when accepted — so revenue history and engineering execution share one thread.

## Processes

1. Staff draft a proposal for a client (optionally addressed to a specific contact): per-tenant code, title, scope text, line items (description, quantity, unit, unit price), currency, validity date. Totals derive from the items.
2. The proposal is issued — status **SENT**. The platform records the state change; transmitting the document to the client happens outside the platform for now (see open question 2).
3. The client decides: **ACCEPTED** or **REJECTED**. A SENT proposal whose validity lapses can be marked **EXPIRED**.
4. An accepted proposal is **converted into a project**: a DRAFT `Project` prefilled from the proposal (same client, name from title), permanently linked — commercial origin traceable from engineering execution and vice versa.
5. Proposals are never hard-deleted: they are the firm's commercial record.

## Domain Concepts

- **Proposal** — a commercial offer from the tenant to one of its clients. Tenant-scoped, client-owned, with a forward-only lifecycle. Content is editable **only in DRAFT** — once sent, it is what the client saw.
- **ProposalItem** — one priced line of the offer (e.g. "Diseño estructural — 450 m² — $X/m²"). Order matters (position). Money is exact decimal, never float.
- **Lifecycle** — `DRAFT → SENT → ACCEPTED | REJECTED`, plus `SENT → EXPIRED`. Forward-only; no transition re-opens a decided proposal (a revision is a new proposal).
- **Conversion** — the ACCEPTED → Project step. One project per proposal, at most once.

## Entities (draft sketch)

| Entity         | Key Fields                                                                                                                                                                        | Notes                                                                                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Proposal`     | `id`, `tenantId`, `clientId`, `contactId?`, `projectId?`, `code`, `title`, `scope?`, `currency` (default `COP`), `validUntil?`, `status`, `createdById`, `createdAt`, `updatedAt` | `code` unique per tenant, human-assigned (project-code precedent). `clientId` **required** — a proposal always addresses a client. `contactId` optional recipient (SetNull on contact delete). `projectId` set only by conversion (unique). |
| `ProposalItem` | `id`, `tenantId`, `proposalId`, `position`, `description`, `quantity` (Decimal), `unit`, `unitPrice` (Decimal)                                                                    | Carries its own `tenantId` (RFC-001 — RLS never depends on a join). Cascade with its proposal. **Totals are computed from items, never stored** — single source of truth.                                                                   |

`status` is a Prisma enum (`ProposalStatus`) — same reasoning ratified for `ProjectStatus` in Sprint 2: platform workflow constants, not tenant-customizable data.

## Relationships

```
Client 1 ──── N Proposal 1 ──── N ProposalItem
   │              │ 0..1
   │              │
Contact 0..1 ─────┘ (recipient)      Proposal 0..1 ──── 1 Project (conversion)
```

- A `Client` has many `Proposal`s; a `Proposal` addresses exactly one client (same-tenant enforced at the application layer + RLS, as with projects).
- A `Proposal` optionally names a recipient `Contact` — which must belong to the same client.
- Conversion links one `Proposal` to one `Project` (unique FK); the project keeps living its own lifecycle.

## Roles & Permissions (role-level only, consistent with Sprints 0–3)

- `OWNER_ADMIN` and `ENGINEER`: create/edit drafts, send, record the client's decision, mark expired, convert accepted proposals.
- No hard delete for either role — lifecycle ends at REJECTED/EXPIRED, or continues into a project.
- No new OWNER_ADMIN-only action this sprint: issuing proposals is the everyday commercial work of both seed roles.

## Open Questions for Ratification

1. **Line items vs. a single amount field.** Recommendation: **line items.** Itemized pricing is the generator's core value and what clients expect to read; a single amount would be re-modeled in one sprint anyway. Totals computed, never stored.
2. **PDF/document generation now vs. later.** Recommendation: **defer the PDF file.** File generation needs object storage (S3 per ADR-001 — not provisioned) and template design — that is its own ADR when prioritized. Sprint 4 ships a **print-optimized proposal view** (browser print → PDF) as the pragmatic generator; the domain model is unaffected either way.
3. **Status transition enforcement.** Recommendation: **forward-only, enforced by the API** — content edits only in DRAFT; SENT can move to ACCEPTED/REJECTED/EXPIRED; decided states are terminal. A revision is a new proposal (copy action can come later).
4. **Conversion shape.** Recommendation: `convertToProject` creates a DRAFT project (client and name prefilled; project code supplied by the user at conversion, since firms number projects independently) and stamps `proposal.projectId`. At most one conversion per proposal.

## What This Document Does Not Cover

Prisma/RLS syntax, tRPC signatures, screen design — implementation after ratification. UI location: proposals are a functional module of **Andes CRM** ([PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) module map), so they live under `/crm/proposals` with in-module navigation — an amendment to [navigation.md](../design/navigation.md) ships with the sprint.

## References

- [sprint-3-domain-model.md](sprint-3-domain-model.md) — the Client/Contact this builds on.
- [sprint-2-domain-model.md](sprint-2-domain-model.md) — the Project a won proposal becomes; the code/status precedents.
- [sprint-4.md](../sprints/sprint-4.md) — the sprint plan this model belongs to.
