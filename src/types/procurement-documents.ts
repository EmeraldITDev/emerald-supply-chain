/**
 * Types for the `procurement-documents` endpoint introduced in Phase 0 of the
 * Finance AP work. Used to correlate uploaded artefacts (POs, GRNs, invoices,
 * waybills, JCC, PFI, etc.) with an MRF / SCM transaction.
 *
 * These types are intentionally additive — no UI consumes them yet.
 */

export type ProcurementDocumentType =
  | 'vendor_invoice'
  | 'grn'
  | 'waybill'
  | 'jcc'
  | 'pfi'
  | 'po_pdf'
  | 'signed_po'
  | 'delivery_confirmation'
  | 'other';

export interface ProcurementDocumentUploader {
  id: number | string;
  name: string;
}

export interface ProcurementDocument {
  id: number | string;
  mrfId: number | string;
  vendorId?: number | string | null;
  type: ProcurementDocumentType;
  fileName: string;
  filePath: string;
  fileUrl: string;
  uploadedBy: ProcurementDocumentUploader;
  uploadedAt: string;
  version: number;
  isActive: boolean;
}

export interface ProcurementDocumentsResponse {
  mrfId: string;
  scmTransactionId?: string | null;
  documents: ProcurementDocument[];
}

export interface GetProcurementDocumentsParams {
  type?: ProcurementDocumentType;
  includeInactive?: boolean;
}