"use client";

// Members table (sprint-12.md scope item 3): role select + remove. The
// last-OWNER_ADMIN guard and the "not yourself" rule live in the admin
// router — this screen only surfaces their refusals.
import { Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@andes/ui";

import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export function MembersSection({ currentUserId }: { currentUserId: string }) {
  const utils = trpc.useUtils();
  const members = trpc.admin.members.useQuery();
  const roles = trpc.admin.roles.useQuery();
  const onSuccess = () => void utils.admin.members.invalidate();
  const changeRole = trpc.admin.changeRole.useMutation({ onSuccess });
  const removeMember = trpc.admin.removeMember.useMutation({ onSuccess });

  const busy = changeRole.isPending || removeMember.isPending;
  const errorMessage =
    changeRole.error?.message ?? removeMember.error?.message ?? null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Members</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A firm always keeps at least one owner-admin.
        </p>
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {members.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading members…</p>
      ) : members.error ? (
        <p className="text-sm text-destructive">{members.error.message}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Member since</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(members.data ?? []).map((member) => {
              const isSelf = member.user.id === currentUserId;
              return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.user.name}
                    {isSelf && (
                      <Badge variant="muted" className="ml-2">
                        You
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {member.user.email}
                  </TableCell>
                  <TableCell>
                    <Select
                      aria-label={`Role of ${member.user.name}`}
                      className="w-44"
                      value={member.role.id}
                      disabled={busy || !roles.data}
                      onChange={(e) => {
                        changeRole.reset();
                        removeMember.reset();
                        changeRole.mutate({
                          membershipId: member.id,
                          roleId: e.target.value,
                        });
                      }}
                    >
                      {(roles.data ?? [member.role]).map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(member.createdAt)}
                  </TableCell>
                  <TableCell>
                    {!isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        aria-label={`Remove ${member.user.name}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${member.user.name} from your firm? They lose access immediately.`,
                            )
                          ) {
                            changeRole.reset();
                            removeMember.reset();
                            removeMember.mutate({ membershipId: member.id });
                          }
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
