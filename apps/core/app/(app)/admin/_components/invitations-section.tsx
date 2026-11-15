"use client";

// Invitations table + create dialog (sprint-12.md scope item 3). Links
// are copied and shared manually — email delivery is deliberately out of
// scope (future ADR). The link is the credential, but acceptance is bound
// to the invited email, so a forwarded link grants nothing.
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeProps,
} from "@andes/ui";

import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";

type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

const statusBadge: Record<
  InvitationStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  PENDING: { label: "Pending", variant: "warning" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  REVOKED: { label: "Revoked", variant: "outline" },
  EXPIRED: { label: "Expired", variant: "muted" },
};

function inviteUrl(token: string) {
  return `${window.location.origin}/invite/${token}`;
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(inviteUrl(token));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

const formSchema = z.object({
  email: z.string().trim().email("Invalid email").max(200),
  roleId: z.string().min(1, "Required"),
});

type InviteFormValues = z.infer<typeof formSchema>;

function InviteDialog() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const roles = trpc.admin.roles.useQuery();
  const create = trpc.admin.createInvitation.useMutation({
    onSuccess: () => void utils.admin.invitations.invalidate(),
  });

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", roleId: "" },
  });

  // Fresh form each time the dialog opens; default to the least
  // privileged seed role so an admin grant is always a deliberate choice.
  useEffect(() => {
    if (open) {
      create.reset();
      form.reset({
        email: "",
        roleId:
          roles.data?.find((r) => r.key === "ENGINEER")?.id ??
          roles.data?.[0]?.id ??
          "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roles.data]);

  const errors = form.formState.errors;
  const created = create.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Creates a single-use link, valid for 7 days, that only the invited
            email can accept. Share it yourself — no email is sent.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <p className="text-sm">
              Invitation for{" "}
              <span className="font-mono text-xs">{created.email}</span> as{" "}
              <span className="font-medium">{created.role.label}</span> is
              ready.
            </p>
            <Input
              readOnly
              aria-label="Invitation link"
              className="font-mono text-xs"
              value={inviteUrl(created.token)}
              onFocus={(e) => e.target.select()}
            />
            <div className="flex justify-end gap-2">
              <CopyLinkButton token={created.token} />
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                {...form.register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select id="invite-role" {...form.register("roleId")}>
                {(roles.data ?? []).map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </Select>
              {errors.roleId && (
                <p className="text-xs text-destructive">
                  {errors.roleId.message}
                </p>
              )}
            </div>

            {create.error && (
              <p role="alert" className="text-sm text-destructive">
                {create.error.message}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={create.isPending || !roles.data}>
                {create.isPending ? "…" : "Create invitation"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InvitationsSection() {
  const utils = trpc.useUtils();
  const invitations = trpc.admin.invitations.useQuery();
  const revoke = trpc.admin.revokeInvitation.useMutation({
    onSuccess: () => void utils.admin.invitations.invalidate(),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Invitations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Re-inviting an email replaces its previous pending invitation.
          </p>
        </div>
        <InviteDialog />
      </div>

      {revoke.error && (
        <p role="alert" className="text-sm text-destructive">
          {revoke.error.message}
        </p>
      )}

      {invitations.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading invitations…</p>
      ) : invitations.error ? (
        <p className="text-sm text-destructive">{invitations.error.message}</p>
      ) : invitations.data && invitations.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Invited by</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.data.map((invitation) => {
              const badge = statusBadge[invitation.status];
              const pending = invitation.status === "PENDING";
              return (
                <TableRow key={invitation.id}>
                  <TableCell className="font-mono text-xs">
                    {invitation.email}
                  </TableCell>
                  <TableCell>{invitation.role.label}</TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pending ? formatDate(invitation.expiresAt) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {invitation.invitedBy.name}
                  </TableCell>
                  <TableCell>
                    {pending && (
                      <div className="flex justify-end gap-2">
                        <CopyLinkButton token={invitation.token} />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={revoke.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Revoke the invitation for ${invitation.email}? Its link stops working.`,
                              )
                            ) {
                              revoke.mutate({ id: invitation.id });
                            }
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No invitations yet. Invite the first member of your team.
        </div>
      )}
    </section>
  );
}
