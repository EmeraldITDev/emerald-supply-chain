import { format } from 'date-fns';
import {
  EMERALD_COMPANY,
  EMERALD_PO_APPROVER_NAME,
  resolveSelectedSupplier,
} from '@/utils/emeraldPoDocumentModel';
import type { MRF, LineItem, Vendor } from '@/types';
import type { PriceComparisonEntry, PriceComparisonRow } from '@/types/procurement';
import { getDisplayId } from '@/utils/displayId';

const DASH = '—';

export interface GrnDisplayLineItem {
  sn: number;
  description: string;
  deliveryDate: string;
  uom: string;
  quantityOrdered: string;
  quantityReceived: string;
  unitPrice: string;
  total: string;
}

export interface GrnSignatoryBlock {
  heading: string;
  name: string;
  position: string;
  signDate: string;
}

export interface GrnDisplayModel {
  companyName: string;
  companyAddressLines: string[];
  companyEmail: string;
  companyWebsite: string;

  title: string;
  subtitle: string;

  grnNumber: string;
  dateOfReceiptDisplay: string;
  mrfReference: string;
  poNumber: string;

  waybillDeliveryNoteNumber: string;
  deliveryDateDisplay: string;
  carrierName: string;
  driverName: string;
  driverPhone: string;
  vehiclePlateNumber: string;

  supplierName: string;
  supplierAddressLines: string[];

  lineItems: GrnDisplayLineItem[];
  comments: string;

  vendorDeliveredBy: GrnSignatoryBlock;
  vendorWitnessedBy: GrnSignatoryBlock;
  emeraldReceivedBy: GrnSignatoryBlock;
  emeraldSupervisedBy: GrnSignatoryBlock;
}

function dash(v: unknown): string {
  const s = (v ?? '').toString().trim();
  return s || DASH;
}

function fmtDate(input?: string | Date | null): string {
  if (!input) return DASH;
  const d = typeof input === 'string' ? new Date(input) : input;
  if (!d || Number.isNaN(d.getTime())) return dash(typeof input === 'string' ? input : '');
  return format(d, 'MMM dd, yyyy');
}

function fmtMoney(n: number, currency = 'NGN'): string {
  if (!Number.isFinite(n) || n === 0) return DASH;
  return `${currency} ${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function splitLines(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return value.split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

export interface GrnBuildInput {
  mrf: MRF;
  /** Form state from GRN dialog. */
  grnNumber?: string;
  dateOfReceipt?: string;
  deliveryNoteNumber?: string;
  deliveryDate?: string;
  carrierName?: string;
  driverName?: string;
  driverPhone?: string;
  vehiclePlateNumber?: string;
  comments?: string;
  /** Map of line-item index -> received qty override. */
  quantityReceivedOverrides?: Record<number, string | number | undefined>;
  /** Vendor info (looked up from MRF when not supplied). */
  supplierName?: string;
  supplierAddress?: string;
  /**
   * Price comparison rows for this MRF (same source the PO uses). When the MRF
   * has no embedded `items`, line items + supplier are derived from the selected
   * supplier's rows so the GRN matches the PO.
   */
  priceComparisonRows?: Array<PriceComparisonRow | PriceComparisonEntry>;
  /** Vendor directory, used to resolve a vendor_id to a supplier name/address. */
  vendors?: Vendor[];
  /** Signatory overrides. */
  vendorDeliveredByName?: string;
  vendorWitnessedByName?: string;
  emeraldReceivedByName?: string;
  emeraldReceivedByTitle?: string;
  emeraldSupervisedByName?: string;
  emeraldSupervisedByTitle?: string;
}

export function buildGrnDisplayModel(input: GrnBuildInput): GrnDisplayModel {
  const { mrf } = input;
  const items = (mrf.items ?? []) as LineItem[];
  const overrides = input.quantityReceivedOverrides || {};
  const currency = (mrf.currency || 'NGN').toUpperCase();

  // Resolve the selected supplier + its rows from price comparison data (same
  // source as the PO). Used both for line items (when the MRF lacks `items`)
  // and to fill in supplier name/address.
  const pcRows = input.priceComparisonRows ?? [];
  const selectedSupplier =
    pcRows.length > 0 ? resolveSelectedSupplier(pcRows, input.vendors ?? []) : null;

  let lineItems: GrnDisplayLineItem[] = items.map((li, idx) => {
    const qtyOrdered = Number(li.quantity) || 0;
    const rawRcv = overrides[idx];
    const qtyRcv =
      rawRcv === undefined || rawRcv === ''
        ? qtyOrdered
        : Number(rawRcv);
    const unitPriceNum =
      (li.quotedAmount && qtyOrdered ? Number(li.quotedAmount) / qtyOrdered : 0) ||
      (li.budgetAmount && qtyOrdered ? Number(li.budgetAmount) / qtyOrdered : 0);
    const totalNum = unitPriceNum * (Number.isFinite(qtyRcv) ? qtyRcv : 0);
    return {
      sn: idx + 1,
      description: dash(li.itemName),
      deliveryDate: fmtDate(input.deliveryDate),
      uom: dash(li.unit),
      quantityOrdered: qtyOrdered ? String(qtyOrdered) : DASH,
      quantityReceived: Number.isFinite(qtyRcv) && qtyRcv > 0 ? String(qtyRcv) : DASH,
      unitPrice: fmtMoney(unitPriceNum, currency),
      total: fmtMoney(totalNum, currency),
    };
  });

  // Fall back to price-comparison rows when the MRF carries no embedded items.
  if (lineItems.length === 0 && selectedSupplier?.supplierRows.length) {
    lineItems = selectedSupplier.supplierRows.map((r, idx) => {
      const qtyOrdered = Number(r.quantity) || 0;
      const rawRcv = overrides[idx];
      const qtyRcv =
        rawRcv === undefined || rawRcv === '' ? qtyOrdered : Number(rawRcv);
      const unitPriceNum = Number(r.unit_price) || 0;
      const totalNum = unitPriceNum * (Number.isFinite(qtyRcv) ? qtyRcv : 0);
      return {
        sn: idx + 1,
        description: dash(
          r.item_description || mrf.description || mrf.title,
        ),
        deliveryDate: fmtDate(input.deliveryDate),
        uom: dash((r as unknown as { unit?: string }).unit),
        quantityOrdered: qtyOrdered ? String(qtyOrdered) : DASH,
        quantityReceived:
          Number.isFinite(qtyRcv) && qtyRcv > 0 ? String(qtyRcv) : DASH,
        unitPrice: fmtMoney(unitPriceNum, currency),
        total: fmtMoney(totalNum, currency),
      };
    });
  }

  const resolvedSupplierName =
    input.supplierName?.trim() ||
    selectedSupplier?.supplierName ||
    ((mrf as unknown as { vendor_name?: string; vendorName?: string }).vendor_name ??
      (mrf as unknown as { vendor_name?: string; vendorName?: string }).vendorName) ||
    '';

  const supplierAddressRaw =
    input.supplierAddress ||
    selectedSupplier?.supplierAddress ||
    ((mrf as unknown as { vendor_address?: string; vendorAddress?: string }).vendor_address ??
      (mrf as unknown as { vendor_address?: string; vendorAddress?: string }).vendorAddress) ||
    '';

  return {
    companyName: EMERALD_COMPANY.name,
    companyAddressLines: [...EMERALD_COMPANY.addressLines],
    companyEmail: EMERALD_COMPANY.email,
    companyWebsite: EMERALD_COMPANY.website,

    title: 'GOODS RECEIVED NOTE',
    subtitle: mrf.category ? `Category: ${mrf.category}` : '',

    grnNumber: dash(input.grnNumber),
    dateOfReceiptDisplay: fmtDate(input.dateOfReceipt),
    mrfReference: dash(getDisplayId(mrf)),
    poNumber: dash(mrf.po_number || mrf.poNumber),

    waybillDeliveryNoteNumber: dash(input.deliveryNoteNumber),
    deliveryDateDisplay: fmtDate(input.deliveryDate),
    carrierName: dash(input.carrierName),
    driverName: dash(input.driverName || input.carrierName),
    driverPhone: dash(input.driverPhone),
    vehiclePlateNumber: dash(input.vehiclePlateNumber),

    supplierName: dash(resolvedSupplierName),
    supplierAddressLines: splitLines(supplierAddressRaw),

    lineItems,
    comments: dash(input.comments),

    vendorDeliveredBy: {
      heading: 'Vendor (Delivered by)',
      name: dash(input.vendorDeliveredByName),
      position: 'Vendor Representative',
      signDate: DASH,
    },
    vendorWitnessedBy: {
      heading: 'Vendor (Witnessed by)',
      name: dash(input.vendorWitnessedByName),
      position: 'Vendor Witness',
      signDate: DASH,
    },
    emeraldReceivedBy: {
      heading: 'Emerald (Received by)',
      name: dash(input.emeraldReceivedByName),
      position: dash(input.emeraldReceivedByTitle || 'Logistics Manager'),
      signDate: fmtDate(input.dateOfReceipt),
    },
    emeraldSupervisedBy: {
      heading: 'Emerald (Supervised by)',
      name: dash(input.emeraldSupervisedByName || EMERALD_PO_APPROVER_NAME),
      position: dash(input.emeraldSupervisedByTitle || 'Director, SCM'),
      signDate: DASH,
    },
  };
}
