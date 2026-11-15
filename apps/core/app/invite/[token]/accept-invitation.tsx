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
import { roleLabel } from "@/lib/format";

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
      Ir al inicio
    </Link>
  );

  if (preview.isLoading) {
    return <Frame title="Verificando tu invitación…" />;
  }

  if (preview.error || !preview.data) {
    return (
      <Frame
        title="Invitación no encontrada"
        description="Este enlace no es válido. Pídele uno nuevo al administrador de tu firma."
      >
        {dashboardLink}
      </Frame>
    );
  }

  const invitation = preview.data;

  if (invitation.status !== "PENDING") {
    const reason =
      invitation.status === "EXPIRED"
        ? "Esta invitación venció."
        : invitation.status === "REVOKED"
          ? "Esta invitación fue revocada."
          : "Esta invitación ya fue usada.";
    return (
      <Frame
        title="Invitación no disponible"
        description={`${reason} Pídele una nueva al administrador de tu firma.`}
      >
        {dashboardLink}
      </Frame>
    );
  }

  if (!invitation.emailMatches) {
    return (
      <Frame
        title="Cuenta equivocada"
        description={
          <>
            Esta invitación a <strong>{invitation.tenantName}</strong> fue
            emitida para{" "}
            <span className="font-mono text-xs">{invitation.email}</span>, pero
            iniciaste sesión como{" "}
            <span className="font-mono text-xs">{signedInEmail}</span>.
          </>
        }
      >
        <Button className="w-full" onClick={switchAccount}>
          Iniciar sesión con otra cuenta
        </Button>
      </Frame>
    );
  }

  return (
    <Frame
      title={`Unirse a ${invitation.tenantName}`}
      description={
        <>
          Te invitaron como{" "}
          <strong className="text-foreground">
            {roleLabel(invitation.roleLabel)}
          </strong>
          . Al aceptar, tu cuenta{" "}
          <span className="font-mono text-xs">{signedInEmail}</span> queda
          vinculada a esta firma.
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
        {accept.isPending || accept.isSuccess ? "…" : "Aceptar invitación"}
      </Button>
    </Frame>
  );
}
