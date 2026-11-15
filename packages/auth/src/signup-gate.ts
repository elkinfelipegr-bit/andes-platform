// Closed registration (ADR-013): an account can only be created by
// someone the firm invited. Sign-in is untouched. Pure decision logic,
// unit-tested; the Better Auth hook in auth.ts supplies the lookups.

export interface PendingInvitation {
  email: string;
  status: string;
  expiresAt: Date;
}

export interface SignUpGateInput {
  email: string;
  // The invitation token the sign-up arrived with, if any.
  inviteToken: string | null;
  // Addresses an operator allows to register without an invitation — how
  // a brand-new firm's first admin gets in (comma-separated env value).
  allowlist: string | undefined;
  // Looks the invitation up by its token; returns null when there is none.
  findInvitation: (token: string) => Promise<PendingInvitation | null>;
  now: Date;
}

export type SignUpDecision =
  | { allowed: true; via: "allowlist" | "invitation" }
  | { allowed: false; reason: string };

const normalize = (value: string) => value.trim().toLowerCase();

export function parseAllowlist(value: string | undefined): string[] {
  return (value ?? "").split(",").map(normalize).filter(Boolean);
}

const DENIED =
  "El registro es solo por invitación. Pídele al administrador de tu firma un enlace de invitación.";

export async function decideSignUp(
  input: SignUpGateInput,
): Promise<SignUpDecision> {
  const email = normalize(input.email);
  if (!email) return { allowed: false, reason: DENIED };
  if (parseAllowlist(input.allowlist).includes(email)) {
    return { allowed: true, via: "allowlist" };
  }
  // Tokens are high-entropy and URL-safe; anything else is not a token.
  if (!input.inviteToken || !/^[A-Za-z0-9_-]{16,}$/.test(input.inviteToken)) {
    return { allowed: false, reason: DENIED };
  }
  const invitation = await input.findInvitation(input.inviteToken);
  if (!invitation) return { allowed: false, reason: DENIED };
  if (invitation.status !== "PENDING" || invitation.expiresAt <= input.now) {
    return {
      allowed: false,
      reason: "Esta invitación ya no está disponible. Pide una nueva.",
    };
  }
  // The invitation is bound to its email: a forwarded link must not let
  // someone else register.
  if (normalize(invitation.email) !== email) {
    return {
      allowed: false,
      reason:
        "Esta invitación fue emitida para otro correo. Regístrate con el correo invitado.",
    };
  }
  return { allowed: true, via: "invitation" };
}
