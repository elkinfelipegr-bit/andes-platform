# glossary.md

**Version:** 1.0
**Status:** Foundation document — will grow as the handbook grows
**Part of:** [Engineering Handbook](README.md)

---

## Process & Documentation Terms

**ADR (Architecture Decision Record)**
A written record of a single, scoped architectural decision, following the standard defined in [engineering-principles.md](engineering-principles.md): Context, Problem, Decision, Alternatives, Trade-offs, Consequences, Examples, Exceptions, References.

**RFC (Request for Comments)**
A written proposal for a larger, cross-cutting change, reviewed before implementation begins. Example: RFC-001 Multi-tenant Architecture.

**DDD (Domain-Driven Design)**
An approach to software design that starts from the business domain and works outward toward implementation: Business → Processes → Domain → Entities → Relationships → Database → API → Frontend. See [architecture-principles.md](architecture-principles.md).

**PRD (Product Requirement Document)**
A document describing what should be built and why, from a product perspective, before domain modeling begins.

**Handbook**
The complete Engineering Handbook — the full set of `docs/` markdown files, planned to reach 250–500 pages. See [README.md](README.md).

**Foundation Documents**
The initial layer of the handbook: identity, philosophy, principles, and glossary. The set of files this glossary belongs to.

**Sprint**
A scoped unit of delivery work focused on a single objective. See [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md).

## Architecture Terms

**Clean Architecture**
An architectural style where dependencies point inward toward the domain, keeping frameworks and infrastructure as replaceable details.

**Single Source of Truth**
The principle that any given fact about the system should be authoritatively defined in exactly one place.

**Multi-tenant Architecture**
An architecture where a single deployment of the platform serves multiple independent client organizations ("tenants") with isolated data. Planned as RFC-001.

**SaaS (Software as a Service)**
A software delivery model where the platform is hosted centrally and accessed by customers over the internet, typically via subscription — the long-term commercial model for the platform. See [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md).

## AI Terms

**Engineering Copilot**
The product vision for AI on this platform: an assistant embedded in engineering workflows that accelerates human engineers without replacing their judgment. See [ai-principles.md](ai-principles.md).

## Civil Engineering Domain Terms

**NSR-10**
_Reglamento Colombiano de Construcción Sismo Resistente_ — the Colombian building code governing seismic-resistant construction. One of the planned AI Copilot assistants.

**ACI (American Concrete Institute)**
A standards body whose codes govern concrete design and construction practice; also refers informally to the ACI code itself. One of the planned AI Copilot assistants.

**RFI (Request for Information)**
A formal query raised during a construction or engineering project to clarify design, specification, or scope ambiguity.

**BIM (Building Information Modeling)**
A digital representation of a building's physical and functional characteristics, used for coordination across engineering disciplines. One of the eight Andes products (Andes BIM).

**ETABS**
Structural analysis and design software (by CSI) used for building systems, particularly for lateral and seismic analysis.

**SAFE**
Structural analysis and design software (by CSI) focused on slabs, foundations, and floor systems.

## Maintaining This Glossary

Add a term here the first time it is used in a new handbook document, if it is not already defined. Do not duplicate a definition that already exists elsewhere in the handbook — link to it instead, per the Single Source of Truth principle in [engineering-philosophy.md](engineering-philosophy.md).
