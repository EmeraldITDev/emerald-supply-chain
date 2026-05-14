/**
 * Display name for an SRF row from API/AppContext shapes.
 * Prefer `requesterName` / `requester_name`; otherwise `requester` as string or `{ name }`.
 */
export function getSrfRequesterDisplayName(entity: unknown): string {
  if (entity == null || typeof entity !== "object") return "—";
  const o = entity as Record<string, unknown>;
  const named =
    (typeof o.requesterName === "string" && o.requesterName.trim()) ||
    (typeof o.requester_name === "string" && o.requester_name.trim());
  if (named) return named;
  const req = o.requester;
  if (typeof req === "string" && req.trim()) return req.trim();
  if (req && typeof req === "object") {
    const n = (req as { name?: unknown }).name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  return "—";
}
