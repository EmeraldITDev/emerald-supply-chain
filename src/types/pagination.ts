export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  from: number | null;
  to: number | null;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export const DEFAULT_PAGE_SIZE = 25;
