"use client";

// Accept screen: shows the firm + role BEFORE the user commits, read
// through the token-scoped client only (admin.invitationPreview). Every
// denial — wrong email, expired, revoked, reused, already a member — is
// decided by the server; this component only explains it.
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@andes/ui";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

function Frame({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tracking-tight">Andes</span>
          <span className="text-xl font-light text-muted-foreground">
            Platform
          </span>
        </div>
        <CardTitle className="pt-2 text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {children && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  );
}

export function AcceptInvitation({
  token,
  signedInEmail,
}: {
  token: string;
  signedInEmail: string;
}) {
  const router = useRouter();
  const preview = trpc.admin.invitationPreview.useQuery(
    { token },
    { retry: false },
  );
  const accept = trpc.admin.acceptInvitation.useMutation({
    onSuccess: () => {
      router.push("/dashboard");
      router.refresh();
    },
  });

  async function switchAccount() {
    await authClient.signOut();
    router.push(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
    router.refresh();
  }

  const dashboardLink = (
    <Link
      href="/dashboard"
      className="text-sm text-muted-foreground underline-offset-2 hover:underline"
    >
      Go to the dashboard
    </Link>
  );

  if (preview.isLoading) {
    return <Frame title="Checking your invitation…" />;
  }

  if (preview.error || !preview.data) {
    return (
      <Frame
        title="Invitation not found"
        description="This link is not valid. Ask your firm's administrator for a new one."
      >
        {dashboardLink}
      </Frame>
    );
  }

  const invitation = preview.data;

  if (invitation.status !== "PENDING") {
    const reason =
      invitation.status === "EXPIRED"
        ? "This invitation has expired."
        : invitation.status === "REVOKED"
          ? "This invitation was revoked."
          : "This invitation has already been used.";
    return (
      <Frame
        title="Invitation unavailable"
        description={`${reason} Ask your firm's administrator for a new one.`}
      >
        {dashboardLink}
      </Frame>
    );
  }

  if (!invitation.emailMatches) {
    return (
      <Frame
        title="Wrong account"
        description={
          <>
            This invitation to <strong>{invitation.tenantName}</strong> was
            issued to{" "}
            <span className="font-mono text-xs">{invitation.email}</span>, but
            you are signed in as{" "}
            <span className="font-mono text-xs">{signedInEmail}</span>.
          </>
        }
      >
        <Button className="w-full" onClick={switchAccount}>
          Sign in with another account
        </Button>
      </Frame>
    );
  }

  return (
    <Frame
      title={`Join ${invitation.tenantName}`}
      description={
        <>
          You have been invited as{" "}
          <strong className="text-foreground">{invitation.roleLabel}</strong>.
          Accepting links your account{" "}
          <span className="font-mono text-xs">{signedInEmail}</span> to this
          firm.
        </>
      }
    >
      {accept.error && (
        <p role="alert" className="text-sm text-destructive">
          {accept.error.message}
        </p>
      )}
      <Button
        className="w-full"
        disabled={accept.isPending || accept.isSuccess}
        onClick={() => accept.mutate({ token })}
      >
        {accept.isPending || accept.isSuccess ? "…" : "Accept invitation"}
      </Button>
    </Frame>
  );
}
