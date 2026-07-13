# Andes Engineering Platform — Engineering Handbook

**Version:** 1.0
**Status:** Foundation phase — active
**Source:** Derived from `Andes Engineering Platform.md` (Project Continuity Document, v1.0, 2026-07-03)
**Owner:** CTO / Lead Software Architect

---

## Purpose

This handbook is the permanent memory of the Andes Engineering Platform project.

It exists so that any person or AI assistant — Claude Code, ChatGPT, Cursor, GitHub Copilot, or a new engineer joining the team — can understand the project's goals, decisions, and constraints **without relying on prior conversation history.**

If a decision is not written here, it does not exist as project truth yet.

## How to Use This Handbook

**If you are a human contributor:** start with [VISION.md](VISION.md) and [MISSION.md](MISSION.md) to understand why this project exists, then read [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md) to understand what is being built.

**If you are an AI coding assistant:** read [ai-principles.md](ai-principles.md) first. It defines your role boundaries and the required session start protocol before you write or recommend any code.

**If you are about to propose or evaluate an architectural decision:** read [architecture-principles.md](architecture-principles.md) and use the ADR process described in [engineering-principles.md](engineering-principles.md). Do not modify architecture without one.

## Handbook Structure

The full Engineering Handbook is planned to reach 250–500 pages across 40–50 markdown files, organized as:

| Directory            | Contents                                                                                      | Status                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `docs/foundation/`   | Identity, philosophy, principles, glossary, project rules                                     | ✅ Drafted (11 documents)                                                          |
| `docs/product/`      | Target market, business model, personas, journeys, roadmap                                    | 🕓 Planned                                                                         |
| `docs/architecture/` | Architecture overview, DDD, module definitions, database, API, auth, security, infrastructure | 🔶 Started — Sprint 0 domain model drafted                                         |
| `docs/design/`       | Design system, component library, UX guidelines, navigation, tokens                           | 🔶 Started — design system + navigation (Sprint 1)                                 |
| `docs/engineering/`  | Module-by-module technical documentation                                                      | 🕓 Planned                                                                         |
| `docs/ai/`           | Engineering Copilot specification and prompts                                                 | 🕓 Planned                                                                         |
| `docs/development/`  | Setup, workflows, conventions                                                                 | 🕓 Planned                                                                         |
| `docs/sprints/`      | Sprint plans and retrospectives                                                               | 🔶 Active — Sprints [0](../sprints/sprint-0.md)–[8](../sprints/sprint-8.md) closed |
| `docs/adr/`          | Architecture Decision Records                                                                 | ✅ Template + ADR-001 to ADR-004                                                   |
| `docs/rfc/`          | Requests for Comments (cross-cutting changes)                                                 | ✅ Template + RFC-001 — _added directory, not in the original planned structure_   |

## Foundation Documents Index

| Document                                                 | Purpose                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [VISION.md](VISION.md)                                   | Where the platform and the company are going, long term                                      |
| [MISSION.md](MISSION.md)                                 | What we are building right now, and the non-negotiable qualities it must have                |
| [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md)               | Product portfolio, functional scope, delivery sequencing                                     |
| [engineering-philosophy.md](engineering-philosophy.md)   | The cultural mindset behind how we build                                                     |
| [project-principles.md](project-principles.md)           | How the project is governed: human/AI roles, documentation, language                         |
| [engineering-principles.md](engineering-principles.md)   | How engineering work is executed: workflow, decision standards, sprint discipline            |
| [architecture-principles.md](architecture-principles.md) | How the system is structured: DDD-first, modularity, ADR discipline                          |
| [ai-principles.md](ai-principles.md)                     | The AI Copilot vision and operating rules for any AI assistant working on this project       |
| [PROJECT_RULES.md](PROJECT_RULES.md)                     | Operational rulebook: git workflow, Definition of Done, testing strategy, AI assistant rules |
| [glossary.md](glossary.md)                               | Shared vocabulary — technical and domain-specific                                            |

## Governing Rule

> Architecture is designed by humans. Implementation is delegated to AI.

Any AI assistant working on this codebase must implement previously documented decisions — never invent new ones. If an assistant finds an inconsistency between this handbook and the current state of the project, it must propose an **ADR** (see `docs/adr/`) before modifying architecture, and must not generate code until the design is approved.

## Ratified Decisions

The following are no longer tentative — they are binding until superseded by a new ADR/RFC:

- [ADR-001: Technology Stack](../adr/0001-technology-stack.md)
- [ADR-002: Authentication Provider (Better Auth)](../adr/0002-authentication-provider.md)
- [ADR-003: API Layer (tRPC)](../adr/0003-api-layer.md)
- [ADR-004: Repository Structure (Monorepo)](../adr/0004-repository-structure.md)
- [ADR-005: Deployment Target (Vercel)](../adr/0005-deployment-target.md)
- [ADR-006: CI Provider (GitHub Actions)](../adr/0006-ci-provider.md)
- [ADR-007: Developer Tooling (ESLint, Prettier, Vitest)](../adr/0007-dev-tooling.md)
- [ADR-008: Object Storage (Cloudflare R2)](../adr/0008-object-storage.md)
- [ADR-009: LLM Provider (Anthropic via Vercel AI SDK)](../adr/0009-llm-provider.md)
- [RFC-001: Multi-Tenant Architecture](../rfc/0001-multi-tenant-architecture.md)
- [RFC-002: BIM Viewer](../rfc/0002-bim-viewer.md)
- [RFC-003: AI Agent](../rfc/0003-ai-agent.md)
- `docs/architecture/sprint-0-domain-model.md` — Tenant/User/Role/Membership domain sketch for Sprint 0

## Open Items Found During Drafting

This handbook was assembled directly from the Project Continuity Document. One gap remains open; one has been resolved:

1. ~~**`PROJECT_RULES.md`** referenced but missing~~ — **Resolved.** See [PROJECT_RULES.md](PROJECT_RULES.md).
2. **`engineering-principles.md` vs. `architecture-principles.md`** were listed as two separate planned documents without an explicit boundary in the source material. A working boundary was drafted (workflow/process vs. system structure) — see the editorial note at the top of each file. This should be confirmed, not assumed final.

## Change Control

This is version 1.0 of the Foundation layer. Any change to the philosophy, principles, or product structure described here that affects architecture must go through the ADR process once `docs/adr/` is established. Until then, propose changes explicitly before acting on them.
