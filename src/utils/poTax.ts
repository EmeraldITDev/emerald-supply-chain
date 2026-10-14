/**
 * PO VAT maths — mirrors the backend `App\Support\PoTaxCalculator`.
 *
 * - per_line: each line carries its own `tax_rate`. Blank means the default
 *   VAT rate (7.5%); 0 means the line is not taxed. Line amounts are VAT-inclusive.
 * - legacy (no tax_mode): one global MRF rate applied to the whole subtotal.
 *
 * Optional PO-level discount (percentage of subtotal or fixed amount) is taken BEFORE
 * VAT: shared across lines by value, VAT charged on the discounted values. VAT is
 * rounded once per rate band. Line display amounts are not discounted.
 */
import type { PODiscountType, POTaxMode } from '@/types/procurement';

export const DEFAULT_VAT_RATE = 7.5;
export const PER_LINE_TAX_MODE: POTaxMode = 'per_line';

type TaxableLine = {
  unit_price?: number | string | null | '';
  quantity?: number | string | null | '';
  tax_rate?: number | string | null | '';
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Parse a rate input; blank / non-numeric → null. */
export function parseTaxRate(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function isPerLineTaxMode(mode: unknown): boolean {
  return String(mode ?? '').trim().toLowerCase() === PER_LINE_TAX_MODE;
}

/** The rate that applies to a per-line VAT row (blank → default). */
export function effectiveLineRate(line: TaxableLine): number {
  return parseTaxRate(line.tax_rate) ?? DEFAULT_VAT_RATE;
}

export function formatTaxLabel(rate: number): string {
  if (!(rate > 0)) return '0%';
  return `${Number(rate.toFixed(2))}%`;
}

export interface LineTax {
  net: number;
  rate: number;
  vat: number;
  /** VAT-inclusive line amount. */
  gross: number;
}

export function lineTax(line: TaxableLine): LineTax {
  const net = round2((Number(line.unit_price) || 0) * (Number(line.quantity) || 0));
  const rate = effectiveLineRate(line);
  const vat = round2((net * rate) / 100);
  return { net, rate, vat, gross: round2(net + vat) };
}

export interface PODiscount {
  type: PODiscountType;
  value: number;
}

/** Normalise a discount type/value pair; null when there is no discount. */
export function normaliseDiscount(type: unknown, value: unknown): PODiscount | null {
  const t = String(type ?? '').trim().toLowerCase();
  if (t !== 'percentage' && t !== 'amount') return null;
  const v = parseTaxRate(value);
  if (v === null || v <= 0) return null;
  return { type: t, value: v };
}

/** Money discount for a subtotal (capped at the subtotal). */
export function discountAmount(subtotal: number, discount: PODiscount | null): number {
  if (!discount || subtotal <= 0) return 0;
  const raw =
    discount.type === 'percentage'
      ? (subtotal * Math.min(100, discount.value)) / 100
      : discount.value;
  return round2(Math.max(0, Math.min(subtotal, raw)));
}

/** Note shown on the PO, e.g. "Discount: 5% of subtotal (before VAT)". */
export function discountNote(discount: PODiscount | null, formattedAmount: string): string | null {
  if (!discount) return null;
  return discount.type === 'percentage'
    ? `Discount: ${formatTaxLabel(discount.value)} of subtotal (before VAT)`
    : `Discount: ${formattedAmount} fixed amount (before VAT)`;
}

export function summariseLines(
  lines: TaxableLine[],
  discount: PODiscount | null = null,
): {
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
} {
  const taxed = lines.map((l) => lineTax(l));
  const subtotal = round2(taxed.reduce((acc, t) => acc + t.net, 0));
  const disc = discountAmount(subtotal, discount);

  // Share the discount by line value; the last priced line takes the remainder.
  let lastPriced = -1;
  taxed.forEach((t, i) => {
    if (t.net > 0) lastPriced = i;
  });
  let allocated = 0;
  const bandBase = new Map<number, number>();
  taxed.forEach((t, i) => {
    let share = 0;
    if (disc > 0 && t.net > 0) {
      share = i === lastPriced ? round2(disc - allocated) : round2((disc * t.net) / subtotal);
      allocated += share;
    }
    bandBase.set(t.rate, (bandBase.get(t.rate) ?? 0) + (t.net - share));
  });
  let vat = 0;
  bandBase.forEach((base, rate) => {
    vat += round2((round2(base) * rate) / 100);
  });
  vat = round2(vat);
  return { subtotal, discount: disc, vat, total: round2(subtotal - disc + vat) };
}

/** Validation message for the PO discount, or null when valid. */
export function discountError(
  type: PODiscountType | '',
  raw: unknown,
  subtotal: number,
): string | null {
  if (!type) return null;
  if (raw === null || raw === undefined || raw === '') return 'Enter a discount value, or choose No discount.';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 'Discount must be greater than 0.';
  if (type === 'percentage' && n >= 100) return 'Discount percentage must be less than 100%.';
  if (type === 'amount' && n >= subtotal) return 'Discount must be less than the selected supplier subtotal.';
  return null;
}

/** Validation message for a VAT input, or null when valid (blank is valid). */
export function taxRateError(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 'VAT must be between 0 and 100.';
  return null;
}
