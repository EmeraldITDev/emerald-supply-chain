import { apiRequest } from '@/services/api';
import type { ApiResponse, MRF } from '@/types';
import type {
  POFormPayload,
  POTermsTemplate,
  PriceComparisonEntry,
  PriceComparisonRow,
} from '@/types/procurement';

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
  return {
    vendor_id: row.vendor_id,
    item_description: row.item_description,
    unit_price: typeof unit_price === 'number' ? unit_price : 0,
    quantity: typeof quantity === 'number' ? quantity : 0,
    is_selected: Boolean(row.is_selected),
    selection_reason: row.selection_reason || null,
  };
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

  /** GET /api/mrfs/{id} — used to hydrate the form. */
  getMRFForPO: async (mrfId: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${encodeURIComponent(mrfId)}`);
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
  ): Promise<ApiResponse<{ mrf: MRF }>> => {
    const res = await apiRequest<{ mrf: MRF }>(
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
  ): Promise<ApiResponse<{ mrf: MRF; po_url?: string }>> => {
    const { save_as_draft: _ignored, ...rest } = payload;
    void _ignored;
    const res = await apiRequest<{ mrf: MRF; po_url?: string }>(
      `/mrfs/${encodeURIComponent(mrfId)}/generate-po`,
      {
        method: 'POST',
        body: JSON.stringify(rest),
      }
    );
    if (res.success) dispatchRefresh();
    return res;
  },
};

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