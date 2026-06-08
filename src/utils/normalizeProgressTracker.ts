import type { PaymentSchedule } from '@/types/payment-schedule';
import type {
  ProgressDisplayStep,
  ProgressPhaseKey,
  ProgressStepStatus,
  ProgressTrackerPhase,
  ProgressTrackerResponse,
  ProgressTrackerStep,
  ProgressTrackerViewModel,
} from '@/types/progress-tracker';
import { buildLegacyProgressViewModel, isFullAdvanceSchedule } from '@/utils/buildLegacyProgressViewModel';
import { getFinanceRoute, mrfUsesFinanceAp } from '@/utils/financeAPRouting';
import type { MRF } from '@/types';

const PHASE_ID_ALIASES: Record<string, ProgressPhaseKey> = {
  approval: 'approval',
  sourcing: 'sourcing',
  procurement: 'procurement',
  delivery: 'delivery',
  payment: 'payment',
};

function inferPhaseFromKey(key: string): ProgressPhaseKey {
  if (key.startsWith('milestone-') || key.includes('finance') || key === 'closed') return 'payment';
  if (key.includes('grn') || key.includes('delivery')) return 'delivery';
  if (key.includes('po') || key.includes('invoice') || key.includes('vendor-invoice')) return 'procurement';
  if (key.includes('rfq') || key.includes('quote') || key.includes('vendor')) return 'sourcing';
  return 'approval';
}

function toDisplayStep(step: ProgressTrackerStep, phase: ProgressPhaseKey): ProgressDisplayStep {
  const completedBy = step.completedBy
    ? { id: Number(step.completedBy.id) || 0, name: step.completedBy.name }
    : undefined;
  return {
    key: step.key,
    phase: (step.phase as ProgressPhaseKey) || phase,
    name: step.name,
    status: step.status,
    completedAt: step.completedAt ?? undefined,
    completedBy,
    remarks: step.remarks ?? undefined,
    description: step.description ?? undefined,
    meta: step.meta ?? undefined,
    isCurrent: step.status === 'pending',
  };
}

function phasesFromApi(phases: ProgressTrackerPhase[]): ProgressTrackerViewModel['phases'] {
  return phases
    .map((p) => {
      const id = (PHASE_ID_ALIASES[p.id] ?? p.id) as ProgressPhaseKey;
      const steps = (p.steps ?? []).map((s) => toDisplayStep(s, id));
      return {
        id,
        label: p.label,
        steps,
        completedSteps: p.completedSteps ?? steps.filter((s) => s.status === 'completed').length,
        totalSteps: p.totalSteps ?? steps.length,
      };
    })
    .filter((p) => p.totalSteps > 0);
}

/**
 * Item 4 — "Delivery Documents Uploaded" must only show as completed when at least one
 * of GRN / waybill / JCC / delivery_confirmation actually exists in the documents
 * registry for this MRF. Backend has historically sent `status: 'completed'` based on
 * stage timestamps alone, which produced false positives.
 *
 * This post-processor re-evaluates the delivery-docs step against `activeByType` and
 * downgrades it to `pending`/`not_started` when no delivery document is present.
 */
function enforceDeliveryDocsTruth(
  phases: ProgressTrackerViewModel['phases'],
  activeByType: any,
): ProgressTrackerViewModel['phases'] {
  const hasDeliveryDoc = Boolean(
    activeByType?.grn ||
      activeByType?.waybill ||
      activeByType?.jcc ||
      activeByType?.delivery_confirmation,
  );
  if (hasDeliveryDoc) return phases; // backend can mark complete — there's a real doc.

  return phases.map((phase) => {
    if (phase.id !== 'delivery') return phase;
    const steps = phase.steps.map((s) => {
      const looksLikeDeliveryDocs =
        /delivery[-_ ]?doc/i.test(s.key) ||
        /delivery documents uploaded/i.test(s.name);
      if (!looksLikeDeliveryDocs) return s;
      if (s.status !== 'completed') return s;
      return {
        ...s,
        status: 'pending' as ProgressStepStatus,
        completedAt: undefined,
        completedBy: undefined,
        isCurrent: true,
        remarks: 'Awaiting GRN / waybill / JCC / delivery confirmation upload.',
      };
    });
    return {
      ...phase,
      steps,
      completedSteps: steps.filter((s) => s.status === 'completed').length,
    };
  });
}

function phasesFromFlatSteps(
  steps: ProgressTrackerStep[],
  hideDelivery: boolean,
): ProgressTrackerViewModel['phases'] {
  const display = steps.map((s) => {
    const phase = (s.phase as ProgressPhaseKey) || inferPhaseFromKey(s.key);
    return toDisplayStep(s, phase);
  });

  const filtered = hideDelivery
    ? display.filter((s) => s.phase !== 'delivery')
    : display;

  const order: ProgressPhaseKey[] = [
    'approval',
    'sourcing',
    'procurement',
    'delivery',
    'payment',
  ];
  const labels: Record<string, string> = {
    approval: 'Approval',
    sourcing: 'Sourcing',
    procurement: 'Procurement',
    delivery: 'Delivery',
    payment: 'Payment',
  };

  return order
    .map((id) => {
      const phaseSteps = filtered.filter((s) => s.phase === id);
      return {
        id,
        label: labels[id] ?? id,
        steps: phaseSteps,
        completedSteps: phaseSteps.filter((s) => s.status === 'completed').length,
        totalSteps: phaseSteps.length,
      };
    })
    .filter((p) => p.totalSteps > 0);
}

function calcProgress(phases: ProgressTrackerViewModel['phases']): number {
  const all = phases.flatMap((p) => p.steps);
  if (!all.length) return 0;
  return Math.round(
    (all.filter((s) => s.status === 'completed').length / all.length) * 100,
  );
}

export interface NormalizeProgressOptions {
  contractType?: string | null;
  mrf?: MRF | null;
  propPaymentSchedule?: PaymentSchedule | null;
  propActiveByType?: ProgressTrackerResponse['activeByType'];
  propStageTimestamps?: ProgressTrackerResponse['stageTimestamps'];
}

export function normalizeProgressTracker(
  raw: Record<string, unknown> | ProgressTrackerResponse,
  options: NormalizeProgressOptions = {},
): ProgressTrackerViewModel {
  const data = raw as ProgressTrackerResponse;
  const mrfId = String(data.mrfId ?? '');
  const title = String(data.title ?? 'MRF Progress');

  const paymentSchedule =
    options.propPaymentSchedule ??
    data.paymentSchedule ??
    data.payment_schedule ??
    null;

  const activeByType = options.propActiveByType ?? data.activeByType;
  const stageTimestamps = {
    ...(data.stageTimestamps ?? {}),
    ...(options.propStageTimestamps ?? {}),
  };

  const hideDeliveryPhase =
    data.meta?.hideDeliveryPhase ?? isFullAdvanceSchedule(paymentSchedule);

  const usesFinanceAp =
    data.usesFinanceAp ?? (options.mrf ? mrfUsesFinanceAp(options.mrf) : false);
  const financeRoute =
    data.financeRoute ?? (options.mrf ? getFinanceRoute(options.mrf) : undefined);

  if (data.phases?.length) {
    let phases = phasesFromApi(data.phases);
    if (hideDeliveryPhase) {
      phases = phases.filter((p) => p.id !== 'delivery');
    }
    phases = enforceDeliveryDocsTruth(phases, activeByType);
    const progressPercent =
      data.meta?.progressPercent ?? calcProgress(phases);
    return {
      mrfId,
      title,
      phases,
      progressPercent,
      hideDeliveryPhase,
      usesFinanceAp,
      financeRoute,
      paymentSchedule,
      activeByType,
      stageTimestamps,
      source: 'api_phases',
    };
  }

  if (data.steps?.length && data.steps.some((s) => s.key)) {
    let phases = phasesFromFlatSteps(data.steps, hideDeliveryPhase);
    phases = enforceDeliveryDocsTruth(phases, activeByType);
    return {
      mrfId,
      title,
      phases,
      progressPercent: data.meta?.progressPercent ?? calcProgress(phases),
      hideDeliveryPhase,
      usesFinanceAp,
      financeRoute,
      paymentSchedule,
      activeByType,
      stageTimestamps,
      source: 'api_steps',
    };
  }

  const legacySteps = (data.steps ?? []) as Array<{
    step: number;
    name: string;
    status: ProgressStepStatus;
    completedAt?: string;
    completedBy?: { id: number; name: string };
    remarks?: string;
  }>;

  return buildLegacyProgressViewModel({
    mrfId,
    title,
    backendSteps: legacySteps.filter((s) => typeof s.step === 'number') as Parameters<
      typeof buildLegacyProgressViewModel
    >[0]['backendSteps'],
    contractType: options.contractType,
    stageTimestamps,
    paymentSchedule,
    activeByType,
    usesFinanceAp,
    financeRoute,
    hideDeliveryPhase,
  });
}
