# Sprint 16 Domain Model — CRM at Scale: Health, Forecast, Requests, Report

**Version:** 1.0
**Status:** Proposed — implemented ahead of ratification under the CTO's delegation of 2026-11-13 and his request of 2026-11-15 for a more complete CRM. Not binding until accepted; decisions are listed in [sprint-16.md](../sprints/sprint-16.md).
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Sprint 15 gave the CRM its pipeline. Used for a day, it showed its limit: it lists opportunities but does not say which ones are in trouble, cannot be read as a table, and does not report on its own. This model extends it from a board into the tool a firm with many open quotes actually runs on.

## Business

A firm that quotes a lot loses work in three predictable ways: a request nobody answers, a quote nobody chases, and an opportunity that quietly goes cold. The owner also needs to know what the open pipeline is _worth_ — not the sum of every hope, but a forecast — and needs that picture to arrive without opening the platform.

## Processes

1. A **request arrives** from outside (the website, [ADR-011](../adr/0011-lead-intake.md)). It sits in a **requests inbox** until a member logs the first contact; unanswered after a day, it is late.
2. Every open opportunity has a **health**: is its next step overdue, has its quote waited too long, has it gone cold, is it missing a next step, is it a request nobody answered.
3. Every open opportunity has a **forecast**: a probability of winning (the stage's default, or the owner's own estimate) and an expected close date. Value × probability is what the firm counts on.
4. The pipeline is read two ways: as a **board** (to move things) and as a **list** (to filter, sort and export).
5. A **report** summarises all of it — overdue follow-ups, today's, unanswered requests, quotes awaiting an answer, cold opportunities — and is emailed each working morning to the firm's addresses, or sent on demand.
6. An admin can **delete** a client, project or opportunity created by mistake or as a test.

## Domain Concepts

- **Risk** — a named reason an open opportunity needs attention. Computed on read from facts already recorded; never stored. Thresholds are constants in one place: cold after **14** days without activity, a quote is chased after **7** days without an answer, a request is late after **1** day.
- **Request** — an activity that came from outside rather than from a member. It is what lets the platform tell "nobody has answered" apart from "someone wrote a note".
- **Probability** — 0–100. Defaults by stage (new 10, contacted 25, quoted 50, negotiation 75); won is 100 and lost is 0 as facts, never overridden.
- **Weighted value** — estimated value × probability. Summed per currency, like every other amount.
- **Time in stage** — since the last stage change; moving to the same stage does not restart it.

## Entities (changes)

| Entity                | Change                                                                  | Notes                                                                      |
| --------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `Opportunity`         | + `expectedCloseAt?`, `probability?` (0–100, checked), `stageChangedAt` | Additive. Existing rows take their last update as the stage-change moment. |
| `OpportunityActivity` | `ActivityType` + `REQUEST`                                              | Written by the intake only; members cannot log it.                         |

No new tables. Risks, forecast and the report are readings.

## Rules

- **Deleting is for mistakes, archiving is for history.** `OWNER_ADMIN` only, behind a typed confirmation that states what goes with the record:
  - an **opportunity** goes with its activity; its proposals survive, unlinked;
  - a **client** goes with its contacts, opportunities and proposals; its projects survive, without a client;
  - a **project** goes with everything recorded under it (inspections, calculation and geotechnical records, BIM model rows); a proposal converted into it survives. Files already in object storage are not removed.
- **One read, three consumers.** The board, the list and the emailed report all come from the same pipeline read, so they cannot disagree.
- **The report is sent only when it has something in it.**

## Roles & Permissions

Reading is open to every member, as in Sprint 15. Deleting and sending the report on demand are `OWNER_ADMIN` only.

## Open Questions for Ratification

1. **Hard delete at all.** Sprints 2–4 ratified archive-only, and "proposals are never hard-deleted". This reverses that for admins, at the CTO's explicit request. Recommendation: **accept as built** — typed confirmation, admin only, engineering records never removed as a side effect of deleting a client.
2. **Thresholds 14 / 7 / 1 days**, fixed in code. Recommendation: **yes** for now; per-firm settings later if they prove wrong.
3. **Stage default probabilities 10 / 25 / 50 / 75.** Recommendation: **yes** — a starting point each opportunity can override.
4. **A manually created new lead with no logged contact also shows in the requests inbox.** Recommendation: **yes** — it is equally unattended.
5. **One firm report to the configured addresses** replaces the per-member digests whenever recipients are configured ([ADR-012](../adr/0012-follow-up-digest.md)). Recommendation: **yes** — it is what the CTO asked for.

## What This Document Does Not Cover

Multiple tasks per opportunity, attachments, email/WhatsApp ingestion, per-firm thresholds, custom stages, win-rate analysis by source or reason (Analytics), and deleting uploaded files from storage.

## References

- [sprint-15-domain-model.md](sprint-15-domain-model.md) — the pipeline this extends.
- [ADR-011](../adr/0011-lead-intake.md), [ADR-012](../adr/0012-follow-up-digest.md) — intake and email delivery.
- [sprint-16.md](../sprints/sprint-16.md)
