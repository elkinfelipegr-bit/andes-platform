# Sprint 5 Domain Model — Inspection Module

**Version:** 1.0
**Status:** Draft — awaiting CTO ratification alongside [sprint-5.md](../sprints/sprint-5.md).
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence — Business → Processes → Domain → Entities → Relationships — for the Inspection Management slice ([PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md), Sprint 5: Inspection Module / **Andes Projects**). This is the first module that attaches engineering records to the project container Sprint 2 built — the pattern every later technical module (Structures, Geo, BIM) will repeat.

## Business

Site inspections are core billable work for an engineering firm: interventoría visits, structural supervision, quality checks during construction. Each inspection happens **within a project**, is performed by one of the firm's engineers on a date, and produces findings — observations with a severity that the client and the builder act on. Today this lives in field notebooks and Word reports disconnected from the project record. The platform must make the inspection a first-class project record with a printable report.

## Processes

1. Staff schedule an inspection for a project: code, purpose/title, planned date, assigned inspector (one of the firm's engineers).
2. The inspector performs the visit and records findings — each with a description, a severity, and optionally where it was observed — plus general notes.
3. The inspection is **completed**: the performed date is stamped and the record freezes — it is now the report of what was found, printable for the client (same print-view pattern ratified in Sprint 4).
4. An inspection that will not happen is **cancelled** (frozen, kept for the record — scheduling history matters).
5. (Later sprints) photos and attachments join the findings — pending the object-storage ADR; finding follow-up/resolution tracking builds on top.

## Domain Concepts

- **Inspection** — a scheduled or performed site visit within a project. Tenant-scoped, project-owned, forward-only lifecycle: `SCHEDULED → COMPLETED | CANCELLED`. Content is editable only while SCHEDULED — a completed inspection is what the inspector reported.
- **Finding** — one observation from the visit: description, severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), optional location. Ordered (position), the ProposalItem pattern applied to field data.
- **Inspector** — a platform `User` who holds a membership in the tenant (staff, not a Contact). The assignment is verified at the application layer — a userId alone proves nothing about tenant membership.

## Entities (draft sketch)

| Entity       | Key Fields                                                                                                                                                 | Notes                                                                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Inspection` | `id`, `tenantId`, `projectId`, `inspectorId`, `code`, `title`, `scheduledFor`, `performedAt?`, `notes?`, `status`, `createdById`, `createdAt`, `updatedAt` | `projectId` **required** — inspections exist only inside projects. `code` unique per tenant, human-assigned (precedent). `inspectorId` → `User`, membership-verified. `performedAt` stamped by completion. |
| `Finding`    | `id`, `tenantId`, `inspectionId`, `position`, `description`, `severity`, `location?`                                                                       | Own `tenantId` (RFC-001 — RLS never joins). Cascade with its inspection. `severity` is a Prisma enum (`FindingSeverity`), platform constant.                                                               |

`status` is a Prisma enum (`InspectionStatus`) — the ratified reasoning from Sprints 2 and 4.

## Relationships

```
Project 1 ──── N Inspection 1 ──── N Finding
                    │
User (inspector) 1 ─┘      User (createdBy) — audit, as everywhere
```

- A `Project` has many `Inspection`s; an `Inspection` belongs to exactly one project — same-tenant enforced at the application layer + RLS.
- `inspectorId` references the global `User`; the API verifies that user holds a `Membership` in the tenant before assignment — the first place the platform validates a User reference beyond the session's own.
- Archived projects keep their inspections readable (engineering history), but new inspections can only be scheduled on non-archived projects.

## Roles & Permissions (role-level only, consistent with Sprints 0–4)

- `OWNER_ADMIN` and `ENGINEER`: schedule, edit (while SCHEDULED), complete, cancel. Field work is both roles' everyday job — no new gate.
- No hard delete: cancelled is the terminal state for inspections that didn't happen.

## Open Questions for Ratification

1. **Inspection `code`: human-assigned per tenant vs. auto-numbered per project.** Recommendation: **human-assigned per tenant** — consistent with projects and proposals; auto-suggestion remains a shared future nicety for all three.
2. **Photos/attachments now vs. later.** Recommendation: **defer** — file upload needs the object-storage ADR (S3 per ADR-001, still unprovisioned). The print-view report (Sprint 4's ratified pattern) is the MVP deliverable; the domain is unaffected when photos arrive as a `FindingAttachment` later.
3. **Finding resolution/follow-up lifecycle.** Recommendation: **defer** — findings are point-in-time records of what was observed. A resolution workflow (assigned, fixed, verified) is real value but a separate objective; layering `FindingStatus` on later breaks nothing.
4. **Inspector as verified platform User vs. free-text name.** Recommendation: **verified `User` reference** — inspections are performed by staff, and the membership check makes the assignment trustworthy; free text would orphan the record from identity (and from future workload/analytics views).

## What This Document Does Not Cover

Prisma/RLS syntax, tRPC signatures, screen design — implementation after ratification. UI location: Inspection Management is a functional module of **Andes Projects**, so it lives under `/projects/inspections` with in-module tabs — the navigation pattern ratified with Sprint 4 (navigation.md), second case.

## References

- [sprint-2-domain-model.md](sprint-2-domain-model.md) — the Project container this attaches to.
- [sprint-4-domain-model.md](sprint-4-domain-model.md) — the lifecycle/print-view/line-record precedents this reuses.
- [sprint-5.md](../sprints/sprint-5.md) — the sprint plan this model belongs to.
