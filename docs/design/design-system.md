# Andes Design System — Foundation

**Version:** 1.0
**Status:** Active — brand direction delegated by the CTO at Sprint 1 ratification ([sprint-1.md](../sprints/sprint-1.md)); amendable by the CTO at any time.
**Part of:** `docs/design/`

---

## Purpose

The single source of truth for the platform's visual language: brand direction, design tokens, and component conventions. Implementation lives in `packages/ui` ([ADR-004](../adr/0004-repository-structure.md)); this document governs it — a change to the visual language is made here first, then in code.

## Brand Direction

Andes is a platform for civil engineers: the identity should read as **technical precision, not consumer software**. The visual metaphor is the Andean range — stone, altitude, deep sky — expressed with restraint:

- **Confident, calm surfaces.** Data-dense screens need quiet chrome: neutral surfaces, one strong brand hue, color reserved for meaning (status, actions).
- **Engineering legibility.** Tabular data, codes (NSR-10, ACI), and identifiers are first-class: a monospace face is part of the system, not an afterthought.
- **Density over airiness.** Engineers scan; compact spacing defaults, generous only where hierarchy demands it.

## Design Tokens

Tokens are CSS custom properties (shadcn/ui convention) declared in `packages/ui` and consumed through Tailwind v4's `@theme`. Semantic names, not raw values, are the API — components never hardcode a hex.

### Color

| Token                              | Light value                   | Role                                   |
| ---------------------------------- | ----------------------------- | -------------------------------------- |
| `--primary`                        | Andes Blue — deep blue        | Brand hue: primary actions, active nav |
| `--primary-foreground`             | near-white                    | Text/icons on primary                  |
| `--background` / `--card`          | slate-tinted whites           | Page and surface backgrounds           |
| `--foreground`                     | deep slate                    | Default text                           |
| `--muted` / `--muted-foreground`   | light slate / mid slate       | Secondary surfaces and supporting text |
| `--border` / `--input` / `--ring`  | light slate / focus = primary | Hairlines, form borders, focus ring    |
| `--accent` / `--accent-foreground` | light slate wash              | Hover states, subtle emphasis          |
| `--destructive`                    | red                           | Destructive actions and errors         |
| `--warning`                        | amber                         | Attention states (site-safety amber)   |
| `--success`                        | green                         | Confirmations, healthy status          |

Exact values live in `packages/ui/src/styles/theme.css` — that file and this table must not drift. **Dark mode:** tokens are structured for a `.dark` variant from day one, but no toggle ships in Sprint 1 (light is the default); adding dark values is a token-only change.

### Typography

- **UI / prose:** Inter (variable), loaded via `next/font` — no external font requests.
- **Data / code:** JetBrains Mono for identifiers, table numerics, and code references.
- Scale: Tailwind defaults; page titles `text-2xl font-semibold`, section labels `text-sm font-medium uppercase tracking-wide text-muted-foreground` (established in Sprint 0's dashboard).

### Shape & Depth

- Radius: `--radius: 0.5rem`; components derive (`sm`/`md`/`lg`) from it.
- Shadows: `shadow-sm` on cards; anything stronger only for overlays (menus, dialogs).

## Component Library (`packages/ui`)

- Built on **shadcn/ui patterns** per [ADR-001](../adr/0001-technology-stack.md): components are owned source code in the repo, not an npm dependency — styled with Tailwind + `class-variance-authority`, composed on Radix primitives where behavior demands it (menus, dialogs).
- Package exports raw TypeScript (repo convention — apps transpile via `transpilePackages`); Tailwind sees its classes via `@source` in the consuming app's CSS.
- Sprint 1 set: `Button`, `Card`, `Badge`, `Separator`, `DropdownMenu`, `cn()` utility. Grown per sprint as modules need — reuse before creation.
- Sprint 2 additions (Projects module): `Input`, `Label`, `Select` (styled native select — swap for Radix only when a design need demands it), `Table` family, `Dialog` (Radix).
- Sprint 3 additions (CRM module): `Textarea`.
- Icons: **lucide-react** (shadcn's companion set), sized `size-4` inline / `size-5` nav.

## Accessibility Baseline

Semantic HTML first; Radix primitives for anything with keyboard/focus behavior; visible focus ring (`--ring`) on all interactive elements; WCAG AA contrast for text tokens; every icon-only control carries an accessible name.

## References

- [ADR-001](../adr/0001-technology-stack.md) — Tailwind + shadcn/ui ratified.
- [navigation.md](navigation.md) — the shell these tokens dress.
- [sprint-1.md](../sprints/sprint-1.md) — ratification record.
