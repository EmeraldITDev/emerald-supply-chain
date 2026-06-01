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
  /** Phase 2: grouped views (active + history) by document type. */
  documentsByType?: Partial<Record<ProcurementDocumentType, ProcurementDocument[]>>;
  activeByType?: Partial<Record<ProcurementDocumentType, ProcurementDocument>>;
}

export interface GetProcurementDocumentsParams {
  type?: ProcurementDocumentType;
  includeInactive?: boolean;
}

/** Phase 2: upload a supporting procurement document (waybill, JCC, PFI, …). */
export interface UploadProcurementDocumentPayload {
  type: ProcurementDocumentType;
  file: File;
}

/** Phase 2: per-line override sent with preview/generate. */
export interface GRNLineItemOverride {
  index: number;
  quantityReceived: number;
}

/** Phase 2: GRN preview / generate request payloads. */
export interface GRNPreviewParams {
  /** Legacy aliases retained for backwards compat. */
  remarks?: string;
  grnNumber?: string;
  receivedAt?: string;
  // Delivery / supplier metadata
  dateOfReceipt?: string;
  deliveryNoteNumber?: string;
  deliveryDate?: string;
  carrierName?: string;
  driverNumber?: string;
  vehiclePlateNumber?: string;
  comments?: string;
  lineItems?: GRNLineItemOverride[];
}

export interface GRNGeneratePayload extends GRNPreviewParams {
  confirm?: boolean; // defaults to true server-side
}

export interface GRNGenerateResponse {
  document: ProcurementDocument;
  mrfGrnUrl?: string;
}