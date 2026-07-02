import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type ReactNode, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export interface VirtualizedTableProps<T> {
  /** Full row dataset — the whole array (windowed internally). */
  rows: T[];
  /** Stable row height in px (uniform). Defaults to 56. */
  rowHeight?: number;
  /** Estimated header height (sticky). Defaults to 44. */
  headerHeight?: number;
  /** Max viewport height in px. Container becomes internally scrollable. Defaults to 640. */
  maxHeight?: number;
  /** Number of extra rows to render above/below viewport. */
  overscan?: number;
  /** Optional stable key extractor. Falls back to index. */
  getRowKey?: (row: T, index: number) => string | number;
  /** Header (thead) content — rendered once, sticky. */
  header: ReactNode;
  /** Row renderer — receives the row and its index. Must return a <tr>. */
  renderRow: (row: T, index: number) => ReactNode;
  /** Render fallback when rows is empty. */
  emptyState?: ReactNode;
  /**
   * Row-count threshold below which virtualization is skipped and the table
   * renders as a plain list. Prevents overhead on small tables. Default 50.
   */
  virtualizeThreshold?: number;
  className?: string;
  tableClassName?: string;
  style?: CSSProperties;
}

/**
 * Headless virtualized table body built on `@tanstack/react-virtual`.
 * Keeps the semantic <table>/<thead>/<tbody> structure so existing shadcn
 * styling continues to apply. Off for small datasets, transparently on for large ones.
 */
export function VirtualizedTable<T>({
  rows,
  rowHeight = 56,
  headerHeight = 44,
  maxHeight = 640,
  overscan = 8,
  getRowKey,
  header,
  renderRow,
  emptyState,
  virtualizeThreshold = 50,
  className,
  tableClassName,
  style,
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const shouldVirtualize = rows.length > virtualizeThreshold;

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? rows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  if (rows.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  if (!shouldVirtualize) {
    return (
      <div
        ref={parentRef}
        className={cn("relative overflow-auto", className)}
        style={{ maxHeight, ...style }}
      >
        <table className={cn("w-full caption-bottom text-sm", tableClassName)}>
          <thead className="sticky top-0 z-10 bg-background">{header}</thead>
          <tbody>{rows.map((row, i) => renderRow(row, i))}</tbody>
        </table>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom = totalHeight - (virtualItems[virtualItems.length - 1]?.end ?? 0);

  return (
    <div
      ref={parentRef}
      className={cn("relative overflow-auto", className)}
      style={{ maxHeight, ...style }}
    >
      <table
        className={cn("w-full caption-bottom text-sm", tableClassName)}
        style={{ height: totalHeight + headerHeight }}
      >
        <thead className="sticky top-0 z-10 bg-background">{header}</thead>
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden style={{ height: paddingTop }}>
              <td />
            </tr>
          )}
          {virtualItems.map((vi) => {
            const row = rows[vi.index];
            const key = getRowKey ? getRowKey(row, vi.index) : vi.index;
            return (
              <tr key={key} data-index={vi.index} ref={virtualizer.measureElement}>
                {/* Row renderer should return the <td> cells only when using this variant. */}
                {renderRow(row, vi.index)}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden style={{ height: paddingBottom }}>
              <td />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Simpler variant for vertical lists (non-table). Same threshold behavior.
 */
export interface VirtualizedListProps<T> {
  rows: T[];
  rowHeight?: number;
  maxHeight?: number;
  overscan?: number;
  getRowKey?: (row: T, index: number) => string | number;
  renderRow: (row: T, index: number) => ReactNode;
  emptyState?: ReactNode;
  virtualizeThreshold?: number;
  className?: string;
}

export function VirtualizedList<T>({
  rows,
  rowHeight = 72,
  maxHeight = 640,
  overscan = 6,
  getRowKey,
  renderRow,
  emptyState,
  virtualizeThreshold = 40,
  className,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const shouldVirtualize = rows.length > virtualizeThreshold;
  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? rows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  if (rows.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  if (!shouldVirtualize) {
    return (
      <div
        ref={parentRef}
        className={cn("overflow-auto", className)}
        style={{ maxHeight }}
      >
        {rows.map((row, i) => (
          <div key={getRowKey ? getRowKey(row, i) : i}>{renderRow(row, i)}</div>
        ))}
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();
  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
      style={{ maxHeight }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {items.map((vi) => {
          const row = rows[vi.index];
          const key = getRowKey ? getRowKey(row, vi.index) : vi.index;
          return (
            <div
              key={key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {renderRow(row, vi.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}