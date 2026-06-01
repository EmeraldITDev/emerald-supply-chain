import { apiRequest, API_BASE_URL, getAuthToken } from '@/services/api';
import type { ApiResponse, MRF } from '@/types';
import type {
  POFormPayload,
  POTermsTemplate,
  PriceComparisonEntry,
  PriceComparisonRow,
} from '@/types/procurement';
import type {
  GetProcurementDocumentsParams,
  GRNGeneratePayload,
  GRNGenerateResponse,
  GRNPreviewParams,
  ProcurementDocumentsResponse,
  ProcurementDocument,
  UploadProcurementDocumentPayload,
} from '@/types/procurement-documents';
import type { WorkflowGatesResponse } from '@/types/workflow-gates';

/** Successful POST /mrfs/{id}/generate-po body (after `apiRequest` unwraps `data`). */
export type GeneratePOResponse = {
  mrf: MRF;
  po_url?: string;
  fast_tracked?: boolean;
  fastTracked?: boolean;
};

/**
 * Procurement API — PO generator + price comparison endpoints.
 * Every successful mutation dispatches the global `app:refresh` event so
 * other panels re-fetch.
 */

const dispatchRefresh = () => {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event('app:refresh'));
    } catch {
      // no-op
    }
  }
};

/** Strip the local-only `_key` and coerce numerics before sending. */
function serializeRow(row: PriceComparisonRow) {
  const unit_price =
    typeof row.unit_price === 'string' && row.unit_price !== ''
      ? Number(row.unit_price)
      : row.unit_price;
  const quantity =
    typeof row.quantity === 'string' && row.quantity !== ''
      ? Number(row.quantity)
      : row.quantity;
  
  const serialized: any = {
    item_description: row.item_description,
    unit_price: typeof unit_price === 'number' ? unit_price : 0,
    quantity: typeof quantity === 'number' ? quantity : 0,
    is_selected: Boolean(row.is_selected),
    selection_reason: row.selection_reason || null,
  };
  
  // Include either vendor_id or manual_vendor (not both)
  if (row.vendor_id) {
    serialized.vendor_id = row.vendor_id;
  } else if (row.manual_vendor) {
    serialized.manual_vendor = row.manual_vendor;
  }
  
  return serialized;
}

export const procurementApi = {
  /** GET /api/po-terms-templates/{type} */
  getPOTermsTemplate: async (
    type: 'goods' | 'services' | 'logistics' | string
  ): Promise<ApiResponse<POTermsTemplate>> => {
    return apiRequest<POTermsTemplate>(
      `/po-terms-templates/${encodeURIComponent(type)}`
    );
  },

  /**
   * GET /api/mrfs/{id}/procurement-documents — Finance AP Phase 0.
   *
   * Lists procurement artefacts (POs, GRNs, invoices, etc.) associated with
   * the MRF and (when present) its SCM transaction. Filter by `type` or pass
   * `includeInactive: true` to surface superseded versions.
   */
  getProcurementDocuments: async (
    mrfId: string,
    params: GetProcurementDocumentsParams = {},
  ): Promise<ApiResponse<ProcurementDocumentsResponse>> => {
    const search = new URLSearchParams();
    if (params.type) search.set('type', params.type);
    if (params.includeInactive) search.set('include_inactive', 'true');
    const qs = search.toString();
    return apiRequest<ProcurementDocumentsResponse>(
      `/mrfs/${encodeURIComponent(mrfId)}/procurement-documents${qs ? `?${qs}` : ''}`,
    );
  },

  /** GET /api/mrfs/{id} — used to hydrate the form. */
  getMRFForPO: async (mrfId: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${encodeURIComponent(mrfId)}`);
  },

  /**
   * GET /api/mrfs/{id}/workflow-gates — Finance AP Phase 3.
   *
   * Returns vendor invoice gate, delivery confirmation requirements, and
   * closure readiness. Legacy MRFs return `usesFinanceAp: false`.
   */
  getWorkflowGates: async (
    mrfId: string,
  ): Promise<ApiResponse<WorkflowGatesResponse>> => {
    return apiRequest<WorkflowGatesResponse>(
      `/mrfs/${encodeURIComponent(mrfId)}/workflow-gates`,
    );
  },

  /** GET /api/mrfs/{id}/price-comparisons */
  getPriceComparison: async (
    mrfId: string
  ): Promise<ApiResponse<PriceComparisonEntry[]>> => {
    return apiRequest<PriceComparisonEntry[]>(
      `/mrfs/${encodeURIComponent(mrfId)}/price-comparisons`
    );
  },

  /** PUT /api/mrfs/{id}/price-comparisons — bulk replace. */
  savePriceComparison: async (
    mrfId: string,
    rows: PriceComparisonRow[]
  ): Promise<ApiResponse<PriceComparisonEntry[]>> => {
    const body = { rows: rows.map(serializeRow) };
    const res = await apiRequest<PriceComparisonEntry[]>(
      `/mrfs/${encodeURIComponent(mrfId)}/price-comparisons`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    );
    if (res.success) dispatchRefresh();
    return res;
  },

  /** POST /api/mrfs/{id}/generate-po with `save_as_draft: true`. */
  savePODraft: async (
    mrfId: string,
    payload: POFormPayload
  ): Promise<ApiResponse<GeneratePOResponse>> => {
    const res = await apiRequest<GeneratePOResponse>(
      `/mrfs/${encodeURIComponent(mrfId)}/generate-po`,
      {
        method: 'POST',
        body: JSON.stringify({ ...payload, save_as_draft: true }),
      }
    );
    if (res.success) dispatchRefresh();
    return res;
  },

  /** POST /api/mrfs/{id}/generate-po (finalise). */
  finalisePO: async (
    mrfId: string,
    payload: POFormPayload
  ): Promise<ApiResponse<GeneratePOResponse>> => {
    const { save_as_draft: _ignored, ...rest } = payload;
    void _ignored;
    const res = await apiRequest<GeneratePOResponse>(
      `/mrfs/${encodeURIComponent(mrfId)}/generate-po`,
      {
        method: 'POST',
        body: JSON.stringify(rest),
      }
    );
    if (res.success) dispatchRefresh();
    return res;
  },

  /**
   * POST /api/mrfs/{id}/procurement-documents — Phase 2.
   * Multipart upload of a supporting document (waybill, JCC, PFI, etc.).
   */
  uploadProcurementDocument: async (
    mrfId: string,
    { type, file }: UploadProcurementDocumentPayload,
  ): Promise<ApiResponse<ProcurementDocument>> => {
    const { token, expired } = getAuthToken();
    if (expired || !token) {
      return { success: false, error: 'Authentication token has expired. Please log in again.' };
    }
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', file);
    try {
      const response = await fetch(
        `${API_BASE_URL}/mrfs/${encodeURIComponent(mrfId)}/procurement-documents`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) dispatchRefresh();
      return {
        success: response.ok,
        data: (data?.data ?? data) as ProcurementDocument,
        error: data?.error || data?.message,
        status: response.status,
      };
    } catch (error) {
      console.error('uploadProcurementDocument failed:', error);
      return { success: false, error: 'Network error while uploading document.' };
    }
  },

  /**
   * GRN preview — Phase 2.
   * Uses GET when no line-item overrides are present, POST when they are
   * (the backend accepts the same body shape as `generate`).
   * Returns the PDF as a blob + object URL the caller can open in a tab.
   */
  previewGRN: async (
    mrfId: string,
    params: GRNPreviewParams = {},
  ): Promise<ApiResponse<{ blob: Blob; objectUrl: string }>> => {
    const { token, expired } = getAuthToken();
    if (expired || !token) {
      return { success: false, error: 'Authentication token has expired. Please log in again.' };
    }
    const needsPost =
      Array.isArray(params.lineItems) && params.lineItems.length > 0;
    const url = `${API_BASE_URL}/mrfs/${encodeURIComponent(mrfId)}/grn/preview`;
    try {
      let response: Response;
      if (needsPost) {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/pdf',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildGrnBody(params)),
        });
      } else {
        const qs = buildGrnQuery(params);
        response = await fetch(`${url}${qs ? `?${qs}` : ''}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
        });
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          success: false,
          error: data?.error || data?.message || `Failed to preview GRN (${response.status})`,
          status: response.status,
        };
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      return { success: true, data: { blob, objectUrl } };
    } catch (error) {
      console.error('previewGRN failed:', error);
      return { success: false, error: 'Network error while previewing GRN.' };
    }
  },

  /** POST /api/mrfs/{id}/grn/generate — Phase 2. */
  generateGRN: async (
    mrfId: string,
    payload: GRNGeneratePayload,
  ): Promise<ApiResponse<GRNGenerateResponse>> => {
    const body = { confirm: payload.confirm ?? true, ...buildGrnBody(payload) };
    const res = await apiRequest<GRNGenerateResponse>(
      `/mrfs/${encodeURIComponent(mrfId)}/grn/generate`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    if (res.success) dispatchRefresh();
    return res;
  },
};

/** Shared body builder so preview (POST) and generate share field shape. */
function buildGrnBody(p: GRNPreviewParams) {
  const out: Record<string, unknown> = {};
  // Prefer explicit dateOfReceipt; fall back to legacy receivedAt.
  const dateOfReceipt = p.dateOfReceipt ?? p.receivedAt;
  if (dateOfReceipt) out.dateOfReceipt = dateOfReceipt;
  if (p.deliveryNoteNumber) out.deliveryNoteNumber = p.deliveryNoteNumber;
  if (p.deliveryDate) out.deliveryDate = p.deliveryDate;
  if (p.carrierName) out.carrierName = p.carrierName;
  if (p.driverNumber) out.driverNumber = p.driverNumber;
  if (p.vehiclePlateNumber) out.vehiclePlateNumber = p.vehiclePlateNumber;
  if (p.comments) out.comments = p.comments;
  // Legacy aliases retained for backwards compat with earlier wiring.
  if (p.remarks && !p.comments) out.comments = p.remarks;
  if (p.grnNumber) out.grnNumber = p.grnNumber;
  if (Array.isArray(p.lineItems) && p.lineItems.length > 0) {
    out.lineItems = p.lineItems.map((li) => ({
      index: li.index,
      quantityReceived: li.quantityReceived,
    }));
  }
  return out;
}

function buildGrnQuery(p: GRNPreviewParams): string {
  const search = new URLSearchParams();
  const dateOfReceipt = p.dateOfReceipt ?? p.receivedAt;
  if (dateOfReceipt) search.set('dateOfReceipt', dateOfReceipt);
  if (p.deliveryNoteNumber) search.set('deliveryNoteNumber', p.deliveryNoteNumber);
  if (p.deliveryDate) search.set('deliveryDate', p.deliveryDate);
  if (p.carrierName) search.set('carrierName', p.carrierName);
  if (p.driverNumber) search.set('driverNumber', p.driverNumber);
  if (p.vehiclePlateNumber) search.set('vehiclePlateNumber', p.vehiclePlateNumber);
  if (p.comments) search.set('comments', p.comments);
  if (p.grnNumber) search.set('grnNumber', p.grnNumber);
  return search.toString();
}

/** True when the MRF is in a state that allows entering the PO generator. */
export function isMRFEligibleForPO(mrf: Partial<MRF> | null | undefined): boolean {
  if (!mrf) return false;
  const status = String(mrf.status ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '_');
  return (
    status === 'pending_po_upload' ||
    status === 'procurement' ||
    status === 'po_rejected'
  );
}

/** Convenience getter for the unsigned PDF link in either casing. */
export function getUnsignedPOUrl(mrf: Partial<MRF> | null | undefined): string | undefined {
  if (!mrf) return undefined;
  return mrf.unsigned_po_url ?? mrf.unsignedPOUrl ?? undefined;
}
export function getSignedPOUrl(mrf: Partial<MRF> | null | undefined): string | undefined {
  if (!mrf) return undefined;
  return mrf.signed_po_url ?? mrf.signedPOUrl ?? undefined;
}