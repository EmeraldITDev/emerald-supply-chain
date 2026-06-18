import { format } from 'date-fns';
import type { MRF, Vendor } from '@/types';
import type { POTermsMode, PriceComparisonEntry, PriceComparisonRow } from '@/types/procurement';

/** Display name shown on signed POs (Supply Chain Director). */
export const EMERALD_PO_APPROVER_NAME = 'Mrs. Viva Musa';

export const EMERALD_COMPANY = {
  name: 'Emerald Industrial Co. FZE',
  addressLines: [
    'Plot A10, Calabar Free Trade Zone, Calabar,',
    'Cross River 540001 NG',
  ],
  email: 'info@emeraldcfze.com',
  website: 'https://emeraldcfze.com/',
} as const;

export const DEFAULT_STANDARD_TERMS = [
  'Deliver only brand-new and compliant goods.',
  'Package contents must be clearly identified and accompanied by delivery documents.',
  'Replace non-conforming goods at no additional cost.',
] as const;

export interface EmeraldPoLineItem {
  categoryLine: string;
  description: string;
  qty: number;
  rate: number;
  taxLabel: string;
  amount: number;
}

/** Human-readable contract type for PO footer (matches Manual PO / New MRF options). */
export function formatContractTypeForPo(mrf: { contract_type?: string; contractType?: string }): string {
  const raw = (mrf.contract_type || mrf.contractType || '').trim();
  if (!raw) return '—';
  const key = raw.toLowerCase();
  const labels: Record<string, string> = {
    emerald: 'Emerald Contract',
    oando: 'Oando Contract',
    dangote: 'Dangote Contract',
    heritage: 'Heritage Contract',
  };
  return labels[key] || raw;
}

export interface EmeraldPoDisplayModel {
  companyName: string;
  companyAddressLines: string[];
  companyEmail: string;
  companyWebsite: string;
  supplierName: string;
  shipTo: string;
  poNumber: string;
  poDateDisplay: string;
  lineItems: EmeraldPoLineItem[];
  invoiceSubmissionLine: string;
  standardTermsLines: string[];
  paymentTermsDisplay: string;
  /**
   * Structured payment schedule milestones (Finance AP Phase 1).
   * When present, the preview renders a milestone table instead of the
   * free-text `paymentTermsDisplay` line.
   */
  paymentMilestones?: EmeraldPoMilestone[];
  contractTypeDisplay: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  currencyCode: string;
  approverName: string;
  approvalDateDisplay: string;
  signatureDataUrl?: string | null;
}

export interface EmeraldPoMilestone {
  milestoneNumber: number;
  label: string;
  percentage: number;
  amount: number;
  triggerLabel: string;
}

function pickSelectedRow(
  rows: Array<PriceComparisonRow | PriceComparisonEntry>
): PriceComparisonRow | PriceComparisonEntry | undefined {
  const sel = rows.find((r) => r.is_selected);
  return sel || rows[0];
}

/**
 * Stable supplier identity key. Two rows refer to the same supplier when
 * they share a directory vendor_id, or share a (trimmed, case-insensitive)
 * manual vendor name. This is what lets the PM add multiple line items
 * for the selected supplier without re-entering vendor details.
 */
function supplierKey(
  row: PriceComparisonRow | PriceComparisonEntry | undefined,
): string {
  if (!row) return '';
  if (row.vendor_id) return `v:${String(row.vendor_id)}`;
  const pr = row as PriceComparisonRow;
  const pe = row as PriceComparisonEntry;
  const name =
    pr.manual_vendor?.name?.trim() ||
    pe.vendor_name?.trim() ||
    '';
  return name ? `m:${name.toLowerCase()}` : '';
}

function vendorNameForId(vendors: Vendor[], vendorId: string): string {
  const v = vendors.find((x) => String(x.id) === String(vendorId));
  return v?.name?.trim() || vendorId || '—';
}

/**
 * Resolve the selected supplier (winning vendor) and all price-comparison rows
 * that belong to that supplier. Shared by the PO and GRN document models so both
 * documents show the same vendor + line items.
 */
export function resolveSelectedSupplier(
  rows: Array<PriceComparisonRow | PriceComparisonEntry>,
  vendors: Vendor[] = [],
): {
  supplierName: string;
  supplierAddress: string;
  supplierRows: Array<PriceComparisonRow | PriceComparisonEntry>;
} {
  const row = pickSelectedRow(rows);
  const selectedKey = supplierKey(row);
  const supplierRows = selectedKey
    ? rows.filter((r) => supplierKey(r) === selectedKey)
    : row
      ? [row]
      : [];

  let supplierName = '—';
  let supplierAddress = '';
  if (row) {
    const pe = row as PriceComparisonEntry;
    const pr = row as PriceComparisonRow;
    if (pe.vendor_name?.trim()) {
      supplierName = pe.vendor_name.trim();
    } else if (pr.manual_vendor?.name?.trim()) {
      supplierName = pr.manual_vendor.name.trim();
      supplierAddress = pr.manual_vendor.address?.trim() || '';
    } else if (pr.vendor_id) {
      supplierName = vendorNameForId(vendors, String(pr.vendor_id));
    }
    // Prefer the directory vendor's address when available.
    if (!supplierAddress && (pr.vendor_id || pe.vendor_id)) {
      const v = vendors.find(
        (x) => String(x.id) === String(pr.vendor_id ?? pe.vendor_id),
      );
      supplierAddress =
        (v as unknown as { address?: string })?.address?.trim() || supplierAddress;
    }
  }
  return { supplierName, supplierAddress, supplierRows };
}

function parsePaymentTermsFromCustomTerms(custom?: string | null): string | null {
  if (!custom?.trim()) return null;
  const m = custom.match(/Payment\s*Terms:\s*([^\n]+)/i);
  let v = m?.[1]?.trim();
  if (!v) {
    const loose = custom.match(/Payment\s+Terms\s+([^\n]+)/i);
    v = loose?.[1]?.trim();
  }
  if (!v) return null;
  const cleaned = v.replace(/^Payment\s*Terms\s*:?\s*/i, '').trim();
  return cleaned || v;
}

export function coercePOTermsMode(v: unknown): POTermsMode {
  if (v === 'standard' || v === 'custom' || v === 'both') return v;
  return 'standard';
}

/** Strip payment clause blocks from stored `custom_terms` for “user clauses” preview. */
export function userClausesFromStoredCustomTerms(stored?: string | null): string | undefined {
  if (!stored?.trim()) return undefined;
  const out = stored
    .split(/\n\s*\n/)
    .filter((block) => !/^Payment\s*Terms:/im.test(block.trim()))
    .join('\n\n')
    .trim();
  return out || undefined;
}

function splitStandardTerms(text: string | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

function templateTermLines(standardTermsBody?: string): string[] {
  const fromTemplate = splitStandardTerms(standardTermsBody);
  return fromTemplate.length > 0 ? fromTemplate : [...DEFAULT_STANDARD_TERMS];
}

/** Bullets for the PO “standard terms” block based on mode (preview / client PDF). */
export function resolvePoTermsLines(input: {
  terms_mode?: POTermsMode;
  standardTermsBody?: string;
  /** User’s “Additional custom terms” field only (not payment line). */
  user_terms_text?: string;
}): string[] {
  const mode = input.terms_mode ?? 'standard';
  const templateLines = templateTermLines(input.standardTermsBody);
  const userLines = splitStandardTerms(input.user_terms_text);
  if (mode === 'standard') return templateLines;
  if (mode === 'custom') return userLines.length > 0 ? userLines : ['—'];
  return [...templateLines, ...userLines];
}

type MRFExtras = MRF & {
  ship_to_address?: string;
  tax_rate?: number | string | null;
  invoice_submission_email?: string;
  invoice_submission_cc?: string;
  custom_terms?: string;
  remarks?: string;
};

/**
 * Build a display model for the Emerald PO layout from MRF + price comparison + vendors.
 */
export function buildEmeraldPoDisplayModel(input: {
  mrf: MRFExtras;
  rows: Array<PriceComparisonRow | PriceComparisonEntry>;
  vendors: Vendor[];
  standardTermsBody?: string;
  terms_mode?: POTermsMode;
  /** User “additional custom terms” textarea (excludes payment, which is a separate field). */
  user_terms_text?: string;
  /** When true, include signature block (SCD signed). */
  includeSignature: boolean;
  signatureDataUrl?: string | null;
  /** Override PO date (defaults to today). */
  poDate?: Date;
  approvalDate?: Date;
}): EmeraldPoDisplayModel {
  const {
    mrf,
    rows,
    vendors,
    standardTermsBody,
    terms_mode,
    user_terms_text,
    includeSignature,
    signatureDataUrl,
    poDate,
    approvalDate,
  } = input;

  const row = pickSelectedRow(rows);

  // All rows belonging to the selected supplier become line items on the PO.
  // Falls back to just the selected row if no supplier identity is resolvable.
  const { supplierName, supplierRows } = resolveSelectedSupplier(rows, vendors);

  const subtotal = supplierRows.reduce(
    (acc, r) => acc + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0),
    0,
  );

  const traw =
    mrf.tax_rate === undefined || mrf.tax_rate === null || mrf.tax_rate === ''
      ? 7.5
      : Number(mrf.tax_rate);
  const taxRate = Number.isFinite(traw) ? traw : 7.5;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const shipTo =
    mrf.ship_to_address?.trim() ||
    'Emerald Industrial Co. FZE, Sapetro Towers, Victoria Island, Lagos, Lagos 100001 NGA';

  const poNum = String(mrf.po_number || mrf.poNumber || '—');
  const pDate = poDate ?? new Date();
  const poDateDisplay = format(pDate, 'dd/MM/yyyy');

  const invoiceTo = mrf.invoice_submission_email?.trim() || 'accountpayables@emeraldcfze.com';
  const invoiceCc = mrf.invoice_submission_cc?.trim() || 'lateef.olanrewaju@emeraldcfze.com';
  const invoiceSubmissionLine = `Invoice submission: ${invoiceTo} cc: ${invoiceCc}`;

  const standardTermsLines = resolvePoTermsLines({
    terms_mode,
    standardTermsBody,
    user_terms_text,
  });

  const paymentTermsDisplay =
    parsePaymentTermsFromCustomTerms(mrf.custom_terms) || 'Net 30';

  // Hydrate milestones from the MRF's payment schedule, if any. Amounts are
  // derived from the PO total so the preview stays consistent with subtotal/tax.
  const schedule =
    (mrf as MRFExtras & {
      paymentSchedule?: import('@/types/payment-schedule').PaymentSchedule | null;
      payment_schedule?: import('@/types/payment-schedule').PaymentSchedule | null;
    }).paymentSchedule ??
    (mrf as MRFExtras & {
      payment_schedule?: import('@/types/payment-schedule').PaymentSchedule | null;
    }).payment_schedule ??
    null;
  const paymentMilestones = schedule?.milestones?.length
    ? schedule.milestones.map((m) => ({
        milestoneNumber: m.milestoneNumber,
        label: m.label,
        percentage: Number(m.percentage) || 0,
        amount:
          m.amount != null && m.amount !== ''
            ? Number(m.amount) || 0
            : (total * (Number(m.percentage) || 0)) / 100,
        triggerLabel: m.triggerLabel || String(m.triggerCondition || ''),
      }))
    : undefined;

  const contractTypeDisplay = formatContractTypeForPo(mrf);

  const categoryLine = (mrf.category || 'Procurement').replace(/-/g, ' ');
  const taxLabel = `${taxRate}%`;

  const lineItems: EmeraldPoLineItem[] = (supplierRows.length > 0
    ? supplierRows
    : [row].filter(Boolean) as Array<PriceComparisonRow | PriceComparisonEntry>
  ).map((r) => {
    const qty = Number(r?.quantity) || 0;
    const rate = Number(r?.unit_price) || 0;
    return {
      categoryLine,
      description:
        r?.item_description?.trim() || mrf.description?.trim() || mrf.title || '—',
      qty,
      rate,
      taxLabel,
      amount: qty * rate,
    };
  });

  return {
    companyName: EMERALD_COMPANY.name,
    companyAddressLines: [...EMERALD_COMPANY.addressLines],
    companyEmail: EMERALD_COMPANY.email,
    companyWebsite: EMERALD_COMPANY.website,
    supplierName,
    shipTo,
    poNumber: poNum,
    poDateDisplay,
    lineItems,
    invoiceSubmissionLine,
    standardTermsLines,
    paymentTermsDisplay,
    paymentMilestones,
    contractTypeDisplay,
    subtotal,
    taxAmount,
    total,
    currencyCode: mrf.currency?.toUpperCase() || 'NGN',
    approverName: EMERALD_PO_APPROVER_NAME,
    approvalDateDisplay: format(approvalDate ?? new Date(), 'MMMM d, yyyy'),
    signatureDataUrl: includeSignature ? signatureDataUrl ?? null : null,
  };
}

/** Public asset: official Emerald logo (`public/emerald-po-logo.png`) for PO header. */
export function getEmeraldPoLogoPublicPath(): string {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null
      ? String(import.meta.env.BASE_URL)
      : '/';
  if (base === '/') return '/emerald-po-logo.png';
  return `${base.replace(/\/$/, '')}/emerald-po-logo.png`;
}
