# ADR-004: Repository Structure — Monorepo

**Status:** Accepted
**Date:** 2026-07-03
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[VISION.md](../foundation/VISION.md) requires eight products (Andes Core, Projects, CRM, Structures, Geo, BIM, AI, Analytics) that must be able to evolve independently while sharing a common Core. Implementation work is heavily delegated to AI coding assistants (see [ai-principles.md](../foundation/ai-principles.md)).

## Problem

Do we organize the codebase as one repository or as separate repositories per product?

## Decision

**Monorepo**, using pnpm workspaces and Turborepo. Each Andes product is an internal app/package; Andes Core is a shared internal package consumed by the others.

## Alternatives

**Polyrepo** — one repository per product, with Andes Core published and imported as a versioned package. Gives stronger deployment isolation per product but adds real friction for any change that spans modules, and makes it harder for an AI assistant to reason about the whole system in a single session, since cross-repo context has to be assembled manually.

## Trade-offs

A monorepo makes cross-module refactors and shared-Core changes cheap and keeps everything visible to an AI coding assistant working in one session, at the cost of needing deliberate package boundaries (via workspace structure and lint rules) so that products don't silently reach into each other's internals and recreate a monolith inside the monorepo.

## Consequences

* CI runs against the whole repository, using Turborepo's affected-package detection so unrelated products aren't rebuilt/retested unnecessarily.
* Module boundaries are enforced by package boundaries and import/lint rules — not by repository separation — and must be respected as if they were separate repos.
* Vercel deployment (tentative direction from [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md), not yet a standalone ADR) targets this monorepo directly, with preview deployments per pull request per `PROJECT_RULES.md`.

## Examples

```
/apps
  /core        (Andes Core: auth, tenancy, navigation shell)
  /projects    (Andes Projects)
  /crm         (Andes CRM)
  /structures  (Andes Structures)
  /geo         (Andes Geo)
  /bim         (Andes BIM)
  /ai          (Andes AI)
  /analytics   (Andes Analytics)
/packages
  /db          (Prisma schema + client)
  /ui          (shared shadcn/ui-based component library)
  /auth        (Better Auth config + tenant/role helpers)
  /config      (shared TS/ESLint/Tailwind config)
```

This layout is illustrative for Sprint 0 planning, not a final ratified file tree — refine it as an implementation detail once Claude Code scaffolds the repo.

## Exceptions

If a specific product later needs a fully independent deployment lifecycle or is sold/spun out separately, it can be extracted into its own repository at that time. That extraction is itself an architectural change and would require its own ADR.

## References

* [ADR-001](0001-technology-stack.md)
* [VISION.md](../foundation/VISION.md)
* Open item: Vercel as the deployment target is confirmed as direction but has not been ratified as its own ADR. Recommended before Sprint 0 implementation begins, since it affects environment/secrets structure in the monorepo above.
