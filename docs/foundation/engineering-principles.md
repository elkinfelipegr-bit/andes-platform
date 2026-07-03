# engineering-principles.md

**Version:** 1.0
**Status:** Foundation document
**Editorial note:** The source Project Continuity Document listed `engineering-principles.md` and `architecture-principles.md` as two separate planned documents but did not define the boundary between them. This document was drafted to cover _process and workflow_ (how engineering work moves from idea to release); [architecture-principles.md](architecture-principles.md) covers _system structure_ (how the software itself is organized). Confirm or adjust this split before treating it as final.
**Part of:** [Engineering Handbook](README.md)

---

## Purpose

This document defines how engineering work is executed on this project — the required sequence, the standard for documenting decisions, and the discipline around sprints.

## Development Workflow

Every piece of work follows this sequence:

```
Idea → PRD → DDD → ADR → RFC → Sprint Planning → Implementation → Testing → Release
```

- **Idea** — a problem or opportunity is identified.
- **PRD** — the product requirement is written down (see the planned `docs/product/` documentation and [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md)).
- **DDD** — the domain is modeled before any database, API, or UI work begins. See [architecture-principles.md](architecture-principles.md).
- **ADR** — any architectural decision required by the work is recorded.
- **RFC** — any major change is proposed and reviewed before implementation (see examples below).
- **Sprint Planning** — the work is scoped into a sprint with a single objective.
- **Implementation** — code is written, by AI assistants or engineers, strictly against the documented design.
- **Testing** — verified against the requirement and the domain model.
- **Release** — shipped.

Skipping steps — especially going straight from Idea to Implementation — is the most common way architecture debt enters the platform.

## Decision Documentation Standard

Every important decision — ADR, RFC, or otherwise — must be written to a standard, not just asserted. The required structure is:

- **Context** — what situation led to this decision being needed
- **Problem** — what specifically needs to be solved
- **Decision** — what was chosen
- **Alternatives** — what else was considered
- **Trade-offs** — what was given up by choosing this option
- **Consequences** — what this decision implies for the rest of the system
- **Examples** — concrete illustration of the decision in practice
- **Exceptions** — where this decision does not apply
- **References** — sources, prior art, related decisions

This standard applies retroactively: the tentative technology direction in [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md) is _not yet_ a decision in this sense — it becomes one only once written up this way as an ADR.

This is a deliberately higher bar than a one-line principle statement. It mirrors how ADRs, RFCs, and internal engineering handbooks work at mature software companies.

## ADR and RFC Usage

**ADRs (Architecture Decision Records)** document individual, scoped architectural decisions. Example:

```
ADR-001
Why PostgreSQL?
Alternatives
Decision
Consequences
```

ADRs live in `docs/adr/` and follow the Decision Documentation Standard above. Ratified so far:

- [ADR-001 — Technology Stack](../adr/0001-technology-stack.md)
- [ADR-002 — Authentication Provider](../adr/0002-authentication-provider.md)
- [ADR-003 — API Layer](../adr/0003-api-layer.md)
- [ADR-004 — Repository Structure](../adr/0004-repository-structure.md)

**RFCs (Request for Comments)** document larger, cross-cutting changes before they are implemented, and live in `docs/rfc/` — a directory added during Sprint 0 preparation since the original Documentation Structure listed `docs/adr/` but had no home for RFCs. Status:

- [RFC-001 — Multi-tenant Architecture](../rfc/0001-multi-tenant-architecture.md) — Accepted.
- RFC-002 — BIM Viewer — not yet drafted.
- RFC-003 — AI Agent — not yet drafted.

## Sprint Philosophy

Every sprint focuses on **one objective** — not a grab-bag of unrelated tickets. See [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md) for the current proposed sprint sequence (Sprint 0 Foundation through Sprint 9 AI).

The ordering logic is deliberate:

- Foundation, architecture, design system, navigation, and authentication come first — nothing else is stable without them.
- Feature modules follow in order of dependency and business value.
- The AI module comes last, because it assists domains (structural, geotechnical, BIM) that need to already exist and be well-modeled before AI can responsibly assist with them. See [ai-principles.md](ai-principles.md).

## Related Documents

- [architecture-principles.md](architecture-principles.md) — the structural principles this workflow protects.
- [project-principles.md](project-principles.md) — the governance rules (human vs. AI decision rights) this workflow enforces.
