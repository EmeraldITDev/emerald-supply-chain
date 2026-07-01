import { apiRequest, type ApiResponse } from '@/services/api';
import type {
  FinanceApAdvanceDeliveryRiskRow,
  FinanceApCycleTimesReport,
  FinanceApListResponse,
  FinanceApOutstandingMilestoneRow,
  FinanceApReportQuery,
  FinanceApSummaryReport,
  FinanceApSyncEventsQuery,
  FinanceApSyncEventsReport,
  FinanceApSyncEventRow,
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
    casesPushed: Number(
      totals.packagePushed ?? totals.casesPushed ?? totals.cases_pushed ?? totals.financeApMrfs ?? 0,
    ),
    handoff: Number(totals.financeHandoffPending ?? totals.handoff ?? 0),
    inReview: Number(totals.inReviewOrPaying ?? totals.inReview ?? totals.in_review ?? 0),
    closed: Number(totals.closedOrComplete ?? totals.closed ?? 0),
    rejectionRate: Number(totals.rejectionRate ?? totals.rejection_rate ?? 0),
    rfiRate: Number(totals.rfiRate ?? totals.rfi_rate ?? 0),
    outstandingMilestoneBalance: Number(
      totals.outstandingMilestoneBalance ?? totals.outstanding_milestone_balance ?? 0,
    ),
    currency: (totals.currency as string) ?? 'NGN',
    cutoverDate: (raw.cutoverDate as string) ?? null,
    routingConfigured: Boolean(raw.routingConfigured),
  };
}

function normalizeOutstandingRow(raw: Record<string, unknown>): FinanceApOutstandingMilestoneRow {
  return {
    mrfId: (raw.mrfId ?? raw.mrf_id ?? '') as string | number,
    mrfDisplayId: (raw.formattedId ?? raw.mrfDisplayId ?? raw.mrfId) as string | undefined,
    mrfTitle: raw.mrfTitle as string | undefined,
    milestoneId: (raw.milestoneId ?? raw.milestone_id) as string | number | undefined,
    milestoneLabel: (raw.label ?? raw.milestoneLabel) as string | undefined,
    amount: raw.amount as number | string | undefined,
    percentage: raw.percentage as number | string | undefined,
    status: raw.status as string | undefined,
    financeApCaseId: (raw.financeApCaseId ?? raw.finance_ap_case_id) as string | null | undefined,
  };
}

function normalizeRiskRow(raw: Record<string, unknown>): FinanceApAdvanceDeliveryRiskRow {
  return {
    mrfId: (raw.mrfId ?? raw.mrf_id ?? '') as string | number,
    mrfDisplayId: (raw.formattedId ?? raw.mrfDisplayId ?? raw.mrfId) as string | undefined,
    mrfTitle: raw.mrfTitle as string | undefined,
    missingDocuments: (raw.missingDocuments ?? raw.missing_documents) as string[] | undefined,
    advanceStatus: raw.advancePaid != null ? (raw.advancePaid ? 'paid' : 'pending') : undefined,
    financeApCaseId: (raw.financeApCaseId ?? raw.finance_ap_case_id) as string | null | undefined,
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
      const list = normalizeList<Record<string, unknown>>(res.data);
      return {
        ...res,
        data: {
          ...list,
          items: list.items.map((row) => normalizeOutstandingRow(row)),
        },
      };
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
      const list = normalizeList<Record<string, unknown>>(res.data);
      return {
        ...res,
        data: {
          ...list,
          items: list.items.map((row) => normalizeRiskRow(row)),
        },
      };
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
          avgDaysPoSignedToFirstMilestonePaid:
            d.avgDaysPoSignedToFirstMilestonePaid != null
              ? Number(d.avgDaysPoSignedToFirstMilestonePaid)
              : d.avg_days_po_signed_to_first_milestone_paid != null
                ? Number(d.avg_days_po_signed_to_first_milestone_paid)
                : null,
          avgDaysPoSignedToClosed:
            d.avgDaysPoSignedToClosed != null
              ? Number(d.avgDaysPoSignedToClosed)
              : d.avg_days_po_signed_to_closed != null
                ? Number(d.avg_days_po_signed_to_closed)
                : null,
          sampleSize: Number(d.sampleSize ?? d.sample_size ?? 0),
        },
      };
    }
    return res as ApiResponse<FinanceApCycleTimesReport>;
  },

  getSyncEvents: async (
    params?: FinanceApSyncEventsQuery,
  ): Promise<ApiResponse<FinanceApSyncEventsReport>> => {
    const qs = new URLSearchParams();
    if (params?.limit != null) qs.set('limit', String(Math.min(100, Math.max(1, params.limit))));
    if (params?.status) qs.set('status', params.status);
    if (params?.event_type) qs.set('event_type', params.event_type);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';

    const res = await apiRequest<Record<string, unknown>>(
      `/reports/finance-ap/sync-events${suffix}`,
    );
    if (res.success && res.data) {
      const raw = res.data;
      const summary = (raw.summary as Record<string, unknown>) ?? {};
      const events = Array.isArray(raw.events) ? raw.events : [];
      return {
        ...res,
        data: {
          summary: {
            failed: Number(summary.failed ?? 0),
            pending: Number(summary.pending ?? 0),
            vendorSyncFailed: Number(summary.vendorSyncFailed ?? summary.vendor_sync_failed ?? 0),
          },
          events: events.map((row) => {
            const e = row as Record<string, unknown>;
            return {
              id: (e.id ?? '') as number | string,
              mrfId: (e.mrfId ?? e.mrf_id ?? null) as string | null,
              mrfDisplayId: (e.mrfDisplayId ?? e.mrf_display_id ?? null) as string | null,
              mrfTitle: (e.mrfTitle ?? e.mrf_title ?? null) as string | null,
              direction: String(e.direction ?? ''),
              eventType: String(e.eventType ?? e.event_type ?? ''),
              status: String(e.status ?? ''),
              httpStatus: e.httpStatus != null ? Number(e.httpStatus) : e.http_status != null ? Number(e.http_status) : null,
              errorMessage: (e.errorMessage ?? e.error_message ?? null) as string | null,
              processedAt: (e.processedAt ?? e.processed_at ?? null) as string | null,
              createdAt: (e.createdAt ?? e.created_at ?? null) as string | null,
            } satisfies FinanceApSyncEventRow;
          }),
        },
      };
    }
    return res as ApiResponse<FinanceApSyncEventsReport>;
  },
};
