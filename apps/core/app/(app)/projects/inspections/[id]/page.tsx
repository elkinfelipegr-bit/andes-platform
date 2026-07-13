"use client";

// Inspection detail — sprint-5.md scope item 3. SCHEDULED: editor (fields
// + findings). COMPLETED/CANCELLED: frozen report with Print — the same
// print-view deliverable ratified in Sprint 4.
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Plus, Printer, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
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

import { formatDate } from "@/lib/format";
import { trpc, type RouterOutputs } from "@/lib/trpc";

import { ProjectsNav } from "../../_components/projects-nav";
import {
  InspectionStatusBadge,
  SeverityBadge,
} from "../_components/inspection-badges";
import { PhotoManager, ReportPhotos } from "../_components/inspection-photos";

type InspectionDetail = RouterOutputs["inspections"]["get"];

const SEVERITIES = [
  ["LOW", "Low"],
  ["MEDIUM", "Medium"],
  ["HIGH", "High"],
  ["CRITICAL", "Critical"],
] as const;

const draftSchema = z.object({
  code: z.string().trim().min(1, "Required").max(32),
  title: z.string().trim().min(1, "Required").max(200),
  inspectorId: z.string().min(1, "Required"),
  scheduledFor: z.string().min(1, "Required"),
  notes: z.string().trim().max(5000),
  findings: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Required").max(1000),
        severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        location: z.string().trim().max(200),
      }),
    )
    .max(200),
});

type DraftValues = z.infer<typeof draftSchema>;

function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function ScheduledEditor({ inspection }: { inspection: InspectionDetail }) {
  const utils = trpc.useUtils();
  const members = trpc.core.members.useQuery();
  const update = trpc.inspections.update.useMutation({
    onSuccess: () => {
      void utils.inspections.get.invalidate({ id: inspection.id });
      void utils.inspections.list.invalidate();
    },
  });

  const form = useForm<DraftValues>({
    resolver: zodResolver(draftSchema),
    defaultValues: {
      code: inspection.code,
      title: inspection.title,
      inspectorId: inspection.inspector.id,
      scheduledFor: toDateInput(inspection.scheduledFor),
      notes: inspection.notes ?? "",
      findings: inspection.findings.map((finding) => ({
        description: finding.description,
        severity: finding.severity,
        location: finding.location ?? "",
      })),
    },
  });
  const findings = useFieldArray({ control: form.control, name: "findings" });
  const errors = form.formState.errors;

  function submit(values: DraftValues) {
    update.mutate({
      id: inspection.id,
      code: values.code,
      title: values.title,
      inspectorId: values.inspectorId,
      scheduledFor: values.scheduledFor,
      notes: values.notes || null,
      findings: values.findings.map((finding) => ({
        description: finding.description,
        severity: finding.severity,
        location: finding.location || undefined,
      })),
    });
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inspection data</CardTitle>
          {update.isSuccess && (
            <CardDescription className="text-success">Saved.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="i-code">Code</Label>
              <Input
                id="i-code"
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
              <Label htmlFor="i-date">Scheduled for</Label>
              <Input
                id="i-date"
                type="date"
                {...form.register("scheduledFor")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-inspector">Inspector</Label>
              <Select id="i-inspector" {...form.register("inspectorId")}>
                {(members.data ?? []).map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-title">Purpose / title</Label>
            <Input id="i-title" {...form.register("title")} />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-notes">General notes</Label>
            <Textarea id="i-notes" rows={3} {...form.register("notes")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Findings</CardTitle>
              <CardDescription>
                What was observed on site, graded by severity.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                findings.append({
                  description: "",
                  severity: "MEDIUM",
                  location: "",
                })
              }
            >
              <Plus aria-hidden="true" />
              Add finding
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {findings.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No findings recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {findings.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-[1fr_130px_160px_36px] items-start gap-2"
                >
                  <div>
                    <Input
                      aria-label={`Finding ${index + 1} description`}
                      placeholder="Descripción del hallazgo"
                      {...form.register(`findings.${index}.description`)}
                    />
                    {errors.findings?.[index]?.description && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.findings[index]?.description?.message}
                      </p>
                    )}
                  </div>
                  <Select
                    aria-label={`Finding ${index + 1} severity`}
                    {...form.register(`findings.${index}.severity`)}
                  >
                    {SEVERITIES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label={`Finding ${index + 1} location`}
                    placeholder="Ubicación (opcional)"
                    {...form.register(`findings.${index}.location`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove finding ${index + 1}`}
                    onClick={() => findings.remove(index)}
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
          {update.isPending ? "…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

// The frozen rendering — on screen for COMPLETED/CANCELLED and the print
// target (browser print → PDF, the ratified MVP report).
function InspectionReport({ inspection }: { inspection: InspectionDetail }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight">
            Andes{" "}
            <span className="font-light text-muted-foreground">Platform</span>
          </p>
          <h2 className="mt-4 text-xl font-semibold">{inspection.title}</h2>
          <p className="font-mono text-sm text-muted-foreground">
            {inspection.code}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Scheduled: {formatDate(inspection.scheduledFor)}</p>
          {inspection.performedAt && (
            <p>Performed: {formatDate(inspection.performedAt)}</p>
          )}
        </div>
      </div>

      <Separator className="my-6" />

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Project
          </p>
          <p className="mt-1 font-medium">
            <span className="font-mono text-xs">{inspection.project.code}</span>{" "}
            — {inspection.project.name}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Inspector
          </p>
          <p className="mt-1 font-medium">{inspection.inspector.name}</p>
        </div>
      </div>

      {inspection.notes && (
        <>
          <p className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            General notes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{inspection.notes}</p>
        </>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Findings ({inspection.findings.length})
        </p>
        {inspection.findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No findings were recorded.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspection.findings.map((finding, index) => (
                <TableRow key={finding.id}>
                  <TableCell className="font-mono text-xs">
                    {index + 1}
                  </TableCell>
                  <TableCell>{finding.description}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={finding.severity} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {finding.location ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ReportPhotos inspection={inspection} />
    </div>
  );
}

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const inspection = trpc.inspections.get.useQuery({ id });
  const invalidate = () => {
    void utils.inspections.get.invalidate({ id });
    void utils.inspections.list.invalidate();
  };
  const complete = trpc.inspections.complete.useMutation({
    onSuccess: invalidate,
  });
  const cancel = trpc.inspections.cancel.useMutation({ onSuccess: invalidate });

  if (inspection.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading inspection…</p>;
  }
  if (!inspection.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Inspection not found.</p>
        <Button asChild variant="outline">
          <Link href="/projects/inspections">
            <ArrowLeft aria-hidden="true" />
            Back to inspections
          </Link>
        </Button>
      </div>
    );
  }

  const ins = inspection.data;
  const actionError = complete.error?.message ?? cancel.error?.message ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="print:hidden">
        <ProjectsNav />
      </div>
      <div className="flex items-center justify-between print:hidden">
        <div className="space-y-1">
          <Link
            href="/projects/inspections"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Inspections
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{ins.code}</h1>
            <InspectionStatusBadge status={ins.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {ins.title} ·{" "}
            <Link
              href={`/projects/${ins.project.id}`}
              className="font-mono text-xs underline-offset-2 hover:text-primary hover:underline"
            >
              {ins.project.code}
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {ins.status !== "SCHEDULED" && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden="true" />
              Print
            </Button>
          )}
          {ins.status === "SCHEDULED" && (
            <>
              <Button
                disabled={complete.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Complete inspection ${ins.code}? The report becomes read-only.`,
                    )
                  ) {
                    complete.mutate({ id });
                  }
                }}
              >
                <Check aria-hidden="true" />
                {complete.isPending ? "…" : "Complete"}
              </Button>
              <Button
                variant="outline"
                disabled={cancel.isPending}
                onClick={() => {
                  if (window.confirm(`Cancel inspection ${ins.code}?`)) {
                    cancel.mutate({ id });
                  }
                }}
              >
                <X aria-hidden="true" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {actionError && (
        <p className="text-sm text-destructive print:hidden">{actionError}</p>
      )}

      {ins.status === "SCHEDULED" ? (
        <>
          <ScheduledEditor key={ins.updatedAt.toString()} inspection={ins} />
          <PhotoManager inspection={ins} />
        </>
      ) : (
        <InspectionReport inspection={ins} />
      )}
    </div>
  );
}
