import type { MRF } from '@/types';
import type { FinanceDashboardRouting, FinanceMRFRow } from '@/types/index';

export interface FinanceDashboardLegacyStats {
  pendingInternal?: number;
  chairmanPayment?: number;
  totalPendingAmount?: number;
}

export interface FinanceDashboardFinanceApStats {
  handoff?: number;
  inReview?: number;
  packagePushed?: number;
}

/** Flat stats kept for backward compatibility with older API payloads */
export interface FinanceDashboardLegacyFlatStats {
  totalFinanceMRFs?: number;
  pendingPayments?: number;
  processedPayments?: number;
  approvedPayments?: number;
  totalPendingAmount?: number;
  totalProcessedAmount?: number;
  totalApprovedAmount?: number;
}

export interface FinanceDashboardStats extends FinanceDashboardLegacyFlatStats {
  legacy?: FinanceDashboardLegacyStats;
  financeAp?: FinanceDashboardFinanceApStats;
}

export interface FinanceDashboardData {
  routing: FinanceDashboardRouting;
  financeMRFs: FinanceMRFRow[];
  legacyFinanceMRFs: FinanceMRFRow[];
  financeApMRFs: FinanceMRFRow[];
  stats: FinanceDashboardStats;
}

export type FinanceDashboardListKey = 'all' | 'legacy' | 'finance_ap';

export function getMrfFromFinanceRow(row: FinanceMRFRow | Record<string, unknown>): MRF {
  const r = row as FinanceMRFRow & { quotation?: unknown; vendor?: unknown };
  if (r.mrf && typeof r.mrf === 'object') return r.mrf;
  return row as unknown as MRF;
}
