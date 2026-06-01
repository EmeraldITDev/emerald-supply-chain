/**
 * Phase 3 — Workflow gates response for Finance AP MRFs.
 * Source: GET /api/mrfs/{id}/workflow-gates
 *
 * Legacy (non Finance AP) MRFs may receive `usesFinanceAp: false` with the
 * remaining fields populated as no-ops; consumers should treat them as
 * non-restrictive (canSubmit=true, required=false, canClose=true).
 */

import type { ProcurementDocumentType } from './procurement-documents';

export type VendorInvoiceGateType = 'advance' | 'delivery' | (string & {});

export interface VendorInvoiceGate {
  canSubmit: boolean;
  gateType?: VendorInvoiceGateType | null;
  reason?: string | null;
}

export interface DeliveryConfirmationGate {
  required: boolean;
  satisfied: boolean;
  requiredDocuments?: ProcurementDocumentType[];
  missingDocuments?: ProcurementDocumentType[];
}

export interface MilestoneClosureStatus {
  milestoneNumber: number;
  label: string;
  percentage: number;
  amount?: number | string | null;
  status?: string;
  paid?: boolean;
  invoiceReceived?: boolean;
  documentsSatisfied?: boolean;
  missingDocuments?: ProcurementDocumentType[];
}

export interface ClosureReadiness {
  canClose: boolean;
  blockers?: string[];
  milestoneSummary?: MilestoneClosureStatus[];
}

export interface WorkflowGatesResponse {
  usesFinanceAp: boolean;
  workflowState: string;
  vendorInvoiceGate: VendorInvoiceGate;
  deliveryConfirmation: DeliveryConfirmationGate;
  closureReadiness: ClosureReadiness;
}