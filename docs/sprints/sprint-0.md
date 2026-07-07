# Sprint 0 — Foundation & Authentication

**Status:** Closed
**Dates:** 2026-07-03 → 2026-07-06
**Objective:** Stand up the platform foundation — monorepo, multi-tenant data layer, authentication, CI, and production deployment — so every later product module builds on ratified decisions, per [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) and the Sprint Philosophy in [engineering-principles.md](../foundation/engineering-principles.md).

---

## Outcome

**Sprint objective met.** The platform runs locally and in production at https://andes-core.vercel.app, with tenant-aware authentication verified end-to-end in both environments.

## What Shipped

- **Monorepo scaffold** (pnpm workspaces + Turborepo, [ADR-004](../adr/0004-repository-structure.md)): `apps/core`, `packages/db`, `packages/auth`, `packages/api`, `packages/config`.
- **Domain schema** (`packages/db`, from [sprint-0-domain-model.md](../architecture/sprint-0-domain-model.md)): Prisma models for `Tenant`, `User`, `Role` (as data, not enum), `Membership`; migrations `init` and `rls_policies`; seed with Andes Engineering as Tenant #1 and the `OWNER_ADMIN` / `ENGINEER` roles; `link-member` operator script.
- **Row-level isolation** ([RFC-001](../rfc/0001-multi-tenant-architecture.md)): PostgreSQL RLS policies plus `forTenant` / `forUser` scoped Prisma clients. Two DB identities: superuser for migrate/seed only, `andes_app` for runtime with RLS enforced.
- **Authentication** (`packages/auth`, [ADR-002](../adr/0002-authentication-provider.md)): Better Auth with email/password; every session resolves to `userId` + `tenantId` + `role` via the `customSession` plugin and `getActiveMembership` (fails closed on multiple memberships).
- **API layer** (`packages/api`, [ADR-003](../adr/0003-api-layer.md)): tRPC middleware chain — `publicProcedure` → `protectedProcedure` → `tenantProcedure` → `roleProcedure` — with `core.health` / `me` / `whoami`.
- **App shell** (`apps/core`): Next.js 15 + Tailwind v4 — login/signup, session dashboard, auth handler, tRPC endpoint.
- **Dev tooling** ([ADR-007](../adr/0007-dev-tooling.md)): ESLint, Prettier, Vitest wired through Turborepo tasks.
- **CI** ([ADR-006](../adr/0006-ci-provider.md)): GitHub Actions — Postgres 17 service container, migrations, format check, `turbo run typecheck lint test build`. Branch protection on `main`: required `ci` check, enforced for admins — all merges go through PRs.
- **Production deployment** ([ADR-005](../adr/0005-deployment-target.md)): Vercel project `andes-core` with Neon Postgres (Marketplace). Runtime connects as `andes_app` (RLS enforced, verified live); owner credentials used for migrations only. `BETTER_AUTH_URL` pinned to the canonical domain.

## Decisions Ratified During the Sprint

[ADR-005](../adr/0005-deployment-target.md) (Vercel), [ADR-006](../adr/0006-ci-provider.md) (GitHub Actions), [ADR-007](../adr/0007-dev-tooling.md) (ESLint/Prettier/Vitest) — proposed, ratified, and implemented within the sprint, closing every item in the handbook's "Not Yet Decided" list.

## Verification

- **Local (2026-07-03):** sign-up → `whoami` 403 (no membership) → `link-member` → `whoami` 200 → 401 without cookie.
- **CI (2026-07-04):** first GitHub Actions run green; RLS tests run against a real Postgres service container.
- **Production (2026-07-06):** root, `/login`, and `/api/auth/ok` healthy; sign-in with bad credentials returns a clean 401 from Neon; RLS verified live (`andes_app` without tenant context sees zero rows; owner sees seed data); origin validation accepts only the canonical domain.

## Deviations & Incidents

- `User.authProviderId` from the domain sketch was not implemented — Better Auth's `Account` table fulfils that intent (recorded in [sprint-0-domain-model.md](../architecture/sprint-0-domain-model.md)).
- Vercel builds required two fix PRs: making the turbo build self-sufficient (PR #1) and bundling the Prisma query engine into serverless functions (PR #2).
- The repo went **public** (2026-07-04): branch protection is free-tier-only on public repos, and ADR-006 requires CI to gate merges.
- Windows operational gotcha: piping a value from PowerShell 5.1 into `vercel env add` prepends a BOM, which broke `BETTER_AUTH_URL` (Better Auth rejects the URL at build time). Use `printf` from Bash for Vercel env values.

## Carry-over (not Sprint 0 scope)

1. **First production user:** sign-up on the canonical domain + `link-member` against Neon to seat the first `OWNER_ADMIN`.
2. **Invite flow** to replace the `link-member` operator script — future sprint, noted in the domain model.
3. **Sprint 1 definition** — per the Golden Rule, scoped and ratified by the CTO before implementation.

## References

- [PROJECT_RULES.md](../foundation/PROJECT_RULES.md) — Definition of Done applied throughout.
- ADRs [001](../adr/0001-technology-stack.md)–[007](../adr/0007-dev-tooling.md), [RFC-001](../rfc/0001-multi-tenant-architecture.md), [sprint-0-domain-model.md](../architecture/sprint-0-domain-model.md).
