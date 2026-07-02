import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { ApiResponse, PaginatedResult } from '@/types';
import type { PaginationMeta } from '@/types/pagination';

type PaginatedFetcher<T> = () => Promise<ApiResponse<PaginatedResult<T>>>;

interface UsePaginatedListQueryOptions<T> {
  queryKey: readonly unknown[];
  queryFn: PaginatedFetcher<T>;
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
}

interface PaginatedListQueryResult<T> {
  items: T[];
  pagination: PaginationMeta | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

/**
 * Cached server-side paginated list — shows previous page instantly while fetching.
 */
export function usePaginatedListQuery<T>({
  queryKey,
  queryFn,
  staleTime,
  gcTime,
  enabled = true,
}: UsePaginatedListQueryOptions<T>): PaginatedListQueryResult<T> {
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await queryFn();
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to load list');
      }
      return res.data;
    },
    staleTime,
    gcTime,
    enabled,
    placeholderData: keepPreviousData,
  });

  return {
    items: query.data?.items ?? [],
    pagination: query.data?.pagination ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
