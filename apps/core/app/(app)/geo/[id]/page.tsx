"use client";

// Geotechnical record detail — sprint-7.md scope item 4, mirroring
// /structures. DRAFT: record editor + checks management (server
// computes). ISSUED: the frozen memoria with Print, carrying the
// responsible-engineer line AND the stated water-table assumption
// (ratified decision 4).
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

import { BearingCheckDialog } from "../_components/bearing-check-dialog";
import { GeoRecordStatusBadge, ShapeBadge } from "../_components/geo-badges";

type GeoRecordDetail = RouterOutputs["geoRecords"]["get"];

const recordSchema = z.object({
  code: z.string().trim().min(1, "Required").max(32),
  title: z.string().trim().min(1, "Required").max(200),
  notes: z.string().trim().max(5000),
});

type RecordValues = z.infer<typeof recordSchema>;

function formatKpa(value: number): string {
  return `${value.toFixed(1)} kPa`;
}

function RecordEditor({ record }: { record: GeoRecordDetail }) {
  const utils = trpc.useUtils();
  const update = trpc.geoRecords.update.useMutation({
    onSuccess: () => {
      void utils.geoRecords.get.invalidate({ id: record.id });
      void utils.geoRecords.list.invalidate();
    },
  });

  const form = useForm<RecordValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      code: record.code,
      title: record.title,
      notes: record.notes ?? "",
    },
  });
  const errors = form.formState.errors;

  function submit(values: RecordValues) {
    update.mutate({
      id: record.id,
      code: values.code,
      title: values.title,
      notes: values.notes || null,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record data</CardTitle>
        {update.isSuccess && (
          <CardDescription className="text-success">Saved.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="grid grid-cols-[140px_1fr] gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="geo-code">Code</Label>
              <Input
                id="geo-code"
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
              <Label htmlFor="geo-title">Title</Label>
              <Input id="geo-title" {...form.register("title")} />
              {errors.title && (
                <p className="text-xs text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="geo-notes">Exploration / criteria notes</Label>
            <Textarea id="geo-notes" rows={3} {...form.register("notes")} />
          </div>

          {update.error && (
            <p className="text-sm text-destructive">{update.error.message}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "…" : "Save"}
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
  record: GeoRecordDetail;
  editable: boolean;
}) {
  const utils = trpc.useUtils();
  const remove = trpc.geoRecords.removeCheck.useMutation({
    onSuccess: () => {
      void utils.geoRecords.get.invalidate({ id: record.id });
      void utils.geoRecords.list.invalidate();
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
          <TableHead>Footing</TableHead>
          <TableHead className="text-right">B / Df (m)</TableHead>
          <TableHead>Shape</TableHead>
          <TableHead className="text-right">γ / c / φ</TableHead>
          <TableHead className="text-right">FS</TableHead>
          <TableHead className="text-right">q ult</TableHead>
          <TableHead className="text-right">q adm</TableHead>
          {editable && <TableHead className="w-20" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {record.checks.map((check) => (
          <TableRow key={check.id}>
            <TableCell className="font-medium">{check.label}</TableCell>
            <TableCell className="text-right font-mono text-xs">
              {check.b} / {check.df}
            </TableCell>
            <TableCell>
              <ShapeBadge shape={check.shape} />
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {check.gamma} / {check.c} / {check.phi}°
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {check.fs}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {formatKpa(check.qUlt)}
            </TableCell>
            <TableCell className="text-right font-mono text-xs font-semibold">
              {formatKpa(check.qAdm)}
            </TableCell>
            {editable && (
              <TableCell>
                <div className="flex items-center gap-1">
                  <BearingCheckDialog
                    geoRecordId={record.id}
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
function GeoMemoriaView({ record }: { record: GeoRecordDetail }) {
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
          <p>
            Project: <span className="font-mono">{record.project.code}</span>
          </p>
          <p>Issued: {formatDate(record.issuedAt)}</p>
        </div>
      </div>

      <Separator className="my-6" />

      {record.notes && (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Exploration / criteria
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{record.notes}</p>
        </>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Bearing capacity checks ({record.checks.length})
        </p>
        <ChecksTable record={record} editable={false} />
      </div>

      <Separator className="my-6" />
      <p className="text-xs text-muted-foreground">
        Capacidad portante por la ecuación general (factores de Vesic). Nivel
        freático supuesto por debajo de la zona de influencia — verificar en
        sitio. Cálculos generados por Andes Platform — revisados y aprobados por
        el ingeniero responsable.
      </p>
    </div>
  );
}

export default function GeoRecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const record = trpc.geoRecords.get.useQuery({ id });
  const issue = trpc.geoRecords.issue.useMutation({
    onSuccess: () => {
      void utils.geoRecords.get.invalidate({ id });
      void utils.geoRecords.list.invalidate();
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
          <Link href="/geo">
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
            href="/geo"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Geotechnical records
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{r.code}</h1>
            <GeoRecordStatusBadge status={r.status} />
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
          <RecordEditor key={r.updatedAt.toString()} record={r} />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Bearing capacity checks
                  </CardTitle>
                  <CardDescription>
                    Computed server-side (Vesic factors) — the engineer reviews
                    before issuing.
                  </CardDescription>
                </div>
                <BearingCheckDialog
                  geoRecordId={r.id}
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
        <GeoMemoriaView record={r} />
      )}
    </div>
  );
}
