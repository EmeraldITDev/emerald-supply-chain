import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { Download } from 'lucide-react';
import { warehouseInventoryApi } from '@/services/warehouseInventoryApi';
import type { WarehouseReportKey } from '@/types/warehouse-inventory';

const REPORTS: { value: WarehouseReportKey; label: string; valuation?: boolean }[] = [
  { value: 'inventory_summary', label: 'Inventory Summary' },
  { value: 'stock_ledger', label: 'Stock Ledger' },
  { value: 'inventory_aging', label: 'Inventory Aging' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'dead_stock', label: 'Dead Stock' },
  { value: 'abc_analysis', label: 'ABC Analysis' },
  { value: 'stock_valuation', label: 'Stock Valuation', valuation: true },
  { value: 'goods_receipt_history', label: 'Goods Receipt History' },
];

const humanize = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const WarehouseReports = ({ canViewValuation }: { canViewValuation: boolean }) => {
  const [report, setReport] = useState<WarehouseReportKey>('inventory_summary');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters = { date_from: dateFrom || undefined, date_to: dateTo || undefined };

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['warehouse', 'report', report, dateFrom, dateTo],
    queryFn: () => warehouseInventoryApi.getReport(report, filters),
  });

  const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
  const options = REPORTS.filter((r) => !r.valuation || canViewValuation);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Warehouse Reports</CardTitle>
        <CardDescription>Server-generated reports with PDF, Excel and CSV export</CardDescription>
        <div className="grid gap-3 pt-2 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="r-report">Report</Label>
            <Select value={report} onValueChange={(v) => setReport(v as WarehouseReportKey)}>
              <SelectTrigger id="r-report">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-from">From</Label>
            <Input id="r-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-to">To</Label>
            <Input id="r-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            {(['pdf', 'xlsx', 'csv'] as const).map((fmt) => (
              <Button
                key={fmt}
                size="sm"
                variant="outline"
                onClick={() => {
                  const url = warehouseInventoryApi.reportExportUrl(report, fmt, filters);
                  const a = document.createElement('a');
                  a.href = url;
                  a.rel = 'noopener';
                  a.target = '_blank';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                {fmt.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <TableSkeleton rows={6} />}
        {!isLoading && error && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Report unavailable — {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No data for the selected filters.</p>
        )}
        {!isLoading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c}>{humanize(c)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell key={c} className="text-sm">
                        {String((row as Record<string, unknown>)[c] ?? '—')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WarehouseReports;