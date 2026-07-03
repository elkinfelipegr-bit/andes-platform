# Andes Engineering Platform — Claude Code Instructions

This repository is governed by the Engineering Handbook in `docs/`. You must read it before writing or recommending any code. Do not rely on chat history from previous sessions — this handbook is the permanent memory of the project.

## Required reading (every session, before touching code)

@docs/foundation/README.md
@docs/foundation/ai-principles.md
@docs/foundation/PROJECT_RULES.md
@docs/foundation/architecture-principles.md
@docs/foundation/engineering-principles.md

## Ratified decisions (read before implementing anything architectural)

@docs/adr/0001-technology-stack.md
@docs/adr/0002-authentication-provider.md
@docs/adr/0003-api-layer.md
@docs/adr/0004-repository-structure.md
@docs/rfc/0001-multi-tenant-architecture.md
@docs/architecture/sprint-0-domain-model.md

Also ratified (browse on demand per the Maintenance Note below, not auto-imported): `docs/adr/0005-deployment-target.md` (Vercel), `docs/adr/0006-ci-provider.md` (GitHub Actions), `docs/adr/0007-dev-tooling.md` (ESLint/Prettier/Vitest).

## Background context (read if you need the "why", not required for every task)

`docs/foundation/VISION.md`, `docs/foundation/MISSION.md`, `docs/foundation/PRODUCT_STRATEGY.md`, `docs/foundation/engineering-philosophy.md`, `docs/foundation/project-principles.md`, `docs/foundation/glossary.md`

## Golden Rule

> Architecture is designed by humans. Implementation is delegated to AI.

You implement previously documented decisions. You do not invent new ones. If you find an inconsistency between this handbook and what you are being asked to do, **propose an ADR or RFC and stop** — do not resolve it unilaterally, and do not generate code until the design is approved.

New ADRs go in `docs/adr/`, new RFCs in `docs/rfc/`, following the templates already there and the Decision Documentation Standard in `engineering-principles.md` (Context, Problem, Decision, Alternatives, Trade-offs, Consequences, Examples, Exceptions, References).

## Maintenance Note

As more ADRs/RFCs accumulate, do not keep auto-importing all of them here forever — that will bloat every session's context. Periodically prune this file back to `docs/adr/` and `docs/rfc/` as directories to browse on demand, keeping only the handful still directly relevant to active work.
