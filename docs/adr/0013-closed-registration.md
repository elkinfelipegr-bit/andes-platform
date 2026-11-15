# ADR-013: Closed Registration — Accounts by Invitation Only

**Status:** Proposed — implemented at the CTO's request of 2026-11-15 ("nobody else may register unless it is an email or credentials I enable") as a condition for publishing the platform. Awaiting his ratification of this text.
**Date:** 2026-11-15
**Deciders:** CTO / Lead Software Architect (Andes Engineering)

---

## Context

[ADR-002](0002-authentication-provider.md) chose Better Auth with email and password. Sign-up was open: anyone who found the login page could create an account. Such an account reaches no tenant data — every tenant-scoped procedure requires a membership ([RFC-001](../rfc/0001-multi-tenant-architecture.md)) — but it is still a row in the user table, a session, and an identity an admin could later invite by mistake. Sprint 12 added invitations; the platform is now being linked from the public website.

## Problem

Before the platform is reachable from a public page, who is allowed to create an account at all?

## Decision

**Creating an account requires a pending invitation for that exact email.** Sign-in is unchanged.

1. A Better Auth `before` hook on `/sign-up/email` refuses the request unless it carries, in the `x-invite-token` header, the token of an invitation that is `PENDING`, not expired, and issued to the email being registered (case-insensitive).
2. The invitation is read through `forInviteToken` — the RLS bootstrap ratified in Sprint 12, which exposes exactly the one row the token names. No new path around tenant isolation is created, and nothing can be learned about other invitations.
3. **Operator allowlist.** `SIGNUP_ALLOWED_EMAILS` (comma-separated) lets named addresses register without an invitation. It exists for one case: the first admin of a brand-new firm, who has nobody to invite them. It is empty by default.
4. The login page offers "register" only to someone who arrived from an invitation link; everyone else is told access is by invitation. This is presentation — the hook is the control.
5. The decision logic is a pure function (`packages/auth/src/signup-gate.ts`), tested at the strict tier.

## Alternatives

- **Leave sign-up open** (the account is harmless without a membership). Rejected: the CTO wants no account he did not enable, and it removes a class of clutter and confusion.
- **Disable sign-up entirely and create users by script.** Brings back the operator-with-a-database step Sprint 12 removed.
- **Email verification instead.** Proves the address is real, not that the firm wants that person; and the platform cannot yet send email to arbitrary recipients ([ADR-012](0012-follow-up-digest.md)). Complementary, not a substitute — see Consequences.
- **A lookup of invitations by email** (a privileged database function). Would add a way to read across tenants and would reveal whether an email has been invited; the token path needs neither.

## Trade-offs

An invited person must use the link they were sent, with the email it was issued to; a mistyped invitation email means issuing a new one. The allowlist is a powerful setting: whoever can edit the deployment's environment can let an address register (they still get no tenant data without a membership).

## Consequences

- One new optional variable, `SIGNUP_ALLOWED_EMAILS`.
- Existing accounts are unaffected.
- **Email ownership is not verified.** The invitation is bound to an address and delivered by the admin through a channel they trust, which is the control today. Verifying addresses by email becomes possible once a sending domain is verified in Resend; it should be added then, together with password reset.
- Provisioning a second firm still needs an operator (allowlist + `link-member`), as RFC-001 already notes.

## Examples

An admin invites `ana@firma.co` and sends her the link. She opens it, is sent to the login page in "register" mode, and creates her account with that email — accepted. Someone who received the link forwarded tries with `otro@gmail.com` — refused. Someone who finds the login page with no link sees no way to register, and a hand-made request to the sign-up endpoint is refused with 403.

## Exceptions

None.

## References

- [ADR-002](0002-authentication-provider.md) — the provider this configures.
- [sprint-12-domain-model.md](../architecture/sprint-12-domain-model.md) — invitations and the `forInviteToken` bootstrap.
