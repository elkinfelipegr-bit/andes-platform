# ADR-003: API Layer — tRPC

**Status:** Accepted
**Date:** 2026-07-03
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[ADR-001](0001-technology-stack.md) commits to TypeScript end-to-end inside a monorepo ([ADR-004](0004-repository-structure.md)). The original tentative stack in [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) did not specify how the frontend and backend communicate.

## Problem

What API style connects the Next.js frontend to backend logic across eight products sharing one Andes Core, in a way that is fast and safe for AI-assisted development to extend?

## Decision

**tRPC.**

## Alternatives

* **REST** — the most standard and easiest to document/expose publicly; the natural choice if external, non-TypeScript integrators need to call the platform's API. Not needed yet.
* **GraphQL** — better suited to flexible, cross-module queries (e.g. a dashboard combining Projects + CRM + Analytics data), at the cost of significantly more operational complexity than the platform needs at this stage.

## Trade-offs

tRPC gives end-to-end type safety between frontend and backend without hand-written or generated contracts, which fits the monorepo (ADR-004) and lets an AI assistant change a backend procedure and its frontend call site together with compiler-checked confidence. The trade-off is that tRPC is not naturally consumable by external, non-TypeScript clients — relevant once the platform is opened to other engineering firms as a SaaS product with third-party integrations.

## Consequences

* All internal frontend-backend communication within the monorepo uses tRPC procedures, organized per Andes product.
* Every tRPC procedure that touches tenant-scoped data must apply the tenant/role context established by [ADR-002](0002-authentication-provider.md) and [RFC-001](../rfc/0001-multi-tenant-architecture.md) — this should be enforced via shared middleware, not per-procedure discipline.
* A public-facing API for external integrators is explicitly out of scope for this decision.

## Examples

A "create project" action in Andes Projects is a `projects.create` tRPC procedure, called directly and type-safely from the Next.js frontend, with tenant scoping applied by middleware before the resolver runs.

## Exceptions

If and when external third-party integrations are required (e.g. a partner firm's system reading data via API), a REST or GraphQL gateway layered on top of the same backend logic will need its own ADR before implementation. This is anticipated as part of the SaaS commercialization path (see [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md)) but is not being built now.

## References

* [ADR-001](0001-technology-stack.md)
* [ADR-004](0004-repository-structure.md)
