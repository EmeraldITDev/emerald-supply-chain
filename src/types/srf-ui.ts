import type { SRF } from '@/types';
import type { SrfLineItemListRow, SrfProgressStep } from '@/types/srf-line-item';

export interface SrfUiAction {
  showButton?: boolean;
  label?: string;
  method?: string;
  path: string;
}

export interface SrfCardUi {
  cardClickable?: boolean;
  viewDetails?: SrfUiAction | null;
}

export interface SrfLineItemUi {
  viewDetails?: SrfUiAction | null;
  progressTracker?: SrfUiAction | null;
}

export interface SrfLineItemWithUi extends SrfLineItemListRow {
  ui?: SrfLineItemUi;
}

export interface SrfWithUi extends Omit<SRF, 'items'> {
  ui?: SrfCardUi;
  items?: SrfLineItemWithUi[];
  lineItems?: SrfLineItemWithUi[];
  progress?: SrfProgressStep[];
  steps?: SrfProgressStep[];
  progressTracker?: { path?: string; method?: string };
  lineItemCount?: number;
}

export interface SrfDetailPayload extends SrfWithUi {
  items?: SrfLineItemWithUi[];
  line_items?: SrfLineItemWithUi[];
}

export function srfUiActionVisible(action?: SrfUiAction | null): boolean {
  return Boolean(action?.showButton && action.path);
}

export function lineItemsFromSrf(srf: SrfWithUi): SrfLineItemWithUi[] {
  return (
    srf.lineItems ??
    srf.items ??
    (srf as SrfDetailPayload).line_items ??
    []
  );
}
