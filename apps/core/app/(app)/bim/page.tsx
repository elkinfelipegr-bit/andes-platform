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
  projectId: z.string().min(1, "Pick a project"),
  code: z.string().trim().min(1, "Required").max(32),
  title: z.string().trim().min(1, "Required").max(200),
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
          New model
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New BIM model</DialogTitle>
          <DialogDescription>
            IFC versions are uploaded on the next screen. Only .ifc files are
            accepted.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="bim-project">Project</Label>
            <Select id="bim-project" {...form.register("projectId")}>
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
              <Label htmlFor="bim-code">Code</Label>
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
              <Label htmlFor="bim-title">Title</Label>
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
            <Label htmlFor="bim-discipline">Discipline</Label>
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
              {create.isPending ? "…" : "Create model"}
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
          <h1 className="text-2xl font-semibold">BIM models</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Project models as immutable IFC versions — reviewable in the
            browser, no desktop viewer required.
          </p>
        </div>
        <NewBimModelDialog />
      </div>

      <Select
        aria-label="Filter by discipline"
        className="w-44"
        value={discipline}
        onChange={(e) => setDiscipline(e.target.value as DisciplineFilter)}
      >
        <option value="ALL">All disciplines</option>
        {DISCIPLINE_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      {models.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading models…</p>
      ) : models.data && models.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Discipline</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Versions</TableHead>
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
          No BIM models
          {discipline !== "ALL" ? " in this discipline" : " yet"}. Create the
          first one.
        </div>
      )}
    </div>
  );
}
