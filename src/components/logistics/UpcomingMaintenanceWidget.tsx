import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench } from "lucide-react";
import { fleetApi } from "@/services/logisticsApi";
import type { UpcomingMaintenanceItem } from "@/types/logistics";

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
};

const daysFromToday = (iso?: string): number | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
};

const normalize = (raw: any): UpcomingMaintenanceItem => ({
  vehicleId: (raw.vehicle_id ?? raw.vehicleId ?? "").toString(),
  plate: raw.plate || raw.vehicle_plate || raw.plate_number || "—",
  vehicleName: raw.vehicle_name || raw.vehicleName,
  maintenanceType: raw.maintenance_type || raw.maintenanceType || "Maintenance",
  nextMaintenanceDate: raw.next_maintenance_date || raw.nextMaintenanceDate || raw.due_date || "",
  daysRemaining: raw.days_remaining ?? raw.daysRemaining,
});

export const UpcomingMaintenanceWidget = () => {
  const [items, setItems] = useState<UpcomingMaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fleetApi.getUpcomingMaintenance();
      if (res.success && res.data) {
        const arr = Array.isArray(res.data) ? res.data : (res.data as any).items || [];
        const normalized = arr.map(normalize).filter((i: UpcomingMaintenanceItem) => {
          const remaining = i.daysRemaining ?? daysFromToday(i.nextMaintenanceDate);
          return remaining !== undefined && remaining >= 0 && remaining <= 14;
        });
        setItems(normalized);
      } else {
        setItems([]);
        if (res.error) setError(res.error);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Upcoming Maintenance (next 14 days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-2">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={fetchData}>Retry</Button>
            </AlertDescription>
          </Alert>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No maintenance due in the next 14 days.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Plate</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Due Date</th>
                  <th className="py-2">Days</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const days = it.daysRemaining ?? daysFromToday(it.nextMaintenanceDate);
                  const tone = days !== undefined && days <= 3
                    ? "bg-destructive/10 text-destructive"
                    : days !== undefined && days <= 7
                      ? "bg-warning/10 text-warning"
                      : "bg-info/10 text-info";
                  return (
                    <tr key={`${it.vehicleId}-${idx}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{it.plate}</td>
                      <td className="py-2 pr-3">{it.maintenanceType}</td>
                      <td className="py-2 pr-3">{formatDate(it.nextMaintenanceDate)}</td>
                      <td className="py-2">
                        <Badge variant="outline" className={tone}>{days ?? "—"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingMaintenanceWidget;