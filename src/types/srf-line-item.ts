import type { SRF } from '@/types';

export interface SrfLineItemProgressSummary {
  currentStepLabel?: string;
  currentStepKey?: string;
  srfStatus?: string;
  srfStage?: string;
  progressPercent?: number;
}

export interface SrfLineItemListRow {
  id: number | string;
  itemName?: string;
  item_name?: string;
  quantity?: number;
  unit?: string;
  budgetAmount?: number;
  budget_amount?: number;
  progressSummary?: SrfLineItemProgressSummary;
  ui?: import('@/types/srf-ui').SrfLineItemUi;
}

export interface SrfProgressStep {
  key: string;
  label: string;
  status: 'completed' | 'pending' | 'in_progress' | 'not_started' | string;
  step?: number;
  completedAt?: string | null;
}

export interface SrfLineItemDetailResponse {
  srf?: SRF;
  lineItem?: SrfLineItemListRow & Record<string, unknown>;
  progress?: SrfProgressStep[];
  steps?: SrfProgressStep[];
}

export interface SrfListQuery {
  status?: string;
  include_line_items?: boolean;
  includeLineItems?: boolean;
  limit?: number;
  per_page?: number;
  page?: number;
}
