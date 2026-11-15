"use client";

// Viewer page for one immutable version. The 3D stack (three + web-ifc
// WASM) loads only here, dynamically — RFC-002's bundle-isolation rule.
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@andes/ui";

import { trpc } from "@/lib/trpc";

const IfcViewer = dynamic(() => import("../../../_components/ifc-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] items-center justify-center rounded-xl border border-border">
      <p className="text-sm text-muted-foreground">Cargando visor…</p>
    </div>
  ),
});

export default function BimViewerPage() {
  const { id, versionId } = useParams<{ id: string; versionId: string }>();
  const model = trpc.bimModels.get.useQuery({ id });
  const download = trpc.bimModels.getDownloadUrl.useQuery({ id: versionId });

  const version = model.data?.versions.find((v) => v.id === versionId);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href={`/bim/${id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {model.data?.code ?? "Modelo"}
          </Link>
          <h1 className="text-xl font-semibold">
            {model.data?.title ?? "Visor"}
            {version && (
              <span className="ml-2 font-mono text-sm text-muted-foreground">
                v{version.versionNumber} · {version.fileName}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Haz clic en un elemento para leer sus atributos IFC. Orbitar:
            arrastrar · Desplazar: arrastrar con clic derecho · Zoom: rueda.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/bim/${id}`}>Volver a versiones</Link>
        </Button>
      </div>

      {download.error ? (
        <div className="flex h-[70vh] items-center justify-center rounded-xl border border-border">
          <p className="text-sm text-destructive">
            Esta versión no está disponible: {download.error.message}
          </p>
        </div>
      ) : download.data ? (
        <IfcViewer url={download.data.url} />
      ) : (
        <div className="flex h-[70vh] items-center justify-center rounded-xl border border-border">
          <p className="text-sm text-muted-foreground">
            Solicitando acceso al modelo…
          </p>
        </div>
      )}
    </div>
  );
}
