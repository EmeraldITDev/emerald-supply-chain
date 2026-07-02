/**
 * Stale-time presets — balance instant revisits vs fresh workflow data.
 *
 * - STABLE: vendor categories, user directory, department config
 * - LIST: paginated module lists (MRF, PO, vendors)
 * - REPORT: aggregated analytics (changes slowly)
 * - WORKFLOW: approval queues, status-driven views
 */

export const STABLE_QUERY_OPTIONS = {
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
} as const;

export const LIST_QUERY_OPTIONS = {
  staleTime: 2 * 60_000,
  gcTime: 10 * 60_000,
} as const;

export const REPORT_QUERY_OPTIONS = {
  staleTime: 5 * 60_000,
  gcTime: 15 * 60_000,
} as const;

export const WORKFLOW_QUERY_OPTIONS = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
} as const;
