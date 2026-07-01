/** Phase 8 — Finance AP cohort reporting (post-cutover MRFs only). */

export interface FinanceApReportQuery {
  from?: string;
  to?: string;
  limit?: number;
}

export interface FinanceApSummaryReport {
  casesPushed?: number;
  handoff?: number;
  inReview?: number;
  closed?: number;
  rejectionRate?: number;
  rfiRate?: number;
  outstandingMilestoneBalance?: number;
  currency?: string;
  cutoverDate?: string | null;
  routingConfigured?: boolean;
  /** API may nest under `totals` */
  totals?: Partial<FinanceApSummaryReport>;
}

export interface FinanceApOutstandingMilestoneRow {
  mrfId: string | number;
  mrfDisplayId?: string;
  mrfTitle?: string;
  milestoneId?: string | number;
  milestoneLabel?: string;
  amount?: number | string;
  percentage?: number | string;
  status?: string;
  dueDate?: string | null;
  financeApCaseId?: string | null;
  financeApStatus?: string | null;
}

export interface FinanceApAdvanceDeliveryRiskRow {
  mrfId: string | number;
  mrfDisplayId?: string;
  mrfTitle?: string;
  milestoneLabel?: string;
  advanceStatus?: string;
  amount?: number | string;
  missingDocuments?: string[];
  daysSinceAdvance?: number | null;
  financeApCaseId?: string | null;
}

export interface FinanceApCycleTimesReport {
  avgDaysPoSignedToFirstMilestonePaid?: number | null;
  avgDaysPoSignedToClosed?: number | null;
  sampleSize?: number;
  /** Nested aliases */
  poSignedToFirstPaid?: number | null;
  poSignedToClosed?: number | null;
}

export interface FinanceApListResponse<T> {
  items: T[];
  total?: number;
  from?: string;
  to?: string;
}

export interface FinanceApSyncEventRow {
  id: number | string;
  mrfId?: string | null;
  mrfDisplayId?: string | null;
  mrfTitle?: string | null;
  direction: string;
  eventType: string;
  status: string;
  httpStatus?: number | null;
  errorMessage?: string | null;
  processedAt?: string | null;
  createdAt?: string | null;
}

export interface FinanceApSyncEventsReport {
  summary: {
    failed: number;
    pending: number;
    vendorSyncFailed: number;
  };
  events: FinanceApSyncEventRow[];
}

export interface FinanceApSyncEventsQuery {
  limit?: number;
  status?: string;
  event_type?: string;
}
