import type { DashboardKPIs } from '@/types';

export interface ProcurementOverviewContext {
  readOnly: boolean;
  isProcurementOverviewOnly: boolean;
  canManageProcurement: boolean;
}

export interface ProcurementManagerDashboardPayload extends ProcurementOverviewContext {
  kpis?: DashboardKPIs;
  [key: string]: unknown;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeKpis(raw: Record<string, unknown> | undefined): DashboardKPIs | undefined {
  if (!raw) return undefined;
  const k = (raw.kpis as Record<string, unknown>) ?? raw;
  return {
    totalPosGenerated: num(k.totalPosGenerated ?? k.total_pos_generated),
    totalMrfsApproved: num(k.totalMrfsApproved ?? k.total_mrfs_approved),
    totalSrfsApproved: num(k.totalSrfsApproved ?? k.total_srfs_approved),
    priceComparisonCount: num(k.priceComparisonCount ?? k.price_comparison_count),
  };
}

export function normalizeProcurementManagerDashboard(
  data: unknown,
): ProcurementManagerDashboardPayload {
  const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const readOnly = Boolean(raw.readOnly ?? raw.read_only);
  const isProcurementOverviewOnly = Boolean(
    raw.isProcurementOverviewOnly ?? raw.is_procurement_overview_only,
  );
  const canManageProcurement = Boolean(
    raw.canManageProcurement ?? raw.can_manage_procurement ?? !readOnly,
  );
  const kpis = normalizeKpis(raw);
  return {
    ...raw,
    readOnly,
    isProcurementOverviewOnly,
    canManageProcurement,
    kpis,
  };
}
