# Sprint 12 — Proposal

**Status:** Proposed — awaiting CTO ratification
**Drafted:** 2026-07-13
**Objective (proposed):** Administration MVP — members list, role management, and self-service invitations by single-use link.

---

## Context

The oldest deferral in the project: since Sprint 1, **Administration** has been a disabled stub and onboarding a member requires an operator running `link-member` against the database. Every module the platform now has (10 shipped) is multi-user by design — but there is no way to add a second user without a CLI. This sprint gives the Sprint 0 identity model its front door, with **zero new cost or vendor** (invite links are copied and shared manually; email delivery is a future ADR if ever wanted). Domain detail in [sprint-12-domain-model.md](../architecture/sprint-12-domain-model.md), ratified together with this plan.

## Proposed Scope

1. **Domain & data layer** (`packages/db`): `Invitation` + status enum per the domain model; **`forInviteToken`** client mirroring the ratified `forUser` bootstrap (transaction-local `app.invite_token` + RLS policy for exactly that row); hand-written migrations; isolation suite extended **including the token-bootstrap case** (strict tier — this is tenant-boundary logic).
2. **API** (`packages/api`, `routers/admin/`): `admin` router — `members` (list with roles), `changeRole` / `removeMember` (both refusing to demote/remove the **last OWNER_ADMIN**), `invitations` list / `createInvitation` (supersedes a previous PENDING one for the same email) / `revokeInvitation` — all `roleProcedure("OWNER_ADMIN")`. Public acceptance: `acceptInvitation` (authenticated, no tenant required) — email must match, token single-use, expiry lazy, one-active-tenant rule enforced. Integration tests: full invite→accept flow, email mismatch, expiry, revocation, last-admin guard, cross-tenant sweep.
3. **UI** (`apps/core`): **Administration** live in the sidebar, **visible to OWNER_ADMIN only** (the role-based visibility navigation.md reserved) — members table with role select + remove, invitations table with create dialog and **copy-link** button, status badges. Public `/invite/[token]` page: sign in/up if needed, show the firm + role, accept.

## Out of Scope

- Email delivery of invitations (future ADR: provider, templates, deliverability — deliberately not smuggled in).
- REVIEWER / CLIENT_VIEWER seed roles (a data insert whenever wanted — Sprint 0 designed for it), permission granularity within roles.
- Multi-tenant memberships; tenant self-signup (provisioning a NEW firm remains operator work until the billing ADR).

## Testing Commitments

Strict tier: the `forInviteToken` bootstrap (a scoping bug here is cross-tenant onboarding) and the invitation table's isolation. Integration: the full acceptance flow incl. all denials (mismatched email, expired, revoked, reused token, already-member), the last-OWNER_ADMIN guard, cross-tenant sweeps. UI verified by the CTO inviting a real second account — the acceptance gate.

## Rollout Notes

Zero new infrastructure, secrets, or cost. Only migrations to Neon. The CTO's walkthrough needs a second email address (any personal one) to accept the invite with.

## Open Decisions for the CTO

1. **Ratify the domain model** — including its five recommendations (link-only invites, email-bound acceptance, `forInviteToken`, last-admin guard, 7-day lazy expiry).
2. **Ratify this scope** — trim candidates: role change/removal second, invitation supersede-on-reinvite first.

## References

- [sprint-12-domain-model.md](../architecture/sprint-12-domain-model.md) — the domain this sprint implements.
- `sprint-0-domain-model.md`, [RFC-001](../rfc/0001-multi-tenant-architecture.md) — the identity model and invite process this operationalizes.
- [sprint-10.md](sprint-10.md) — closed; [sprint-9.md](sprint-9.md) — executed, closure pending Copilot activation.
