# Sprint 15 — CRM Pipeline & Follow-up

**Status:** Executed ahead of ratification — the CTO delegated design decisions on 2026-11-13 ("proceed, I validate everything at the end") and asked for the CRM to be prioritised over Sprint 14. Closure is pending the CTO's validation of the list under "Decisions Taken on the CTO's Behalf".
**Drafted:** 2026-11-13
**Objective:** Make Andes CRM the place where prospects and quotes are followed up — a pipeline of opportunities, an activity log, and a dated next step on each.

---

## Context

The CRM stores clients, contacts and proposals but not the commercial thread between them. The firm now has live prospects and sent quotes to chase, and nowhere to see what is pending today. Domain detail in [sprint-15-domain-model.md](../architecture/sprint-15-domain-model.md).

Numbering: Sprint 13 (numerical service, ADR-010) and Sprint 14 (Analytics) are proposed and not yet ratified; this sprint was pulled ahead of both at the CTO's request.

## Scope

1. **Domain & data layer** (`packages/db`): `Opportunity`, `OpportunityActivity`, the two enums, and `Proposal.opportunityId` / `sentAt` / `decidedAt`; hand-written domain + RLS migrations (the four-policy pattern, verbatim); isolation suite extended for both new tables.
2. **API** (`packages/api`, `routers/crm/`): `opportunities` router — `list`, `get`, `create`, `update`, `setStage`, `logActivity`. Proposals: `create` accepts `opportunityId`; `send` / `decide` / `markExpired` stamp the timestamps and apply the two stage automations. Unit tests for the Zod schemas and the follow-up classification; integration tests for the lifecycle, the automations, the denials and the cross-tenant sweep.
3. **UI** (`apps/core`): `/crm/pipeline` — follow-up agenda (overdue / today / upcoming / no next step, plus sent proposals awaiting an answer), stage board with drag-and-drop, closed opportunities; `/crm/pipeline/[id]` — stage stepper, activity composer and timeline, next step, linked proposals, won/lost. CRM tabs become **Pipeline | Clients | Proposals**; the proposals list shows when each was sent and how long it has been waiting.

## Out of Scope

Reminders (email/push), calendar sync, automatic lead capture from the public website, win-rate analytics (Sprint 14), custom stages per tenant, activity editing/deletion, UI translation.

## Testing Commitments

Strict tier: RLS isolation of `opportunity` and `opportunity_activity`, and the cross-tenant sweep of every new procedure, including user-controlled foreign ids (`clientId`, `contactId`, `ownerId`, `opportunityId`). Integration: full lifecycle and both automations. UI verified by browser walkthrough.

## Rollout Notes

Two migrations to Neon. No new infrastructure, secret, dependency or cost. Existing proposals keep `sentAt` / `decidedAt` empty.

## Decisions Taken on the CTO's Behalf

To validate (each is detailed in the domain model's "Open Questions"):

1. A prospect is a `Client`; no separate Lead entity.
2. Opportunities move freely between stages and can be reopened.
3. One dated next step per opportunity, as fields.
4. Sending a linked proposal → `QUOTED`; accepting it → `WON`. Nothing else automatic.
5. Six fixed stages: Lead, Contacted, Quoted, Negotiation, Won, Lost.
6. Pipeline and amounts visible to every member of the firm.
7. `sentAt` / `decidedAt` not back-filled.
8. Navigation: **Pipeline** becomes the first CRM tab at `/crm/pipeline`; `/crm` remains the clients list ([navigation.md](../design/navigation.md) amended).
9. UI copy stays in English, like the rest of the platform.

## References

- [sprint-15-domain-model.md](../architecture/sprint-15-domain-model.md)
- [sprint-4.md](sprint-4.md) — the Proposal Generator this builds on.
- `sprint-14.md` (proposed, not yet merged) — Analytics; gains proposal cycle time from the timestamps added here.
