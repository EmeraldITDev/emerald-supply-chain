import { apiRequest, type ApiResponse } from '@/services/api';
import type {
  FinanceApAdvanceDeliveryRiskRow,
  FinanceApCycleTimesReport,
  FinanceApListResponse,
  FinanceApOutstandingMilestoneRow,
  FinanceApReportQuery,
  FinanceApSummaryReport,
} from '@/types/finance-ap-reports';

function buildQuery(params?: FinanceApReportQuery): string {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.limit != null) qs.set('limit', String(Math.min(100, Math.max(1, params.limit))));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

function normalizeSummary(raw: Record<string, unknown>): FinanceApSummaryReport {
  const totals = (raw.totals as Record<string, unknown>) ?? raw;
  return {
    casesPushed: Number(totals.casesPushed ?? totals.cases_pushed ?? 0),
    handoff: Number(totals.handoff ?? 0),
    inReview: Number(totals.inReview ?? totals.in_review ?? 0),
    closed: Number(totals.closed ?? 0),
    rejectionRate: Number(totals.rejectionRate ?? totals.rejection_rate ?? 0),
    rfiRate: Number(totals.rfiRate ?? totals.rfi_rate ?? 0),
    outstandingMilestoneBalance: Number(
      totals.outstandingMilestoneBalance ?? totals.outstanding_milestone_balance ?? 0,
    ),
    currency: (totals.currency as string) ?? 'NGN',
  };
}

function normalizeList<T>(raw: unknown): FinanceApListResponse<T> {
  if (Array.isArray(raw)) return { items: raw as T[] };
  const obj = raw as Record<string, unknown>;
  const items =
    (obj.items as T[]) ??
    (obj.data as T[]) ??
    (obj.rows as T[]) ??
    (obj.milestones as T[]) ??
    (obj.risks as T[]) ??
    [];
  return {
    items,
    total: obj.total as number | undefined,
    from: obj.from as string | undefined,
    to: obj.to as string | undefined,
  };
}

export const financeApReportsApi = {
  getSummary: async (
    params?: FinanceApReportQuery,
  ): Promise<ApiResponse<FinanceApSummaryReport>> => {
    const res = await apiRequest<Record<string, unknown>>(
      `/reports/finance-ap/summary${buildQuery(params)}`,
    );
    if (res.success && res.data) {
      return { ...res, data: normalizeSummary(res.data) };
    }
    return res as ApiResponse<FinanceApSummaryReport>;
  },

  getOutstandingMilestones: async (
    params?: FinanceApReportQuery,
  ): Promise<ApiResponse<FinanceApListResponse<FinanceApOutstandingMilestoneRow>>> => {
    const res = await apiRequest<unknown>(
      `/reports/finance-ap/outstanding-milestones${buildQuery(params)}`,
    );
    if (res.success) {
      return { ...res, data: normalizeList<FinanceApOutstandingMilestoneRow>(res.data) };
    }
    return res as ApiResponse<FinanceApListResponse<FinanceApOutstandingMilestoneRow>>;
  },

  getAdvanceDeliveryRisk: async (
    params?: FinanceApReportQuery,
  ): Promise<ApiResponse<FinanceApListResponse<FinanceApAdvanceDeliveryRiskRow>>> => {
    const res = await apiRequest<unknown>(
      `/reports/finance-ap/advance-delivery-risk${buildQuery(params)}`,
    );
    if (res.success) {
      return { ...res, data: normalizeList<FinanceApAdvanceDeliveryRiskRow>(res.data) };
    }
    return res as ApiResponse<FinanceApListResponse<FinanceApAdvanceDeliveryRiskRow>>;
  },

  getCycleTimes: async (
    params?: FinanceApReportQuery,
  ): Promise<ApiResponse<FinanceApCycleTimesReport>> => {
    const res = await apiRequest<Record<string, unknown>>(
      `/reports/finance-ap/cycle-times${buildQuery(params)}`,
    );
    if (res.success && res.data) {
      const d = res.data;
      return {
        ...res,
        data: {
          avgDaysPoSignedToFirstMilestonePaid: Number(
            d.avgDaysPoSignedToFirstMilestonePaid ??
              d.avg_days_po_signed_to_first_milestone_paid ??
              d.poSignedToFirstPaid ??
              0,
          ),
          avgDaysPoSignedToClosed: Number(
            d.avgDaysPoSignedToClosed ??
              d.avg_days_po_signed_to_closed ??
              d.poSignedToClosed ??
              0,
          ),
          sampleSize: Number(d.sampleSize ?? d.sample_size ?? 0),
        },
      };
    }
    return res as ApiResponse<FinanceApCycleTimesReport>;
  },
};
