# Andes Engineering Platform

## Project Continuity Document

**Version:** 1.0

---

# Purpose

This document summarizes every important architectural and strategic decision made during the initial planning phase of the project.

Any future AI assistant (Claude Code, ChatGPT, Cursor, GitHub Copilot, etc.) should read this document before making recommendations or writing code.

This document becomes the initial context of the project.

---

# Project Goal

The objective is **not** to build a simple application.

The objective is to build an **enterprise-grade software platform** for civil engineering firms.

The platform must be capable of growing during the next 10+ years.

It should eventually become the operating system for engineering consulting companies.

The project must prioritize:

- Scalability
- Maintainability
- Modularity
- Clean Architecture
- Excellent User Experience
- Artificial Intelligence integration
- Engineering-first workflows

---

# Company Vision

The software belongs to Andes Engineering.

Long-term vision:

Transform Andes Engineering into both:

- an engineering consulting company
- a software company specialized in civil engineering

The software should eventually become a commercial SaaS product.

---

# Platform Vision

The platform is no longer viewed as a single application.

Instead, it is a platform composed of multiple products.

Proposed product structure:

- Andes Core
- Andes Projects
- Andes CRM
- Andes Structures
- Andes Geo
- Andes BIM
- Andes AI
- Andes Analytics

Each module should eventually be able to evolve independently.

---

# Development Philosophy

The AI should never make architectural decisions.

AI should implement previously documented decisions.

Architecture is designed by humans.

Implementation is delegated to AI.

---

# Documentation Philosophy

Documentation is considered part of the product.

The documentation is the permanent memory of the project.

Claude Code should never rely on previous conversations.

Instead, it must rely on documentation.

---

# Engineering Handbook

Instead of isolated markdown files, the project will contain a complete Engineering Handbook.

This handbook will become the "brain" of the project.

Estimated size:

250–500 pages.

Approximately 40–50 markdown files.

---

# Documentation Structure

Recommended structure:

docs/

foundation/

product/

architecture/

design/

engineering/

ai/

development/

sprints/

adr/

---

# Foundation Documents

Current documents:

- README.md
- VISION.md
- MISSION.md
- PRODUCT_STRATEGY.md

Next planned documents:

- engineering-philosophy.md
- project-principles.md
- engineering-principles.md
- architecture-principles.md
- ai-principles.md
- glossary.md

---

# Product Documentation

Planned:

- Target Market
- Business Model
- Competitor Analysis
- User Personas
- User Journeys
- User Stories
- Features
- Non-functional Requirements
- Product Roadmap

---

# Architecture Documentation

Planned:

- Architecture Overview
- Domain-Driven Design
- Module Definitions
- Database Design
- API Design
- Authentication
- Authorization
- Security
- Infrastructure

---

# Design Documentation

Planned:

- Design System
- Component Library
- UX Guidelines
- Navigation
- Design Tokens

---

# Engineering Modules

The platform should eventually include:

Dashboard

Projects

Clients

CRM

Proposal Generator

Structural Engineering

Geotechnical Engineering

Inspection Management

BIM

Reports

Artificial Intelligence

Analytics

Notifications

Authentication

Administration

---

# AI Vision

Artificial Intelligence should not be a chatbot.

It should become an Engineering Copilot.

Future capabilities include:

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

Human engineers always make the final decision.

---

# Architectural Philosophy

Important principles discussed:

- Engineering before implementation.
- Domain before UI.
- Documentation before coding.
- Reuse before creation.
- Modularity over monolithic design.
- Simplicity over cleverness.
- Architecture over speed.
- Long-term maintainability.
- Single Source of Truth.
- AI assists but does not replace engineering judgment.

---

# Domain-Driven Design

The platform should be designed from the engineering domain outward.

Recommended workflow:

Business

↓

Processes

↓

Domain

↓

Entities

↓

Relationships

↓

Database

↓

API

↓

Frontend

Never design screens first.

---

# ADR (Architecture Decision Records)

The project will use ADRs.

Every important architectural decision should be documented.

Example:

ADR-001

Why PostgreSQL?

Alternatives

Decision

Consequences

---

# RFCs

Future major changes should be documented before implementation.

Examples:

RFC-001 Multi-tenant Architecture

RFC-002 BIM Viewer

RFC-003 AI Agent

---

# Claude Code Workflow

Each development session should begin by reading:

README.md

VISION.md

MISSION.md

PRODUCT_STRATEGY.md

engineering-philosophy.md

PROJECT_RULES.md

Architecture documentation

Current Sprint

Claude should never assume previous chat history.

---

# Development Workflow

Preferred sequence:

Idea

↓

PRD

↓

DDD

↓

ADR

↓

RFC

↓

Sprint Planning

↓

Implementation

↓

Testing

↓

Release

---

# Sprint Philosophy

Every sprint focuses on one objective.

Suggested order:

Sprint 0

Foundation

Architecture

Design System

Navigation

Authentication

Sprint 1

Dashboard

Sprint 2

Projects

Sprint 3

CRM

Sprint 4

Proposal Generator

Sprint 5

Inspection Module

Sprint 6

Structural Module

Sprint 7

Geotechnical Module

Sprint 8

BIM Module

Sprint 9

AI Module

---

# Long-Term Technology Direction

Tentative stack (subject to future ADRs):

Frontend

- React
- Next.js
- TypeScript

UI

- Tailwind CSS
- shadcn/ui

Database

- PostgreSQL

ORM

- Prisma

Authentication

- Better Auth or Auth.js

State

- Zustand
- TanStack Query

Forms

- React Hook Form

Validation

- Zod

Storage

- S3-compatible storage

Deployment

- Vercel

Monitoring

- Sentry

Analytics

- PostHog

AI

- OpenAI
- Anthropic
- Gemini

---

# Engineering Philosophy

The first major handbook chapter drafted was:

engineering-philosophy.md

Key ideas:

- Engineering First
- Simplicity Over Cleverness
- Build for Evolution
- Documentation is Product
- Domain Driven
- AI as Copilot
- Quality by Design
- Single Source of Truth
- Reuse Before Create
- UX is Engineering

---

# Improvements Identified

Future documents should be written with a higher standard.

Instead of only describing principles, every important decision should include:

Context

Problem

Decision

Alternatives

Trade-offs

Consequences

Examples

Exceptions

References

This documentation style should resemble:

- ADRs
- RFCs
- Internal engineering handbooks used by mature software companies.

---

# Language Decision

Recommended approach:

Technical documentation:

English

Personal notes and strategic discussions:

Spanish (optional)

Reason:

English is the standard language for software architecture, libraries, APIs, AI tooling, and technical documentation.

---

# Final Objective

The end goal is not simply to complete an application.

The end goal is to create a professional engineering platform with documentation, architecture, and development standards comparable to mature software companies.

The documentation should allow any AI coding assistant to understand the project without relying on chat history.

This handbook is intended to become the single source of truth for the entire platform.
