import { format } from 'date-fns';
import type { MRF, Vendor } from '@/types';
import type { PriceComparisonEntry, PriceComparisonRow } from '@/types/procurement';

/** Display name shown on signed POs (Supply Chain Director). */
export const EMERALD_PO_APPROVER_NAME = 'Mrs. Viva Musa';

export const EMERALD_COMPANY = {
  name: 'Emerald Industrial Co. FZE',
  addressLines: [
    'Plot A10, Calabar Free Trade Zone, Calabar,',
    'Cross River 540001 NG',
  ],
  email: 'temitope.lawal@emeraldcfze.com',
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
  subtotal: number;
  taxAmount: number;
  total: number;
  currencyCode: string;
  approverName: string;
  approvalDateDisplay: string;
  signatureDataUrl?: string | null;
}

function pickSelectedRow(
  rows: Array<PriceComparisonRow | PriceComparisonEntry>
): PriceComparisonRow | PriceComparisonEntry | undefined {
  const sel = rows.find((r) => r.is_selected);
  return sel || rows[0];
}

function vendorNameForId(vendors: Vendor[], vendorId: string): string {
  const v = vendors.find((x) => String(x.id) === String(vendorId));
  return v?.name?.trim() || vendorId || '—';
}

function parsePaymentTermsFromCustomTerms(custom?: string | null): string | null {
  if (!custom?.trim()) return null;
  const m = custom.match(/Payment\s*Terms:\s*([^\n]+)/i);
  return m?.[1]?.trim() || null;
}

function splitStandardTerms(text: string | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
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
  /** When true, include signature block (SCD signed). */
  includeSignature: boolean;
  signatureDataUrl?: string | null;
  /** Override PO date (defaults to today). */
  poDate?: Date;
  approvalDate?: Date;
}): EmeraldPoDisplayModel {
  const { mrf, rows, vendors, standardTermsBody, includeSignature, signatureDataUrl, poDate, approvalDate } =
    input;

  const row = pickSelectedRow(rows);
  const qty = Number(row?.quantity) || 0;
  const rate = Number(row?.unit_price) || 0;
  const subtotal = qty * rate;

  const traw =
    mrf.tax_rate === undefined || mrf.tax_rate === null || mrf.tax_rate === ''
      ? 7.5
      : Number(mrf.tax_rate);
  const taxRate = Number.isFinite(traw) ? traw : 7.5;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const supplierName = row
    ? (row as PriceComparisonEntry).vendor_name?.trim() || vendorNameForId(vendors, String(row.vendor_id))
    : '—';

  const shipTo =
    mrf.ship_to_address?.trim() ||
    'Emerald Industrial Co. FZE, Sapetro Towers, Victoria Island, Lagos, Lagos 100001 NGA';

  const poNum = String(mrf.po_number || mrf.poNumber || '—');
  const pDate = poDate ?? new Date();
  const poDateDisplay = format(pDate, 'dd/MM/yyyy');

  const invoiceTo = mrf.invoice_submission_email?.trim() || 'accountpayables@emeraldcfze.com';
  const invoiceCc = mrf.invoice_submission_cc?.trim() || 'lateef.olanrewaju@emeraldcfze.com';
  const invoiceSubmissionLine = `Invoice submission: ${invoiceTo} cc: ${invoiceCc}`;

  const fromTemplate = splitStandardTerms(standardTermsBody);
  const standardTermsLines =
    fromTemplate.length > 0 ? fromTemplate : [...DEFAULT_STANDARD_TERMS];

  const paymentTermsDisplay =
    parsePaymentTermsFromCustomTerms(mrf.custom_terms) || 'Net 30';

  const categoryLine = (mrf.category || 'Procurement').replace(/-/g, ' ');
  const description =
    row?.item_description?.trim() || mrf.description?.trim() || mrf.title || '—';

  const taxLabel = `${taxRate}%`;

  return {
    companyName: EMERALD_COMPANY.name,
    companyAddressLines: [...EMERALD_COMPANY.addressLines],
    companyEmail: EMERALD_COMPANY.email,
    companyWebsite: EMERALD_COMPANY.website,
    supplierName,
    shipTo,
    poNumber: poNum,
    poDateDisplay,
    lineItems: [
      {
        categoryLine,
        description,
        qty,
        rate,
        taxLabel,
        amount: subtotal,
      },
    ],
    invoiceSubmissionLine,
    standardTermsLines,
    paymentTermsDisplay,
    subtotal,
    taxAmount,
    total,
    currencyCode: mrf.currency?.toUpperCase() || 'NGN',
    approverName: EMERALD_PO_APPROVER_NAME,
    approvalDateDisplay: format(approvalDate ?? new Date(), 'MMMM d, yyyy'),
    signatureDataUrl: includeSignature ? signatureDataUrl ?? null : null,
  };
}
