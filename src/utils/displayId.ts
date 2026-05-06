/**
 * Returns the display-friendly ID for a request entity (MRF/SRF/RFQ/etc).
 * Order: formattedId → formatted_id → legacyId → legacy_id → id.
 * UUIDs (`id`) MUST stay the canonical key for API calls — only use this for UI.
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
 * True if a string looks like the new formatted ID
 * (e.g. MRF-EMERALD-IT-LAP-2026-001, RFQ-IT-LAP-V001-2026-001).
 */
export const isFormattedId = (s: string): boolean =>
  /^[A-Z]+(-[A-Z0-9]+){2,}-\d{4}-\d+$/.test(s ?? "");