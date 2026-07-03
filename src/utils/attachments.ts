/**
 * Normalize a quotation attachment entry into a consistent { url, name } shape.
 * Supports two formats:
 *  - plain string URL
 *  - object with { url | file_url | path, name | file_name | fileName | filename }
 */
export interface NormalizedAttachment {
  url: string;
  name: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
}

export function normalizeAttachment(
  att: unknown,
  index: number
): NormalizedAttachment | null {
  if (!att) return null;

  if (typeof att === "string") {
    const url = att.trim();
    if (!url) return null;
    return { url, name: `Document ${index + 1}` };
  }

  if (typeof att === "object") {
    const a = att as Record<string, unknown>;
    const url =
      stringValue(a.downloadUrl) ||
      stringValue(a.download_url) ||
      stringValue(a.url) ||
      stringValue(a.file_url) ||
      stringValue(a.fileUrl) ||
      stringValue(a.path) ||
      "";
    if (!url) return null;
    // Always prefer the original uploaded filename. Never derive from the
    // hashed storage URL — that exposes opaque storage paths to the user.
    // Only fall back to "Document N" if name is genuinely null/empty.
    const rawName =
      a.name ??
      a.original_name ??
      a.originalName ??
      a.file_name ??
      a.fileName ??
      a.filename ??
      null;
    const name =
      typeof rawName === "string" && rawName.trim()
        ? rawName
        : `Document ${index + 1}`;
    const rawSize = a.sizeBytes ?? a.size_bytes ?? a.size ?? null;
    const sizeBytes =
      typeof rawSize === "number"
        ? rawSize
        : typeof rawSize === "string" && rawSize.trim() !== ""
          ? Number(rawSize)
          : null;
    return {
      url,
      name,
      sizeBytes: Number.isFinite(sizeBytes as number) ? (sizeBytes as number) : null,
      mimeType: stringValue(a.mimeType) || stringValue(a.mime_type) || null,
    };
  }

  return null;
}

export function normalizeAttachments(
  attachments: unknown
): NormalizedAttachment[] {
  if (!attachments) return [];

  // Defensively parse if the backend returned a JSON string instead of an array.
  let raw: unknown = attachments;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [raw];
    }
  }
  if (!Array.isArray(raw)) raw = [raw];

  const flat = (raw as unknown[]).flat(Infinity).filter(Boolean);
  const normalized = flat
    .map((a, i) => normalizeAttachment(a, i))
    .filter((a): a is NormalizedAttachment => a !== null);

  // Dedupe by URL so phantom duplicates from merged sources/cached state
  // never inflate the count.
  const seen = new Set<string>();
  const unique: NormalizedAttachment[] = [];
  for (const att of normalized) {
    if (seen.has(att.url)) continue;
    seen.add(att.url);
    unique.push(att);
  }
  return unique;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}