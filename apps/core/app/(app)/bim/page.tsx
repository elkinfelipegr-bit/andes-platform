"use client";

// BIM models list — sprint-8.md scope item 4, following the module list
// pattern. A model is created here; versions are uploaded on the detail.
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

import {
  DISCIPLINE_OPTIONS,
  DisciplineBadge,
  type BimDiscipline,
} from "./_components/bim-badges";

type DisciplineFilter = "ALL" | BimDiscipline;

const createFormSchema = z.object({
  projectId: z.string().min(1, "Elige un proyecto"),
  code: z.string().trim().min(1, "Obligatorio").max(32),
  title: z.string().trim().min(1, "Obligatorio").max(200),
  discipline: z.enum([
    "ARCHITECTURE",
    "STRUCTURAL",
    "MEP",
    "SITE",
    "OTHER",
  ] as const),
});

type CreateFormValues = z.infer<typeof createFormSchema>;

function NewBimModelDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  const projects = trpc.projects.list.useQuery();
  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      projectId: "",
      code: "",
      title: "",
      discipline: "STRUCTURAL",
    },
  });
  const create = trpc.bimModels.create.useMutation({
    onSuccess: (created) => {
      void utils.bimModels.list.invalidate();
      setOpen(false);
      router.push(`/bim/${created.id}`);
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
          Nuevo modelo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo modelo BIM</DialogTitle>
          <DialogDescription>
            Las versiones IFC se suben en la siguiente pantalla. Solo se aceptan
            archivos .ifc.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="bim-project">Proyecto</Label>
            <Select id="bim-project" {...form.register("projectId")}>
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
          <div className="grid grid-cols-[140px_1fr] gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bim-code">Código</Label>
              <Input
                id="bim-code"
                placeholder="BIM-2026-001"
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
              <Label htmlFor="bim-title">Título</Label>
              <Input
                id="bim-title"
                placeholder="Modelo estructural — Torre A"
                {...form.register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bim-discipline">Disciplina</Label>
            <Select id="bim-discipline" {...form.register("discipline")}>
              {DISCIPLINE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          {create.error && (
            <p className="text-sm text-destructive">{create.error.message}</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "…" : "Crear modelo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BimPage() {
  const [discipline, setDiscipline] = useState<DisciplineFilter>("ALL");
  const models = trpc.bimModels.list.useQuery(
    discipline === "ALL" ? undefined : { discipline },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Modelos BIM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Modelos del proyecto como versiones IFC inmutables: se revisan en el
            navegador, sin visor de escritorio.
          </p>
        </div>
        <NewBimModelDialog />
      </div>

      <Select
        aria-label="Filtrar por disciplina"
        className="w-44"
        value={discipline}
        onChange={(e) => setDiscipline(e.target.value as DisciplineFilter)}
      >
        <option value="ALL">Todas las disciplinas</option>
        {DISCIPLINE_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      {models.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando modelos…</p>
      ) : models.data && models.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Disciplina</TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead className="text-right">Versiones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.data.map((model) => (
              <TableRow key={model.id}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/bim/${model.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {model.code}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{model.title}</TableCell>
                <TableCell>
                  <DisciplineBadge discipline={model.discipline} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <Link
                    href={`/projects/${model.project.id}`}
                    className="font-mono text-xs underline-offset-2 hover:text-primary hover:underline"
                  >
                    {model.project.code}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  {model._count.versions}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No hay modelos BIM
          {discipline !== "ALL" ? " en esta disciplina" : " todavía"}. Crea el
          primero.
        </div>
      )}
    </div>
  );
}
