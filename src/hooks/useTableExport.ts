import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  exportTableDataset,
  fetchTableRowsWithLimit,
  parseExportLimitInput,
  rowsFromColumns,
  TABLE_EXPORT_DEFAULT_LIMIT,
  type FetchTablePageResult,
  type TableExportColumn,
  type TableExportFormat,
} from '@/utils/tableExport';

export type UseTableExportOptions<T> = {
  /** e.g. "MRF_List" → MRF_List_2026-07-01.csv */
  filenamePrefix: string;
  columns: TableExportColumn<T>[];
  /** Paginated fetch — receives same filters/sort the table uses. */
  fetchPage: (page: number, perPage: number) => Promise<FetchTablePageResult<T>>;
  hasActiveFilters?: boolean;
};

export function useTableExport<T>({
  filenamePrefix,
  columns,
  fetchPage,
  hasActiveFilters = false,
}: UseTableExportOptions<T>) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<TableExportFormat>('xlsx');
  const [limitInput, setLimitInput] = useState(String(TABLE_EXPORT_DEFAULT_LIMIT));

  const runExport = useCallback(async () => {
    if (!columns.length) {
      toast({
        title: 'Nothing to export',
        description: 'No export columns configured.',
        variant: 'destructive',
      });
      return;
    }

    const limit = parseExportLimitInput(limitInput);
    setExporting(true);
    try {
      const items = await fetchTableRowsWithLimit(fetchPage, limit);
      if (!items.length) {
        toast({
          title: 'No records',
          description: 'No rows match the current table filters.',
          variant: 'destructive',
        });
        return;
      }
      const { headers, rows } = rowsFromColumns(items, columns);
      exportTableDataset(filenamePrefix, format, headers, rows);
      toast({
        title: 'Export complete',
        description: `Downloaded ${items.length} row(s) as ${format.toUpperCase()}.`,
      });
      setDialogOpen(false);
    } catch (e: unknown) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Could not export table data',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  }, [columns, fetchPage, filenamePrefix, format, limitInput, toast]);

  return {
    dialogOpen,
    setDialogOpen,
    exporting,
    format,
    setFormat,
    limitInput,
    setLimitInput,
    runExport,
    hasActiveFilters,
    filenamePrefix,
  };
}

export type TableExportController<T> = ReturnType<typeof useTableExport<T>>;
