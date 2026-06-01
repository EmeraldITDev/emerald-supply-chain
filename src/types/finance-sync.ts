/**
 * Phase 6 — Finance AP integration sync status for an MRF.
 * Source: GET /api/mrfs/{id}/finance-sync
 */

export type FinanceApStatus =
  | 'pending_review'
  | 'in_review'
  | 'rejected'
  | 'rfi'
  | 'closed'
  | (string & {});

export interface FinanceSyncEvent {
  id?: string | number;
  direction?: 'outbound' | 'inbound' | (string & {});
  eventType?: string;
  status?: string;
  message?: string | null;
  createdAt?: string | null;
  payloadSummary?: string | null;
}

export interface FinanceSyncResponse {
  usesFinanceAp: boolean;
  financeApCaseId?: string | null;
  financeApStatus?: FinanceApStatus | null;
  packagePushed: boolean;
  integrationConfigured: boolean;
  financeApBaseUrl?: string | null;
  financeApCaseUrl?: string | null;
  lastOutbound?: FinanceSyncEvent | null;
  lastInbound?: FinanceSyncEvent | null;
  recentEvents?: FinanceSyncEvent[];
}