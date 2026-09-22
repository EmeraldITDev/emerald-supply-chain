import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import type { PaginationMeta } from '@/types/pagination';

interface ServerPaginationBarProps {
  pagination: PaginationMeta | null | undefined;
  page: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Max numbered buttons to show around the current page (default 5). */
  maxPageButtons?: number;
}

function visiblePages(current: number, total: number, maxButtons: number): (number | 'ellipsis')[] {
  if (total <= maxButtons) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const side = Math.floor((maxButtons - 3) / 2);
  let start = Math.max(2, current - side);
  let end = Math.min(total - 1, current + side);

  if (current - 1 <= side + 1) {
    start = 2;
    end = Math.min(total - 1, maxButtons - 2);
  }
  if (total - current <= side + 1) {
    end = total - 1;
    start = Math.max(2, total - (maxButtons - 3));
  }

  const pages: (number | 'ellipsis')[] = [1];
  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < total - 1) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

export function ServerPaginationBar({
  pagination,
  page,
  onPageChange,
  className,
  maxPageButtons = 5,
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

  const pages = visiblePages(page, pagination.total_pages, maxPageButtons);

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
              className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
            />
          </PaginationItem>
          {pages.map((p, idx) =>
            p === 'ellipsis' ? (
              <PaginationItem key={`e-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page < pagination.total_pages) onPageChange(page + 1);
              }}
              className={page >= pagination.total_pages ? 'pointer-events-none opacity-50' : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
