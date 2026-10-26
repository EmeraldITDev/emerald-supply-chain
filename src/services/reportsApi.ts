import { apiRequest, type ApiResponse } from '@/services/api';
import { getAuthToken, API_BASE_URL } from '@/services/api';

export interface ReportKpiCard {
  name: string;
  value: string;
  rawValue: number | null;
  unit: string;
  change: string;
  trend: 'up' | 'down' | 'flat';
}

export interface GeneratedReportRow {
  id: number;
  name: string;
  type: string;
  format: string;
  status: string;
  date: string | null;
  size: string;
  downloadUrl: string | null;
}

export interface ScheduledReportRow {
  id: number;
  name: string;
  type: string;
  frequency: string;
  nextRun: string;
  recipients: number;
}

export interface ReportsDashboardData {
  period: { from: string; to: string };
  kpis: ReportKpiCard[];
  recentReports: GeneratedReportRow[];
  scheduledReports: ScheduledReportRow[];
}

export interface ProcurementReportRecord {
  id: number;
  mrfId: string;
  displayId: string;
  title: string;
  department?: string | null;
  status?: string | null;
  workflowState?: string | null;
  vendorId?: number | null;
  vendorName?: string | null;
  estimatedCost: number;
  createdAt?: string | null;
  poSignedAt?: string | null;
  detailPath: string;
  mrfLinkId?: string;
}

export interface PaginatedReportRecords {
  period: { from: string | null; to: string | null };
  items: ProcurementReportRecord[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    from: number | null;
    to: number | null;
  };
}

export interface PoRegisterRow {
  id: number;
  poNumber: string | null;
  poVersion: string | null;
  mrfNumber: string | null;
  title: string;
  vendorName: string | null;
  vendorCode?: string | null;
  department?: string | null;
  contractType?: string | null;
  currency: string;
  poValue: number;
  taxAmount: number;
  totalAmount: number;
  poGenerationDate: string | null;
  poSigningDate: string | null;
  approvalStatus?: string | null;
  signingStatus?: string | null;
  paymentStatus?: string | null;
  grnStatus?: string | null;
  expectedDeliveryDate?: string | null;
  unsignedPoUrl?: string | null;
  signedPoUrl?: string | null;
  procurementManager?: string | null;
}

export interface PoRegisterSummary {
  totalGeneratedPos: number;
  totalPoValue: number | null;
  totalPoValueByCurrency: Array<{ currency: string; count: number; totalValue: number }>;
  signedPos: number;
  unsignedPos: number;
  awaitingGrn: number;
  completedGrn: number;
  averagePoValue: number;
  totalTaxAmount: number;
  monthlyTrend: Array<{ month: string; count: number; value: number }>;
  topVendors: Array<{ name: string; poCount: number; totalPoValue: number }>;
}

export interface PaginatedPoRegister {
  period: { from: string | null; to: string | null };
  summary: PoRegisterSummary;
  items: PoRegisterRow[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    from: number | null;
    to: number | null;
  };
}

export interface ProcurementRecordsQuery {
  from?: string;
  to?: string;
  department?: string;
  vendor_id?: number;
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      qs.set(key, String(value));
    }
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const reportsApi = {
  getDashboard: async (from?: string, to?: string): Promise<ApiResponse<ReportsDashboardData>> => {
    return apiRequest<ReportsDashboardData>(
      `/reports/dashboard${buildQuery({ from, to })}`,
    );
  },

  getProcurementRecords: async (
    params: ProcurementRecordsQuery = {},
  ): Promise<ApiResponse<PaginatedReportRecords>> => {
    return apiRequest<PaginatedReportRecords>(
      `/reports/procurement/records${buildQuery(params as Record<string, string | number | undefined>)}`,
    );
  },

  getProcurementRecordDetail: async (id: number): Promise<ApiResponse<{ record: ProcurementReportRecord & { items?: unknown[] } }>> => {
    return apiRequest(`/reports/procurement/records/${id}`);
  },

  getPORegister: async (
    params: ProcurementRecordsQuery = {},
  ): Promise<ApiResponse<PaginatedPoRegister>> => {
    return apiRequest<PaginatedPoRegister>(
      `/reports/po-register${buildQuery(params as Record<string, string | number | undefined>)}`,
    );
  },

  exportPORegister: async (
    format: 'xlsx' | 'pdf',
    params: ProcurementRecordsQuery = {},
  ): Promise<ApiResponse<Blob>> => {
    const { token, expired } = getAuthToken();
    if (expired || !token) {
      return { success: false, error: 'Authentication token has expired. Please log in again.' };
    }

    const query = buildQuery({ ...params, format } as Record<string, string | number | undefined>);
    try {
      const response = await fetch(`${API_BASE_URL}/reports/po-register/export${query}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return { success: false, error: `Export failed (status ${response.status})` };
      }
      return { success: true, data: await response.blob() };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Export failed' };
    }
  },

  exportProcurementRecords: async (
    format: 'csv' | 'xlsx' | 'pdf',
    params: ProcurementRecordsQuery = {},
  ): Promise<ApiResponse<Blob>> => {
    const { token, expired } = getAuthToken();
    if (expired || !token) {
      return { success: false, error: 'Authentication token has expired. Please log in again.' };
    }

    const query = buildQuery({ ...params, format } as Record<string, string | number | undefined>);
    try {
      const response = await fetch(`${API_BASE_URL}/reports/procurement/records/export${query}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return { success: false, error: `Export failed (status ${response.status})` };
      }
      return { success: true, data: await response.blob() };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Export failed' };
    }
  },
};
