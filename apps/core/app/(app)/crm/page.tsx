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
import { CrmNav } from "./_components/crm-nav";

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
          Nuevo cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            Registra un cliente de tu firma.
          </DialogDescription>
        </DialogHeader>
        <ClientForm
          submitLabel="Crear cliente"
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
      <CrmNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Las empresas y entidades para las que haces trabajo de ingeniería.
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
        Mostrar archivados
      </label>

      {clients.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando clientes…</p>
      ) : clients.data && clients.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>NIT</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Contactos</TableHead>
              <TableHead>Proyectos</TableHead>
              <TableHead>Estado</TableHead>
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
                    <Badge variant="outline">Archivado</Badge>
                  ) : (
                    <Badge variant="success">Activo</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Aún no hay clientes. Crea el primero.
        </div>
      )}
    </div>
  );
}
