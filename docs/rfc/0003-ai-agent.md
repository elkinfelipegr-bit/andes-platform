# RFC-003: AI Agent — the Engineering Copilot

**Status:** Proposed — awaiting CTO ratification
**Date:** 2026-07-12
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) sequences Sprint 9 — the last of the original sequence — as the **AI Module**, and [engineering-principles.md](../foundation/engineering-principles.md) has listed "RFC-003 — AI Agent — not yet drafted" since Sprint 0. The ordering was deliberate ([ai-principles.md](../foundation/ai-principles.md)): the Copilot only becomes trustworthy once the domains it assists exist and are well-modeled. That condition is now met — six modules are live in production (Projects, CRM, Proposals, Inspections, Structures, Geo, BIM), each with a documented domain model and tenant-scoped services.

## Problem

An AI assistant crosses three boundaries at once, and each must be decided before any code: (1) **data** — what tenant data the model may see, given RFC-001's isolation guarantees; (2) **judgment** — what the Copilot may do versus what stays with the engineer, per the platform's founding principle; (3) **infrastructure** — where inference-bound, streaming workloads run given the serverless deployment (ADR-005) and the dedicated-service exception (ADR-001).

## Proposal

**1. The Copilot reads through the platform's own tenant-scoped services — never the database.** Every piece of context the model receives is fetched by calling the same `tenantProcedure`-guarded service layer with the **calling user's own session**. The model gets exactly what that user could already see on screen, both isolation layers (middleware + RLS) apply unchanged, and there is no parallel data path to audit. In the MVP the tool set is **read-only**: the Copilot can look up projects, clients, proposals, inspections, calculation records, geo records, and BIM models — it cannot create, mutate, issue, or delete anything.

**2. The Copilot informs; the engineer decides — enforced by architecture, not just prompt.** Per [ai-principles.md](../foundation/ai-principles.md) and engineering-philosophy principle 6: the Copilot retrieves, summarizes, explains (including explaining a stored check's inputs, factors, and outputs), and drafts text. It does **not** produce authoritative engineering numbers of its own — deterministic calculations belong to the ratified libraries (`@andes/structures`, `@andes/geo`) behind their known-answer contracts, and the read-only tool boundary makes signing, issuing, or deciding structurally impossible, not merely discouraged. Every response carries the platform's standing line: computed and explained by the platform, reviewed and decided by the responsible engineer.

**3. It runs inside the Next.js app as a streaming route — no new infrastructure.** LLM chat is I/O-bound streaming, not heavy computation: the ADR-001 dedicated-service trigger does not fire. A single streaming endpoint in Andes Core hosts the loop (model ↔ tools ↔ stream), with the provider choice made in [ADR-009](../adr/0009-llm-provider.md). Conversations persist as tenant-scoped records owned by the asking user ([sprint-9-domain-model.md](../architecture/sprint-9-domain-model.md)).

## Alternatives

- **Separate agent service** (queue + worker): right shape for long-running autonomous agents, wrong for interactive chat — adds infrastructure the MVP doesn't need; revisit if the Copilot ever gains long-running jobs (that revisit is the ADR-001 trigger).
- **RAG over external technical corpora** (NSR-10 full text, ACI): high value, but licensing questions plus an embedding/vector-store decision of its own — deferred to its own proposal rather than smuggled in here.
- **Write-capable tools from day one** ("create the proposal for me"): rejected for the MVP — mutation via LLM needs a confirmation UX and an audit trail designed deliberately, not bolted on. The read-only MVP builds the trust base first.
- **No persistence** (ephemeral chat): rejected — an engineer's conversation about a project is work product, and the tenant-scoped table pattern makes persistence nearly free.

## Trade-offs

Read-only tools cap the Copilot's usefulness (it explains and finds; it does not do) — accepted deliberately as the safe first step of the vision's capability list. Running in serverless bounds a single response by function limits — acceptable for chat (streaming starts immediately); long autonomous work stays out of scope. Session-based tool access means the Copilot can never answer about data the asking user couldn't open — that is a feature, not a limitation.

## Consequences

- The tool layer is a thin adapter over existing routers — no new query paths, no new isolation surface to test beyond the conversation tables themselves.
- The model provider sees tenant data in prompts: provider choice (ADR-009) must consider data-processing terms, and this becomes a standing item for the SaaS compliance story.
- Conversations become the platform's first user-private records: tenant-scoped as always, and additionally filtered to their owner at the application layer.
- Every future AI capability (proposal drafting, report generation, NSR-10 RAG) extends this RFC's frame — tools + judgment boundary — rather than re-deciding it.

## Rollout

Implemented as Sprint 9 ([sprint-9.md](../sprints/sprint-9.md)): data layer → copilot service + API → UI, each a CI-gated PR. One new secret (the provider API key, per ADR-009). No migration path — there is no prior AI feature.

## Open Questions

- **Conversation retention** — kept until the owner deletes them (proposed), or a tenant-level retention window later? Owner-delete for the MVP; revisit with the SaaS compliance work.
- **Which read-only tools ship first** — proposed: the list/get pairs of all six live modules plus the explain-a-check context builders. Trim to fewer modules if the sprint grows.
- Token-usage visibility per tenant — future billing concern, out of scope now.

## References

- [ai-principles.md](../foundation/ai-principles.md) — the Copilot vision and operating rules this RFC implements
- [ADR-009](../adr/0009-llm-provider.md) — provider/SDK decision, proposed alongside
- [RFC-001](0001-multi-tenant-architecture.md) — the isolation model choice 1 preserves
- [sprint-9-domain-model.md](../architecture/sprint-9-domain-model.md) — conversation domain
