import type { MRF } from '@/types';
import { mrfApi } from '@/services/api';

export type DashboardApprovalRole = 'executive' | 'scd' | 'chairman';

const DASHBOARD_PER_PAGE = 50;

/**
 * Marker set by {@link fetchDashboardMrfs} on MRFs the backend returned in the
 * `pending_for_role=<role>` slice for the current dashboard. This is the
 * authoritative signal for "is THIS role still expected to act on this MRF" —
 * the bucket classifiers prefer it over guessing from `workflow_state`, which
 * can stay on `parallel_first_approval` after one of the two parallel
 * approvers has already signed off.
 */
export const PENDING_FOR_ROLE_FLAG = '__pendingForRole' as const;

function mrfKey(mrf: MRF): string {
  return String(mrf.id ?? (mrf as { mrf_id?: string }).mrf_id ?? '');
}

function mergeMrfsById(pending: MRF[], recent: MRF[]): MRF[] {
  const pendingIds = new Set(pending.map(mrfKey).filter(Boolean));
  const map = new Map<string, MRF>();
  for (const mrf of pending) {
    const key = mrfKey(mrf);
    if (!key) continue;
    map.set(key, { ...(mrf as MRF), [PENDING_FOR_ROLE_FLAG]: true } as MRF);
  }
  for (const mrf of recent) {
    const key = mrfKey(mrf);
    if (!key) continue;
    // `recent` carries the freshest server state — always let it win, but
    // preserve the pending-for-role flag so classifiers know which queue
    // this role should still see it in.
    map.set(key, {
      ...(mrf as MRF),
      [PENDING_FOR_ROLE_FLAG]: pendingIds.has(key),
    } as MRF);
  }
  return [...map.values()];
}

/**
 * Loads role-relevant pending MRFs plus a recent slice for history tabs.
 * Two small paginated calls replace one generic `per_page: 100` fetch.
 */
export async function fetchDashboardMrfs(
  role: DashboardApprovalRole,
): Promise<MRF[]> {
  const [pendingRes, recentRes] = await Promise.all([
    mrfApi.list({
      page: 1,
      per_page: DASHBOARD_PER_PAGE,
      pending_for_role: role,
    }),
    mrfApi.list({
      page: 1,
      per_page: DASHBOARD_PER_PAGE,
      sort_by: 'updated_at',
      sort_direction: 'desc',
    }),
  ]);

  const pending =
    pendingRes.success && pendingRes.data ? pendingRes.data.items : [];
  const recent =
    recentRes.success && recentRes.data ? recentRes.data.items : [];

  return mergeMrfsById(pending, recent);
}
