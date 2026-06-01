/**
 * Phase 5 — Delivery Confirmation panel response.
 * Source: GET /api/mrfs/{id}/delivery-confirmation
 */
import type { ProcurementDocument, ProcurementDocumentType } from './procurement-documents';

export type DeliveryChecklistAction =
  | 'generate_grn'
  | 'upload_grn'
  | 'upload_waybill'
  | 'upload_jcc'
  | 'upload_delivery_confirmation'
  | 'upload_other'
  | (string & {});

export interface DeliveryChecklistItem {
  type: ProcurementDocumentType;
  label: string;
  required: boolean;
  satisfied: boolean;
  document?: ProcurementDocument | null;
  actions?: DeliveryChecklistAction[];
}

export interface DeliveryMilestoneContext {
  milestoneNumber?: number;
  label?: string;
  percentage?: number | string | null;
  amount?: number | string | null;
  status?: string;
}

export interface DeliveryConfirmationPermissions {
  canManageDeliveryConfirmation?: boolean;
  canGenerateGRN?: boolean;
  canUploadGRN?: boolean;
  canUploadWaybill?: boolean;
  canUploadJcc?: boolean;
  canUploadDeliveryConfirmation?: boolean;
  canUploadOther?: boolean;
}

export interface DeliveryConfirmationResponse {
  showPanel: boolean;
  required: boolean;
  satisfied: boolean;
  workflowState?: string;
  currentMilestone?: DeliveryMilestoneContext | null;
  checklist?: DeliveryChecklistItem[];
  missingDocuments?: ProcurementDocumentType[];
  uploadedDocuments?: ProcurementDocumentType[];
  permissions?: DeliveryConfirmationPermissions;
  refreshHint?: string | null;
}