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

import { formatDate, formatMoney } from "@/lib/format";
import { trpc } from "@/lib/trpc";

import { CrmNav } from "../_components/crm-nav";
import { ProposalStatusBadge } from "./_components/proposal-status-badge";

const STATUS_FILTERS = [
  ["ALL", "All statuses"],
  ["DRAFT", "Draft"],
  ["SENT", "Sent"],
  ["ACCEPTED", "Accepted"],
  ["REJECTED", "Rejected"],
  ["EXPIRED", "Expired"],
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number][0];

const createFormSchema = z.object({
  clientId: z.string().min(1, "Pick a client"),
  contactId: z.string(),
  code: z.string().trim().min(1, "Required").max(32),
  title: z.string().trim().min(1, "Required").max(200),
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
          New proposal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New proposal</DialogTitle>
          <DialogDescription>
            Basic data first — you add the priced items on the next screen,
            while it is a draft.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="proposal-client">Client</Label>
              <Select id="proposal-client" {...form.register("clientId")}>
                <option value="">— Pick a client —</option>
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
              <Label htmlFor="proposal-contact">Recipient (optional)</Label>
              <Select
                id="proposal-contact"
                disabled={!clientId}
                {...form.register("contactId")}
              >
                <option value="">— No specific contact —</option>
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
              <Label htmlFor="proposal-code">Code</Label>
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
              <Label htmlFor="proposal-valid">Valid until</Label>
              <Input
                id="proposal-valid"
                type="date"
                {...form.register("validUntil")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proposal-title">Title</Label>
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
              {create.isPending ? "…" : "Create draft"}
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
          <h1 className="text-2xl font-semibold">Proposals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Commercial offers — accepted ones become projects.
          </p>
        </div>
        <NewProposalDialog />
      </div>

      <Select
        aria-label="Filter by status"
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
        <p className="text-sm text-muted-foreground">Loading proposals…</p>
      ) : proposals.data && proposals.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valid until</TableHead>
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
                  {formatDate(proposal.validUntil)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No proposals{status !== "ALL" ? " with this status" : " yet"}. Create
          the first one.
        </div>
      )}
    </div>
  );
}
