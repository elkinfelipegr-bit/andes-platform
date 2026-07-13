"use client";

// BIM model detail — metadata editor, immutable version history, and the
// direct-to-storage upload flow (RFC-002/ADR-008): request a presigned
// PUT, send the file browser→R2 with progress, confirm so the server
// records what storage actually holds. Bytes never touch the app.
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Download, Eye, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
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
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@andes/ui";

import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";

import { DISCIPLINE_OPTIONS, DisciplineBadge } from "../_components/bim-badges";

const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

const metadataSchema = z.object({
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

type MetadataValues = z.infer<typeof metadataSchema>;

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new Error(`Storage rejected the upload (HTTP ${xhr.status}).`),
          );
    xhr.onerror = () =>
      reject(new Error("Network error while uploading to storage."));
    xhr.send(file);
  });
}

function UploadVersion({ modelId }: { modelId: string }) {
  const utils = trpc.useUtils();
  const requestUpload = trpc.bimModels.requestUpload.useMutation();
  const confirmUpload = trpc.bimModels.confirmUpload.useMutation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".ifc")) {
      setError("Only .ifc files are accepted (RFC-002).");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("The file exceeds the 300 MB limit.");
      return;
    }
    if (file.size === 0) {
      setError("The file is empty.");
      return;
    }
    setProgress(0);
    try {
      const request = await requestUpload.mutateAsync({
        bimModelId: modelId,
        fileName: file.name,
        fileSize: file.size,
      });
      await putWithProgress(
        request.uploadUrl,
        file,
        request.contentType,
        setProgress,
      );
      await confirmUpload.mutateAsync({ id: request.versionId });
      void utils.bimModels.get.invalidate({ id: modelId });
      void utils.bimModels.list.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".ifc"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        disabled={progress !== null}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud aria-hidden="true" />
        {progress === null
          ? "Upload new version"
          : progress < 100
            ? `Uploading… ${progress}%`
            : "Confirming…"}
      </Button>
      {progress !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function DownloadButton({ versionId }: { versionId: string }) {
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    setBusy(true);
    try {
      const { url } = await utils.bimModels.getDownloadUrl.fetch({
        id: versionId,
      });
      window.open(url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => void handleDownload()}
    >
      <Download aria-hidden="true" />
      {busy ? "…" : "Download"}
    </Button>
  );
}

export default function BimModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const model = trpc.bimModels.get.useQuery({ id });
  const update = trpc.bimModels.update.useMutation({
    onSuccess: () => {
      void utils.bimModels.get.invalidate({ id });
      void utils.bimModels.list.invalidate();
    },
  });

  const form = useForm<MetadataValues>({
    resolver: zodResolver(metadataSchema),
    values: model.data
      ? {
          code: model.data.code,
          title: model.data.title,
          discipline: model.data.discipline,
        }
      : undefined,
  });

  if (model.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading model…</p>;
  }
  if (!model.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">BIM model not found.</p>
        <Button asChild variant="outline">
          <Link href="/bim">
            <ArrowLeft aria-hidden="true" />
            Back to BIM
          </Link>
        </Button>
      </div>
    );
  }

  const m = model.data;
  const errors = form.formState.errors;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/bim"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          BIM models
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold">{m.code}</h1>
          <DisciplineBadge discipline={m.discipline} />
        </div>
        <p className="text-sm text-muted-foreground">
          {m.title} ·{" "}
          <Link
            href={`/projects/${m.project.id}`}
            className="font-mono text-xs underline-offset-2 hover:text-primary hover:underline"
          >
            {m.project.code}
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model details</CardTitle>
          {update.isSuccess && (
            <CardDescription className="text-success">Saved.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((values) =>
              update.mutate({ id, ...values }),
            )}
            className="space-y-4"
          >
            <div className="grid grid-cols-[140px_1fr_160px] gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-code">Code</Label>
                <Input
                  id="edit-code"
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
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" {...form.register("title")} />
                {errors.title && (
                  <p className="text-xs text-destructive">
                    {errors.title.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-discipline">Discipline</Label>
                <Select id="edit-discipline" {...form.register("discipline")}>
                  {DISCIPLINE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {update.error && (
              <p className="text-sm text-destructive">{update.error.message}</p>
            )}
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                disabled={update.isPending}
              >
                {update.isPending ? "…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versions</CardTitle>
          <CardDescription>
            Every upload is an immutable version — nothing is overwritten or
            deleted. The model a decision was reviewed against stays
            retrievable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UploadVersion modelId={id} />
          {m.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No versions uploaded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead>Uploaded by</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-mono text-xs">
                      v{version.versionNumber}
                    </TableCell>
                    <TableCell className="max-w-56 truncate font-mono text-xs">
                      {version.fileName}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {formatBytes(version.fileSize)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {version.uploadedBy.name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(version.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        <Button asChild size="sm">
                          <Link href={`/bim/${id}/viewer/${version.id}`}>
                            <Eye aria-hidden="true" />
                            View
                          </Link>
                        </Button>
                        <DownloadButton versionId={version.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
