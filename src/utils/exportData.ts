import type { MRF, SRF, RFQ, Quotation, Vendor } from '@/types';

// Export to CSV
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string
) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        const stringValue = value?.toString() || '';
        // Escape commas and quotes
        return stringValue.includes(',') || stringValue.includes('"')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
}

// Export to JSON
export function exportToJSON<T>(data: T[], filename: string) {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
}

// Export to Excel (CSV with Excel-specific formatting)
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string
) {
  if (data.length === 0) return;

  // Excel prefers UTF-8 with BOM
  const BOM = '\uFEFF';
  const headers = Object.keys(data[0]);
  
  const csvContent = BOM + [
    headers.join('\t'), // Tab-separated for better Excel compatibility
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        const stringValue = value?.toString() || '';
        return stringValue.includes('\t') || stringValue.includes('"')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join('\t')
    )
  ].join('\n');

  downloadFile(csvContent, `${filename}.xls`, 'application/vnd.ms-excel');
}

// Helper function to trigger download
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// Print current page
export function printPage() {
  window.print();
}

// Prepare data for export (flatten nested objects)
export function prepareForExport<T extends Record<string, any>>(data: T[]): any[] {
  return data.map(item => {
    const flattened: Record<string, any> = {};
    
    Object.entries(item).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Flatten nested objects
        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
          flattened[`${key}_${nestedKey}`] = nestedValue;
        });
      } else if (Array.isArray(value)) {
        // Convert arrays to comma-separated strings
        flattened[key] = value.join(', ');
      } else {
        flattened[key] = value;
      }
    });
    
    return flattened;
  });
}

// Export specific data types with proper formatting
export function exportMRFs(mrfs: MRF[], format: 'csv' | 'excel' | 'json' = 'csv') {
  const prepared = prepareForExport(mrfs);
  const filename = `MRF_Report_${new Date().toISOString().split('T')[0]}`;
  
  switch (format) {
    case 'csv':
      exportToCSV(prepared, filename);
      break;
    case 'excel':
      exportToExcel(prepared, filename);
      break;
    case 'json':
      exportToJSON(mrfs, filename);
      break;
  }
}

export function exportSRFs(srfs: SRF[], format: 'csv' | 'excel' | 'json' = 'csv') {
  const prepared = prepareForExport(srfs);
  const filename = `SRF_Report_${new Date().toISOString().split('T')[0]}`;
  
  switch (format) {
    case 'csv':
      exportToCSV(prepared, filename);
      break;
    case 'excel':
      exportToExcel(prepared, filename);
      break;
    case 'json':
      exportToJSON(srfs, filename);
      break;
  }
}

export function exportRFQs(rfqs: RFQ[], format: 'csv' | 'excel' | 'json' = 'csv') {
  const prepared = prepareForExport(rfqs);
  const filename = `RFQ_Report_${new Date().toISOString().split('T')[0]}`;
  
  switch (format) {
    case 'csv':
      exportToCSV(prepared, filename);
      break;
    case 'excel':
      exportToExcel(prepared, filename);
      break;
    case 'json':
      exportToJSON(rfqs, filename);
      break;
  }
}

export function exportQuotations(quotations: Quotation[], format: 'csv' | 'excel' | 'json' = 'csv') {
  const prepared = prepareForExport(quotations);
  const filename = `Quotations_Report_${new Date().toISOString().split('T')[0]}`;
  
  switch (format) {
    case 'csv':
      exportToCSV(prepared, filename);
      break;
    case 'excel':
      exportToExcel(prepared, filename);
      break;
    case 'json':
      exportToJSON(quotations, filename);
      break;
  }
}

export function exportVendors(vendors: Vendor[], format: 'csv' | 'excel' | 'json' = 'csv') {
  const prepared = prepareForExport(vendors);
  const filename = `Vendors_Report_${new Date().toISOString().split('T')[0]}`;
  
  switch (format) {
    case 'csv':
      exportToCSV(prepared, filename);
      break;
    case 'excel':
      exportToExcel(prepared, filename);
      break;
    case 'json':
      exportToJSON(vendors, filename);
      break;
  }
}
