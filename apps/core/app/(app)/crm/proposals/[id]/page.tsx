"use client";

// Proposal detail — sprint-4.md scope item 3. DRAFT: full editor (fields +
// items). SENT and beyond: frozen document view (what the client saw) with
// the action bar driving the forward-only lifecycle, and a print-optimized
// rendering as the MVP generated document (ratified decision 2).
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Check,
  FolderKanban,
  Plus,
  Printer,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@andes/ui";

import { formatDate, formatMoney } from "@/lib/format";
import { trpc, type RouterOutputs } from "@/lib/trpc";

import { CrmNav } from "../../_components/crm-nav";
import { ProposalStatusBadge } from "../_components/proposal-status-badge";

type ProposalDetail = RouterOutputs["proposals"]["get"];

const draftSchema = z.object({
  code: z.string().trim().min(1, "Required").max(32),
  title: z.string().trim().min(1, "Required").max(200),
  scope: z.string().trim().max(5000),
  contactId: z.string(),
  currency: z.string().trim().length(3, "3-letter code"),
  validUntil: z.string(),
  // Numeric fields stay strings in the form (RHF-friendly types) and are
  // converted on submit; the API re-validates as numbers.
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Required").max(500),
        quantity: z.string().refine((v) => Number(v) > 0, { message: "> 0" }),
        unit: z.string().trim().min(1, "Req.").max(50),
        unitPrice: z
          .string()
          .refine(
            (v) => v !== "" && Number(v) >= 0 && !Number.isNaN(Number(v)),
            {
              message: "≥ 0",
            },
          ),
      }),
    )
    .max(100),
});

type DraftValues = z.infer<typeof draftSchema>;

function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function DraftEditor({ proposal }: { proposal: ProposalDetail }) {
  const utils = trpc.useUtils();
  const clientDetail = trpc.clients.get.useQuery({ id: proposal.clientId });
  const update = trpc.proposals.update.useMutation({
    onSuccess: () => {
      void utils.proposals.get.invalidate({ id: proposal.id });
      void utils.proposals.list.invalidate();
    },
  });

  const form = useForm<DraftValues>({
    resolver: zodResolver(draftSchema),
    defaultValues: {
      code: proposal.code,
      title: proposal.title,
      scope: proposal.scope ?? "",
      contactId: proposal.contact?.id ?? "",
      currency: proposal.currency,
      validUntil: toDateInput(proposal.validUntil),
      items: proposal.items.map((item) => ({
        description: item.description,
        quantity: String(item.quantity),
        unit: item.unit,
        unitPrice: String(item.unitPrice),
      })),
    },
  });
  const items = useFieldArray({ control: form.control, name: "items" });
  const watchedItems = form.watch("items");
  const liveTotal = watchedItems.reduce(
    (acc, item) =>
      acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const errors = form.formState.errors;

  function submit(values: DraftValues) {
    update.mutate({
      id: proposal.id,
      code: values.code,
      title: values.title,
      scope: values.scope || null,
      contactId: values.contactId || null,
      currency: values.currency.toUpperCase(),
      validUntil: values.validUntil || null,
      items: values.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
      })),
    });
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proposal data</CardTitle>
          {update.isSuccess && (
            <CardDescription className="text-success">Saved.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-code">Code</Label>
              <Input
                id="p-code"
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
              <Label htmlFor="p-currency">Currency</Label>
              <Input
                id="p-currency"
                className="font-mono uppercase"
                {...form.register("currency")}
              />
              {errors.currency && (
                <p className="text-xs text-destructive">
                  {errors.currency.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-valid">Valid until</Label>
              <Input
                id="p-valid"
                type="date"
                {...form.register("validUntil")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-title">Title</Label>
            <Input id="p-title" {...form.register("title")} />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-contact">Recipient</Label>
            <Select id="p-contact" {...form.register("contactId")}>
              <option value="">— No specific contact —</option>
              {(clientDetail.data?.contacts ?? []).map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-scope">Scope</Label>
            <Textarea
              id="p-scope"
              rows={4}
              placeholder="Alcance de los servicios…"
              {...form.register("scope")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Items</CardTitle>
              <CardDescription>
                Live total:{" "}
                <span className="font-mono font-medium text-foreground">
                  {formatMoney(liveTotal, form.watch("currency") || "COP")}
                </span>
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                items.append({
                  description: "",
                  quantity: "1",
                  unit: "un",
                  unitPrice: "0",
                })
              }
            >
              <Plus aria-hidden="true" />
              Add item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {items.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No items yet — a proposal needs at least one before it can be
              sent.
            </p>
          ) : (
            <div className="space-y-2">
              {items.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-[1fr_90px_70px_130px_36px] items-start gap-2"
                >
                  <div>
                    <Input
                      aria-label={`Item ${index + 1} description`}
                      placeholder="Descripción"
                      {...form.register(`items.${index}.description`)}
                    />
                    {errors.items?.[index]?.description && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.items[index]?.description?.message}
                      </p>
                    )}
                  </div>
                  <Input
                    aria-label={`Item ${index + 1} quantity`}
                    type="number"
                    step="any"
                    placeholder="Cant."
                    {...form.register(`items.${index}.quantity`)}
                  />
                  <Input
                    aria-label={`Item ${index + 1} unit`}
                    placeholder="un"
                    {...form.register(`items.${index}.unit`)}
                  />
                  <Input
                    aria-label={`Item ${index + 1} unit price`}
                    type="number"
                    step="any"
                    placeholder="Precio unit."
                    className="font-mono"
                    {...form.register(`items.${index}.unitPrice`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() => items.remove(index)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {update.error && (
        <p className="text-sm text-destructive">{update.error.message}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "…" : "Save draft"}
        </Button>
      </div>
    </form>
  );
}

// The frozen rendering — on screen for SENT+ and the print target
// (browser print → PDF is the MVP generated document).
function ProposalDocument({ proposal }: { proposal: ProposalDetail }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight">
            Andes{" "}
            <span className="font-light text-muted-foreground">Platform</span>
          </p>
          <h2 className="mt-4 text-xl font-semibold">{proposal.title}</h2>
          <p className="font-mono text-sm text-muted-foreground">
            {proposal.code}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Date: {formatDate(proposal.createdAt)}</p>
          <p>Valid until: {formatDate(proposal.validUntil)}</p>
        </div>
      </div>

      <Separator className="my-6" />

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Client
          </p>
          <p className="mt-1 font-medium">{proposal.client.name}</p>
        </div>
        {proposal.contact && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Attention
            </p>
            <p className="mt-1 font-medium">
              {proposal.contact.name}
              {proposal.contact.title && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  — {proposal.contact.title}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {proposal.scope && (
        <>
          <p className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Scope
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{proposal.scope}</p>
        </>
      )}

      <div className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposal.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {item.quantity}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.unit}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatMoney(item.unitPrice, proposal.currency)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatMoney(
                    item.quantity * item.unitPrice,
                    proposal.currency,
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex justify-end">
          <p className="text-sm">
            Total:{" "}
            <span className="font-mono text-lg font-semibold">
              {formatMoney(proposal.total, proposal.currency)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function ConvertDialog({ proposal }: { proposal: ProposalDetail }) {
  const [open, setOpen] = useState(false);
  const [projectCode, setProjectCode] = useState("");
  const utils = trpc.useUtils();
  const convert = trpc.proposals.convertToProject.useMutation({
    onSuccess: () => {
      void utils.proposals.get.invalidate({ id: proposal.id });
      void utils.proposals.list.invalidate();
      void utils.projects.list.invalidate();
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FolderKanban aria-hidden="true" />
          Convert to project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to project</DialogTitle>
          <DialogDescription>
            Creates a draft project for {proposal.client.name}, permanently
            linked to this proposal. Pick the project code.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="convert-code">Project code</Label>
            <Input
              id="convert-code"
              placeholder="P-2026-014"
              className="font-mono"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
            />
          </div>
          {convert.error && (
            <p className="text-sm text-destructive">{convert.error.message}</p>
          )}
          <div className="flex justify-end">
            <Button
              disabled={!projectCode.trim() || convert.isPending}
              onClick={() =>
                convert.mutate({
                  id: proposal.id,
                  projectCode: projectCode.trim(),
                })
              }
            >
              {convert.isPending ? "…" : "Create project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const proposal = trpc.proposals.get.useQuery({ id });
  const invalidate = () => {
    void utils.proposals.get.invalidate({ id });
    void utils.proposals.list.invalidate();
  };
  const send = trpc.proposals.send.useMutation({ onSuccess: invalidate });
  const decide = trpc.proposals.decide.useMutation({ onSuccess: invalidate });
  const markExpired = trpc.proposals.markExpired.useMutation({
    onSuccess: invalidate,
  });

  if (proposal.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading proposal…</p>;
  }
  if (!proposal.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Proposal not found.</p>
        <Button asChild variant="outline">
          <Link href="/crm/proposals">
            <ArrowLeft aria-hidden="true" />
            Back to proposals
          </Link>
        </Button>
      </div>
    );
  }

  const p = proposal.data;
  const actionError =
    send.error?.message ??
    decide.error?.message ??
    markExpired.error?.message ??
    null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="print:hidden">
        <CrmNav />
      </div>
      <div className="flex items-center justify-between print:hidden">
        <div className="space-y-1">
          <Link
            href="/crm/proposals"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Proposals
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{p.code}</h1>
            <ProposalStatusBadge status={p.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {p.title} ·{" "}
            <Link
              href={`/crm/${p.client.id}`}
              className="underline-offset-2 hover:text-primary hover:underline"
            >
              {p.client.name}
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {p.status !== "DRAFT" && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden="true" />
              Print
            </Button>
          )}
          {p.status === "DRAFT" && (
            <Button
              disabled={send.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Send proposal ${p.code}? It becomes read-only.`,
                  )
                ) {
                  send.mutate({ id });
                }
              }}
            >
              <Send aria-hidden="true" />
              {send.isPending ? "…" : "Send"}
            </Button>
          )}
          {p.status === "SENT" && (
            <>
              <Button
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id, decision: "ACCEPTED" })}
              >
                <Check aria-hidden="true" />
                Accepted
              </Button>
              <Button
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id, decision: "REJECTED" })}
              >
                <X aria-hidden="true" />
                Rejected
              </Button>
              <Button
                variant="ghost"
                disabled={markExpired.isPending}
                onClick={() => markExpired.mutate({ id })}
              >
                Expired
              </Button>
            </>
          )}
          {p.status === "ACCEPTED" && !p.project && (
            <ConvertDialog proposal={p} />
          )}
          {p.project && (
            <Button asChild variant="outline">
              <Link href={`/projects/${p.project.id}`}>
                <FolderKanban aria-hidden="true" />
                {p.project.code}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <p className="text-sm text-destructive print:hidden">{actionError}</p>
      )}

      {p.status === "DRAFT" ? (
        <DraftEditor key={p.updatedAt.toString()} proposal={p} />
      ) : (
        <ProposalDocument proposal={p} />
      )}
    </div>
  );
}
