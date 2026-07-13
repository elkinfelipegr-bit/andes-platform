"use client";

// Inspection photos (sprint-10.md scope item 4): manager while
// SCHEDULED (upload, caption, finding link, delete) and the frozen
// gallery the report and print view render. Every image loads through
// a fresh short-lived presigned GET — no public URLs ever exist.
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from "@andes/ui";

import { trpc, type RouterOutputs } from "@/lib/trpc";
import { putWithProgress } from "@/lib/upload";

type InspectionDetail = RouterOutputs["inspections"]["get"];
type Photo = InspectionDetail["photos"][number];

const PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const GENERAL = "__general__";

export function PhotoImg({
  photoId,
  alt,
  className,
}: {
  photoId: string;
  alt: string;
  className?: string;
}) {
  // Presigned GETs expire by design — keep them fresher than the
  // 15-minute signature window.
  const url = trpc.inspections.getPhotoUrl.useQuery(
    { id: photoId },
    { staleTime: 5 * 60 * 1000 },
  );
  if (!url.data) {
    return (
      <div
        className={`animate-pulse rounded-lg bg-muted ${className ?? ""}`}
        aria-hidden="true"
      />
    );
  }
  // Plain <img>: expiring presigned URLs must not pass through the
  // image optimizer cache.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url.data.url} alt={alt} className={className} />;
}

export function PhotoManager({ inspection }: { inspection: InspectionDetail }) {
  const utils = trpc.useUtils();
  const requestUpload = trpc.inspections.requestPhotoUpload.useMutation();
  const confirmUpload = trpc.inspections.confirmPhotoUpload.useMutation();
  const updatePhoto = trpc.inspections.updatePhoto.useMutation({
    onSuccess: () =>
      void utils.inspections.get.invalidate({ id: inspection.id }),
  });
  const removePhoto = trpc.inspections.removePhoto.useMutation({
    onSuccess: () =>
      void utils.inspections.get.invalidate({ id: inspection.id }),
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const [attachTo, setAttachTo] = useState<string>(GENERAL);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!PHOTO_CONTENT_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG, or WebP photos are accepted.");
      return;
    }
    if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
      setError("Photos must be between 1 byte and 15 MB.");
      return;
    }
    setProgress(0);
    try {
      const request = await requestUpload.mutateAsync({
        inspectionId: inspection.id,
        findingId: attachTo === GENERAL ? undefined : attachTo,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
      });
      await putWithProgress(
        request.uploadUrl,
        file,
        request.contentType,
        setProgress,
      );
      await confirmUpload.mutateAsync({ id: request.photoId });
      void utils.inspections.get.invalidate({ id: inspection.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Photos</CardTitle>
        <CardDescription>
          Photographic evidence — attached to a finding or to the visit in
          general. Freezes with the completed report.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <label
              htmlFor="photo-attach"
              className="text-xs font-medium text-muted-foreground"
            >
              Attach to
            </label>
            <Select
              id="photo-attach"
              className="w-56"
              value={attachTo}
              onChange={(e) => setAttachTo(e.target.value)}
            >
              <option value={GENERAL}>General (whole visit)</option>
              {inspection.findings.map((finding, index) => (
                <option key={finding.id} value={finding.id}>
                  Finding {index + 1} — {finding.description.slice(0, 40)}
                </option>
              ))}
            </Select>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={progress !== null}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus aria-hidden="true" />
            {progress === null
              ? "Add photo"
              : progress < 100
                ? `Uploading… ${progress}%`
                : "Confirming…"}
          </Button>
        </div>
        {progress !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {inspection.photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {inspection.photos.map((photo: Photo) => (
              <div
                key={photo.id}
                className="space-y-2 rounded-lg border border-border p-2"
              >
                <PhotoImg
                  photoId={photo.id}
                  alt={photo.caption ?? photo.fileName}
                  className="aspect-video w-full rounded object-cover"
                />
                <Input
                  aria-label="Photo caption"
                  placeholder="Caption…"
                  defaultValue={photo.caption ?? ""}
                  onBlur={(e) => {
                    const caption = e.target.value.trim();
                    if (caption !== (photo.caption ?? "")) {
                      updatePhoto.mutate({
                        id: photo.id,
                        caption: caption || null,
                      });
                    }
                  }}
                />
                <div className="flex items-center gap-1">
                  <Select
                    aria-label="Photo finding link"
                    value={photo.findingId ?? GENERAL}
                    onChange={(e) =>
                      updatePhoto.mutate({
                        id: photo.id,
                        findingId:
                          e.target.value === GENERAL ? null : e.target.value,
                      })
                    }
                  >
                    <option value={GENERAL}>General</option>
                    {inspection.findings.map((finding, index) => (
                      <option key={finding.id} value={finding.id}>
                        Finding {index + 1}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Delete photo"
                    onClick={() => {
                      if (window.confirm("Delete this photo?")) {
                        removePhoto.mutate({ id: photo.id });
                      }
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {(updatePhoto.error ?? removePhoto.error) && (
          <p className="text-sm text-destructive">
            {(updatePhoto.error ?? removePhoto.error)!.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Frozen gallery for the report + print: each finding's photos under a
// labelled figure, then the general ones.
export function ReportPhotos({ inspection }: { inspection: InspectionDetail }) {
  if (inspection.photos.length === 0) return null;
  const groups: Array<{ label: string; photos: Photo[] }> = [];
  inspection.findings.forEach((finding, index) => {
    const photos = inspection.photos.filter(
      (p: Photo) => p.findingId === finding.id,
    );
    if (photos.length > 0) {
      groups.push({ label: `Finding ${index + 1}`, photos });
    }
  });
  const general = inspection.photos.filter((p: Photo) => !p.findingId);
  if (general.length > 0) groups.push({ label: "General", photos: general });

  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Photographic evidence ({inspection.photos.length})
      </p>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-sm font-medium">{group.label}</p>
            <div className="grid grid-cols-2 gap-4 print:grid-cols-2">
              {group.photos.map((photo) => (
                <figure key={photo.id} className="break-inside-avoid">
                  <PhotoImg
                    photoId={photo.id}
                    alt={photo.caption ?? photo.fileName}
                    className="w-full rounded border border-border object-contain"
                  />
                  {photo.caption && (
                    <figcaption className="mt-1 text-xs text-muted-foreground">
                      {photo.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
