// Upload allowlist. No SVG: a stored SVG can run script when a browser opens it.
export const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "application/pdf": "pdf",
} as const;

export type AllowedType = keyof typeof ALLOWED_TYPES;

export const MAX_BYTES = 10 * 1024 * 1024;

/** Bytes that `sniffType` needs from the start of a file. */
export const SNIFF_BYTES = 16;

export function isAllowedType(type: string): type is AllowedType {
  return Object.hasOwn(ALLOWED_TYPES, type);
}

/** Returns an error message, or null when the declared type and size are allowed. */
export function validateUpload({ type, size }: { type: string; size: number }): string | null {
  if (!isAllowedType(type)) return "Only JPEG, PNG, WebP, GIF, AVIF and PDF files are allowed.";
  if (!Number.isInteger(size) || size <= 0) return "The file is empty.";
  if (size > MAX_BYTES) return "The file is larger than 10 MB.";
  return null;
}

const ascii = (bytes: Uint8Array, start: number, text: string) =>
  [...text].every((c, i) => bytes[start + i] === c.charCodeAt(0));

/** Detects the real type from the first bytes (magic numbers). Returns null for anything not allowed. */
export function sniffType(bytes: Uint8Array): AllowedType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(bytes, 0, "\x89PNG\r\n\x1a\n")) return "image/png";
  if (ascii(bytes, 0, "GIF87a") || ascii(bytes, 0, "GIF89a")) return "image/gif";
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "image/webp";
  // Known limit: AVIF with major brand "mif1" is refused.
  if (ascii(bytes, 4, "ftyp") && (ascii(bytes, 8, "avif") || ascii(bytes, 8, "avis"))) return "image/avif";
  if (ascii(bytes, 0, "%PDF-")) return "application/pdf";
  return null;
}

/** Longest alt text the library accepts. */
export const ALT_MAX = 1000;

/** A finished upload as the library and the picker see it. `alt`: null = not set, '' = decorative. */
export type MediaItem = { id: string; filename: string; contentType: string; size: number; alt: string | null; url: string };

export const isImage = (contentType: string) => contentType.startsWith("image/");

/** The public URL of a finished upload. The one place that builds it (the serve route parses it back). */
export const mediaUrl = (row: { id: string; contentType: string }) =>
  `/media/${row.id}.${ALLOWED_TYPES[row.contentType as AllowedType]}`;
