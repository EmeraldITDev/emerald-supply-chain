import type { PaymentSchedule, PaymentMilestone } from '@/types/payment-schedule';
import type { ProcurementDocumentsResponse } from '@/types/procurement-documents';
import type {
  ProgressDisplayStep,
  ProgressPhaseKey,
  ProgressTrackerStageTimestamps,
  ProgressTrackerViewModel,
  ProgressStepStatus,
} from '@/types/progress-tracker';

const PHASE_LABELS: Record<string, string> = {
  approval: 'Approval',
  sourcing: 'Sourcing',
  procurement: 'Procurement',
  delivery: 'Delivery',
  payment: 'Payment',
};

export const isFullAdvanceSchedule = (schedule?: PaymentSchedule | null): boolean => {
  if (!schedule?.milestones?.length) return false;
  if (schedule.milestones.length !== 1) return false;
  const m = schedule.milestones[0];
  const pct = typeof m.percentage === 'string' ? Number(m.percentage) : m.percentage;
  return pct === 100 && m.triggerCondition === 'on_advance';
};

const formatDurationMs = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) {
    const mins = totalMinutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
};

const formatNaira = (val: number | string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '-';
  const n = typeof val === 'string' ? Number(val) : val;
  if (!Number.isFinite(n)) return '-';
  return `₦${n.toLocaleString()}`;
};

interface LegacyBackendStep {
  step: number;
  name: string;
  status: ProgressStepStatus;
  completedAt?: string;
  completedBy?: { id: number; name: string };
  remarks?: string;
}

export interface BuildLegacyProgressInput {
  mrfId: string;
  title: string;
  backendSteps: LegacyBackendStep[];
  contractType?: string | null;
  stageTimestamps?: ProgressTrackerStageTimestamps;
  paymentSchedule?: PaymentSchedule | null;
  activeByType?: ProcurementDocumentsResponse['activeByType'];
  usesFinanceAp?: boolean;
  financeRoute?: 'legacy_internal' | 'finance_ap';
  hideDeliveryPhase?: boolean;
}

export function buildLegacyProgressViewModel(
  input: BuildLegacyProgressInput,
): ProgressTrackerViewModel {
  const {
    mrfId,
    title,
    backendSteps,
    contractType,
    stageTimestamps = {},
    paymentSchedule = null,
    activeByType,
    usesFinanceAp = false,
    financeRoute,
  } = input;

  const isEmeraldContract = (contractType || '').toLowerCase().includes('emerald');
  const stepByNum = new Map(backendSteps.map((s) => [s.step, s]));
  const initialApprovalTs = isEmeraldContract
    ? stageTimestamps.executive_approved_at
    : stageTimestamps.director_approved_at ?? stageTimestamps.initial_approval_at;

  const createdAt =
    stageTimestamps.mrf_created_at ?? stageTimestamps.created_at;

  const durationBetween = (start?: string, end?: string, status?: string): string => {
    if (status === 'completed' && start && end) {
      const t = formatDurationMs(new Date(end).getTime() - new Date(start).getTime());
      return t ? `Took: ${t}` : '';
    }
    if (status === 'pending' && start) {
      const t = formatDurationMs(Date.now() - new Date(start).getTime());
      return t ? `Elapsed: ${t}` : '';
    }
    return '';
  };

  const fromBackend = (
    stepNum: number,
    phase: ProgressPhaseKey,
    overrideName?: string,
    duration?: string,
  ): ProgressDisplayStep | null => {
    const s = stepByNum.get(stepNum);
    if (!s) return null;
    return {
      key: `b-${stepNum}`,
      phase,
      name: overrideName ?? s.name,
      status: s.status,
      completedAt: s.completedAt,
      completedBy: s.completedBy,
      remarks: s.remarks,
      durationText: duration,
      isCurrent: s.status === 'pending',
    };
  };

  const steps: ProgressDisplayStep[] = [];

  const s1 = fromBackend(1, 'approval');
  if (s1) steps.push(s1);
  const s2 = fromBackend(
    2,
    'approval',
    isEmeraldContract ? 'Executive Approval (Initial)' : 'Supply Chain Director Approval (Initial)',
    durationBetween(createdAt, initialApprovalTs, stepByNum.get(2)?.status),
  );
  if (s2) steps.push(s2);
  const s3 = fromBackend(
    3,
    'approval',
    'Procurement Review',
    durationBetween(
      initialApprovalTs,
      stageTimestamps.procurement_review_at ?? stageTimestamps.procurement_review_started_at,
      stepByNum.get(3)?.status,
    ),
  );
  if (s3) steps.push(s3);

  const s4 = fromBackend(4, 'sourcing', 'RFQ Issued');
  if (s4) steps.push(s4);
  const s5 = fromBackend(5, 'sourcing', 'Quotes Received');
  if (s5) steps.push(s5);
  const s6 = fromBackend(6, 'sourcing', 'Vendor Selection Approved');
  if (s6) steps.push(s6);

  const invoiceDoc = activeByType?.vendor_invoice;
  const invoiceTs = stageTimestamps.vendor_invoice_submitted_at;
  const invoiceStatus: ProgressStepStatus = invoiceDoc
    ? 'completed'
    : stepByNum.get(7)?.status === 'pending'
      ? 'pending'
      : 'not_started';
  steps.push({
    key: 'vendor-invoice',
    phase: 'procurement',
    name: 'Vendor Final Invoice Submitted',
    status: invoiceStatus,
    completedAt: invoiceTs ?? (invoiceDoc ? invoiceDoc.uploadedAt : undefined),
    completedBy: invoiceDoc?.uploadedBy
      ? { id: Number(invoiceDoc.uploadedBy.id) || 0, name: invoiceDoc.uploadedBy.name }
      : undefined,
    isCurrent: invoiceStatus === 'pending',
  });

  const s7Backend = fromBackend(7, 'procurement', 'PO Generated');
  if (s7Backend) steps.push(s7Backend);

  const signedPoDoc = activeByType?.signed_po;
  const s8Backend = stepByNum.get(8);
  const poSignedStatus: ProgressStepStatus = signedPoDoc
    ? 'completed'
    : (s8Backend?.status as ProgressStepStatus) ?? 'not_started';
  steps.push({
    key: 'po-signed',
    phase: 'procurement',
    name: 'PO Signed by SCD',
    status: poSignedStatus,
    completedAt:
      stageTimestamps.po_signed_at ?? s8Backend?.completedAt ?? signedPoDoc?.uploadedAt,
    completedBy: s8Backend?.completedBy,
    remarks: s8Backend?.remarks,
    isCurrent: poSignedStatus === 'pending',
  });

  const hideDelivery =
    input.hideDeliveryPhase ?? isFullAdvanceSchedule(paymentSchedule);
  if (!hideDelivery) {
    const grnDoc = activeByType?.grn;
    const grnStatus: ProgressStepStatus = grnDoc
      ? 'completed'
      : poSignedStatus === 'completed'
        ? 'pending'
        : 'not_started';
    steps.push({
      key: 'grn',
      phase: 'delivery',
      name: 'GRN / Goods Received',
      status: grnStatus,
      completedAt: stageTimestamps.grn_generated_at ?? grnDoc?.uploadedAt,
      completedBy: grnDoc?.uploadedBy
        ? { id: Number(grnDoc.uploadedBy.id) || 0, name: grnDoc.uploadedBy.name }
        : undefined,
      isCurrent: grnStatus === 'pending',
    });

    const deliveryDoc =
      activeByType?.waybill || activeByType?.jcc || activeByType?.delivery_confirmation;
    const deliveryStatus: ProgressStepStatus = deliveryDoc
      ? 'completed'
      : grnStatus === 'completed'
        ? 'pending'
        : 'not_started';
    steps.push({
      key: 'delivery-docs',
      phase: 'delivery',
      name: 'Delivery Documents Uploaded',
      status: deliveryStatus,
      completedAt: stageTimestamps.delivery_docs_uploaded_at ?? deliveryDoc?.uploadedAt,
      completedBy: deliveryDoc?.uploadedBy
        ? { id: Number(deliveryDoc.uploadedBy.id) || 0, name: deliveryDoc.uploadedBy.name }
        : undefined,
      isCurrent: deliveryStatus === 'pending',
    });
  }

  const financeReviewTs = stageTimestamps.finance_reviewed_at;
  const upstreamComplete = steps.every((s) => s.status === 'completed');
  const financeStatus: ProgressStepStatus = financeReviewTs
    ? 'completed'
    : upstreamComplete
      ? 'pending'
      : 'not_started';
  steps.push({
    key: 'finance-review',
    phase: 'payment',
    name: 'Finance Review',
    status: financeStatus,
    completedAt: financeReviewTs,
    isCurrent: financeStatus === 'pending',
  });

  const milestones: PaymentMilestone[] = paymentSchedule?.milestones ?? [];
  if (milestones.length > 0) {
    milestones.forEach((m, idx) => {
      const status: ProgressStepStatus =
        m.status === 'paid' ? 'completed' : m.status === 'eligible' ? 'pending' : 'not_started';
      steps.push({
        key: `milestone-${m.id ?? idx}`,
        phase: 'payment',
        name: m.label || `Milestone ${m.milestoneNumber}`,
        status,
        meta: `${formatNaira(m.amount ?? null)} • ${m.percentage}%`,
        isCurrent: status === 'pending',
      });
    });
  } else if (!usesFinanceAp) {
    steps.push({
      key: 'payment-chairman',
      phase: 'payment',
      name: 'Chairman Payment Approval',
      status: stageTimestamps.payment_approved_at
        ? 'completed'
        : financeStatus === 'completed'
          ? 'pending'
          : 'not_started',
      completedAt: stageTimestamps.payment_approved_at,
    });
    steps.push({
      key: 'payment-generic',
      phase: 'payment',
      name: 'Payment Processed',
      status: stageTimestamps.payment_completed_at ? 'completed' : 'not_started',
      completedAt: stageTimestamps.payment_completed_at,
    });
  } else {
    steps.push({
      key: 'payment-generic',
      phase: 'payment',
      name: 'Payment',
      status: stageTimestamps.payment_completed_at ? 'completed' : 'not_started',
      completedAt: stageTimestamps.payment_completed_at,
    });
  }

  const closedAt = stageTimestamps.closed_at ?? stageTimestamps.payment_completed_at;
  steps.push({
    key: 'closed',
    phase: 'payment',
    name: 'Fully Paid / Closed',
    status: closedAt ? 'completed' : 'not_started',
    completedAt: closedAt,
  });

  const phaseOrder: ProgressPhaseKey[] = [
    'approval',
    'sourcing',
    'procurement',
    'delivery',
    'payment',
  ];
  const grouped = phaseOrder.map((id) => {
    const phaseSteps = steps.filter((s) => s.phase === id);
    return {
      id,
      label: PHASE_LABELS[id] ?? id,
      steps: phaseSteps,
      completedSteps: phaseSteps.filter((s) => s.status === 'completed').length,
      totalSteps: phaseSteps.length,
    };
  }).filter((p) => p.totalSteps > 0);

  const totalCount = steps.length;
  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const progressPercent = totalCount ? Math.round((completedSteps / totalCount) * 100) : 0;

  return {
    mrfId,
    title,
    phases: grouped,
    progressPercent,
    hideDeliveryPhase: hideDelivery,
    usesFinanceAp,
    financeRoute,
    paymentSchedule,
    activeByType,
    stageTimestamps,
    source: 'legacy',
  };
}
