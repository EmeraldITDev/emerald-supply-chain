import type { SRF } from '@/types';
import type { SrfDetailPayload, SrfWithUi } from '@/types/srf-ui';
import type { SrfLineItemDetailResponse, SrfProgressStep } from '@/types/srf-line-item';

function stripSuccessWrapper(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.success !== undefined && raw.data != null && typeof raw.data === 'object') {
    return raw.data as Record<string, unknown>;
  }
  const { success: _s, ...rest } = raw;
  return rest;
}

export function normalizeSrfListPayload(payload: unknown): SrfWithUi[] {
  if (Array.isArray(payload)) return payload as SrfWithUi[];
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as SrfWithUi[];
    if (Array.isArray(o.srfs)) return o.srfs as SrfWithUi[];
  }
  return [];
}

export function normalizeSrfDetail(payload: unknown): SrfDetailPayload {
  if (!payload || typeof payload !== 'object') {
    return { id: '', title: '', description: '', duration: '', justification: '', urgency: 'Medium', requester: '', date: '', status: 'Pending' };
  }
  const raw = stripSuccessWrapper(payload as Record<string, unknown>);
  return raw as SrfDetailPayload;
}

export function normalizeLineItemDetail(payload: unknown): SrfLineItemDetailResponse {
  if (!payload || typeof payload !== 'object') return {};
  const raw = stripSuccessWrapper(payload as Record<string, unknown>);
  const data = (raw.data as Record<string, unknown>) ?? raw;

  const progress =
    (data.progress as SrfProgressStep[]) ??
    (data.steps as SrfProgressStep[]) ??
    [];

  return {
    srf: (data.srf as SRF) ?? undefined,
    lineItem:
      (data.lineItem as SrfLineItemDetailResponse['lineItem']) ??
      (data.line_item as SrfLineItemDetailResponse['lineItem']),
    progress,
    steps: (data.steps as SrfProgressStep[]) ?? progress,
  };
}
