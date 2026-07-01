import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import type { PaginationMeta } from '@/types/pagination';

interface ServerPaginationBarProps {
  pagination: PaginationMeta | null | undefined;
  page: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function ServerPaginationBar({
  pagination,
  page,
  onPageChange,
  className,
}: ServerPaginationBarProps) {
  if (!pagination || pagination.total_pages <= 1) {
    if (pagination && pagination.total > 0) {
      return (
        <p className={`text-sm text-muted-foreground ${className ?? ''}`}>
          Showing {pagination.from ?? 1}–{pagination.to ?? pagination.total} of {pagination.total}
        </p>
      );
    }
    return null;
  }

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 ${className ?? ''}`}
    >
      <p className="text-sm text-muted-foreground">
        Showing {pagination.from ?? 0}–{pagination.to ?? 0} of {pagination.total}
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) onPageChange(page - 1);
              }}
              className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          <PaginationItem>
            <span className="px-3 text-sm">
              Page {pagination.page} of {pagination.total_pages}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page < pagination.total_pages) onPageChange(page + 1);
              }}
              className={page >= pagination.total_pages ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
