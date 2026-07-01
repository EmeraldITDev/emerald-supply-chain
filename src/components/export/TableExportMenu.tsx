import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { TableExportController } from '@/hooks/useTableExport';
import type { TableExportFormat } from '@/utils/tableExport';
import { TABLE_EXPORT_MAX_ROWS } from '@/utils/tableExport';

type TableExportMenuProps<T> = {
  export: TableExportController<T>;
  /** Shown in dialog header, e.g. "Material Request Forms" */
  title?: string;
  disabled?: boolean;
  className?: string;
};

export function TableExportMenu<T>({
  export: exp,
  title = 'Export table',
  disabled = false,
  className,
}: TableExportMenuProps<T>) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className ?? 'gap-1.5'}
        disabled={disabled}
        onClick={() => exp.setDialogOpen(true)}
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </Button>

      <Dialog open={exp.dialogOpen} onOpenChange={exp.setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Export respects the table&apos;s current search, filters, and sort order.
            </DialogDescription>
          </DialogHeader>

          {exp.hasActiveFilters && (
            <Alert>
              <AlertDescription>
                Exporting filtered results only. Clear filters to export all records.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="table-export-format">Format</Label>
              <RadioGroup
                value={exp.format}
                onValueChange={(v) => exp.setFormat(v as TableExportFormat)}
                className="grid gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="xlsx" id="table-export-xlsx" />
                  <Label htmlFor="table-export-xlsx" className="flex items-center gap-2 font-normal cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel (XLSX)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="table-export-csv" />
                  <Label htmlFor="table-export-csv" className="flex items-center gap-2 font-normal cursor-pointer">
                    <FileText className="h-4 w-4" />
                    CSV
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="table-export-limit">Number of records</Label>
              <Input
                id="table-export-limit"
                value={exp.limitInput}
                onChange={(e) => exp.setLimitInput(e.target.value)}
                placeholder={`e.g. 50, 100, or All (max ${TABLE_EXPORT_MAX_ROWS})`}
              />
              <p className="text-xs text-muted-foreground">
                Enter a number or &quot;All&quot; to export up to {TABLE_EXPORT_MAX_ROWS.toLocaleString()} matching rows.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => exp.setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void exp.runExport()} disabled={exp.exporting}>
              {exp.exporting ? (
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
    </>
  );
}
