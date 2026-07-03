# VISION.md

**Version:** 1.0
**Status:** Foundation document
**Part of:** [Engineering Handbook](README.md)

---

## Company Vision

Andes Engineering Platform belongs to **Andes Engineering**.

The long-term vision is for Andes Engineering to become both:

* an **engineering consulting company**, and
* a **software company specialized in civil engineering**.

These are not two separate businesses. The platform built to run Andes Engineering's own consulting practice is the same platform that, over time, becomes a commercial product. Every architectural decision should be evaluated against both uses: does it serve us as an internal operating system today, and does it hold up as a multi-tenant SaaS product tomorrow?

## Platform Vision

The platform is not a single application. It is a **platform composed of multiple products**, each capable of evolving independently.

| Product | Role |
|---|---|
| **Andes Core** | Shared platform services: authentication, tenancy, notifications, administration |
| **Andes Projects** | Project management for engineering deliverables |
| **Andes CRM** | Client relationships and proposal management |
| **Andes Structures** | Structural engineering: design guidance, code compliance (e.g. NSR-10, ACI) |
| **Andes Geo** | Geotechnical engineering |
| **Andes BIM** | BIM integration, model viewing, and coordination |
| **Andes AI** | The Engineering Copilot — see [ai-principles.md](ai-principles.md) |
| **Andes Analytics** | Cross-project and cross-client analytics and reporting |

This module boundary is a **vision-level grouping**, not yet a ratified architecture decision. The actual module/service boundaries, ownership, and data contracts belong in `docs/architecture/module-definitions.md` (planned) and must go through the ADR process before being treated as binding.

## Ten-Year Horizon

The platform must be capable of growing for **10+ years**. It should eventually become **the operating system for engineering consulting companies** — not a tool bolted onto existing workflows, but the system of record and the daily working surface for structural, geotechnical, and civil engineering practices.

This horizon is the reason the project prioritizes:

* Scalability
* Maintainability
* Modularity
* Clean Architecture
* Excellent User Experience
* Artificial Intelligence integration
* Engineering-first workflows

(See [MISSION.md](MISSION.md) for how these priorities translate into what gets built now.)

## What This Is Not

* It is not a simple internal tool built for short-term convenience.
* It is not a chatbot wrapper — AI is a copilot embedded in engineering workflows, not the product itself.
* It is not designed screen-first. See [architecture-principles.md](architecture-principles.md) for why domain design always precedes UI.

## Relationship to Other Foundation Documents

VISION.md answers *where we are going*. [MISSION.md](MISSION.md) answers *what we are building right now to get there*. [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md) answers *in what order*.
