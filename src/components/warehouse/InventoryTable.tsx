import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { ScanLine, Search } from 'lucide-react';
import { warehouseInventoryApi } from '@/services/warehouseInventoryApi';
import { BarcodeScannerDialog } from './BarcodeScannerDialog';
import type { InventoryRecord } from '@/types/warehouse-inventory';

const fmtQty = (v: number | null | undefined) => (v == null ? '—' : new Intl.NumberFormat('en-NG').format(v));

export const InventoryTable = () => {
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const { data: inventory = [], isLoading, error } = useQuery({
    queryKey: ['warehouse', 'inventory', search],
    queryFn: () => warehouseInventoryApi.getInventory(search ? { search } : {}),
  });

  const rows = useMemo<InventoryRecord[]>(() => inventory, [inventory]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory</CardTitle>
        <CardDescription>Real-time stock across every warehouse location, down to bin level</CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search SKU, description or location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => setScannerOpen(true)}>
            <ScanLine className="mr-2 h-4 w-4" /> Scan
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <TableSkeleton rows={6} />}
        {!isLoading && error && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Inventory unavailable — {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No inventory records found.</p>
        )}
        {!isLoading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Reorder</TableHead>
                  <TableHead>Batch / Lot</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const low = r.reorder_level != null && r.qty_on_hand <= r.reorder_level;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.sku}</TableCell>
                      <TableCell className="max-w-[240px] truncate">{r.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.location_path || r.bin_code || '—'}
                      </TableCell>
                      <TableCell className="text-right">{fmtQty(r.qty_on_hand)}</TableCell>
                      <TableCell className="text-right">{fmtQty(r.qty_reserved)}</TableCell>
                      <TableCell className="text-right">{fmtQty(r.qty_available)}</TableCell>
                      <TableCell className="text-right">{fmtQty(r.reorder_level)}</TableCell>
                      <TableCell className="text-sm">{r.batch_number || r.lot_number || '—'}</TableCell>
                      <TableCell className="text-sm">{r.expiry_date || '—'}</TableCell>
                      <TableCell>
                        {r.is_quarantined ? (
                          <Badge variant="destructive">Quarantine</Badge>
                        ) : low ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            Low stock
                          </Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <BarcodeScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onDetected={(code) => setSearch(code)} />
    </Card>
  );
};

export default InventoryTable;