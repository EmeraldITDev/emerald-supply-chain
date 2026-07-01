export const VENDOR_DIRECTORY_EXPORT_ROLES = [
  'procurement_manager',
  'supply_chain_director',
  'executive',
  'logistics_manager',
] as const;

export const VENDOR_DIRECTORY_EXPORT_COLUMNS = [
  { key: 'vendor_id', label: 'Vendor ID' },
  { key: 'company_name', label: 'Company Name' },
  { key: 'category', label: 'Category' },
  { key: 'email', label: 'Email Address' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'address', label: 'Address' },
  { key: 'tax_id', label: 'Tax ID' },
  { key: 'contact_person', label: 'Contact Person' },
  { key: 'bank_name', label: 'Bank Name' },
  { key: 'account_number', label: 'Account Number' },
  { key: 'account_name', label: 'Account Name' },
  { key: 'currency', label: 'Currency' },
  { key: 'registration_status', label: 'Registration Status' },
  { key: 'registration_date', label: 'Registration Date' },
  { key: 'document_status', label: 'Document Status' },
] as const;

export type VendorDirectoryExportColumnKey =
  (typeof VENDOR_DIRECTORY_EXPORT_COLUMNS)[number]['key'];

export const VENDOR_DIRECTORY_EXPORT_COLUMNS_STORAGE_KEY =
  'vendor_directory_export_columns';

export function loadStoredExportColumns(): VendorDirectoryExportColumnKey[] {
  try {
    const raw = sessionStorage.getItem(VENDOR_DIRECTORY_EXPORT_COLUMNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const valid = new Set(
      VENDOR_DIRECTORY_EXPORT_COLUMNS.map((c) => c.key),
    );
    return parsed.filter(
      (k): k is VendorDirectoryExportColumnKey =>
        typeof k === 'string' && valid.has(k as VendorDirectoryExportColumnKey),
    );
  } catch {
    return [];
  }
}

export function storeExportColumns(columns: VendorDirectoryExportColumnKey[]): void {
  sessionStorage.setItem(
    VENDOR_DIRECTORY_EXPORT_COLUMNS_STORAGE_KEY,
    JSON.stringify(columns),
  );
}

export function vendorDirectoryExportFilename(ext: 'pdf' | 'xlsx' | 'csv'): string {
  const date = new Date().toISOString().slice(0, 10);
  return `Vendor_Directory_${date}.${ext}`;
}

export function buildVendorDirectoryCsv(
  headers: string[],
  rows: string[][],
): string {
  const escape = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const bom = '\uFEFF';
  const headerLine = headers.map(escape).join(',');
  const body = rows.map((row) =>
    row.map((cell) => escape(String(cell ?? ''))).join(','),
  );
  return bom + [headerLine, ...body].join('\r\n');
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
