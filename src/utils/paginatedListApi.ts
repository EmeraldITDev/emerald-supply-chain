import type { PaginationMeta } from '@/types/pagination';
import type { ListSort } from '@/utils/listFilters';

export function normalizePagination(raw: Record<string, unknown> | undefined): PaginationMeta {
  const page = Number(raw?.page ?? raw?.current_page ?? raw?.currentPage ?? 1);
  const per_page = Number(raw?.per_page ?? raw?.perPage ?? 25);
  const total = Number(raw?.total ?? 0);
  const total_pages = Number(
    raw?.total_pages ?? raw?.totalPages ?? raw?.last_page ?? raw?.lastPage ?? 1,
  );
  const from = raw?.from != null ? Number(raw.from) : null;
  const to = raw?.to != null ? Number(raw.to) : null;
  return { page, per_page, total, total_pages, from, to };
}

export function listSortToApi(
  sort: ListSort,
  valueField = 'estimated_cost',
): { sort_by: string; sort_direction: 'asc' | 'desc' } {
  switch (sort) {
    case 'oldest':
      return { sort_by: 'created_at', sort_direction: 'asc' };
    case 'value-desc':
      return { sort_by: valueField, sort_direction: 'desc' };
    case 'value-asc':
      return { sort_by: valueField, sort_direction: 'asc' };
    default:
      return { sort_by: 'created_at', sort_direction: 'desc' };
  }
}

export function buildListQueryParams(
  params: Record<string, string | number | boolean | undefined | null>,
): URLSearchParams {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, String(value));
  });
  return qs;
}

/** Parse standard `{ success, data[], pagination }` or Laravel paginator shapes. */
export function extractPaginatedItems<T>(
  payload: unknown,
  nestedKey?: string,
): { items: T[]; pagination?: PaginationMeta } {
  if (!payload || typeof payload !== 'object') {
    return { items: [] };
  }

  const obj = payload as Record<string, unknown>;

  if (obj.pagination && Array.isArray(obj.data)) {
    return {
      items: obj.data as T[],
      pagination: normalizePagination(obj.pagination as Record<string, unknown>),
    };
  }

  if (nestedKey && obj[nestedKey] && obj.pagination) {
    const nested = obj[nestedKey];
    if (Array.isArray(nested)) {
      return {
        items: nested as T[],
        pagination: normalizePagination(obj.pagination as Record<string, unknown>),
      };
    }
  }

  if (Array.isArray(obj.data) && ('current_page' in obj || 'page' in obj)) {
    return {
      items: obj.data as T[],
      pagination: normalizePagination(obj),
    };
  }

  if (nestedKey && obj[nestedKey] && typeof obj[nestedKey] === 'object') {
    const nested = obj[nestedKey] as Record<string, unknown>;
    if (Array.isArray(nested.data)) {
      return {
        items: nested.data as T[],
        pagination: normalizePagination(nested),
      };
    }
    if (Array.isArray(nested)) {
      return { items: nested as T[] };
    }
  }

  if (Array.isArray(payload)) {
    return { items: payload as T[] };
  }

  if (Array.isArray(obj.data)) {
    return { items: obj.data as T[] };
  }

  return { items: [] };
}

const DEFAULT_FETCH_ALL_PER_PAGE = 100;
const DEFAULT_FETCH_ALL_MAX_PAGES = 2;

/**
 * Walk paginated list endpoints until all pages are loaded (capped).
 * Use for AppContext / dropdowns that need more than the first page.
 */
export async function fetchAllListPages<T>(
  fetchPage: (
    page: number,
    perPage: number,
  ) => Promise<{ items: T[]; pagination?: PaginationMeta }>,
  options?: { perPage?: number; maxPages?: number },
): Promise<T[]> {
  const perPage = options?.perPage ?? DEFAULT_FETCH_ALL_PER_PAGE;
  const maxPages = options?.maxPages ?? DEFAULT_FETCH_ALL_MAX_PAGES;
  const all: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= maxPages) {
    const { items, pagination } = await fetchPage(page, perPage);
    all.push(...items);
    totalPages = pagination?.total_pages ?? (items.length < perPage ? page : page + 1);
    if (items.length === 0) break;
    page += 1;
  }

  return all;
}
