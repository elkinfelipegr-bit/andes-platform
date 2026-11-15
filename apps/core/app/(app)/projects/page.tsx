"use client";

// Projects list — sprint-2.md scope item 3, on the Sprint 1 shell.
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@andes/ui";

import { trpc } from "@/lib/trpc";

import {
  ProjectForm,
  type ProjectFormPayload,
} from "./_components/project-form";
import { ProjectsNav } from "./_components/projects-nav";
import { StatusBadge } from "./_components/status-badge";

const STATUS_FILTERS = [
  ["ALL", "Todos los estados"],
  ["DRAFT", "Borrador"],
  ["ACTIVE", "Activo"],
  ["ON_HOLD", "En pausa"],
  ["COMPLETED", "Completado"],
  ["ARCHIVED", "Archivado"],
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number][0];

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  // Date-only values are stored at UTC midnight; format in UTC so the day
  // doesn't shift in western timezones.
  return new Date(value).toLocaleDateString("es-CO", { timeZone: "UTC" });
}

function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const createClient = trpc.clients.create.useMutation();
  const createProject = trpc.projects.create.useMutation({
    onSuccess: () => {
      void utils.projects.list.invalidate();
      void utils.clients.list.invalidate();
      setOpen(false);
    },
  });

  async function handleSubmit(payload: ProjectFormPayload) {
    let clientId = payload.clientId;
    if (payload.newClientName) {
      const created = await createClient.mutateAsync({
        name: payload.newClientName,
      });
      clientId = created.id;
    }
    createProject.mutate({
      code: payload.code,
      name: payload.name,
      description: payload.description,
      clientId,
      status: payload.status,
      startDate: payload.startDate,
      endDate: payload.endDate,
    });
  }

  const busy = createClient.isPending || createProject.isPending;
  const errorMessage =
    createProject.error?.message ?? createClient.error?.message ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          Nuevo proyecto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>
            Registra un proyecto de tu firma. El código debe ser único.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          submitLabel="Crear proyecto"
          busy={busy}
          errorMessage={errorMessage}
          onSubmit={(payload) => void handleSubmit(payload)}
        />
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectsPage() {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const projects = trpc.projects.list.useQuery(
    status === "ALL" ? undefined : { status },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ProjectsNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proyectos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos los encargos de ingeniería de tu firma.
          </p>
        </div>
        <NewProjectDialog />
      </div>

      <div className="flex items-center gap-2">
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
      </div>

      {projects.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando proyectos…</p>
      ) : projects.data && projects.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Fin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.data.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {project.code}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{project.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {project.client ? (
                    <Link
                      href={`/crm/${project.client.id}`}
                      className="underline-offset-2 hover:text-primary hover:underline"
                    >
                      {project.client.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={project.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(project.startDate)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(project.endDate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No hay proyectos{status !== "ALL" ? " con este estado" : " todavía"}.
          Crea el primero.
        </div>
      )}
    </div>
  );
}
