# PRODUCT_STRATEGY.md

**Version:** 1.0
**Status:** Foundation document — high-level strategy only. Detailed product documentation (below) is planned but not yet written.
**Part of:** [Engineering Handbook](README.md)

---

## Scope of This Document

This document captures the product structure and delivery sequencing that were already decided. It is **not** a replacement for the detailed product documentation planned under `docs/product/`:

- Target Market
- Business Model
- Competitor Analysis
- User Personas
- User Journeys
- User Stories
- Features
- Non-functional Requirements
- Product Roadmap

Those remain 🕓 **planned** and should be developed as their own PRDs, following the workflow in [engineering-principles.md](engineering-principles.md).

## Product Portfolio

The platform is a portfolio of eight products (see [VISION.md](VISION.md) for the full rationale):

Andes Core · Andes Projects · Andes CRM · Andes Structures · Andes Geo · Andes BIM · Andes AI · Andes Analytics

## Functional Scope

The following functional modules are known to be in scope for the platform. Their mapping to the eight products above is indicative, not yet ratified as architecture:

| Functional Module        | Likely Product   |
| ------------------------ | ---------------- |
| Dashboard                | Andes Core       |
| Projects                 | Andes Projects   |
| Clients                  | Andes CRM        |
| CRM                      | Andes CRM        |
| Proposal Generator       | Andes CRM        |
| Structural Engineering   | Andes Structures |
| Geotechnical Engineering | Andes Geo        |
| Inspection Management    | Andes Projects   |
| BIM                      | Andes BIM        |
| Reports                  | Andes Analytics  |
| Artificial Intelligence  | Andes AI         |
| Analytics                | Andes Analytics  |
| Notifications            | Andes Core       |
| Authentication           | Andes Core       |
| Administration           | Andes Core       |

## Delivery Strategy

Every sprint focuses on **one objective**. The sequencing logic — foundation and platform mechanics before feature modules, AI last — is deliberate: AI features are only trustworthy once the domain they assist (structural, geotechnical, BIM) already exists and is well-modeled.

| Phase    | Focus                                                               |
| -------- | ------------------------------------------------------------------- |
| Sprint 0 | Foundation, Architecture, Design System, Navigation, Authentication |
| Sprint 1 | Dashboard                                                           |
| Sprint 2 | Projects                                                            |
| Sprint 3 | CRM                                                                 |
| Sprint 4 | Proposal Generator                                                  |
| Sprint 5 | Inspection Module                                                   |
| Sprint 6 | Structural Module                                                   |
| Sprint 7 | Geotechnical Module                                                 |
| Sprint 8 | BIM Module                                                          |
| Sprint 9 | AI Module                                                           |

This order is a starting proposal, not a locked commitment — it should be revisited at the start of each sprint per [engineering-principles.md](engineering-principles.md).

## Technology Direction (Ratified — see ADR-001)

The stack below is now binding, ratified as [ADR-001](../adr/0001-technology-stack.md). Authentication, API layer, and repository structure — left open in the original tentative list — are resolved by their own ADRs.

| Layer                | Choice                                                 | Decision                                          |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| Frontend             | React, Next.js, TypeScript                             | ADR-001                                           |
| UI                   | Tailwind CSS, shadcn/ui                                | ADR-001                                           |
| Database             | PostgreSQL                                             | ADR-001                                           |
| ORM                  | Prisma                                                 | ADR-001                                           |
| Authentication       | Better Auth                                            | [ADR-002](../adr/0002-authentication-provider.md) |
| API layer            | tRPC                                                   | [ADR-003](../adr/0003-api-layer.md)               |
| Repository structure | Monorepo (pnpm + Turborepo)                            | [ADR-004](../adr/0004-repository-structure.md)    |
| State                | Zustand, TanStack Query                                | ADR-001                                           |
| Forms                | React Hook Form                                        | ADR-001                                           |
| Validation           | Zod                                                    | ADR-001                                           |
| Storage              | S3-compatible storage                                  | ADR-001                                           |
| Deployment           | Vercel (direction confirmed; not yet a standalone ADR) | —                                                 |
| Monitoring           | Sentry                                                 | ADR-001                                           |
| Analytics            | PostHog                                                | ADR-001                                           |
| AI                   | OpenAI, Anthropic, Gemini                              | ADR-001                                           |

## Commercialization Path

Internal tool for Andes Engineering's own consulting practice → validated multi-tenant platform → commercial SaaS product for the broader civil engineering consulting market. Tenancy and data isolation are resolved in [RFC-001: Multi-Tenant Architecture](../rfc/0001-multi-tenant-architecture.md) — a tenant is an engineering firm, with Andes Engineering as Tenant #1.
