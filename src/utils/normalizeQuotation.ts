/**
 * Centralized quotation normalizer — single source of truth for all quotation field access.
 * Handles nested API response shapes (item.quotation) and flat shapes alike.
 * Uses ?? (nullish coalescing) throughout to preserve legitimate zero values.
 */

export interface NormalizedQuotation {
  id: string;
  rfqId: string;
  vendorId: string;
  vendorName: string;
  vendorRating: number;
  vendorOrders: number;
  vendorEmail?: string;
  total: number | null;
  price: string;
  deliveryDays: number | null;
  deliveryDate: string | null;
  paymentTerms: string | null;
  validityDays: number | null;
  warrantyPeriod: string | null;
  currency: string;
  submittedAt: string;
  quotationTerms: string | null;
  status: string;
  notes: string;
  // TODO: Type this as NormalizedQuotationItem[] once line item shape stabilizes from backend.
  // This is a known `any` boundary — quotation line items have inconsistent shapes.
  items: any[];
  documentUrl?: string;
}

/**
 * Safely extracts delivery days from a quotation object.
 * Prioritizes explicit delivery_days, only calculates from date if missing.
 */
function resolveDeliveryDays(q: any): number | null {
  // Explicit delivery_days (snake_case first)
  if (q.delivery_days != null && q.delivery_days !== '') {
    const days = Number(q.delivery_days);
    if (!isNaN(days)) return Math.round(days);
  }
  // camelCase variant
  if (q.deliveryDays != null && q.deliveryDays !== '') {
    const days = Number(q.deliveryDays);
    if (!isNaN(days)) return Math.round(days);
  }
  // Calculate from delivery_date as last resort
  const dateStr = q.delivery_date ?? q.deliveryDate;
  if (dateStr) {
    try {
      const deliveryDate = new Date(dateStr);
      const now = new Date();
      if (!isNaN(deliveryDate.getTime())) {
        const diffDays = Math.ceil((deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
      }
    } catch {
      // ignore parse errors
    }
  }
  return null;
}

/**
 * Resolves a numeric total from multiple possible field names.
 * Returns null only when all sources are null/undefined.
 */
function resolveTotal(q: any): number | null {
  const raw = q.totalAmount ?? q.total_amount ?? q.price ?? q.total_order_value ?? q.totalOrderValue;
  if (raw == null) return null;
  const num = Number(raw);
  return isNaN(num) ? null : num;
}

/**
 * Normalizes a single quotation response item into a flat, typed object.
 * Accepts both nested ({ quotation, vendor, items }) and flat shapes.
 */
export function normalizeQuotation(item: any, fallbackRfqId?: string): NormalizedQuotation {
  const q = item.quotation ?? item;
  const vendor = item.vendor ?? q.vendor ?? {};
  const items = item.items ?? q.items ?? [];

  const deliveryDays = resolveDeliveryDays(q);
  const total = resolveTotal(q);
  const paymentTerms: string | null = q.payment_terms ?? q.paymentTerms ?? q.payment_terms_text ?? null;
  const validityDays: number | null = (() => {
    const raw = q.validity_days ?? q.validityDays;
    if (raw == null) return null;
    const num = Number(raw);
    return isNaN(num) ? null : num;
  })();

  return {
    id: q.id ?? '',
    rfqId: fallbackRfqId ?? q.rfq_id ?? q.rfqId ?? '',
    vendorId: vendor?.id ?? vendor?.vendor_id ?? q.vendor_id ?? q.vendorId ?? '',
    vendorName: vendor?.name ?? vendor?.company_name ?? q.vendor_name ?? q.vendorName ?? 'Unknown Vendor',
    vendorRating: vendor?.rating ?? q.vendorRating ?? 0,
    vendorOrders: vendor?.total_orders ?? vendor?.orders ?? q.vendorOrders ?? 0,
    vendorEmail: vendor?.email ?? q.vendorEmail,
    total,
    price: String(total ?? '0'),
    deliveryDays,
    deliveryDate: q.delivery_date ?? q.deliveryDate ?? null,
    paymentTerms,
    validityDays,
    warrantyPeriod: q.warranty_period ?? q.warrantyPeriod ?? null,
    currency: q.currency ?? q.currency_code ?? 'NGN',
    submittedAt: q.submitted_at ?? q.submittedDate ?? q.submitted_date ?? q.created_at ?? q.createdAt ?? '',
    quotationTerms: q.quotation_terms ?? q.terms ?? null,
    status: q.status ?? 'Pending',
    notes: q.notes ?? q.note ?? q.remarks ?? '',
    items,
    documentUrl: q.document_url ?? q.documentUrl,
  };
}

/**
 * Normalizes an array of quotation response items.
 */
export function normalizeQuotations(items: any[], fallbackRfqId?: string): NormalizedQuotation[] {
  return items.map(item => normalizeQuotation(item, fallbackRfqId));
}

// --- Display helpers ---
// Use these in UI components to render normalized values correctly.

/**
 * Formats a numeric field for display. Returns 'N/A' only for null/undefined.
 * Zero is displayed as-is (e.g. "0 days"), not as N/A.
 */
export function displayNumeric(value: number | null | undefined, suffix?: string): string {
  if (value == null) return 'N/A';
  return suffix ? `${value} ${suffix}` : String(value);
}

/**
 * Formats a string field for display. Returns 'N/A' for null/undefined/empty.
 */
export function displayString(value: string | null | undefined): string {
  return value || 'N/A';
}

/**
 * Formats a currency amount for display (simple symbol prefix).
 */
export function displayCurrency(value: number | null | undefined, currency: string = 'NGN'): string {
  if (value == null) return 'N/A';
  const symbol = currency === 'NGN' ? '₦' : currency === 'USD' ? '$' : currency;
  return `${symbol}${value.toLocaleString()}`;
}

/**
 * Formats a day-count field for display.
 * Preserves 0 as "0 days", uses singular "day" for 1.
 */
export function formatDays(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  if (value === 1) return '1 day';
  return `${value} days`;
}

/**
 * Formats a currency amount using Intl.NumberFormat for proper locale-aware display.
 */
export function formatAmount(value: number | string | null | undefined, currency: string = 'NGN'): string {
  if (value == null) return 'N/A';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'N/A';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}
