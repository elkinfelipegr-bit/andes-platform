# Navigation & App Shell

**Version:** 1.0
**Status:** Active — Sprint 1 ([sprint-1.md](../sprints/sprint-1.md))
**Part of:** `docs/design/`

---

## Purpose

Defines the authenticated shell every Andes product renders inside, and the navigation structure that maps the eight products ([PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md)) onto routes. Screens follow this document — never the reverse ([architecture-principles.md](../foundation/architecture-principles.md): domain before UI, screens never first).

## Shell Anatomy

```
┌────────────┬──────────────────────────────────────┐
│            │ Topbar: page context · tenant · user │
│  Sidebar   ├──────────────────────────────────────┤
│  (fixed)   │                                      │
│  modules   │            Page content              │
│            │                                      │
│  admin ─── │                                      │
└────────────┴──────────────────────────────────────┘
```

- **Sidebar** (fixed, `w-60`, desktop-first): Andes wordmark, then one entry per product module, then Administration pinned at the bottom. Active module = `--primary` treatment; inactive real routes = muted; **not-yet-built modules render as disabled stubs** (muted + "Soon" badge) so the product map is visible from day one without dead links.
- **Topbar**: current page title/breadcrumb slot on the left; on the right the **tenant name + role badge** (the session context RFC-001 makes mandatory — the user must always see which tenant scope they act in) and the user menu (name, email, sign-out) as a `DropdownMenu`.
- Mobile: the sidebar collapses behind a menu button. Sprint 1 ships the desktop layout and a usable small-screen fallback (topbar + slide-over nav is acceptable to defer if it grows the sprint).

## Module → Route Map

| Sidebar entry  | Product          | Route         | Sprint 1 state  |
| -------------- | ---------------- | ------------- | --------------- |
| Dashboard      | Andes Core       | `/dashboard`  | **Live**        |
| Projects       | Andes Projects   | `/projects`   | Stub (disabled) |
| CRM            | Andes CRM        | `/crm`        | Stub (disabled) |
| Structures     | Andes Structures | `/structures` | Stub (disabled) |
| Geo            | Andes Geo        | `/geo`        | Stub (disabled) |
| BIM            | Andes BIM        | `/bim`        | Stub (disabled) |
| AI             | Andes AI         | `/ai`         | Stub (disabled) |
| Analytics      | Andes Analytics  | `/analytics`  | Stub (disabled) |
| Administration | Andes Core       | `/admin`      | Stub (disabled) |

Routes are top-level segments (no `/core/...` prefix): products are one platform to the user; the monorepo package split ([ADR-004](../adr/0004-repository-structure.md)) is an implementation boundary, not a URL scheme.

## Access States

Implemented with a Next.js route group `(app)` whose layout owns the shell and the session check:

1. **No session** → redirect to `/login` (existing Sprint 0 behavior, moves into the shell layout).
2. **Session, no membership** → shell renders with navigation disabled and the "ask an operator to link you" state from Sprint 0 as the page body — the user can see they're signed in and sign out, but reaches no tenant data.
3. **Session + membership** → full shell; tenant + role always visible in the topbar.

Role-based visibility (e.g. Administration only for `OWNER_ADMIN`) applies when those pages carry real functionality — stubs stay visible to everyone in Sprint 1.

## References

- [design-system.md](design-system.md) — tokens and components the shell uses.
- [RFC-001](../rfc/0001-multi-tenant-architecture.md) — why tenant context is always on screen.
- [PRODUCT_STRATEGY.md](../foundation/PRODUCT_STRATEGY.md) — module map source.
