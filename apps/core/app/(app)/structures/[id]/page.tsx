"use client";

// Calculation record detail — sprint-6.md scope item 4. DRAFT: criteria
// editor + checks management (server computes). ISSUED: the frozen
// memoria with Print, carrying the responsible-engineer line
// (engineering-philosophy 6: the engineer reviews, decides, and signs).
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  FileCheck2,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@andes/ui";

import { formatDate } from "@/lib/format";
import { trpc, type RouterOutputs } from "@/lib/trpc";

import { CheckDialog } from "../_components/check-dialog";
import {
  CalcRecordStatusBadge,
  VerdictBadge,
} from "../_components/structures-badges";

type CalcRecordDetail = RouterOutputs["calcRecords"]["get"];

const criteriaSchema = z.object({
  code: z.string().trim().min(1, "Required").max(32),
  title: z.string().trim().min(1, "Required").max(200),
  designCode: z.string().trim().min(1, "Required").max(50),
  fc: z.string().refine((v) => Number(v) >= 17 && Number(v) <= 100, {
    message: "17–100 MPa",
  }),
  fy: z.string().refine((v) => Number(v) >= 240 && Number(v) <= 700, {
    message: "240–700 MPa",
  }),
  notes: z.string().trim().max(5000),
});

type CriteriaValues = z.infer<typeof criteriaSchema>;

function formatAs(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value)} mm²`;
}

function formatRho(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(5);
}

function CriteriaEditor({ record }: { record: CalcRecordDetail }) {
  const utils = trpc.useUtils();
  const update = trpc.calcRecords.update.useMutation({
    onSuccess: () => {
      void utils.calcRecords.get.invalidate({ id: record.id });
      void utils.calcRecords.list.invalidate();
    },
  });

  const form = useForm<CriteriaValues>({
    resolver: zodResolver(criteriaSchema),
    defaultValues: {
      code: record.code,
      title: record.title,
      designCode: record.designCode,
      fc: String(record.fc),
      fy: String(record.fy),
      notes: record.notes ?? "",
    },
  });
  const errors = form.formState.errors;

  function submit(values: CriteriaValues) {
    update.mutate({
      id: record.id,
      code: values.code,
      title: values.title,
      designCode: values.designCode,
      fc: Number(values.fc),
      fy: Number(values.fy),
      notes: values.notes || null,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Design criteria</CardTitle>
        <CardDescription>
          Changing f&apos;c or fy recomputes every check in this record.
          {update.isSuccess && (
            <span className="ml-2 text-success">Saved.</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cr-code">Code</Label>
              <Input
                id="cr-code"
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
              <Label htmlFor="cr-designcode">Design code</Label>
              <Input id="cr-designcode" {...form.register("designCode")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-fc">f&apos;c (MPa)</Label>
              <Input
                id="cr-fc"
                type="number"
                step="any"
                className="font-mono"
                {...form.register("fc")}
              />
              {errors.fc && (
                <p className="text-xs text-destructive">{errors.fc.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-fy">fy (MPa)</Label>
              <Input
                id="cr-fy"
                type="number"
                step="any"
                className="font-mono"
                {...form.register("fy")}
              />
              {errors.fy && (
                <p className="text-xs text-destructive">{errors.fy.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr-title">Title</Label>
            <Input id="cr-title" {...form.register("title")} />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr-notes">Criteria notes</Label>
            <Textarea id="cr-notes" rows={3} {...form.register("notes")} />
          </div>

          {update.error && (
            <p className="text-sm text-destructive">{update.error.message}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "…" : "Save criteria"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ChecksTable({
  record,
  editable,
}: {
  record: CalcRecordDetail;
  editable: boolean;
}) {
  const utils = trpc.useUtils();
  const remove = trpc.calcRecords.removeCheck.useMutation({
    onSuccess: () => {
      void utils.calcRecords.get.invalidate({ id: record.id });
      void utils.calcRecords.list.invalidate();
    },
  });

  if (record.checks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No checks yet — a record needs at least one before it can be issued.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Element</TableHead>
          <TableHead className="text-right">b×h (mm)</TableHead>
          <TableHead className="text-right">Mu (kN·m)</TableHead>
          <TableHead className="text-right">d (mm)</TableHead>
          <TableHead className="text-right">ρ req.</TableHead>
          <TableHead className="text-right">As req.</TableHead>
          <TableHead>Verdict</TableHead>
          {editable && <TableHead className="w-20" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {record.checks.map((check) => (
          <TableRow key={check.id}>
            <TableCell className="font-medium">{check.label}</TableCell>
            <TableCell className="text-right font-mono text-xs">
              {check.b}×{check.h}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {check.mu}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {check.d}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {formatRho(check.rhoRequired)}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {formatAs(check.requiredAs)}
            </TableCell>
            <TableCell>
              <VerdictBadge verdict={check.verdict} />
            </TableCell>
            {editable && (
              <TableCell>
                <div className="flex items-center gap-1">
                  <CheckDialog
                    calcRecordId={record.id}
                    check={check}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${check.label}`}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${check.label}`}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Remove check "${check.label}"?`)) {
                        remove.mutate({ id: check.id });
                      }
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// The frozen memoria — on screen for ISSUED and the print target.
function MemoriaView({ record }: { record: CalcRecordDetail }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight">
            Andes{" "}
            <span className="font-light text-muted-foreground">Platform</span>
          </p>
          <h2 className="mt-4 text-xl font-semibold">{record.title}</h2>
          <p className="font-mono text-sm text-muted-foreground">
            {record.code}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Design code: {record.designCode}</p>
          <p>Issued: {formatDate(record.issuedAt)}</p>
        </div>
      </div>

      <Separator className="my-6" />

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Project
          </p>
          <p className="mt-1 font-medium">
            <span className="font-mono text-xs">{record.project.code}</span> —{" "}
            {record.project.name}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Concrete f&apos;c
          </p>
          <p className="mt-1 font-mono font-medium">{record.fc} MPa</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Steel fy
          </p>
          <p className="mt-1 font-mono font-medium">{record.fy} MPa</p>
        </div>
      </div>

      {record.notes && (
        <>
          <p className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Criteria
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{record.notes}</p>
        </>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Flexural design checks ({record.checks.length})
        </p>
        <ChecksTable record={record} editable={false} />
      </div>

      <Separator className="my-6" />
      <p className="text-xs text-muted-foreground">
        Cálculos generados por Andes Platform (NSR-10 C.10, φ=0.90, sección
        rectangular con refuerzo a tracción) — revisados y aprobados por el
        ingeniero responsable.
      </p>
    </div>
  );
}

export default function CalcRecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const record = trpc.calcRecords.get.useQuery({ id });
  const issue = trpc.calcRecords.issue.useMutation({
    onSuccess: () => {
      void utils.calcRecords.get.invalidate({ id });
      void utils.calcRecords.list.invalidate();
    },
  });

  if (record.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading record…</p>;
  }
  if (!record.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Record not found.</p>
        <Button asChild variant="outline">
          <Link href="/structures">
            <ArrowLeft aria-hidden="true" />
            Back to records
          </Link>
        </Button>
      </div>
    );
  }

  const r = record.data;
  const draft = r.status === "DRAFT";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="space-y-1">
          <Link
            href="/structures"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Calculation records
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{r.code}</h1>
            <CalcRecordStatusBadge status={r.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {r.title} ·{" "}
            <Link
              href={`/projects/${r.project.id}`}
              className="font-mono text-xs underline-offset-2 hover:text-primary hover:underline"
            >
              {r.project.code}
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!draft && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden="true" />
              Print
            </Button>
          )}
          {draft && (
            <Button
              disabled={issue.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Issue record ${r.code}? It freezes as evidence — a correction is a new record.`,
                  )
                ) {
                  issue.mutate({ id });
                }
              }}
            >
              <FileCheck2 aria-hidden="true" />
              {issue.isPending ? "…" : "Issue"}
            </Button>
          )}
        </div>
      </div>

      {issue.error && (
        <p className="text-sm text-destructive print:hidden">
          {issue.error.message}
        </p>
      )}

      {draft ? (
        <>
          <CriteriaEditor key={r.updatedAt.toString()} record={r} />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Design checks</CardTitle>
                  <CardDescription>
                    Computed server-side per NSR-10 C.10 — the engineer reviews
                    before issuing.
                  </CardDescription>
                </div>
                <CheckDialog
                  calcRecordId={r.id}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Plus aria-hidden="true" />
                      Add check
                    </Button>
                  }
                />
              </div>
            </CardHeader>
            <CardContent>
              <ChecksTable record={r} editable />
            </CardContent>
          </Card>
        </>
      ) : (
        <MemoriaView record={r} />
      )}
    </div>
  );
}
