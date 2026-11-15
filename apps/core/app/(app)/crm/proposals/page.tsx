"use client";

// Proposals list — sprint-4.md scope item 3. Creation captures the basic
// fields; items are edited on the detail page while the proposal is DRAFT.
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
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
} from "@andes/ui";

import {
  daysBetween,
  formatDate,
  formatMoney,
  localDay,
  toDay,
} from "@/lib/format";
import { trpc } from "@/lib/trpc";

import { CrmNav } from "../_components/crm-nav";
import { ProposalStatusBadge } from "./_components/proposal-status-badge";

const STATUS_FILTERS = [
  ["ALL", "Todos los estados"],
  ["DRAFT", "Borrador"],
  ["SENT", "Enviada"],
  ["ACCEPTED", "Aceptada"],
  ["REJECTED", "Rechazada"],
  ["EXPIRED", "Vencida"],
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number][0];

const createFormSchema = z.object({
  clientId: z.string().min(1, "Elige un cliente"),
  contactId: z.string(),
  code: z.string().trim().min(1, "Obligatorio").max(32),
  title: z.string().trim().min(1, "Obligatorio").max(200),
  validUntil: z.string(),
});

type CreateFormValues = z.infer<typeof createFormSchema>;

function NewProposalDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  const clients = trpc.clients.list.useQuery();
  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      clientId: "",
      contactId: "",
      code: "",
      title: "",
      validUntil: "",
    },
  });
  const clientId = form.watch("clientId");
  const clientDetail = trpc.clients.get.useQuery(
    { id: clientId },
    { enabled: !!clientId },
  );
  const create = trpc.proposals.create.useMutation({
    onSuccess: (created) => {
      void utils.proposals.list.invalidate();
      setOpen(false);
      router.push(`/crm/proposals/${created.id}`);
    },
  });

  function submit(values: CreateFormValues) {
    create.mutate({
      clientId: values.clientId,
      contactId: values.contactId || undefined,
      code: values.code,
      title: values.title,
      validUntil: values.validUntil || undefined,
    });
  }

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          Nueva propuesta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva propuesta</DialogTitle>
          <DialogDescription>
            Primero los datos básicos; los ítems con precio se agregan en la
            siguiente pantalla, mientras es borrador.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="proposal-client">Cliente</Label>
              <Select id="proposal-client" {...form.register("clientId")}>
                <option value="">— Elige un cliente —</option>
                {(clients.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {errors.clientId && (
                <p className="text-xs text-destructive">
                  {errors.clientId.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proposal-contact">Destinatario (opcional)</Label>
              <Select
                id="proposal-contact"
                disabled={!clientId}
                {...form.register("contactId")}
              >
                <option value="">— Sin contacto específico —</option>
                {(clientDetail.data?.contacts ?? []).map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="proposal-code">Código</Label>
              <Input
                id="proposal-code"
                placeholder="PR-2026-001"
                className="font-mono"
                {...form.register("code")}
              />
              {errors.code && (
                <p className="text-xs text-destructive">
                  {errors.code.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proposal-valid">Válida hasta</Label>
              <Input
                id="proposal-valid"
                type="date"
                {...form.register("validUntil")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proposal-title">Título</Label>
            <Input id="proposal-title" {...form.register("title")} />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {create.error && (
            <p className="text-sm text-destructive">{create.error.message}</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "…" : "Crear borrador"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProposalsPage() {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const proposals = trpc.proposals.list.useQuery(
    status === "ALL" ? undefined : { status },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CrmNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Propuestas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ofertas comerciales; las aceptadas se convierten en proyectos.
          </p>
        </div>
        <NewProposalDialog />
      </div>

      <Select
        aria-label="Filtrar por estado"
        className="w-44"
        value={status}
        onChange={(e) => setStatus(e.target.value as StatusFilter)}
      >
        {STATUS_FILTERS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      {proposals.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando propuestas…</p>
      ) : proposals.data && proposals.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Enviada</TableHead>
              <TableHead>Válida hasta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.data.map((proposal) => (
              <TableRow key={proposal.id}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/crm/proposals/${proposal.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {proposal.code}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{proposal.title}</TableCell>
                <TableCell className="text-muted-foreground">
                  <Link
                    href={`/crm/${proposal.client.id}`}
                    className="underline-offset-2 hover:text-primary hover:underline"
                  >
                    {proposal.client.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatMoney(proposal.total, proposal.currency)}
                </TableCell>
                <TableCell>
                  <ProposalStatusBadge status={proposal.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {proposal.sentAt ? (
                    <>
                      {formatDate(proposal.sentAt)}
                      {proposal.status === "SENT" && (
                        <span className="block text-xs">
                          esperando{" "}
                          {daysBetween(toDay(proposal.sentAt), localDay())} d
                        </span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(proposal.validUntil)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No hay propuestas{status !== "ALL" ? " con este estado" : " todavía"}.
          Crea el primero.
        </div>
      )}
    </div>
  );
}
