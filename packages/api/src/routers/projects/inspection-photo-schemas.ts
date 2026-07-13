// Zod input schemas for inspection photos (sprint-10-domain-model.md).
// Formats and cap are the ratified whitelist — enforced here at the
// boundary; the storage key extension derives from the content type,
// never from the file name.
import { z } from "zod";

export const PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const photoContentTypeSchema = z.enum(PHOTO_CONTENT_TYPES);

// Ratified cap (domain model recommendation 2): any phone camera fits.
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export const EXTENSION_BY_CONTENT_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const photoUploadRequestSchema = z.object({
  inspectionId: z.string().min(1),
  findingId: z.string().min(1).optional(),
  fileName: z.string().trim().min(1).max(200),
  fileSize: z.number().int().positive().max(MAX_PHOTO_BYTES),
  contentType: photoContentTypeSchema,
});

export const photoIdSchema = z.object({ id: z.string().min(1) });

export const photoUpdateSchema = z.object({
  id: z.string().min(1),
  caption: z.string().trim().max(500).nullable().optional(),
  // null detaches the photo from its finding (back to general).
  findingId: z.string().min(1).nullable().optional(),
});
