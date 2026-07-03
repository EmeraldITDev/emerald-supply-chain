import type { MRF } from '@/types';
import { mrfApi } from '@/services/api';

export type DashboardApprovalRole = 'executive' | 'scd' | 'chairman';

const DASHBOARD_PER_PAGE = 50;

function mrfKey(mrf: MRF): string {
  return String(mrf.id ?? mrf.mrf_id ?? '');
}

function mergeMrfsById(...lists: MRF[][]): MRF[] {
  const map = new Map<string, MRF>();
  for (const list of lists) {
    for (const mrf of list) {
      const key = mrfKey(mrf);
      if (key) map.set(key, mrf);
    }
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
