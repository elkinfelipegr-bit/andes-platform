# ADR-007: Developer Tooling — ESLint, Prettier, Vitest

**Status:** Accepted — ratified by CTO 2026-07-03
**Date:** 2026-07-03
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[PROJECT_RULES.md](../foundation/PROJECT_RULES.md) lists linting/formatting tooling as "Not Yet Decided." Additionally, the testing strategy mandates unit and integration tests (strictly so for tenant-isolation logic per [RFC-001](../rfc/0001-multi-tenant-architecture.md)) but no test runner has been ratified — a gap discovered when Sprint 0's auth/tenant-scoping work needed to write its mandatory tests. These three tools are grouped in one ADR because they are the remaining developer-tooling surface and share one rationale; the CTO may split the decision if any item warrants different treatment.

## Problem

Which linter, formatter, and test runner does the monorepo standardize on, so that AI assistants produce uniformly-styled, uniformly-tested code across all packages without per-package drift?

## Decision

- **ESLint** (flat config) with `typescript-eslint`, plus `eslint-config-next` in Next.js apps. Shared base config lives in `packages/config`, consumed by every workspace package — this is also where the import-boundary rules required by [ADR-004](0004-repository-structure.md) ("products don't silently reach into each other's internals") will be enforced.
- **Prettier** for formatting, one root config, no per-package overrides.
- **Vitest** as the test runner for all packages (unit and integration). Native TypeScript/ESM support, workspace-aware, and Turborepo-cacheable via each package's `test` script.

## Alternatives

- **Biome (lint + format in one)** — much faster and a single tool, but its rule ecosystem is still thinner than ESLint's, and the ADR-004 requirement for custom import-boundary enforcement plus Next.js's first-party ESLint integration favor ESLint. Consistent with [ADR-001](0001-technology-stack.md)'s pattern of preferring the mature ecosystem (Prisma over Drizzle) to lower risk for AI-assisted changes. Revisit if ESLint performance becomes a real monorepo bottleneck.
- **Jest** — the incumbent test runner, but its ESM/TypeScript story requires transform configuration that Vitest makes native; Vitest is the default in the Vite/modern-TS ecosystem this stack already inhabits.
- **Node's built-in test runner** — zero dependencies, but lacks the watch/UI/mocking ergonomics and ecosystem the team and AI assistants will lean on.

## Trade-offs

ESLint + Prettier is two tools (and slower) versus Biome's one — accepted for ecosystem maturity and the boundary-rule requirement. Vitest adds a Vite-based toolchain dependency even in non-Vite packages — accepted for its native TS/ESM support, which removes an entire class of transform-configuration failure modes that would otherwise recur every time an AI assistant scaffolds a package.

## Consequences

- `packages/config` grows shared ESLint and Vitest configuration alongside the existing `tsconfig.base.json`; new packages inherit rather than reinvent.
- `turbo run lint test` becomes meaningful across the workspace and is wired into CI ([ADR-006](0006-ci-provider.md)).
- The mandatory tenant-isolation tests for Sprint 0 are written in Vitest; if this ADR is rejected in favor of another runner, those tests must be ported — they are written against standard `describe/it/expect` to keep that portable.
- Formatting disputes are closed by definition: Prettier's output is canonical.

## Examples

`packages/api` defines `"test": "vitest run"`; its tenant-scoping middleware suite runs locally via `pnpm test`, in CI via Turborepo affected detection, and fails the PR if any isolation invariant breaks.

## Exceptions

None identified. A future non-TypeScript numerical service (ADR-001's exception) would bring its own toolchain under its own ADR.

## References

- [PROJECT_RULES.md](../foundation/PROJECT_RULES.md) — "Not Yet Decided" item this ADR resolves; testing strategy
- [ADR-001](0001-technology-stack.md) — ecosystem-maturity decision pattern
- [ADR-004](0004-repository-structure.md) — import-boundary enforcement requirement
- [ADR-006](0006-ci-provider.md) — CI integration of these tools
