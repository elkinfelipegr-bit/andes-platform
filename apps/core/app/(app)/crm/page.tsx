"use client";

// CRM clients list — sprint-3.md scope item 3, on the Sprint 1 shell.
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@andes/ui";

import { trpc } from "@/lib/trpc";

import { ClientForm, type ClientFormPayload } from "./_components/client-form";

function NewClientDialog() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const create = trpc.clients.create.useMutation({
    onSuccess: () => {
      void utils.clients.list.invalidate();
      setOpen(false);
    },
  });

  function handleSubmit(payload: ClientFormPayload) {
    create.mutate({
      name: payload.name,
      taxId: payload.taxId ?? undefined,
      industry: payload.industry ?? undefined,
      address: payload.address ?? undefined,
      city: payload.city ?? undefined,
      phone: payload.phone ?? undefined,
      email: payload.email ?? undefined,
      notes: payload.notes ?? undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          New client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>
            Register a customer of your firm — never a tenant.
          </DialogDescription>
        </DialogHeader>
        <ClientForm
          submitLabel="Create client"
          busy={create.isPending}
          errorMessage={create.error?.message ?? null}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

export default function CrmPage() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const clients = trpc.clients.list.useQuery(
    includeArchived ? { includeArchived: true } : undefined,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The firms and entities you do engineering work for.
          </p>
        </div>
        <NewClientDialog />
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) => setIncludeArchived(e.target.checked)}
          className="size-4 accent-primary"
        />
        Show archived
      </label>

      {clients.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading clients…</p>
      ) : clients.data && clients.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Tax ID</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.data.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/crm/${client.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {client.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {client.taxId ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.city ?? "—"}
                </TableCell>
                <TableCell>{client._count.contacts}</TableCell>
                <TableCell>{client._count.projects}</TableCell>
                <TableCell>
                  {client.archivedAt ? (
                    <Badge variant="outline">Archived</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No clients yet. Create the first one.
        </div>
      )}
    </div>
  );
}
