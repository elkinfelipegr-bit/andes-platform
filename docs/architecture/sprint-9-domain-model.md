# Sprint 9 Domain Model — AI Module

**Version:** 1.0
**Status:** Accepted — ratified by the CTO on 2026-07-13 together with [sprint-9.md](../sprints/sprint-9.md), [RFC-003](../rfc/0003-ai-agent.md), and [ADR-009](../adr/0009-llm-provider.md), including this model's five recommendations.
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence for the first slice of Andes AI ([PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md), Sprint 9: AI Module — the last of the original sequence). The interesting decisions here are cross-cutting and live in [RFC-003](../rfc/0003-ai-agent.md); the domain itself is deliberately small: **conversations as records**. The Copilot's knowledge is not modeled — it is fetched live through the existing modules' services, which is the point.

## Business

Engineers lose time answering questions the platform already knows: "which proposals for this client are still open?", "what did the estudio for that project conclude for footing Z-2?", "who inspected the site and what were the critical findings?". The Copilot answers these conversationally, grounded in the tenant's own records, and explains stored calculations in plain language — **informing the engineer, never replacing their judgment** (engineering-philosophy 6, [ai-principles.md](../foundation/ai-principles.md)).

## Processes

1. An engineer opens **AI** and asks a question in natural language.
2. The Copilot decides which **read-only tools** to call (the live modules' list/get services, invoked with the engineer's own session — RFC-003 choice 1), gathers context, and streams an answer citing which records it consulted.
3. The exchange persists as a conversation owned by that engineer; they can continue it later, start new ones, and delete their own.
4. Anything beyond reading — creating records, issuing, deciding — the Copilot declines and points to the module where the engineer does it (RFC-003 choice 2).
5. (Future proposals) drafting proposals/reports, NSR-10 corpus RAG, write-capable tools with confirmation UX.

## Domain Concepts

- **AiConversation** — a persisted chat thread: tenant-scoped, **owned by one user**. The platform's first user-private record: tenant isolation as always (RLS), plus owner filtering at the application layer.
- **AiMessage** — one turn: role (`USER`/`ASSISTANT`), text content, position. Tool-call traces are streamed to the UI for transparency but **not persisted** in the MVP — they are derivable noise, and persisting polymorphic traces would mean a JSON blob, against the typed-tables principle.

## Entities (draft sketch)

| Entity           | Key Fields                                                               | Notes                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `AiConversation` | `id`, `tenantId`, `userId`, `title`, `createdAt`, `updatedAt`            | `title` auto-derived from the first question. Owner-deletable (a chat is working aid, not engineering evidence — see Roles note below). |
| `AiMessage`      | `id`, `tenantId`, `conversationId`, `role` (enum), `content`, `position` | Own `tenantId` (RLS never joins); cascade with its conversation; append-only while the conversation lives.                              |

## Relationships

```
User 1 ──── N AiConversation 1 ──── N AiMessage
```

Same-tenant enforcement + RLS as everywhere; `userId` ownership filtering in every procedure (`where: { userId: session.userId }`), tested at the strict tier alongside the tenant sweep — a colleague in the same tenant must not read another engineer's conversations.

## Roles & Permissions (role-level only, consistent with Sprints 0–8)

`OWNER_ADMIN` and `ENGINEER`: full copilot access; each user sees and deletes only their own conversations. **Deletion note:** this is the platform's first hard delete of a record family since contacts — deliberate: conversations are working aids, not the engineering/commercial evidence the no-delete rule protects. The records the Copilot talks _about_ keep their immutability guarantees untouched.

## Open Questions for Ratification

1. **Ratify RFC-003's three choices** — session-scoped read-only tools, judgment boundary by architecture, streaming route in Andes Core. Recommendation: **yes**.
2. **Ratify ADR-009** — Anthropic Claude via the Vercel AI SDK, model id as config. Recommendation: **yes**.
3. **Conversations persisted and owner-deletable** (vs. ephemeral). Recommendation: **persist** — work product, cheap under the established pattern.
4. **Tool set for the MVP: all six live modules' read paths** (projects, clients+proposals, inspections, calc records, geo records, bim models). Recommendation: **yes** — the adapters are thin; trim to Projects+Structures+Geo if the sprint grows.
5. **Tool traces streamed but not persisted.** Recommendation: **yes** — transparency without a JSON-blob table.

## What This Document Does Not Cover

Prisma/RLS syntax, tRPC signatures, the system prompt's exact wording, streaming protocol details — implementation after ratification. UI: `/ai` goes live in the sidebar (conversation list + chat pane), completing the eight-product map's seventh live module.

## References

- [RFC-003](../rfc/0003-ai-agent.md) — the cross-cutting decisions this model implements.
- [ADR-009](../adr/0009-llm-provider.md) — provider/SDK.
- [sprint-8-domain-model.md](sprint-8-domain-model.md) — the record-pattern precedent; [sprint-9.md](../sprints/sprint-9.md) — the sprint plan this model belongs to.
