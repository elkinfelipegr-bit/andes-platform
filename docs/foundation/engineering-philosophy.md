# engineering-philosophy.md

**Version:** 1.0
**Status:** Foundation document
**Part of:** [Engineering Handbook](README.md)

---

## Purpose

This document is the cultural mindset behind how Andes Engineering Platform is built — the "why" behind our decisions. It is distinct from [engineering-principles.md](engineering-principles.md) (the "how": workflow and process) and [architecture-principles.md](architecture-principles.md) (the "what": system structure).

## The Ten Ideas

### 1. Engineering First

We build software the way we expect our own structural and geotechnical engineers to work: with rigor, with calculations that can be checked, and with a bias toward getting the fundamentals right before adding features. A feature that is fast to ship but structurally unsound is not a shortcut — it is future rework.

### 2. Simplicity Over Cleverness

The simplest design that solves the actual problem beats the cleverest design that solves an imagined one. Clever code is expensive to maintain and hard to onboard new engineers into. If a solution needs a paragraph of explanation to justify its cleverness, it is probably wrong for a 10-year platform.

### 3. Build for Evolution

Every module should be replaceable without threatening the rest of the platform. We are not optimizing for the fastest way to ship v1 — we are optimizing for the platform's ability to still be alive, and still be improvable, in year eight.

### 4. Documentation is Product

Documentation is not a byproduct of building the platform — it is part of what we are building. See [project-principles.md](project-principles.md) for the documentation philosophy in full. A feature without documentation is an unfinished feature.

### 5. Domain Driven

We design from the engineering domain outward — business, then process, then domain, then entities, then database, API, and finally UI. We never design screens first. See [architecture-principles.md](architecture-principles.md) for the full workflow.

### 6. AI as Copilot

AI accelerates engineers; it does not replace their judgment. This applies both to the AI features we build into the product (see [ai-principles.md](ai-principles.md)) and to the AI coding assistants used to build the platform itself. Human engineers always make the final decision.

### 7. Quality by Design

Quality is not a QA phase bolted onto the end of development. It is designed in from the domain model outward — correct entities and relationships prevent entire categories of bugs before a single test is written.

### 8. Single Source of Truth

Every fact about the system should live in exactly one authoritative place — one schema, one handbook entry, one decision record. When the same fact is duplicated in multiple places, it will eventually disagree with itself, and someone will build on the wrong version.

### 9. Reuse Before Create

Before building something new, check whether it already exists in the platform, in a library, or in a prior decision. Reuse reduces the surface area we have to maintain over the next decade. New code is a liability until proven otherwise.

### 10. UX is Engineering

User experience is not a layer of polish applied after the "real" engineering work is done. For a platform used daily by structural and geotechnical engineers, a confusing workflow is a defect with the same severity as a calculation bug — see [MISSION.md](MISSION.md) priority 5.

## How This Document Is Used

New engineers and every AI assistant session should read this document to understand *why* the platform is built the way it is, before reading the more operational [engineering-principles.md](engineering-principles.md) and [architecture-principles.md](architecture-principles.md).
