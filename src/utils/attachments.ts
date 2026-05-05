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
    const fromUrl = url.split("?")[0].split("/").pop() || "";
    return { url, name: fromUrl || `Document ${index + 1}` };
  }

  if (typeof att === "object") {
    const a = att as Record<string, any>;
    const url = a.url || a.file_url || a.fileUrl || a.path || "";
    if (!url) return null;
    const name =
      a.name ||
      a.file_name ||
      a.fileName ||
      a.filename ||
      url.split("?")[0].split("/").pop() ||
      `Document ${index + 1}`;
    return { url, name };
  }

  return null;
}

export function normalizeAttachments(
  attachments: unknown
): NormalizedAttachment[] {
  if (!attachments || !Array.isArray(attachments)) return [];
  return attachments
    .map((a, i) => normalizeAttachment(a, i))
    .filter((a): a is NormalizedAttachment => a !== null);
}