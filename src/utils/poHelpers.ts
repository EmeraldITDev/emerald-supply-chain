/**
 * PO-related helpers: defensive accessors for backend payload shape variance.
 * Backend may return either camelCase / snake_case AND singular / plural keys
 * depending on serializer version. Always go through these helpers.
 */

export interface PriceComparisonRow {
  vendorName: string;
  itemDescription: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  selected: boolean;
  selectionReason?: string;
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Resolve the price-comparison rows attached to a PO regardless of
 * which key the backend chose (priceComparison / priceComparisons /
 * price_comparison / price_comparisons).
 */
export const getPriceComparison = (po: any): PriceComparisonRow[] => {
  if (!po) return [];

  const rawCandidates = [
    po.priceComparison,
    po.priceComparisons,
    po.price_comparison,
    po.price_comparisons,
  ].filter((v) => Array.isArray(v));

  // Dev warning if multiple non-empty variants disagree
  if (
    typeof window !== "undefined" &&
    import.meta.env?.DEV &&
    rawCandidates.length > 1
  ) {
    const lengths = new Set(rawCandidates.map((a) => a.length));
    if (lengths.size > 1) {
      // eslint-disable-next-line no-console
      console.warn(
        "[poHelpers] PO returned multiple price-comparison keys with different lengths",
      );
    }
  }

  const raw: any[] = rawCandidates[0] ?? [];

  return raw.map((r) => {
    const unitPrice = num(r.unitPrice ?? r.unit_price);
    const quantity = num(r.quantity ?? r.qty);
    const totalPrice = num(
      r.totalPrice ?? r.total_price ?? unitPrice * quantity,
    );
    return {
      vendorName:
        r.vendorName ?? r.vendor_name ?? r.vendor?.name ?? "Unknown vendor",
      itemDescription:
        r.itemDescription ??
        r.item_description ??
        r.description ??
        r.item ??
        "",
      unitPrice,
      quantity,
      totalPrice,
      selected: Boolean(r.selected ?? r.is_selected ?? r.isSelected),
      selectionReason:
        r.selectionReason ?? r.selection_reason ?? r.reason ?? undefined,
    };
  });
};

/** Normalized PO status string (lowercased, snake-cased). */
export const getPOStatus = (po: any): string => {
  if (!po) return "";
  const raw = String(po.status ?? po.po_status ?? "").trim();
  return raw.toLowerCase().replace(/[\s-]+/g, "_");
};

/** True if the PO has been returned to procurement for revision. */
export const isPORevisionRequired = (po: any): boolean => {
  const s = getPOStatus(po);
  return s === "revision_required" || s === "returned_to_procurement";
};

/** True if the PO is awaiting SCD signature. */
export const isPOAwaitingSignature = (po: any): boolean =>
  getPOStatus(po) === "awaiting_scd_signature";

/** Pull a rejection reason from any of the common backend keys. */
export const getRejectionReason = (po: any): string | undefined => {
  if (!po) return undefined;
  return (
    po.rejectionReason ??
    po.rejection_reason ??
    po.poRejectionReason ??
    po.po_rejection_reason ??
    undefined
  );
};