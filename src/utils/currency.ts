/** Supported currencies for purchase order line amounts. */
export const PO_CURRENCY_OPTIONS = [
  { value: 'NGN', label: 'Nigerian Naira (₦)' },
  { value: 'USD', label: 'US Dollar ($)' },
] as const;

export type PoCurrencyCode = (typeof PO_CURRENCY_OPTIONS)[number]['value'];

export function normalizeCurrencyCode(code?: string | null): PoCurrencyCode {
  const c = (code || 'NGN').toUpperCase().trim();
  return c === 'USD' ? 'USD' : 'NGN';
}

export function currencyLocale(code?: string | null): string {
  return normalizeCurrencyCode(code) === 'USD' ? 'en-US' : 'en-NG';
}

/** Locale-aware currency formatting for PO amounts. */
export function formatPoAmount(
  value: number | string | null | undefined,
  currency: string = 'NGN',
): string {
  if (value == null || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return '—';
  const code = normalizeCurrencyCode(currency);
  return new Intl.NumberFormat(currencyLocale(code), {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Short symbol for column headers (Unit Price, Total). */
export function currencySymbol(currency: string = 'NGN'): string {
  return normalizeCurrencyCode(currency) === 'USD' ? '$' : '₦';
}

/** An MRF's currency. MRFs saved before the currency field existed are Naira. */
export function mrfCurrency(mrf?: { currency?: string | null } | null): PoCurrencyCode {
  return normalizeCurrencyCode(mrf?.currency);
}

/** Whole-amount style used on MRF lists and cards, e.g. "₦1,500,000" or "$7,380". */
export function formatMrfAmount(
  value: number | string | null | undefined,
  currency: string = 'NGN',
): string {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
  return `${currencySymbol(currency)}${(Number.isNaN(num) ? 0 : num).toLocaleString()}`;
}
