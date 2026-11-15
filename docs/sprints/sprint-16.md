# Sprint 16 — CRM at Scale

**Status:** Executed ahead of ratification — the CTO asked on 2026-11-15 for a more complete CRM, deletion of test records, website requests tracked in the platform and a report by email. Closure is pending his validation of the decisions below.
**Drafted:** 2026-11-15
**Objective:** Turn the pipeline into a CRM a firm with many open quotes can run on: health, forecast, a list view, a requests inbox, a report that arrives by itself, and deletion of mistakes.

---

## Scope

1. **Data** (`packages/db`): `Opportunity.expectedCloseAt` / `probability` / `stageChangedAt`; `ActivityType.REQUEST`. Two additive migrations.
2. **API** (`packages/api`): one shared pipeline read with risks, forecast and aging; `opportunities.delete`, `clients.delete`, `projects.delete` (all `OWNER_ADMIN`); the firm report (`reminders/report.ts`) and `opportunities.sendReport`; the scheduler sends the firm report when recipients are configured.
3. **UI** (`apps/core`): board/list toggle with owner and alert filters, sortable list with CSV export, requests inbox, at-risk panel, forecast tile, risk badges and time-in-stage on cards, forecast fields on the opportunity, the client's commercial history on its page, and typed-confirmation delete on clients, projects and opportunities.

Built on top of Sprint 15, ADR-011, ADR-012 and the Spanish interface; merge those first.

## Testing

Unit: health rules (every threshold and its boundary), forecast. Integration: aging and risks from the pipeline read, stage clock, forecast fields, the firm report, and deletes — role-gated and unable to reach another tenant (strict tier). Browser walkthrough of list, filters, export, inbox, alerts and the delete flow.

## Rollout Notes

Two migrations. `DIGEST_TO_EMAIL` now accepts several addresses separated by commas.

## Decisions Taken on the CTO's Behalf

1. Hard delete for admins, reversing the earlier archive-only decisions, with the cascades described in the domain model.
2. Alert thresholds: cold after 14 days, chase a quote after 7, a request is late after 1.
3. Default probabilities by stage: 10, 25, 50, 75 %.
4. New leads without a logged contact appear in the requests inbox, whatever their origin.
5. One firm-wide report replaces per-member digests when recipients are configured; it is skipped on days with nothing pending.

## References

- [sprint-16-domain-model.md](../architecture/sprint-16-domain-model.md)
