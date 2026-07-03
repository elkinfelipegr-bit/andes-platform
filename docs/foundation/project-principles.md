# project-principles.md

**Version:** 1.0
**Status:** Foundation document
**Part of:** [Engineering Handbook](README.md)

---

## Purpose

This document governs *how the project itself is run*: who decides what, how documentation works, and what language we write in. It is distinct from [engineering-principles.md](engineering-principles.md), which governs how engineering *work* is executed once these rules are in place.

## Development Philosophy: Human and AI Roles

> The AI should never make architectural decisions. AI should implement previously documented decisions. Architecture is designed by humans. Implementation is delegated to AI.

This is the single most important governance rule on this project. It applies to every AI assistant working on the codebase — Claude Code, ChatGPT, Cursor, GitHub Copilot, or any future tool.

In practice:

* A human (the CTO / Lead Architect) makes and documents architecture decisions, typically as an ADR.
* An AI assistant implements what has already been decided and documented.
* If an AI assistant identifies an inconsistency between the documented architecture and what is being asked of it, it must **propose an ADR** and pause, rather than resolve the inconsistency unilaterally.
* No code is generated until the design behind it is approved.

See [ai-principles.md](ai-principles.md) for how this translates into a concrete session protocol for AI assistants.

## Documentation Philosophy

> Documentation is considered part of the product. The documentation is the permanent memory of the project.

Concretely:

* Claude Code — and any AI assistant — should never rely on previous conversations. It must rely on documentation.
* If a decision, convention, or piece of context is not written down in the handbook, it is not safe to assume it is known.
* Documentation is written and maintained with the same rigor as code: reviewed, versioned, and kept current.

This is why the Engineering Handbook exists at the scale it does (see [README.md](README.md)) rather than as a handful of informal notes.

## Language Decision

* **Technical documentation:** English. This is the standard language for software architecture, libraries, APIs, AI tooling, and technical documentation, and keeps the handbook usable by any AI assistant or future hire regardless of origin.
* **Personal notes and strategic discussions:** Spanish, optionally, where that is the natural working language for the team.

Anything intended to become part of the permanent handbook — foundation documents, ADRs, RFCs, architecture docs — is written in English.

## Governance Summary

| Question | Answer |
|---|---|
| Who decides architecture? | Humans (CTO / Lead Architect) |
| Who implements it? | AI assistants and engineers, following documented decisions |
| What happens when documentation and reality disagree? | Propose an ADR before proceeding |
| Where does project truth live? | This handbook, not chat history |
| What language is technical documentation written in? | English |

## Related Documents

* [engineering-principles.md](engineering-principles.md) — the workflow and decision-documentation standard that operationalizes these rules.
* [architecture-principles.md](architecture-principles.md) — the structural principles this governance rule protects.
* [ai-principles.md](ai-principles.md) — the AI-specific operating protocol.
