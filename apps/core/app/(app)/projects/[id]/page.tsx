"use client";

// Project detail/edit — sprint-2.md scope item 3. Archive is OWNER_ADMIN
// only (the API enforces it; the UI mirrors it by hiding the action).
import { Archive, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@andes/ui";

import { trpc } from "@/lib/trpc";

import {
  ProjectForm,
  type ProjectFormPayload,
} from "../_components/project-form";
import { StatusBadge } from "../_components/status-badge";
import { InspectionStatusBadge } from "../inspections/_components/inspection-badges";
import { CalcRecordStatusBadge } from "../../structures/_components/structures-badges";
import { GeoRecordStatusBadge } from "../../geo/_components/geo-badges";
import { DisciplineBadge } from "../../bim/_components/bim-badges";
import { ConfirmDelete } from "../../_components/confirm-delete";

function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const project = trpc.projects.get.useQuery({ id });
  const me = trpc.core.me.useQuery();
  const createClient = trpc.clients.create.useMutation();
  const update = trpc.projects.update.useMutation({
    onSuccess: () => {
      void utils.projects.get.invalidate({ id });
      void utils.projects.list.invalidate();
      void utils.clients.list.invalidate();
    },
  });
  const archive = trpc.projects.archive.useMutation({
    onSuccess: () => {
      void utils.projects.get.invalidate({ id });
      void utils.projects.list.invalidate();
    },
  });

  const router = useRouter();
  const remove = trpc.projects.delete.useMutation({
    onSuccess: () => {
      void utils.projects.list.invalidate();
      router.push("/projects");
    },
  });
  const isOwnerAdmin = me.data?.activeMembership?.roleKey === "OWNER_ADMIN";

  if (project.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando proyecto…</p>;
  }
  if (!project.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Proyecto no encontrado.</p>
        <Button asChild variant="outline">
          <Link href="/projects">
            <ArrowLeft aria-hidden="true" />
            Volver a proyectos
          </Link>
        </Button>
      </div>
    );
  }

  const p = project.data;
  const archived = p.status === "ARCHIVED";

  async function handleSubmit(payload: ProjectFormPayload) {
    let clientId = payload.clientId ?? null;
    if (payload.newClientName) {
      const created = await createClient.mutateAsync({
        name: payload.newClientName,
      });
      clientId = created.id;
    }
    update.mutate({
      id,
      code: payload.code,
      name: payload.name,
      description: payload.description ?? null,
      clientId,
      status: payload.status,
      startDate: payload.startDate ?? null,
      endDate: payload.endDate ?? null,
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Proyectos
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{p.code}</h1>
            <StatusBadge status={p.status} />
          </div>
          <p className="text-sm text-muted-foreground">{p.name}</p>
        </div>
        {isOwnerAdmin && (
          <div className="flex flex-wrap gap-2">
            {!archived && (
              <Button
                variant="outline"
                disabled={archive.isPending}
                onClick={() => {
                  if (window.confirm(`¿Archivar el proyecto ${p.code}?`)) {
                    archive.mutate({ id });
                  }
                }}
              >
                <Archive aria-hidden="true" />
                {archive.isPending ? "…" : "Archivar"}
              </Button>
            )}
            <ConfirmDelete
              what="el proyecto"
              name={p.code}
              busy={remove.isPending}
              error={remove.error?.message ?? null}
              onConfirm={() => remove.mutate({ id })}
              consequences={
                <>
                  <p>
                    Se elimina el proyecto <strong>{p.name}</strong> con todo lo
                    registrado en él: inspecciones y sus hallazgos, memorias de
                    cálculo, registros geotécnicos y modelos BIM.
                  </p>
                  <p className="mt-2">
                    Si vino de una propuesta, la propuesta se conserva. Para
                    retirar un proyecto real sin perder su historia, usa
                    Archivar.
                  </p>
                </>
              }
            />
          </div>
        )}
      </div>

      {archived ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Archivado</CardTitle>
            <CardDescription>
              Este proyecto está archivado y es de solo lectura. Sus registros
              de ingeniería siguen disponibles desde aquí.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Editar proyecto</CardTitle>
            {update.isSuccess && (
              <CardDescription className="text-success">
                Guardado.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <ProjectForm
              defaultValues={{
                code: p.code,
                name: p.name,
                description: p.description ?? "",
                clientId: p.client?.id ?? "",
                status: p.status === "ARCHIVED" ? "DRAFT" : p.status,
                startDate: toDateInput(p.startDate),
                endDate: toDateInput(p.endDate),
              }}
              submitLabel="Guardar cambios"
              busy={update.isPending || createClient.isPending}
              errorMessage={
                update.error?.message ?? createClient.error?.message ?? null
              }
              onSubmit={(payload) => void handleSubmit(payload)}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inspecciones</CardTitle>
          <CardDescription>
            Visitas de obra de este proyecto, gestionadas en{" "}
            <Link
              href="/projects/inspections"
              className="text-primary underline-offset-2 hover:underline"
            >
              Inspecciones
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {p.inspections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay inspecciones para este proyecto.
            </p>
          ) : (
            <ul className="space-y-2">
              {p.inspections.map((inspection) => (
                <li
                  key={inspection.id}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Link
                      href={`/projects/inspections/${inspection.id}`}
                      className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {inspection.code}
                    </Link>
                    <span className="truncate text-sm">{inspection.title}</span>
                  </div>
                  <InspectionStatusBadge status={inspection.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Memorias de cálculo</CardTitle>
          <CardDescription>
            Memorias de cálculo de este proyecto, gestionadas en{" "}
            <Link
              href="/structures"
              className="text-primary underline-offset-2 hover:underline"
            >
              Estructuras
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {p.calcRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay memorias de cálculo para este proyecto.
            </p>
          ) : (
            <ul className="space-y-2">
              {p.calcRecords.map((calcRecord) => (
                <li
                  key={calcRecord.id}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Link
                      href={`/structures/${calcRecord.id}`}
                      className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {calcRecord.code}
                    </Link>
                    <span className="truncate text-sm">{calcRecord.title}</span>
                  </div>
                  <CalcRecordStatusBadge status={calcRecord.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros geotécnicos</CardTitle>
          <CardDescription>
            Estudios geotécnicos de este proyecto, gestionados en{" "}
            <Link
              href="/geo"
              className="text-primary underline-offset-2 hover:underline"
            >
              Geo
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {p.geoRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay registros geotécnicos para este proyecto.
            </p>
          ) : (
            <ul className="space-y-2">
              {p.geoRecords.map((geoRecord) => (
                <li
                  key={geoRecord.id}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Link
                      href={`/geo/${geoRecord.id}`}
                      className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {geoRecord.code}
                    </Link>
                    <span className="truncate text-sm">{geoRecord.title}</span>
                  </div>
                  <GeoRecordStatusBadge status={geoRecord.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modelos BIM</CardTitle>
          <CardDescription>
            Modelos IFC de este proyecto, gestionados en{" "}
            <Link
              href="/bim"
              className="text-primary underline-offset-2 hover:underline"
            >
              BIM
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {p.bimModels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay modelos BIM para este proyecto.
            </p>
          ) : (
            <ul className="space-y-2">
              {p.bimModels.map((bimModel) => (
                <li
                  key={bimModel.id}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Link
                      href={`/bim/${bimModel.id}`}
                      className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {bimModel.code}
                    </Link>
                    <span className="truncate text-sm">{bimModel.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {bimModel._count.versions} versión
                      {bimModel._count.versions === 1 ? "" : "s"}
                    </span>
                  </div>
                  <DisciplineBadge discipline={bimModel.discipline} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
