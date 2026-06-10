import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fleetApi } from "@/services/logisticsApi";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";

export default function FleetDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fleetApi
      .getById(id)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setVehicle(res.data);
        else setError(res.error || "Failed to load vehicle");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const v = vehicle as any;
  return (
    <EntityDetailShell
      title={v ? `${v.make || ""} ${v.model || ""}`.trim() || "Vehicle" : "Vehicle"}
      subtitle={v?.plate_number || v?.plateNumber || id}
      status={v?.status}
      backTo="/logistics"
      backLabel="Back to Logistics"
      loading={loading}
      error={error}
      notFound={!loading && !error && !vehicle}
      notFoundLabel="Vehicle not found"
    >
      {vehicle && (
        <DetailFields
          fields={[
            { label: "Plate Number", value: v.plate_number || v.plateNumber },
            { label: "Make", value: v.make },
            { label: "Model", value: v.model },
            { label: "Year", value: v.year },
            { label: "Type", value: v.vehicle_type || v.type },
            { label: "Assigned Driver", value: v.assigned_driver_name || v.driver?.name },
          ]}
        />
      )}
    </EntityDetailShell>
  );
}