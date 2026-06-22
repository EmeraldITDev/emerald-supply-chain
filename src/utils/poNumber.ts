/**
 * Canonical Purchase Order number format helpers.
 *
 * Format: `PO-DDMMYY-SupplierToken-NNNN`
 *   - DDMMYY  : creation date, two-digit day/month/year, no separators
 *   - Supplier: supplier name with all non-alphanumeric characters removed
 *   - NNNN    : 4-digit zero-padded serial that resets per supplier per day
 *
 * Examples:
 *   Mochenz Computers, 22 Jun 2026, 1st of the day  -> PO-220626-MochenzComputers-0001
 *   Al-Fatah Trading,  22 Jun 2026, 1st of the day  -> PO-220626-AlFatahTrading-0001
 *
 * IMPORTANT — authority:
 *   The authoritative PO number (specifically the per-supplier-per-day serial)
 *   MUST be assigned by the backend at generation time, because only the backend
 *   can guarantee an atomic, race-free, persistent counter. The frontend uses
 *   these helpers for previews, the (legacy) client-supplied path, validation,
 *   and display normalisation only. See PO_NUMBERING_BACKEND_SPEC.md.
 */

export interface ParsedPoNumber {
  datePart: string; // DDMMYY
  supplier: string; // normalised supplier token
  serial: number; // numeric serial
  serialPart: string; // zero-padded serial as stored
}

/** Max characters kept from the supplier token to avoid unwieldy PO numbers. */
const SUPPLIER_TOKEN_MAX = 30;

/** Format a Date (or date-ish input) as DDMMYY with no separators. */
export function formatPoDatePart(date: Date | string | number = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  const valid = !Number.isNaN(d.getTime()) ? d : new Date();
  const dd = String(valid.getDate()).padStart(2, '0');
  const mm = String(valid.getMonth() + 1).padStart(2, '0');
  const yy = String(valid.getFullYear() % 100).padStart(2, '0');
  return `${dd}${mm}${yy}`;
}

/**
 * Reduce a supplier name to a token of its alphanumeric characters only.
 *  - Removes every space, punctuation and special character from the whole name,
 *    concatenating all words, so:
 *      "Mochenz Computers" -> "MochenzComputers"
 *      "Al-Fatah Trading"  -> "AlFatahTrading"
 *      "&Co Supplies"      -> "CoSupplies"
 *  - Preserves original casing. Caps length to keep PO numbers manageable.
 */
export function normalizeSupplierToken(name: string | null | undefined): string {
  const cleaned = String(name ?? '').replace(/[^A-Za-z0-9]/g, '');
  return (cleaned || 'Vendor').slice(0, SUPPLIER_TOKEN_MAX);
}

/** Zero-pad a serial number to 4 digits (more digits kept if it overflows). */
export function formatPoSerial(serial: number): string {
  const n = Math.max(0, Math.floor(Number(serial) || 0));
  return String(n).padStart(4, '0');
}

/**
 * Build a PO number from its parts. The serial is normally supplied by the
 * backend; pass a preview placeholder when previewing client-side.
 */
export function buildPoNumber(params: {
  supplierName: string | null | undefined;
  serial: number;
  date?: Date | string | number;
}): string {
  const datePart = formatPoDatePart(params.date ?? new Date());
  const supplier = normalizeSupplierToken(params.supplierName);
  const serialPart = formatPoSerial(params.serial);
  return `PO-${datePart}-${supplier}-${serialPart}`;
}

/** Regex matching the new canonical PO number format. */
export const NEW_PO_NUMBER_REGEX = /^PO-(\d{6})-([A-Za-z0-9]+)-(\d{3,})$/;

/** True when a PO number string matches the new canonical format. */
export function isNewFormatPoNumber(po: string | null | undefined): boolean {
  return NEW_PO_NUMBER_REGEX.test(String(po ?? '').trim());
}

/** Parse a canonical PO number into its parts, or null when it does not match. */
export function parsePoNumber(po: string | null | undefined): ParsedPoNumber | null {
  const m = NEW_PO_NUMBER_REGEX.exec(String(po ?? '').trim());
  if (!m) return null;
  return {
    datePart: m[1],
    supplier: m[2],
    serialPart: m[3],
    serial: parseInt(m[3], 10),
  };
}

/**
 * Preview PO number for UIs shown before the backend assigns the real serial.
 * Uses a `XXXX` serial placeholder so it is never mistaken for a final number.
 */
export function previewPoNumber(
  supplierName: string | null | undefined,
  date: Date | string | number = new Date(),
): string {
  return `PO-${formatPoDatePart(date)}-${normalizeSupplierToken(supplierName)}-XXXX`;
}
