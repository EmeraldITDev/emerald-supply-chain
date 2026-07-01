import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { vendorApi } from '@/services/api';
import {
  VENDOR_DIRECTORY_EXPORT_COLUMNS,
  buildVendorDirectoryCsv,
  downloadBlob,
  loadStoredExportColumns,
  storeExportColumns,
  vendorDirectoryExportFilename,
  type VendorDirectoryExportColumnKey,
} from '@/utils/vendorDirectoryExport';
import { parseExportLimitInput, TABLE_EXPORT_DEFAULT_LIMIT, TABLE_EXPORT_MAX_ROWS } from '@/utils/tableExport';
import { Input } from '@/components/ui/input';

export type VendorDirectoryExportFilters = {
  search?: string;
  status?: string;
  category?: string;
};

interface VendorDirectoryExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: VendorDirectoryExportFilters;
  hasActiveFilters: boolean;
}

type ExportFormat = 'pdf' | 'xlsx' | 'csv';

export function VendorDirectoryExportDialog({
  open,
  onOpenChange,
  filters,
  hasActiveFilters,
}: VendorDirectoryExportDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [selectedColumns, setSelectedColumns] = useState<VendorDirectoryExportColumnKey[]>(
    () => loadStoredExportColumns(),
  );
  const [exporting, setExporting] = useState(false);
  const [limitInput, setLimitInput] = useState(String(TABLE_EXPORT_DEFAULT_LIMIT));

  useEffect(() => {
    if (open) {
      setSelectedColumns(loadStoredExportColumns());
    }
  }, [open]);

  const allSelected = useMemo(
    () => selectedColumns.length === VENDOR_DIRECTORY_EXPORT_COLUMNS.length,
    [selectedColumns],
  );

  const toggleColumn = (key: VendorDirectoryExportColumnKey, checked: boolean) => {
    setSelectedColumns((prev) => {
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key];
      }
      return prev.filter((k) => k !== key);
    });
  };

  const selectAll = () => {
    setSelectedColumns(VENDOR_DIRECTORY_EXPORT_COLUMNS.map((c) => c.key));
  };

  const deselectAll = () => {
    setSelectedColumns([]);
  };

  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      toast({
        title: 'Select columns',
        description: 'Choose at least one field to include in the export.',
        variant: 'destructive',
      });
      return;
    }

    storeExportColumns(selectedColumns);
    setExporting(true);

    const limit = parseExportLimitInput(limitInput);
    const limitParam = limit === 'all' ? 'all' : String(limit);

    try {
      const params = {
        columns: selectedColumns,
        search: filters.search,
        status: filters.status,
        category: filters.category,
        limit: limitParam,
      };

      if (format === 'csv') {
        const res = await vendorApi.exportDirectoryRows(params);
        if (!res.success || !res.data) {
          throw new Error(res.error || 'Failed to load export data');
        }
        const csv = buildVendorDirectoryCsv(res.data.headers, res.data.rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, vendorDirectoryExportFilename('csv'));
      } else {
        const res = await vendorApi.exportDirectory(format, params);
        if (!res.success || !res.data) {
          throw new Error(res.error || 'Export failed');
        }
        downloadBlob(res.data, vendorDirectoryExportFilename(format));
      }

      toast({
        title: 'Export complete',
        description: `Vendor directory downloaded as ${format.toUpperCase()}.`,
      });
      onOpenChange(false);
    } catch (e: unknown) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Could not export vendor directory',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export vendor directory</DialogTitle>
          <DialogDescription>
            Choose a format and the fields to include. Nothing is exported until you confirm.
          </DialogDescription>
        </DialogHeader>

        {hasActiveFilters && (
          <Alert>
            <AlertDescription>
              Exporting filtered results only. Clear filters to export all vendors.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Export format</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
              className="grid gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="vendor-export-pdf" />
                <Label htmlFor="vendor-export-pdf" className="flex items-center gap-2 cursor-pointer font-normal">
                  <FileText className="h-4 w-4" />
                  PDF (server-generated)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="vendor-export-xlsx" />
                <Label htmlFor="vendor-export-xlsx" className="flex items-center gap-2 cursor-pointer font-normal">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel (XLSX, server-generated)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="vendor-export-csv" />
                <Label htmlFor="vendor-export-csv" className="flex items-center gap-2 cursor-pointer font-normal">
                  <Download className="h-4 w-4" />
                  CSV (assembled in browser)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">Columns to include</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={selectAll}
                  disabled={allSelected}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={deselectAll}
                  disabled={selectedColumns.length === 0}
                >
                  Deselect all
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-md p-3 max-h-48 overflow-y-auto">
              {VENDOR_DIRECTORY_EXPORT_COLUMNS.map((col) => (
                <div key={col.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`vendor-col-${col.key}`}
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={(checked) =>
                      toggleColumn(col.key, checked === true)
                    }
                  />
                  <Label
                    htmlFor={`vendor-col-${col.key}`}
                    className="text-sm font-normal cursor-pointer leading-tight"
                  >
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedColumns.length} column{selectedColumns.length === 1 ? '' : 's'} selected
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-export-limit">Number of records</Label>
            <Input
              id="vendor-export-limit"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              placeholder={`e.g. 50, 100, or All (max ${TABLE_EXPORT_MAX_ROWS.toLocaleString()})`}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
