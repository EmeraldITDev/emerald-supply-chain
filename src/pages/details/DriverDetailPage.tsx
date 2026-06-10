import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { driversApi } from "@/services/logisticsApi";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";

export default function DriverDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [driver, setDriver] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // No direct getById endpoint — match from list().
    driversApi
      .list()
      .then((res) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          const match = res.data.find((d: any) => String(d.id) === String(id));
          setDriver(match || null);
        } else {
          setError(res.error || "Failed to load driver");
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const d = driver as any;
  return (
    <EntityDetailShell
      title={d?.name || "Driver"}
      subtitle={d?.licence_number || d?.license_number || id}
      status={d?.status}
      backTo="/logistics"
      backLabel="Back to Logistics"
      loading={loading}
      error={error}
      notFound={!loading && !error && !driver}
      notFoundLabel="Driver not found"
    >
      {driver && (
        <DetailFields
          fields={[
            { label: "Name", value: d.name },
            { label: "Phone", value: d.phone_number || d.phone },
            { label: "Email", value: d.email },
            { label: "Licence Number", value: d.licence_number || d.license_number },
            { label: "Status", value: d.status },
          ]}
        />
      )}
    </EntityDetailShell>
  );
}