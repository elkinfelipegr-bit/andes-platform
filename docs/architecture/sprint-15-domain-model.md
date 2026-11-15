# Sprint 15 Domain Model — CRM Pipeline: Opportunities & Follow-up

**Version:** 1.0
**Status:** Proposed — implemented ahead of ratification under the CTO's explicit delegation of 2026-11-13 ("proceed, I validate everything at the end"). Every recommendation below is listed for that end-of-sprint validation in [sprint-15.md](../sprints/sprint-15.md); nothing here is binding until the CTO accepts it.
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence for the commercial follow-up slice of Andes CRM. Sprints 3 and 4 gave the CRM its records (clients, contacts) and its document (the proposal). What is still missing is the _process between them_: knowing which prospects are alive, what was last said to each one, and what the next step is and when.

## Business

An engineering firm wins work by following up: a prospect asks for a quote, the firm answers, sends a proposal, and then calls back until there is a decision. Today that thread lives in memory, WhatsApp and email. A prospect that nobody calls back is lost revenue, and a sent proposal nobody chases is the most common way it happens.

## Processes

1. A **lead arrives** (website tool, referral, call). Someone records it as an **opportunity**: who the prospect is, what they need, a rough value, and where it came from.
2. Every **interaction** is logged against the opportunity — a call, an email, a meeting, a WhatsApp, a note — as it happens.
3. Every open opportunity carries a **next step with a date**. The follow-up agenda is that list sorted by date: overdue first, then today, then the coming days. An open opportunity _without_ a next step is itself a warning.
4. The opportunity **moves through stages** as it matures: new → contacted → quoted → negotiation → won / lost.
5. A **proposal** (Sprint 4) is prepared _for_ an opportunity. Sending it puts the opportunity in "quoted"; the client accepting it wins the opportunity. A rejected proposal does not lose the opportunity — a revised quote is common.
6. A lost opportunity records **why** — the only raw material for improving the win rate later.

## Domain Concepts

- **Opportunity** — one potential engagement with one client: the unit of commercial follow-up. Distinct from the `Proposal`, which is the priced document sent within it (an opportunity may have none yet, or several revisions).
- **Stage** — where the opportunity stands. Open stages are a working board, not a document lifecycle: unlike a proposal (forward-only, Sprint 4 decision 3), an opportunity may move backwards and may be reopened after closing, because a "lost" client does call back.
- **Activity** — one logged interaction. Append-only history; the opportunity's memory.
- **Next step** — the single pending action on an opportunity, with its due date. Deliberately a pair of fields on the opportunity, not a task entity: one opportunity, one next step.
- **Prospect** — _not_ a new entity. A prospect is a `Client` that has not bought yet. Keeping one table avoids a lead-to-client conversion step and keeps contacts, proposals and projects pointing at the same record.

## Entities (draft sketch)

| Entity                | Key Fields                                                                                                                                                                                               | Notes                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Opportunity`         | `id`, `tenantId`, `clientId`, `contactId?`, `title`, `stage`, `estimatedValue?`, `currency`, `source?`, `ownerId`, `nextAction?`, `nextActionAt?`, `lostReason?`, `closedAt?`, `createdById`, timestamps | Client `Restrict` (the proposal precedent). `ownerId` must be a member of the tenant. `closedAt` is stamped on WON/LOST and cleared on reopen. Never hard-deleted through the API.                 |
| `OpportunityActivity` | `id`, `tenantId`, `opportunityId`, `type`, `body`, `occurredAt`, `createdById`, `createdAt`                                                                                                              | Carries its own `tenantId` (RFC-001: never scoped through a join). Append-only.                                                                                                                    |
| `Proposal` (extended) | + `opportunityId?`, `sentAt?`, `decidedAt?`                                                                                                                                                              | `opportunityId` `SetNull`; the opportunity must belong to the proposal's client. `sentAt` / `decidedAt` are stamped by the existing transitions — the gap Sprint 14's proposal had to work around. |

**Enums** (the `ProposalStatus` precedent — enum, not data): `OpportunityStage` = `LEAD`, `CONTACTED`, `QUOTED`, `NEGOTIATION`, `WON`, `LOST`; `ActivityType` = `NOTE`, `CALL`, `EMAIL`, `MEETING`, `WHATSAPP`, `VISIT`.

## Relationships

```
Client 1 ──── N Opportunity 1 ──── N OpportunityActivity
                    │
                    ├── 0..1 Contact (of that client)
                    ├── 1 owner User (member of the tenant)
                    └── N Proposal (0..1 opportunity per proposal)
```

## Rules

- **Stage ↔ proposal automation.** Sending a linked proposal moves an opportunity that is in `LEAD` or `CONTACTED` to `QUOTED`. Accepting a linked proposal moves an open opportunity to `WON`. Nothing else is automatic: rejection and expiry leave the stage alone.
- **Losing requires a reason.** Moving to `LOST` without `lostReason` is refused.
- **Closing clears the next step.** A closed opportunity has nothing pending; reopening it starts without one.
- **Estimated value is an estimate.** It is entered by hand and is never derived from, nor does it constrain, a proposal's total.

## Roles & Permissions

Every member of the tenant (`OWNER_ADMIN`, `ENGINEER`) can read and work the pipeline — the Sprint 3/4 precedent for clients and proposals, where amounts are already visible to both roles. No role gate is added.

## Open Questions for Ratification

1. **Prospect = Client** (no separate Lead entity). Recommendation: **yes**.
2. **Free stage movement and reopening**, unlike the proposal's forward-only lifecycle. Recommendation: **yes** — the board is a working tool.
3. **One next step per opportunity as fields**, not a Task entity. Recommendation: **yes**; a task entity can replace it later without losing data.
4. **Automation on send / accept** as described under Rules. Recommendation: **yes**, and no more than that.
5. **Stage set fixed as an enum** (six values). Recommendation: **yes** for now; per-tenant configurable stages would be a later, larger change.
6. **Pipeline visible to every member**, amounts included. Recommendation: **yes**, consistent with proposals. Sprint 14's proposal restricts _aggregated_ money to `OWNER_ADMIN`; that question belongs to Analytics, not here.
7. **`sentAt` / `decidedAt` on `Proposal`**, not back-filled for existing rows. Recommendation: **yes** — existing SENT proposals show "date unknown" rather than an invented date.

## What This Document Does Not Cover

Prisma/RLS syntax, tRPC signatures and screen layout — implementation. Out of the domain for now: reminders by email or push, calendar sync, email/WhatsApp ingestion, win-rate reporting (Analytics, Sprint 14), per-tenant custom stages, and capturing leads automatically from the public website tools (a cross-system integration that needs its own decision).

## References

- [sprint-3-domain-model.md](sprint-3-domain-model.md), [sprint-4-domain-model.md](sprint-4-domain-model.md) — the Client/Contact and Proposal models this extends.
- [RFC-001](../rfc/0001-multi-tenant-architecture.md) — every new table carries `tenantId` + RLS.
- [sprint-15.md](../sprints/sprint-15.md) — the sprint plan this model belongs to.
