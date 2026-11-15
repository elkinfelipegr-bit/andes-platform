"use client";

// Inspections list — sprint-5.md scope item 3. Creation captures the
// schedule; findings are recorded on the detail while SCHEDULED.
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

import { formatDate, roleLabel } from "@/lib/format";
import { trpc } from "@/lib/trpc";

import { ProjectsNav } from "../_components/projects-nav";
import { InspectionStatusBadge } from "./_components/inspection-badges";

const STATUS_FILTERS = [
  ["ALL", "Todos los estados"],
  ["SCHEDULED", "Programada"],
  ["COMPLETED", "Completado"],
  ["CANCELLED", "Cancelada"],
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number][0];

const createFormSchema = z.object({
  projectId: z.string().min(1, "Elige un proyecto"),
  inspectorId: z.string().min(1, "Elige un inspector"),
  code: z.string().trim().min(1, "Obligatorio").max(32),
  title: z.string().trim().min(1, "Obligatorio").max(200),
  scheduledFor: z.string().min(1, "Obligatorio"),
});

type CreateFormValues = z.infer<typeof createFormSchema>;

function NewInspectionDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  const projects = trpc.projects.list.useQuery();
  const members = trpc.core.members.useQuery();
  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      projectId: "",
      inspectorId: "",
      code: "",
      title: "",
      scheduledFor: "",
    },
  });
  const create = trpc.inspections.create.useMutation({
    onSuccess: (created) => {
      void utils.inspections.list.invalidate();
      setOpen(false);
      router.push(`/projects/inspections/${created.id}`);
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
          Nueva inspección
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Programar inspección</DialogTitle>
          <DialogDescription>
            Los hallazgos se registran en la siguiente pantalla, mientras está
            programada.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="ins-project">Proyecto</Label>
            <Select id="ins-project" {...form.register("projectId")}>
              <option value="">— Elige un proyecto —</option>
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
          <div className="space-y-1.5">
            <Label htmlFor="ins-inspector">Inspector</Label>
            <Select id="ins-inspector" {...form.register("inspectorId")}>
              <option value="">— Elige un inspector —</option>
              {(members.data ?? []).map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name} ({roleLabel(m.role.label)})
                </option>
              ))}
            </Select>
            {errors.inspectorId && (
              <p className="text-xs text-destructive">
                {errors.inspectorId.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ins-code">Código</Label>
              <Input
                id="ins-code"
                placeholder="INS-2026-001"
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
              <Label htmlFor="ins-date">Programada para</Label>
              <Input
                id="ins-date"
                type="date"
                {...form.register("scheduledFor")}
              />
              {errors.scheduledFor && (
                <p className="text-xs text-destructive">
                  {errors.scheduledFor.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ins-title">Objeto / título</Label>
            <Input
              id="ins-title"
              placeholder="Interventoría estructural"
              {...form.register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {create.error && (
            <p className="text-sm text-destructive">{create.error.message}</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "…" : "Programar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function InspectionsPage() {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const inspections = trpc.inspections.list.useQuery(
    status === "ALL" ? undefined : { status },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ProjectsNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inspecciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visitas de obra y sus hallazgos, dentro de cada proyecto.
          </p>
        </div>
        <NewInspectionDialog />
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

      {inspections.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando inspecciones…</p>
      ) : inspections.data && inspections.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead>Inspector</TableHead>
              <TableHead>Programada</TableHead>
              <TableHead className="text-right">Hallazgos</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inspections.data.map((inspection) => (
              <TableRow key={inspection.id}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/projects/inspections/${inspection.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {inspection.code}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  {inspection.title}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <Link
                    href={`/projects/${inspection.project.id}`}
                    className="font-mono text-xs underline-offset-2 hover:text-primary hover:underline"
                  >
                    {inspection.project.code}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {inspection.inspector.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(inspection.scheduledFor)}
                </TableCell>
                <TableCell className="text-right">
                  {inspection._count.findings}
                </TableCell>
                <TableCell>
                  <InspectionStatusBadge status={inspection.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No hay inspecciones
          {status !== "ALL" ? " con este estado" : " todavía"}. Programa la
          primera.
        </div>
      )}
    </div>
  );
}
