# Sprint 12 Domain Model — Administration: Members & Invitations

**Version:** 1.0
**Status:** Draft — awaiting CTO ratification together with [sprint-12.md](../sprints/sprint-12.md)
**Part of:** `docs/architecture/`, following the DDD workflow in [architecture-principles.md](../foundation/architecture-principles.md)

---

## Purpose

Walks the DDD sequence for the Administration module's first slice: seeing the firm's members and inviting new ones. This operationalizes the Sprint 0 identity model (Tenant/User/Role/Membership) for self-service — today a new engineer can only be linked by an operator running a CLI script against the database, which cannot survive first contact with a real firm.

## Business

An engineering firm's admin must be able to bring their staff onto the platform and control what each person can do — without a database operator. This is the process RFC-001 and the Sprint 0 domain model described ("a user is created or invited into that tenant") finally getting its front door. It is also the last Sprint 1 deferral still standing.

## Processes

1. An `OWNER_ADMIN` opens **Administration**: the members list (name, email, role) and the invitations list.
2. The admin creates an **invitation**: email + role (from the tenant's own `Role` table — Sprint 0 made roles data precisely so this screen never needs a migration). The platform generates a **single-use invite link**; the admin copies it and sends it through whatever channel (no email service in the MVP — zero cost, zero new vendor).
3. The invitee opens the link: signs in or signs up (Better Auth, ADR-002), and accepts. Acceptance is **bound to the invited email** — the session's email must match, case-insensitively, or it fails closed. Accepting consumes the token and creates the `Membership` with the invited role.
4. Invitations expire (7 days) and are revocable while pending: `PENDING → ACCEPTED | REVOKED | EXPIRED` (the forward-only precedent).
5. The admin can **change a member's role** or **remove a member** — with the platform refusing to demote or remove the **last `OWNER_ADMIN`** (a tenant must never lock itself out).
6. The one-active-tenant rule (Sprint 0) holds: a user already belonging to another tenant cannot accept.

## Domain Concepts

- **Invitation** — a pending, revocable, expiring offer of membership: tenant-scoped, email-bound, role-bound, carrying a high-entropy single-use token.
- **Acceptance context** — the one deliberately special data path: the invitee has a session but **no tenant yet**, so the token lookup cannot ride `forTenant`. It rides a new `forInviteToken` client that mirrors the existing `forUser` bootstrap: a transaction-local `app.invite_token` setting with an RLS policy granting visibility of exactly that one row. No blanket read, no RLS bypass — the same pattern Sprint 0 ratified for session bootstrap.

## Entities (draft sketch)

| Entity       | Key Fields                                                                                                                                 | Notes                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invitation` | `id`, `tenantId`, `email`, `roleId`, `token` (unique, high-entropy), `status`, `expiresAt`, `invitedById`, `acceptedByUserId?`, timestamps | Role `Restrict` (an invitation must not outlive its role silently); no hard delete — REVOKED/EXPIRED stay as audit trail. Re-inviting the same email supersedes (revokes) the previous PENDING one. |

## Relationships

```
Tenant 1 ──── N Invitation N ──── 1 Role
                    │
                    1 invitedBy User · 0..1 acceptedBy User
```

Acceptance creates the standard `Membership` — nothing about Sprint 0's model changes.

## Roles & Permissions

Everything here is **`OWNER_ADMIN`-only** (`roleProcedure`, the Sprint 2 archive precedent) except acceptance itself, which any authenticated session without a tenant may attempt against a valid token. The Administration sidebar entry becomes visible to `OWNER_ADMIN` only — the role-based visibility navigation.md reserved for when `/admin` carried real functionality.

## Open Questions for Ratification

1. **Invite links without email delivery** (admin copies and shares the link). Recommendation: **yes** — zero cost/vendor; an email-delivery ADR can layer on later without touching this model.
2. **Acceptance bound to the invited email.** Recommendation: **yes** — fail closed; a forwarded link alone must not grant access.
3. **`forInviteToken` RLS bootstrap** mirroring `forUser`. Recommendation: **yes** — consistent with the ratified pattern; strict-tier tested.
4. **Role change + member removal with last-OWNER_ADMIN guard.** Recommendation: **include** — it completes the screen; trim candidate if the sprint grows.
5. **7-day expiry, lazy transition** (EXPIRED computed/stamped on read/accept attempt, no cron). Recommendation: **yes**.

## What This Document Does Not Cover

Prisma/RLS syntax, token generation details, tRPC signatures, screen layout — implementation after ratification. Email delivery, REVIEWER/CLIENT_VIEWER seed roles (a data insert whenever wanted), and multi-tenant membership remain out of scope.

## References

- `sprint-0-domain-model.md` — the identity model this operationalizes; the roles-as-data decision this screen finally exploits.
- [RFC-001](../rfc/0001-multi-tenant-architecture.md) — tenant provisioning/invite process; one-active-tenant rule.
- [sprint-12.md](../sprints/sprint-12.md) — the sprint plan this model belongs to.
