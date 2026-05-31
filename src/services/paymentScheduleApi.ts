import { apiRequest } from '@/services/api';
import type { ApiResponse } from '@/types';
import type {
  CreatePaymentSchedulePayload,
  PaymentSchedule,
  PaymentTermTemplate,
} from '@/types/payment-schedule';

/**
 * Payment Schedule API — Phase 1 of the Finance AP rollout.
 *
 * All mutating endpoints dispatch the global `app:refresh` event so other
 * panels (RFQ, price comparison, PO preview) re-fetch. Mirrors the pattern
 * used in `procurementApi.ts`.
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

export const paymentScheduleApi = {
  /** GET /api/payment-term-templates */
  listTemplates: async (): Promise<ApiResponse<PaymentTermTemplate[]>> => {
    return apiRequest<PaymentTermTemplate[]>('/payment-term-templates');
  },

  /**
   * GET /api/mrfs/{id}/payment-schedule.
   *
   * A 404 from the backend means "no schedule yet" — we surface that as a
   * successful `null` payload so callers don't need to special-case the error.
   */
  getSchedule: async (
    mrfId: string,
  ): Promise<ApiResponse<PaymentSchedule | null>> => {
    const res = await apiRequest<PaymentSchedule>(
      `/mrfs/${encodeURIComponent(mrfId)}/payment-schedule`,
    );
    if (!res.success && res.status === 404) {
      return { success: true, data: null };
    }
    return res as ApiResponse<PaymentSchedule | null>;
  },

  /** POST /api/mrfs/{id}/payment-schedule */
  createSchedule: async (
    mrfId: string,
    payload: CreatePaymentSchedulePayload,
  ): Promise<ApiResponse<PaymentSchedule>> => {
    const res = await apiRequest<PaymentSchedule>(
      `/mrfs/${encodeURIComponent(mrfId)}/payment-schedule`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    if (res.success) dispatchRefresh();
    return res;
  },

  /**
   * PUT /api/mrfs/{id}/payment-schedule.
   * Returns 409 with `error_code: SCHEDULE_LOCKED` once the PO is generated.
   */
  updateSchedule: async (
    mrfId: string,
    payload: CreatePaymentSchedulePayload,
  ): Promise<ApiResponse<PaymentSchedule>> => {
    const res = await apiRequest<PaymentSchedule>(
      `/mrfs/${encodeURIComponent(mrfId)}/payment-schedule`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
    if (res.success) dispatchRefresh();
    return res;
  },
};

/** True when a 409 came back from `updateSchedule` because the PO is locked. */
export function isScheduleLockedError(res: ApiResponse<unknown>): boolean {
  if (res.success) return false;
  if (res.status === 409) return true;
  const code = (res.raw as { error_code?: string } | undefined)?.error_code;
  return code === 'SCHEDULE_LOCKED';
}