/**
 * Payment schedule types — Phase 1 of the Finance AP rollout.
 *
 * A schedule is a sequence of milestones (e.g. 70% advance / 30% on delivery).
 * Schedules are created from a template or freeform list and lock once the PO
 * is generated. The backend renders milestones onto the generated PO PDF and
 * Finance AP uses them to drive payment runs.
 */

export type PaymentTriggerCondition =
  | 'on_advance'
  | 'upon_delivery'
  | 'on_grn'
  | 'on_invoice'
  | 'on_completion'
  | (string & {});

export type PaymentMilestoneStatus =
  | 'pending'
  | 'eligible'
  | 'paid'
  | 'cancelled'
  | (string & {});

/** Milestone shape as it appears inside a template definition. */
export interface PaymentMilestoneTemplate {
  milestone_number: number;
  label: string;
  percentage: number;
  trigger_condition: PaymentTriggerCondition;
  required_documents?: string[];
}

export interface PaymentTermTemplate {
  key: string;
  name: string;
  milestones: PaymentMilestoneTemplate[];
}

/** A live milestone on an MRF's schedule (post create / hydrated by backend). */
export interface PaymentMilestone {
  id?: number | string;
  milestoneNumber: number;
  label: string;
  percentage: number;
  amount?: number | string | null;
  triggerCondition: PaymentTriggerCondition;
  triggerLabel?: string;
  requiredDocuments?: string[];
  status?: PaymentMilestoneStatus;
}

export interface PaymentSchedule {
  id: number | string;
  templateKey?: string | null;
  templateName?: string | null;
  version: number;
  isLocked: boolean;
  lockedAt?: string | null;
  summary?: string | null;
  milestones: PaymentMilestone[];
  createdAt?: string;
  updatedAt?: string;
}

/** Input for creating a schedule via the structured custom path. */
export interface PaymentScheduleCustomMilestoneInput {
  milestoneNumber: number;
  label: string;
  percentage: number;
  triggerCondition: PaymentTriggerCondition;
  requiredDocuments?: string[];
}

/** POST/PUT payload — either templateKey or milestones must be present. */
export type CreatePaymentSchedulePayload =
  | { templateKey: string; milestones?: never }
  | { templateKey?: never; milestones: PaymentScheduleCustomMilestoneInput[] };

/** Helper: sum of percentages on a custom milestone list. */
export function sumMilestonePercentages(
  milestones: Array<{ percentage: number | string }>,
): number {
  return milestones.reduce((acc, m) => {
    const n = typeof m.percentage === 'string' ? Number(m.percentage) : m.percentage;
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** Build a one-line summary string from milestones (UI fallback). */
export function formatScheduleSummary(milestones: PaymentMilestone[]): string {
  if (!milestones?.length) return '';
  return milestones
    .map((m) => `${m.percentage}% ${m.triggerLabel || m.label || m.triggerCondition}`)
    .join(' / ');
}