import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { AlertTriangle, CheckCircle2, FilePlus2 } from 'lucide-react';
import { warehouseInventoryApi } from '@/services/warehouseInventoryApi';

export const LowStockAlerts = ({ canRaiseMrf }: { canRaiseMrf: boolean }) => {
  const navigate = useNavigate();
  const { data: alerts = [], isLoading, error } = useQuery({
    queryKey: ['warehouse', 'low-stock'],
    queryFn: () => warehouseInventoryApi.getLowStockAlerts(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Low Stock Alerts
        </CardTitle>
        <CardDescription>Items at or below reorder level — raise an MRF to replenish</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <TableSkeleton rows={4} />}
        {!isLoading && error && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Alerts unavailable — {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && alerts.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            All items are above their reorder levels.
          </div>
        )}
        {!isLoading && alerts.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead>Severity</TableHead>
                  {canRaiseMrf && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.sku}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{a.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.location_path || '—'}</TableCell>
                    <TableCell className="text-right">
                      {a.qty_on_hand} {a.uom || ''}
                    </TableCell>
                    <TableCell className="text-right">{a.reorder_level ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={a.severity === 'critical' ? 'destructive' : 'outline'}>
                        {a.severity === 'critical' ? 'Critical' : 'Low'}
                      </Badge>
                    </TableCell>
                    {canRaiseMrf && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(
                              `/new-mrf?item=${encodeURIComponent(a.sku)}&description=${encodeURIComponent(a.description)}`,
                            )
                          }
                        >
                          <FilePlus2 className="mr-2 h-4 w-4" /> Raise MRF
                        </Button>
                      </TableCell>
                    )}
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

export default LowStockAlerts;