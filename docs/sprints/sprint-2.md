# Sprint 2 — Projects Module

**Status:** Closed — 2026-07-08
**Drafted:** 2026-07-07 · **Ratified:** 2026-07-07 (as proposed, including the domain model's three recommendations)
**Objective:** Projects module MVP — tenant-scoped project registry on the Andes Core shell.

---

## Context

[PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) sequences Sprint 2 as **Projects**, and the platform now has everything it depends on: identity/tenancy (Sprint 0) and the UI shell with a stubbed `/projects` route (Sprint 1). The domain model is drafted in [sprint-2-domain-model.md](../architecture/sprint-2-domain-model.md) and is ratified together with this plan.

## Proposed Scope

1. **Domain & data layer** (`packages/db`): `Client` (minimal) and `Project` entities per the domain model — migration, RLS policies for both tables, seed touch-up for dev. Tenant-isolation tests at the strict tier (non-negotiable per [PROJECT_RULES.md](../foundation/PROJECT_RULES.md)).
2. **API** (`packages/api`): `projects` router — `list` (status filter), `get`, `create`, `update`, `archive` — plus minimal `clients.list`/`clients.create` for inline client creation. All on `tenantProcedure`; `archive` on `roleProcedure(OWNER_ADMIN)` — the first real role-gated procedure. Zod input schemas unit-tested; integration tests for the CRUD path and cross-tenant denial.
3. **UI** (`apps/core`): enable **Projects** in the sidebar — list page (table: code, name, client, status badge, dates), create form (React Hook Form + Zod per [ADR-001](../adr/0001-technology-stack.md) — their first use), detail/edit page, archive action gated by role. Dashboard upgrade: the Projects placeholder card becomes a real "active projects" count.
4. **`@andes/ui` growth as needed** (reuse before creation): likely `Input`, `Label`, `Select`, `Table`, `Dialog` — added to the design system doc as they land.

## Out of Scope

- CRM enrichment of `Client` (contacts, pipeline) — Sprint 3.
- Project artifacts: documents, tasks, inspections, calculations — their own sprints.
- Project team assignment / per-project permissions — needs the deferred permission-granularity design first.
- Auto-numbering of project codes; import of existing project lists.

## Testing Commitments

Tenant-scoping logic (RLS policies for `client`/`project`, tenantProcedure coverage, cross-tenant access denial) is treated at the strict tier per [RFC-001](../rfc/0001-multi-tenant-architecture.md) and [PROJECT_RULES.md](../foundation/PROJECT_RULES.md); Zod schemas and any domain logic get unit tests; the create→list→update→archive path gets an integration test.

## Open Decisions for the CTO

1. **Ratify the domain model** — including its three recommendations (minimal `Client` entity; `status` as Prisma enum; human-assigned per-tenant-unique `code`). See [sprint-2-domain-model.md](../architecture/sprint-2-domain-model.md).
2. **Ratify this scope** — or trim item 3's detail page to a follow-up if the sprint runs long (list + create are the core).

## Retrospective (closure, 2026-07-08)

**Objective met — all four scope items shipped to production across three CI-gated PRs**, in the documented order (domain → data → API → UI):

- **PR #10 — data layer:** `Client` + `Project` per the ratified model; migrations `projects_domain` + `projects_rls` (strict tenant scoping, no bootstrap branch); RLS integration suite extended to 13 cases, all green against Postgres as `andes_app`.
- **PR #11 — API:** `projects` (list/get/create/update/archive) + `clients` (list/create) routers; `archive` role-gated to `OWNER_ADMIN` — the platform's first real `roleProcedure` use; same-tenant client verification; 23 tests including 7 integration cases running the real middleware chain (CRUD path, role gate, cross-tenant read/write denials, per-tenant code uniqueness).
- **PR #12 — UI:** `/projects` live on the shell (list + filter, create dialog with inline client creation on React Hook Form + Zod — their first platform use — detail/edit, role-mirrored archive); `@andes/ui` grew Input/Label/Select/Table/Dialog; tRPC React client + server caller wired (TanStack Query per ADR-001); dashboard shows the live active-projects count.

**Verification:** full E2E in a real browser against the production build (create with inline client → edit → ENGINEER sees no archive → OWNER_ADMIN archives → read-only state); a date-only timezone shift bug was caught and fixed during that pass. Production rollout: migrations applied to Neon (unpooled URL — the pooler breaks `migrate deploy`), `andes_app` grants on the new tables verified, smoke test green. **CTO approval on the deployed module (2026-07-08) closes the sprint.**

**Deviations:** none against the ratified scope.

**Carry-over:**

1. Client-side date-only handling is formatted in UTC — revisit if the platform ever needs tenant-local calendars.
2. Project list pagination/search — when real data volume demands it.
3. Standing items: invite flow, mobile nav, dark-mode tokens (from [sprint-1.md](sprint-1.md)).

## References

- [sprint-2-domain-model.md](../architecture/sprint-2-domain-model.md) — the domain this sprint implements.
- [sprint-1.md](sprint-1.md) — closed; provides the shell this module renders in.
- [engineering-principles.md](../foundation/engineering-principles.md) — workflow and sprint philosophy.
