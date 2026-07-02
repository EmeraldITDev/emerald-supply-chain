import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { PaginatedResult, MRF } from '@/types';

const LIST_CACHE_ROOTS = [
  queryKeys.mrfs.all,
  queryKeys.pos.all,
  queryKeys.vendors.all,
  queryKeys.rfqs.all,
  queryKeys.srfs.all,
  queryKeys.users.all,
  queryKeys.reports.all,
  queryKeys.dashboard.all,
  queryKeys.departments.all,
] as const;

/** Invalidate list/report caches for the header refresh button — not the entire app cache. */
export async function invalidateScmListCaches(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    LIST_CACHE_ROOTS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'active' }),
    ),
  );
}

export function invalidateMrfLists(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.mrfs.all });
}

export function invalidatePoLists(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.pos.all });
}

export function invalidateVendorLists(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
}

export function invalidateUserLists(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
}

export function invalidateReportCaches(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
}

function mrfMatchesId(mrf: MRF, mrfId: string): boolean {
  const needle = mrfId.trim();
  return (
    String(mrf.id ?? '') === needle ||
    String((mrf as { mrf_id?: string }).mrf_id ?? '') === needle ||
    String(mrf.formatted_id ?? '') === needle ||
    String(mrf.formattedId ?? '') === needle
  );
}

/** Remove a deleted MRF from all cached list pages immediately (optimistic UI). */
export function optimisticallyRemoveMrfFromCache(
  queryClient: QueryClient,
  mrfId: string,
): void {
  queryClient.setQueriesData<PaginatedResult<MRF>>(
    { queryKey: queryKeys.mrfs.all },
    (old) => {
      if (!old?.items?.length) return old;
      const items = old.items.filter((m) => !mrfMatchesId(m, mrfId));
      if (items.length === old.items.length) return old;
      const pagination = old.pagination
        ? {
            ...old.pagination,
            total: Math.max(0, (old.pagination.total ?? items.length) - 1),
          }
        : old.pagination;
      return { ...old, items, pagination };
    },
  );
}
