# ai-principles.md

**Version:** 1.0
**Status:** Foundation document
**Part of:** [Engineering Handbook](README.md)

---

## Purpose

This document defines two things: (1) the product vision for AI within the platform, and (2) the operating rules for any AI assistant — Claude Code, ChatGPT, Cursor, GitHub Copilot, or otherwise — working on this codebase.

## AI Vision: The Engineering Copilot

> Artificial Intelligence should not be a chatbot. It should become an Engineering Copilot.

Planned capabilities, to be built out module by module (see the AI module's position in [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md), deliberately last in the sprint sequence):

- NSR-10 assistant
- ACI assistant
- Structural design guidance
- Geotechnical recommendations
- Inspection report generation
- Proposal generation
- RFI assistance
- Document summarization
- BIM assistance
- ETABS result explanation
- SAFE assistance
- Specification search
- Technical knowledge retrieval

**Human engineers always make the final decision.** The Copilot accelerates and informs; it does not sign off on structural or geotechnical judgment. This mirrors [engineering-philosophy.md](engineering-philosophy.md) principle 6, "AI as Copilot."

Detailed specification of each capability belongs in `docs/ai/` (planned), not in this foundation document.

## Operating Rules for AI Coding Assistants

These rules apply to any AI assistant working on this repository, regardless of tool:

1. **Architecture is designed by humans. Implementation is delegated to AI.** Do not make unilateral architectural decisions. See [project-principles.md](project-principles.md).
2. **Rely on documentation, not conversation history.** Do not assume context from a previous chat session persists. If it is not written in the handbook, treat it as unknown.
3. **If you find an inconsistency** between this handbook and what you are being asked to do, **propose an ADR** before modifying architecture. See [engineering-principles.md](engineering-principles.md) for the ADR format.
4. **Do not generate code until the design is approved.** Design and implementation are separate, sequential steps.

## Session Start Protocol

Every development session should begin by reading, in order:

1. [README.md](README.md)
2. [VISION.md](VISION.md)
3. [MISSION.md](MISSION.md)
4. [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md)
5. [engineering-philosophy.md](engineering-philosophy.md)
6. [PROJECT_RULES.md](PROJECT_RULES.md)
7. Relevant ratified decisions: [ADR-001 through ADR-004](../adr/), [RFC-001](../rfc/0001-multi-tenant-architecture.md), and `docs/architecture/sprint-0-domain-model.md`
8. The current sprint (`docs/sprints/`, planned)

## Related Documents

- [engineering-philosophy.md](engineering-philosophy.md) — principle 6, "AI as Copilot."
- [project-principles.md](project-principles.md) — the governance rule this document operationalizes.
- [architecture-principles.md](architecture-principles.md) — "AI assists but does not replace engineering judgment."
