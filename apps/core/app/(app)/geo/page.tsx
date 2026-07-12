"use client";

// Geotechnical records list — sprint-7.md scope item 4, mirroring
// /structures. Creation captures the record; checks are added on the
// detail while DRAFT.
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

import { trpc } from "@/lib/trpc";

import { GeoRecordStatusBadge } from "./_components/geo-badges";

const STATUS_FILTERS = [
  ["ALL", "All statuses"],
  ["DRAFT", "Draft"],
  ["ISSUED", "Issued"],
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number][0];

const createFormSchema = z.object({
  projectId: z.string().min(1, "Pick a project"),
  code: z.string().trim().min(1, "Required").max(32),
  title: z.string().trim().min(1, "Required").max(200),
});

type CreateFormValues = z.infer<typeof createFormSchema>;

function NewGeoRecordDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  const projects = trpc.projects.list.useQuery();
  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { projectId: "", code: "", title: "" },
  });
  const create = trpc.geoRecords.create.useMutation({
    onSuccess: (created) => {
      void utils.geoRecords.list.invalidate();
      setOpen(false);
      router.push(`/geo/${created.id}`);
    },
  });

  const activeProjects = (projects.data ?? []).filter(
    (project) => project.status !== "ARCHIVED",
  );
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          New record
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New geotechnical record</DialogTitle>
          <DialogDescription>
            Bearing capacity checks are added on the next screen, while it stays
            a draft.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="geo-project">Project</Label>
            <Select id="geo-project" {...form.register("projectId")}>
              <option value="">— Pick a project —</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} — {project.name}
                </option>
              ))}
            </Select>
            {errors.projectId && (
              <p className="text-xs text-destructive">
                {errors.projectId.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="geo-code">Code</Label>
              <Input
                id="geo-code"
                placeholder="EG-2026-001"
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
              <Input
                id="geo-title"
                placeholder="Estudio geotécnico — cimentaciones"
                {...form.register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>
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

export default function GeoPage() {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const records = trpc.geoRecords.list.useQuery(
    status === "ALL" ? undefined : { status },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Geotechnical records</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bearing capacity checks behind each estudio — the platform computes;
            the engineer reviews, decides, and signs.
          </p>
        </div>
        <NewGeoRecordDialog />
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

      {records.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading records…</p>
      ) : records.data && records.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Checks</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.data.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/geo/${record.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {record.code}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{record.title}</TableCell>
                <TableCell className="text-muted-foreground">
                  <Link
                    href={`/projects/${record.project.id}`}
                    className="font-mono text-xs underline-offset-2 hover:text-primary hover:underline"
                  >
                    {record.project.code}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  {record._count.checks}
                </TableCell>
                <TableCell>
                  <GeoRecordStatusBadge status={record.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No geotechnical records
          {status !== "ALL" ? " with this status" : " yet"}. Create the first
          one.
        </div>
      )}
    </div>
  );
}
