# Sprint 9 — Proposal

**Status:** Proposed — awaiting CTO ratification (together with RFC-003 and ADR-009)
**Drafted:** 2026-07-12
**Objective (proposed):** AI Module MVP — the Engineering Copilot: a tenant-scoped, read-only assistant grounded in the platform's own records, with persisted conversations.

---

## Context

[PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) sequences Sprint 9 — the **last sprint of the original sequence** — as the AI Module, deliberately after every domain it assists ([ai-principles.md](../foundation/ai-principles.md)). That condition is met: six modules are live with documented models and tenant-scoped services. Like Sprints 8, this one ratifies decisions and a domain model together: [RFC-003 (AI Agent)](../rfc/0003-ai-agent.md), [ADR-009 (LLM Provider — Anthropic via Vercel AI SDK)](../adr/0009-llm-provider.md), and [sprint-9-domain-model.md](../architecture/sprint-9-domain-model.md). Nothing below is implemented until all three are ratified.

## Proposed Scope

1. **Domain & data layer** (`packages/db`): `AiConversation` + `AiMessage` + role enum — hand-written migration + strict RLS; isolation suite extended, **including the owner-privacy case** (same-tenant colleague must not read another user's conversations).
2. **API** (`packages/api`, `routers/ai/`): `ai` router — `listConversations`/`getConversation`/`deleteConversation` (owner-only) plus message persistence. **Copilot tool layer:** thin read-only adapters over the six live modules' existing list/get services, always invoked with the caller's session (RFC-003 choice 1). Schemas unit-tested; integration tests for conversation CRUD with tenant + owner sweeps.
3. **Copilot service** (`apps/core`): the streaming chat route using the Vercel AI SDK with the Anthropic provider (ADR-009) — system prompt encoding the judgment boundary (informs, cites consulted records, declines actions and non-library calculations), tool loop over the adapters, messages persisted per turn. Model boundary mocked in CI; no API key in CI.
4. **UI** (`apps/core`): **AI** live in the sidebar — conversation list + streaming chat pane, tool-use transparency ("consulted: P-2026-014, EG-2026-001"), owner delete with confirm, and the standing responsible-engineer line visible in the chat chrome.

## Out of Scope

- **Write-capable tools** (create/issue/decide anything) — future proposal with confirmation UX + audit trail, per RFC-003.
- NSR-10/ACI corpus RAG (licensing + vector-store decision of its own); document/proposal generation; ETABS/SAFE explanation depth beyond stored-check explanation.
- Multi-provider failover / AI Gateway; per-tenant token metering (future billing ADR).
- Long-running autonomous agents — the ADR-001 dedicated-service trigger.

## Testing Commitments

Strict tier for the new tables **plus the owner-privacy dimension** (first user-private records). Unit tests for tool-adapter schemas and the prompt-policy constants; integration for conversation CRUD with cross-tenant and cross-user sweeps. The model boundary is mocked in CI exactly as the S3 boundary was in Sprint 8 — inference behavior (grounding quality, tone, refusals) is verified manually in production, the sprint's acceptance gate as always.

## Rollout Notes

One new secret per environment: `ANTHROPIC_API_KEY` (the CTO creates it at console.anthropic.com — the sprint's one manual step, mirroring Sprint 8's R2 setup), loaded via bash `printf`. Model id as env config with a code default.

## Open Decisions for the CTO

1. **Ratify RFC-003** — session-scoped read-only tools, judgment boundary by architecture, streaming in Andes Core.
2. **Ratify ADR-009** — Anthropic Claude via the Vercel AI SDK.
3. **Ratify the domain model** — including its five recommendations (persisted owner-deletable conversations; all-six-modules tool set; traces not persisted).
4. **Ratify this scope** — trim candidates: tool set down to Projects+Structures+Geo first, tool-transparency panel second (chat + grounding are the core).

## References

- [RFC-003](../rfc/0003-ai-agent.md), [ADR-009](../adr/0009-llm-provider.md), [sprint-9-domain-model.md](../architecture/sprint-9-domain-model.md) — the decisions this sprint implements.
- [sprint-8.md](sprint-8.md) — closed; the decision-bundle precedent this repeats.
- [ai-principles.md](../foundation/ai-principles.md) — the Copilot vision this sprint finally builds.
