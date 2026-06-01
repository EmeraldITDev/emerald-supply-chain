import type { PaymentSchedule } from '@/types/payment-schedule';
import type { ProcurementDocumentsResponse } from '@/types/procurement-documents';

export type ProgressStepStatus = 'completed' | 'pending' | 'not_started';

export interface ProgressTrackerStepActor {
  id: number | string;
  name: string;
}

export interface ProgressTrackerStep {
  key: string;
  name: string;
  status: ProgressStepStatus;
  completedAt?: string | null;
  description?: string | null;
  completedBy?: ProgressTrackerStepActor | null;
  remarks?: string | null;
  meta?: string | null;
  phase?: string;
  /** Legacy numbered API */
  step?: number;
}

export interface ProgressTrackerPhase {
  id: string;
  label: string;
  steps: ProgressTrackerStep[];
  completedSteps: number;
  totalSteps: number;
}

export interface ProgressTrackerStageTimestamps {
  mrf_created_at?: string;
  initial_approval_at?: string;
  procurement_review_at?: string;
  rfq_issued_at?: string;
  quotes_received_at?: string;
  vendor_selection_approved_at?: string;
  vendor_invoice_submitted_at?: string;
  po_generated_at?: string;
  po_signed_at?: string;
  grn_generated_at?: string;
  delivery_docs_uploaded_at?: string;
  finance_reviewed_at?: string;
  payment_completed_at?: string;
  closed_at?: string;
  created_at?: string;
  executive_approved_at?: string;
  director_approved_at?: string;
  procurement_review_started_at?: string;
  grn_completed_at?: string;
  payment_approved_at?: string;
  updated_at?: string;
}

export interface ProgressTrackerMeta {
  hideDeliveryPhase?: boolean;
  progressPercent?: number;
}

export interface ProgressTrackerResponse {
  mrfId: string;
  title: string;
  currentStep?: number;
  phases?: ProgressTrackerPhase[];
  steps?: ProgressTrackerStep[];
  meta?: ProgressTrackerMeta;
  stageTimestamps?: ProgressTrackerStageTimestamps;
  paymentSchedule?: PaymentSchedule | null;
  payment_schedule?: PaymentSchedule | null;
  documentsByType?: ProcurementDocumentsResponse['documentsByType'];
  activeByType?: ProcurementDocumentsResponse['activeByType'];
  usesFinanceAp?: boolean;
  financeRoute?: 'legacy_internal' | 'finance_ap';
}

export type ProgressPhaseKey =
  | 'approval'
  | 'sourcing'
  | 'procurement'
  | 'delivery'
  | 'payment'
  | (string & {});

export interface ProgressDisplayStep {
  key: string;
  phase: ProgressPhaseKey;
  name: string;
  status: ProgressStepStatus;
  completedAt?: string;
  completedBy?: { id: number; name: string };
  remarks?: string;
  description?: string;
  durationText?: string;
  meta?: string;
  isCurrent?: boolean;
}

export interface ProgressTrackerViewModel {
  mrfId: string;
  title: string;
  phases: Array<{
    id: ProgressPhaseKey;
    label: string;
    steps: ProgressDisplayStep[];
    completedSteps: number;
    totalSteps: number;
  }>;
  progressPercent: number;
  hideDeliveryPhase: boolean;
  usesFinanceAp: boolean;
  financeRoute?: 'legacy_internal' | 'finance_ap';
  paymentSchedule: PaymentSchedule | null;
  activeByType?: ProcurementDocumentsResponse['activeByType'];
  stageTimestamps: ProgressTrackerStageTimestamps;
  source: 'api_phases' | 'api_steps' | 'legacy';
}
