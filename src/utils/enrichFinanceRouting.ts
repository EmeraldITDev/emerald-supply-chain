import type { AvailableActions, MRF } from '@/types';
import type { FinanceDashboardData, FinanceMRFRow } from '@/types/finance-dashboard';
import { getDisplayId } from '@/utils/displayId';
import {
  getFinanceAPCutoverDate,
  getFinanceRoute,
  getFinanceRoutingDescription,
  isFinanceAPRoutingConfigured,
  mrfUsesFinanceAp,
} from '@/utils/financeAPRouting';

const FINANCE_SYNC_ROLES = new Set([
  'finance',
  'finance_officer',
  'admin',
  'procurement',
  'procurement_manager',
  'supply_chain_director',
  'supply_chain',
]);

export function buildFinanceSyncPath(mrf: MRF): string {
  return `/procurement?mrf=${encodeURIComponent(getDisplayId(mrf))}`;
}

/** Normalize a dashboard row; fills routing fields when the API omits them. */
export function enrichFinanceMrfRow(
  row: FinanceMRFRow | Record<string, unknown>,
): FinanceMRFRow {
  const raw = row as FinanceMRFRow & { quotation?: unknown; vendor?: unknown };
  const mrf = (raw.mrf && typeof raw.mrf === 'object' ? raw.mrf : raw) as MRF;
  const usesFinanceAp = raw.usesFinanceAp ?? mrfUsesFinanceAp(mrf);
  const financeRoute = raw.financeRoute ?? getFinanceRoute(mrf);

  return {
    ...raw,
    mrf,
    usesFinanceAp,
    financeRoute,
    workflowState:
      raw.workflowState ??
      (mrf.workflow_state as string | undefined) ??
      (mrf.workflowState as string | undefined),
    financeApCaseId: raw.financeApCaseId ?? (mrf as MRF & { finance_ap_case_id?: string }).finance_ap_case_id,
    financeApStatus: raw.financeApStatus ?? (mrf as MRF & { finance_ap_status?: string }).finance_ap_status,
    canProcessPaymentInternal: raw.canProcessPaymentInternal ?? !usesFinanceAp,
    financeSyncPath: raw.financeSyncPath ?? (usesFinanceAp ? buildFinanceSyncPath(mrf) : undefined),
  };
}

export function enrichAvailableActions(
  actions: AvailableActions,
  mrf: MRF,
  userRole?: string | null,
): AvailableActions {
  const cutoverDate =
    actions.cutoverDate !== undefined ? actions.cutoverDate : getFinanceAPCutoverDate();
  const usesFinanceAp = actions.usesFinanceAp ?? mrfUsesFinanceAp(mrf);
  const financeRoute = actions.financeRoute ?? getFinanceRoute(mrf);

  const canProcessPayment = usesFinanceAp
    ? false
    : actions.canProcessPayment;

  const role = userRole ?? '';
  const canViewFinanceSync =
    actions.canViewFinanceSync ??
    (usesFinanceAp && FINANCE_SYNC_ROLES.has(role));

  const availableActions = [...(actions.availableActions ?? [])];
  if (canViewFinanceSync && !availableActions.includes('view_finance_sync')) {
    availableActions.push('view_finance_sync');
  }
  if (usesFinanceAp) {
    const idx = availableActions.indexOf('process_payment');
    if (idx >= 0) availableActions.splice(idx, 1);
  }

  return {
    ...actions,
    cutoverDate,
    usesFinanceAp,
    financeRoute,
    canProcessPayment,
    canViewFinanceSync,
    availableActions,
  };
}

function buildRoutingFromApi(
  routing?: Partial<FinanceDashboardData['routing']> | null,
): FinanceDashboardData['routing'] {
  const cutoverDate =
    routing?.cutoverDate !== undefined ? routing.cutoverDate : getFinanceAPCutoverDate();
  return {
    cutoverDate,
    routingConfigured:
      routing?.routingConfigured ?? isFinanceAPRoutingConfigured(),
    description: routing?.description ?? getFinanceRoutingDescription(),
  };
}

/** Normalize GET /dashboard/finance — supports Phase 7 and legacy payloads. */
export function normalizeFinanceDashboard(
  data: Record<string, unknown> | null | undefined,
): FinanceDashboardData {
  const routing = buildRoutingFromApi(
    (data?.routing as FinanceDashboardData['routing']) ?? null,
  );

  const mapRows = (rows: unknown[] | undefined): FinanceMRFRow[] =>
    (rows ?? []).map((r) => enrichFinanceMrfRow(r as FinanceMRFRow));

  let financeMRFs = mapRows(data?.financeMRFs as unknown[]);
  let legacyFinanceMRFs = mapRows(data?.legacyFinanceMRFs as unknown[]);
  let financeApMRFs = mapRows(data?.financeApMRFs as unknown[]);

  if (financeMRFs.length === 0 && (legacyFinanceMRFs.length > 0 || financeApMRFs.length > 0)) {
    financeMRFs = [...legacyFinanceMRFs, ...financeApMRFs];
  }

  if (legacyFinanceMRFs.length === 0 && financeApMRFs.length === 0 && financeMRFs.length > 0) {
    legacyFinanceMRFs = financeMRFs.filter((r) => !r.usesFinanceAp);
    financeApMRFs = financeMRFs.filter((r) => r.usesFinanceAp);
  }

  const statsRaw = (data?.stats as Record<string, unknown>) ?? {};
  const legacyRaw = (statsRaw.legacy as Record<string, unknown>) ?? {};
  const financeApRaw = (statsRaw.financeAp as Record<string, unknown>) ?? {};

  const stats: FinanceDashboardData['stats'] = {
    totalFinanceMRFs: Number(statsRaw.totalFinanceMRFs ?? 0) || undefined,
    pendingPayments: Number(
      legacyRaw.pendingInternalPayment ?? statsRaw.pendingPayments ?? 0,
    ) || undefined,
    processedPayments: Number(statsRaw.processedPayments ?? 0) || undefined,
    approvedPayments: Number(
      legacyRaw.awaitingChairmanApproval ?? statsRaw.approvedPayments ?? 0,
    ) || undefined,
    totalPendingAmount: Number(legacyRaw.totalPendingAmount ?? statsRaw.totalPendingAmount ?? 0) || undefined,
    totalProcessedAmount: Number(statsRaw.totalProcessedAmount ?? 0) || undefined,
    totalApprovedAmount: Number(statsRaw.totalApprovedAmount ?? 0) || undefined,
    legacy: {
      pendingInternal: Number(
        legacyRaw.pendingInternal ??
          legacyRaw.pendingInternalPayment ??
          statsRaw.pendingPayments ??
          0,
      ),
      chairmanPayment: Number(
        legacyRaw.chairmanPayment ??
          legacyRaw.awaitingChairmanApproval ??
          statsRaw.approvedPayments ??
          0,
      ),
      totalPendingAmount: Number(legacyRaw.totalPendingAmount ?? 0) || undefined,
    },
    financeAp: {
      handoff: Number(
        financeApRaw.handoff ??
          financeApRaw.financeHandoffPending ??
          0,
      ),
      inReview: Number(
        financeApRaw.inReview ??
          financeApRaw.inReviewOrMilestonePayment ??
          0,
      ),
      packagePushed: Number(
        financeApRaw.packagePushed ??
          financeApRaw.packagePushedCount ??
          0,
      ),
    },
  };

  return {
    routing,
    financeMRFs,
    legacyFinanceMRFs,
    financeApMRFs,
    stats,
  };
}
