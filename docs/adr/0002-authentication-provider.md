# ADR-002: Authentication Provider — Better Auth

**Status:** Accepted
**Date:** 2026-07-03
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[ADR-001](0001-technology-stack.md) left the choice between Better Auth and Auth.js open. [RFC-001](../rfc/0001-multi-tenant-architecture.md) establishes that a tenant is an engineering firm, with data isolated by `tenantId` at the row level — authentication and session data must carry tenant and role context from the first request.

## Problem

Which authentication library do we standardize on, given the multi-tenant model in RFC-001 and the need for full control over the user/session schema?

## Decision

**Better Auth.**

## Alternatives

- **Auth.js (NextAuth)** — more established, more OAuth providers out of the box, but historically less flexible for custom multi-tenant session/organization models without significant workarounds.
- **Managed external provider (Clerk, Auth0, WorkOS)** — less code to maintain, but recurring per-user cost and less control over the user data model, which matters once the platform is sold to other engineering firms as SaaS (see [VISION.md](../foundation/VISION.md)) and user data ownership becomes a sales/compliance question.

## Trade-offs

Better Auth is self-hosted and TypeScript-native, giving full control over the session/organization/role model needed for RFC-001's tenant isolation — at the cost of maintaining more auth code ourselves instead of delegating to a managed vendor.

## Consequences

- User, session, and membership (tenant + role) data lives in our own PostgreSQL database, under [ADR-001](0001-technology-stack.md)'s stack.
- Every authenticated session must resolve to a `tenantId` and `role`, consistent with the Sprint 0 domain model (see `docs/architecture/sprint-0-domain-model.md`).
- Tenant-scoping logic in auth callbacks becomes security-critical code and must be covered by the testing strategy in `PROJECT_RULES.md`.

## Examples

A login resolves to a session object carrying `userId`, `tenantId`, and `role`, which every tRPC procedure (see [ADR-003](0003-api-layer.md)) reads to scope its queries.

## Exceptions

None identified yet. Revisit if future enterprise customers require compliance certifications (e.g. SOC 2) that are easier to satisfy via a managed provider — that would be a new ADR, not a silent migration.

## References

- [ADR-001](0001-technology-stack.md)
- [RFC-001: Multi-Tenant Architecture](../rfc/0001-multi-tenant-architecture.md)
