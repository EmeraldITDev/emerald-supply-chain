import { format } from 'date-fns';
import { EMERALD_COMPANY, EMERALD_PO_APPROVER_NAME } from '@/utils/emeraldPoDocumentModel';
import type { JCC, JCCLineItem, Trip } from '@/types/logistics';

const DASH = '—';

export interface JccDisplayLineItem {
  sn: number;
  description: string;
  trip: string;
  durationDate: string;
  remarks: string;
}

export interface JccSignatoryBlock {
  heading: string;
  name: string;
  position: string;
  signDate: string;
  signatureDataUrl?: string | null;
}

export interface JccDisplayModel {
  // Header (Emerald)
  companyName: string;
  companyAddressLines: string[];
  companyEmail: string;
  companyWebsite: string;

  // Metadata
  referenceNumber: string;
  dateIssuedDisplay: string;

  // Recipient (vendor)
  vendorName: string;
  vendorAddressLines: string[];

  // Linked records
  tripReference: string;
  poNumber: string;

  // Body
  title: string;
  salutation: string;
  certificationStatement: string;
  lineItems: JccDisplayLineItem[];
  closing: string;

  // Signatures
  vendorSignatory: JccSignatoryBlock;
  emeraldSignatory: JccSignatoryBlock;
}

function dash(v?: string | null): string {
  const s = (v ?? '').toString().trim();
  return s || DASH;
}

function fmtDate(input?: string | Date | null, pattern = 'do MMMM, yyyy'): string {
  if (!input) return DASH;
  const d = typeof input === 'string' ? new Date(input) : input;
  if (!d || Number.isNaN(d.getTime())) return dash(typeof input === 'string' ? input : '');
  return format(d, pattern);
}

function vendorAddressLinesFromTrip(trip?: Trip | null): string[] {
  // Trip does not carry vendor address; leave blank for layout (consumer can override).
  if (!trip?.vendorName) return [];
  return [];
}

export function buildJccDisplayModel(input: {
  trip?: Trip | null;
  jcc?: Partial<JCC> | null;
  /** Override line items when the dialog has unsaved edits. */
  lineItems?: JCCLineItem[];
  /** Override the certification statement when editing. */
  certificationStatement?: string;
  /** Override the reference number when editing. */
  referenceNumber?: string;
  /** Override the issue date when editing (ISO date). */
  dateIssued?: string;
  /** Optional explicit vendor address (multi-line). */
  vendorAddress?: string;
  /** Optional Emerald signatory override (defaults to SCD Viva Musa). */
  emeraldSignatoryName?: string;
  emeraldSignatoryTitle?: string;
  emeraldSignatureDataUrl?: string | null;
}): JccDisplayModel {
  const trip = input.trip ?? null;
  const jcc = input.jcc ?? null;

  const rawItems = (input.lineItems ?? (jcc?.lineItems as JCCLineItem[] | undefined) ?? []).filter(
    (r) => r && (r.description?.trim() || r.trip?.trim() || r.durationDate?.trim() || r.remarks?.trim()),
  );

  const lineItems: JccDisplayLineItem[] = rawItems.map((r, i) => ({
    sn: i + 1,
    description: dash(r.description),
    trip: dash(r.trip),
    durationDate: dash(r.durationDate),
    remarks: dash(r.remarks),
  }));

  const vendorAddrRaw = (input.vendorAddress || jcc?.vendorAddress || '').trim();
  const vendorAddressLines = vendorAddrRaw
    ? vendorAddrRaw.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    : vendorAddressLinesFromTrip(trip);

  const tripAny = trip as (Trip & { poNumber?: string; po_number?: string }) | null;
  const poNumber = dash(tripAny?.poNumber || tripAny?.po_number);

  const emeraldName = input.emeraldSignatoryName?.trim() || EMERALD_PO_APPROVER_NAME;
  const emeraldTitle = input.emeraldSignatoryTitle?.trim() || 'Director, Supply Chain Management';

  return {
    companyName: EMERALD_COMPANY.name,
    companyAddressLines: [...EMERALD_COMPANY.addressLines],
    companyEmail: EMERALD_COMPANY.email,
    companyWebsite: EMERALD_COMPANY.website,

    referenceNumber: dash(input.referenceNumber || jcc?.referenceNumber),
    dateIssuedDisplay: fmtDate(input.dateIssued || jcc?.dateIssued || undefined),

    vendorName: dash(jcc?.vendorName || trip?.vendorName),
    vendorAddressLines,

    tripReference: dash(trip?.tripNumber),
    poNumber,

    title: 'JOB COMPLETION CERTIFICATE – VEHICLE SERVICES',
    salutation: 'Dear Sir,',
    certificationStatement: dash(input.certificationStatement || jcc?.certificationStatement),
    lineItems,
    closing: 'Regards.',

    vendorSignatory: {
      heading: 'Vendor (Acknowledged by)',
      name: dash(jcc?.vendorName || trip?.vendorName),
      position: 'Authorised Representative',
      signDate: DASH,
    },
    emeraldSignatory: {
      heading: 'Emerald (Approved by)',
      name: emeraldName,
      position: emeraldTitle,
      signDate: fmtDate(input.dateIssued || jcc?.dateIssued || undefined, 'dd/MM/yyyy'),
      signatureDataUrl: input.emeraldSignatureDataUrl ?? null,
    },
  };
}
