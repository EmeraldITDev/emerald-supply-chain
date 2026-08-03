import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Boxes, PackageCheck, AlertTriangle, Wallet } from 'lucide-react';
import { warehouseInventoryApi } from '@/services/warehouseInventoryApi';
import { formatCurrency } from '@/utils/currency';

const StatCard = ({
  title,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: typeof Boxes;
  loading: boolean;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-primary" />
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="text-2xl font-bold">{value}</div>
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </CardContent>
  </Card>
);

export const WarehouseDashboardPanel = ({ canViewValuation }: { canViewValuation: boolean }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['warehouse', 'dashboard'],
    queryFn: () => warehouseInventoryApi.getDashboard(),
  });

  const summary = data ?? {};

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {canViewValuation && (
          <StatCard
            title="Inventory Value"
            value={formatCurrency(summary.total_inventory_value ?? 0)}
            hint="Total valuation at current cost"
            icon={Wallet}
            loading={isLoading}
          />
        )}
        <StatCard
          title="Stock Items"
          value={summary.total_stock_items ?? 0}
          hint={`${summary.qty_available ?? 0} available / ${summary.qty_reserved ?? 0} reserved`}
          icon={Boxes}
          loading={isLoading}
        />
        <StatCard
          title="Low Stock"
          value={summary.low_stock_count ?? 0}
          hint={`${summary.dead_stock_count ?? 0} dead stock items`}
          icon={AlertTriangle}
          loading={isLoading}
        />
        <StatCard
          title="Pending Counts"
          value={summary.pending_counts ?? 0}
          hint="Counts awaiting review or posting"
          icon={PackageCheck}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Location Utilization</CardTitle>
            <CardDescription>Capacity used per warehouse location</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <Skeleton className="h-24 w-full" />}
            {!isLoading && (summary.utilization ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No utilization data yet.</p>
            )}
            {(summary.utilization ?? []).map((u) => (
              <div key={u.location_id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate">{u.location_path}</span>
                  <span className="text-muted-foreground">{Math.round(u.utilization_percent)}%</span>
                </div>
                <Progress value={Math.min(100, u.utilization_percent)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Goods Receipts</CardTitle>
            <CardDescription>Latest deliveries received against purchase orders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <Skeleton className="h-24 w-full" />}
            {!isLoading && (summary.recent_receipts ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No goods receipts recorded yet.</p>
            )}
            {(summary.recent_receipts ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.grn_number || r.id}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.vendor_name || 'Unknown vendor'} · PO {r.po_number || '—'}
                  </p>
                </div>
                <Badge variant="secondary">
                  {r.received_at ? new Date(r.received_at).toLocaleDateString() : '—'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WarehouseDashboardPanel;