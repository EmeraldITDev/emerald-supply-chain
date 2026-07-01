/**
 * Finance AP routing — server FINANCE_AP_CUTOVER_DATE is source of truth.
 * Loaded via GET /api/config/finance-routing (see financeRoutingConfig.ts).
 */

import type { MRF } from '@/types';
import {
  isFinanceAPRoutingConfiguredFromServer,
  resolveFinanceAPCutoverDate,
} from '@/services/financeRoutingConfig';

export function getFinanceAPCutoverDate(): string | null {
  return resolveFinanceAPCutoverDate();
}

export function mrfUsesFinanceAp(mrf: MRF): boolean {
  const cutoverDate = getFinanceAPCutoverDate();

  if (!cutoverDate) {
    return false;
  }

  const mrfCreatedAt = mrf.created_at || mrf.date;
  if (!mrfCreatedAt) {
    return false;
  }

  try {
    const cutoverDateTime = new Date(cutoverDate).getTime();
    const mrfDateTime = new Date(mrfCreatedAt).getTime();
    return mrfDateTime >= cutoverDateTime;
  } catch {
    console.warn('Invalid date format for Finance AP cutover comparison:', { cutoverDate, mrfCreatedAt });
    return false;
  }
}

export function getFinanceRoute(mrf: MRF): 'finance_ap' | 'legacy_internal' {
  return mrfUsesFinanceAp(mrf) ? 'finance_ap' : 'legacy_internal';
}

export function getFinanceRoutingDescription(): string {
  const cutoverDate = getFinanceAPCutoverDate();

  if (!cutoverDate) {
    return 'Finance AP cutover is not configured on the server (FINANCE_AP_CUTOVER_DATE).';
  }

  try {
    const date = new Date(cutoverDate);
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `MRFs created on or after ${formatted} are routed to Finance AP; earlier MRFs use legacy internal finance`;
  } catch {
    return `Finance AP cutover configured but date invalid: ${cutoverDate}`;
  }
}

export function isFinanceAPRoutingConfigured(): boolean {
  return isFinanceAPRoutingConfiguredFromServer();
}
