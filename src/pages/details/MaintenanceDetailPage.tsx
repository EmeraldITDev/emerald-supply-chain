import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fleetApi } from "@/services/logisticsApi";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";

/**
 * Maintenance records are nested under vehicles. We resolve the record via
 * the upcoming-maintenance list, which carries the vehicle reference.
 */
export default function MaintenanceDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [record, setRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const promise = (fleetApi as any).getUpcomingMaintenance?.();
    if (!promise) {
      setLoading(false);
      setError("Maintenance API unavailable");
      return;
    }
    promise
      .then((res: any) => {
        if (cancelled) return;
        if (res?.success && Array.isArray(res.data)) {
          const match = res.data.find(
            (r: any) => String(r.id ?? r.schedule_id) === String(id),
          );
          setRecord(match || null);
        } else {
          setError(res?.error || "Failed to load maintenance record");
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const r = record as any;
  return (
    <EntityDetailShell
      title={r?.maintenance_type || r?.maintenanceType || "Maintenance"}
      subtitle={r?.vehicle_plate || r?.vehicle?.plate_number || id}
      status={r?.status}
      backTo="/logistics"
      backLabel="Back to Logistics"
      loading={loading}
      error={error}
      notFound={!loading && !error && !record}
      notFoundLabel="Maintenance record not found"
    >
      {record && (
        <DetailFields
          fields={[
            { label: "Vehicle", value: r.vehicle_plate || r.vehicle?.plate_number },
            { label: "Type", value: r.maintenance_type || r.maintenanceType },
            { label: "Due Date", value: r.due_date || r.dueDate },
            { label: "Interval (months)", value: r.interval_months || r.intervalMonths },
            { label: "Last Performed", value: r.last_maintenance_date || r.lastMaintenanceDate },
            { label: "Notes", value: r.notes },
          ]}
        />
      )}
    </EntityDetailShell>
  );
}