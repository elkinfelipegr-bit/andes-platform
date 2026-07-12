"use client";

// Project detail/edit — sprint-2.md scope item 3. Archive is OWNER_ADMIN
// only (the API enforces it; the UI mirrors it by hiding the action).
import { Archive, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

  const isOwnerAdmin = me.data?.activeMembership?.roleKey === "OWNER_ADMIN";

  if (project.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading project…</p>;
  }
  if (!project.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Project not found.</p>
        <Button asChild variant="outline">
          <Link href="/projects">
            <ArrowLeft aria-hidden="true" />
            Back to projects
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
            Projects
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{p.code}</h1>
            <StatusBadge status={p.status} />
          </div>
          <p className="text-sm text-muted-foreground">{p.name}</p>
        </div>
        {isOwnerAdmin && !archived && (
          <Button
            variant="destructive"
            disabled={archive.isPending}
            onClick={() => {
              if (window.confirm(`Archive project ${p.code}?`)) {
                archive.mutate({ id });
              }
            }}
          >
            <Archive aria-hidden="true" />
            {archive.isPending ? "…" : "Archive"}
          </Button>
        )}
      </div>

      {archived ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Archived</CardTitle>
            <CardDescription>
              This project is archived and read-only. Engineering records
              attached in future sprints remain reachable from here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit project</CardTitle>
            {update.isSuccess && (
              <CardDescription className="text-success">Saved.</CardDescription>
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
              submitLabel="Save changes"
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
          <CardTitle className="text-base">Inspections</CardTitle>
          <CardDescription>
            Site visits for this project — managed in{" "}
            <Link
              href="/projects/inspections"
              className="text-primary underline-offset-2 hover:underline"
            >
              Inspections
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {p.inspections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No inspections for this project yet.
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
          <CardTitle className="text-base">Calculation records</CardTitle>
          <CardDescription>
            Memorias de cálculo for this project — managed in{" "}
            <Link
              href="/structures"
              className="text-primary underline-offset-2 hover:underline"
            >
              Structures
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {p.calcRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No calculation records for this project yet.
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
          <CardTitle className="text-base">Geotechnical records</CardTitle>
          <CardDescription>
            Estudios geotécnicos for this project — managed in{" "}
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
              No geotechnical records for this project yet.
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
    </div>
  );
}
