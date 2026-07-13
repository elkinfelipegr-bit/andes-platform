# ADR-009: LLM Provider & SDK — Anthropic Claude via the Vercel AI SDK

**Status:** Proposed — awaiting CTO ratification
**Date:** 2026-07-12
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[ADR-001](0001-technology-stack.md) ratified the provider **set** — OpenAI, Anthropic, Gemini — but not a concrete first integration: which provider the Copilot ([RFC-003](../rfc/0003-ai-agent.md)) actually calls, through which SDK, with which key management. Sprint 9 forces the choice.

## Problem

Which LLM provider and integration layer does the Engineering Copilot launch with, in a way that keeps the other ADR-001 providers reachable without a rewrite?

## Decision

**Anthropic Claude, called through the Vercel AI SDK** (`ai` package + the Anthropic provider adapter):

1. **The Vercel AI SDK is the abstraction boundary.** All copilot code (streaming loop, tool definitions, message shapes) is written against the SDK's provider-agnostic interfaces — switching or adding an ADR-001 provider later is a configuration change plus an adapter install, not a rewrite. It is also the stack-native choice: first-party support for Next.js streaming on Vercel (ADR-005), TypeScript end-to-end (ADR-001).
2. **Anthropic Claude is the launch provider,** on the current mid-tier model (Sonnet class) — strong tool-calling reliability (the Copilot is tool-centric per RFC-003), long context for record-heavy prompts, and API terms that do not train on API inputs by default (tenant data appears in prompts — RFC-003's consequence).
3. **One new secret, `ANTHROPIC_API_KEY`,** managed per ADR-005's environment model. CI never has it: the model boundary is mocked in tests, exactly like the S3 boundary in Sprint 8.
4. **Model id is configuration** (env var with a code default), so tier upgrades are ops changes, not deployments of new code.

## Alternatives

- **OpenAI / Gemini as launch provider** — both remain ratified options behind the same SDK boundary; Anthropic is preferred at launch for tool-use reliability and data-processing posture, not exclusivity.
- **Vercel AI Gateway** (unified multi-provider endpoint with fallbacks) — attractive once multi-provider failover or per-tenant routing matters; deferred to avoid coupling the MVP's billing/observability to another platform product before there is a need. Adopting it later slots behind the same SDK boundary.
- **Provider SDK directly** (`@anthropic-ai/sdk`) — fewer layers, but hand-rolls streaming-to-React and tool-loop plumbing the AI SDK already solves, and hard-couples the copilot to one vendor's shapes.

## Trade-offs

A single launch provider concentrates availability risk — accepted for an MVP whose failure mode is "the assistant is briefly unavailable," with the SDK boundary as the pre-built escape hatch. The AI SDK adds a dependency layer that occasionally lags brand-new provider features — acceptable; the Copilot uses core primitives (streaming, tools), not frontier features.

## Consequences

- `ai` + the Anthropic adapter join `apps/core` dependencies; the copilot service lives in Andes Core (RFC-003 choice 3).
- The CTO provisions the Anthropic API key (console.anthropic.com) — the Sprint 9 rollout's one manual step, mirroring Sprint 8's R2 setup.
- Cost is usage-based per token: acceptable while dogfooding as Tenant #1; per-tenant metering becomes part of the future billing ADR flagged in RFC-001.
- Tests mock the model boundary; no CI secret, no CI inference cost.

## Examples

The chat route builds messages + read-only tools and calls the SDK's streaming primitive with the Anthropic model; the same code runs against another ratified provider by swapping the model factory line.

## Exceptions

Specialized future capabilities may justify a different model per task (e.g. a cheaper model for titles/summaries) — allowed within this ADR as configuration, since the SDK boundary already supports it. Moving to AI Gateway or adding failover is a new decision.

## References

- [ADR-001](0001-technology-stack.md) — the ratified provider set this ADR narrows for launch
- [RFC-003](../rfc/0003-ai-agent.md) — the Copilot this decision serves
- [ADR-005](0005-deployment-target.md) — secrets model; streaming on Vercel
