# ADR-001: Technology Stack

**Status:** Accepted
**Date:** 2026-07-03
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

The platform must be built by a small team working heavily with AI coding assistants (Claude Code and others), while remaining maintainable for 10+ years across eight independently-evolving products (see [VISION.md](../foundation/VISION.md)). [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) listed a tentative stack pending ratification.

## Problem

Which concrete technologies do we commit to for the platform, given the constraints of: a large, evolving engineering domain; a small team leaning on AI-assisted implementation; and a 10-year maintainability horizon?

## Decision

Ratify the tentative stack from [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) as binding:

| Layer        | Choice                     |
| ------------ | -------------------------- |
| Frontend     | React, Next.js, TypeScript |
| UI           | Tailwind CSS, shadcn/ui    |
| Database     | PostgreSQL                 |
| ORM          | Prisma                     |
| State        | Zustand, TanStack Query    |
| Forms        | React Hook Form            |
| Validation   | Zod                        |
| Storage      | S3-compatible storage      |
| Monitoring   | Sentry                     |
| Analytics    | PostHog                    |
| AI providers | OpenAI, Anthropic, Gemini  |

Three items originally left open in that list are resolved by their own ADRs, not here: authentication provider ([ADR-002](0002-authentication-provider.md)), API layer style ([ADR-003](0003-api-layer.md)), and repository structure ([ADR-004](0004-repository-structure.md)). Deployment target (Vercel) is confirmed as direction but not yet formally ratified — see the open item in [ADR-004](0004-repository-structure.md#references).

TypeScript end-to-end (frontend, backend, validation via Zod, ORM via Prisma) is the unifying decision underneath every row in this table: one language across the whole platform, chosen specifically because it lets AI coding assistants (this project's primary implementation workforce, per [ai-principles.md](../foundation/ai-principles.md)) work consistently across module boundaries without context-switching languages.

## Alternatives

- **Frontend framework:** Remix, plain Vite SPA — rejected in favor of Next.js for its maturity, Vercel-native deployment story, and server component model that fits a data-heavy engineering platform.
- **UI:** Material UI, Chakra — rejected in favor of Tailwind + shadcn/ui for full control over a distinct Andes brand identity without fighting a component library's opinions.
- **Database:** MongoDB / other NoSQL — rejected. Engineering domain data (projects, entities, relationships, approvals) is inherently relational and benefits from strict schema and referential integrity.
- **ORM:** Drizzle — a reasonable alternative; rejected in favor of Prisma for its more mature migration tooling and broader ecosystem familiarity, which lowers risk for AI-assisted schema changes.

## Trade-offs

- Next.js/Vercel optimizes for shipping speed and developer experience over infrastructure control.
- PostgreSQL/Prisma optimizes for relational integrity and schema discipline over the flexibility of a schemaless store — the right trade for engineering data with strict, checkable relationships.
- A single-language (TypeScript) stack optimizes for AI-assisted development safety and cross-module consistency over the flexibility of using the best-fit language per problem (e.g. Python for heavy numerical computation).

## Consequences

- All eight Andes products share one type-safe stack end to end.
- Claude Code and other AI assistants should default to this stack without asking, and should treat a proposal to deviate from it as requiring a new ADR, not a unilateral choice.
- Engineering hiring and onboarding should assume TypeScript proficiency as a baseline.

## Examples

A new module — e.g. a structural calculation feature in Andes Structures — is implemented as TypeScript business logic inside the monorepo (see [ADR-004](0004-repository-structure.md)), validated with Zod, persisted via Prisma/PostgreSQL, and exposed to the frontend via tRPC (see [ADR-003](0003-api-layer.md)).

## Exceptions

Specialized, computationally heavy structural or geotechnical analysis (e.g. finite element computation) may eventually justify a dedicated numerical service outside this stack (for example, Python with scientific libraries). This is not decided or needed yet — it would require its own ADR before implementation, triggered only when a specific module's requirements demand it.

## References

- [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) — original tentative stack
- [engineering-principles.md](../foundation/engineering-principles.md) — Decision Documentation Standard
- [ADR-002](0002-authentication-provider.md), [ADR-003](0003-api-layer.md), [ADR-004](0004-repository-structure.md)
