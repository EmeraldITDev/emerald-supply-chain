/**
 * Normalize a quotation attachment entry into a consistent { url, name } shape.
 * Supports two formats:
 *  - plain string URL
 *  - object with { url | file_url | path, name | file_name | fileName | filename }
 */
export interface NormalizedAttachment {
  url: string;
  name: string;
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
    const a = att as Record<string, any>;
    const url = a.url || a.file_url || a.fileUrl || a.path || "";
    if (!url) return null;
    // Always prefer the original uploaded filename. Never derive from the
    // hashed storage URL — that exposes opaque storage paths to the user.
    const name =
      a.name ||
      a.original_name ||
      a.originalName ||
      a.file_name ||
      a.fileName ||
      a.filename ||
      `Document ${index + 1}`;
    return { url, name };
  }

  return null;
}

export function normalizeAttachments(
  attachments: unknown
): NormalizedAttachment[] {
  if (!attachments || !Array.isArray(attachments)) return [];
  const flat = (attachments as any[]).flat(Infinity).filter(Boolean);
  return flat
    .map((a, i) => normalizeAttachment(a, i))
    .filter((a): a is NormalizedAttachment => a !== null);
}