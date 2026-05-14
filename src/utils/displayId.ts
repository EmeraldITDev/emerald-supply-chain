/**
 * Returns the display-friendly ID for a request entity (MRF/SRF/RFQ/etc).
 * Order: formattedId → formatted_id → legacyId → legacy_id → id.
 */
export const getDisplayId = (r: any): string => {
  if (!r) return "";
  return (
    r.formattedId ??
    r.formatted_id ??
    r.legacyId ??
    r.legacy_id ??
    r.id ??
    ""
  );
};

/**
 * Every string that might identify the same MRF row (list payload vs RFQ link vs detail).
 * Used to join RFQs/quotations to the correct MRF when `id` and `formatted_id` diverge.
 */
export function collectMrfIdAliases(m: unknown): string[] {
  if (!m || typeof m !== "object") return [];
  const o = m as Record<string, unknown>;
  const keys = [
    "formatted_id",
    "formattedId",
    "mrf_id",
    "mrfId",
    "legacy_id",
    "legacyId",
    "id",
  ] as const;
  const out: string[] = [];
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && String(v) !== "") {
      out.push(String(v));
    }
  }
  return [...new Set(out)];
}

/**
 * Id to embed in `/api/mrfs/{id}/...` paths. Prefers formatted_id (same priority as
 * {@link getDisplayId}) so mutations target the record the user sees, not a stale legacy `id`.
 * Falls back to mrf_id, legacy ids, then `id`. Backend may resolve any of these.
 */
export function getMrfApiId(m: unknown): string {
  if (!m || typeof m !== "object") return "";
  const o = m as Record<string, unknown>;
  const v =
    o.formatted_id ??
    o.formattedId ??
    o.mrf_id ??
    o.mrfId ??
    o.legacy_id ??
    o.legacyId ??
    o.id;
  return v !== undefined && v !== null ? String(v) : "";
}

/**
 * Find an MRF row in a list when another object (e.g. RFQ) only stores one link field
 * (`mrf_id` / `mrfId`) that might equal any alias on the MRF.
 */
export function findMrfByAnyLinkId(
  link: string | null | undefined,
  mrfs: readonly unknown[],
): unknown | null {
  if (link == null || link === "" || !mrfs?.length) return null;
  const s = String(link);
  for (const row of mrfs) {
    if (collectMrfIdAliases(row).includes(s)) return row;
  }
  return null;
}

/**
 * Resolve the list row for the same underlying MRF as `ref`, using overlapping aliases.
 */
export function resolveMrfInList<T = unknown>(
  ref: unknown,
  list: readonly T[],
): T | undefined {
  const aliases = new Set(collectMrfIdAliases(ref));
  if (aliases.size === 0) return undefined;
  return list.find((m) =>
    collectMrfIdAliases(m).some((a) => aliases.has(a)),
  );
}

/**
 * True if a string looks like the new formatted ID
 * (e.g. MRF-EMERALD-IT-LAP-2026-001, RFQ-IT-LAP-V001-2026-001).
 */
export const isFormattedId = (s: string): boolean =>
  /^[A-Z]+(-[A-Z0-9]+){2,}-\d{4}-\d+$/.test(s ?? "");

/** Id aliases for an SRF row (list vs deep link query param). */
export function collectSrfIdAliases(s: unknown): string[] {
  if (!s || typeof s !== "object") return [];
  const o = s as Record<string, unknown>;
  const keys = ["formatted_id", "formattedId", "legacy_id", "legacyId", "id"] as const;
  const out: string[] = [];
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && String(v) !== "") out.push(String(v));
  }
  return [...new Set(out)];
}

export function matchesSrfQueryParam(entity: unknown, q: string): boolean {
  const decoded = decodeURIComponent(q.trim());
  return collectSrfIdAliases(entity).some((a) => a === decoded);
}
