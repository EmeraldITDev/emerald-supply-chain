export const TABLE_EXPORT_MAX_ROWS = 10000;
export const TABLE_EXPORT_DEFAULT_LIMIT = 100;

export type TableExportColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
};

export type TableExportFormat = 'csv' | 'xlsx';

export type FetchTablePageResult<T> = {
  items: T[];
  pagination?: {
    page: number;
    total_pages: number;
    total?: number;
  };
};

export function exportFilename(prefix: string, ext: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const safe = prefix.replace(/[^\w-]+/g, '_').replace(/_+/g, '_');
  return `${safe}_${date}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** UTF-8 CSV with BOM for Excel compatibility. */
export function buildCsvContent(headers: string[], rows: string[][]): string {
  const bom = '\uFEFF';
  const headerLine = headers.map(escapeCsvCell).join(',');
  const body = rows.map((row) =>
    row.map((cell) => escapeCsvCell(String(cell ?? ''))).join(','),
  );
  return bom + [headerLine, ...body].join('\r\n');
}

/**
 * Build an XLSX blob. `xlsx` is ~430KB — kept out of the initial bundle by
 * dynamic-importing it here so it's only fetched when a user actually exports.
 */
export async function buildXlsxBlob(headers: string[], rows: string[][]): Promise<Blob> {
  const XLSX = await import('xlsx');
  const aoa = [headers, ...rows.map((r) => r.map((c) => c ?? ''))];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function rowsFromColumns<T>(
  items: T[],
  columns: TableExportColumn<T>[],
): { headers: string[]; rows: string[][] } {
  const headers = columns.map((c) => c.label);
  const rows = items.map((item) =>
    columns.map((col) => {
      const v = col.value(item);
      return v === null || v === undefined ? '' : String(v);
    }),
  );
  return { headers, rows };
}

/**
 * Walk paginated list endpoints until `limit` rows are collected.
 */
export async function fetchTableRowsWithLimit<T>(
  fetchPage: (page: number, perPage: number) => Promise<FetchTablePageResult<T>>,
  limit: number | 'all',
  options?: { perPage?: number; maxCap?: number },
): Promise<T[]> {
  const perPage = options?.perPage ?? 100;
  const maxCap = options?.maxCap ?? TABLE_EXPORT_MAX_ROWS;
  const target = limit === 'all' ? maxCap : Math.min(limit, maxCap);

  const all: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && all.length < target) {
    const { items, pagination } = await fetchPage(page, perPage);
    if (!items.length) break;
    all.push(...items);
    totalPages = pagination?.total_pages ?? (items.length < perPage ? page : page + 1);
    page += 1;
  }

  return all.slice(0, target);
}

export function parseExportLimitInput(raw: string): number | 'all' {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === 'all') return 'all';
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n) || n <= 0) return 'all';
  return Math.min(n, TABLE_EXPORT_MAX_ROWS);
}

export async function exportTableDataset(
  filenamePrefix: string,
  format: TableExportFormat,
  headers: string[],
  rows: string[][],
): Promise<void> {
  if (format === 'csv') {
    const csv = buildCsvContent(headers, rows);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), exportFilename(filenamePrefix, 'csv'));
    return;
  }
  const blob = await buildXlsxBlob(headers, rows);
  downloadBlob(blob, exportFilename(filenamePrefix, 'xlsx'));
}
