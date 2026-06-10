import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { tripsApi } from "@/services/logisticsApi";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";

export default function TripDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tripsApi
      .getById(id)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setTrip(res.data);
        else setError(res.error || "Failed to load trip");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const t = trip as any;
  return (
    <EntityDetailShell
      title={t?.trip_number || t?.tripNumber || t?.purpose || "Trip"}
      subtitle={t?.purpose || id}
      status={t?.status}
      backTo="/logistics"
      backLabel="Back to Logistics"
      loading={loading}
      error={error}
      notFound={!loading && !error && !trip}
      notFoundLabel="Trip not found"
    >
      {trip && (
        <DetailFields
          fields={[
            { label: "Origin", value: t.origin },
            { label: "Destination", value: t.destination },
            { label: "Departure", value: t.departure_date || t.departureDate },
            { label: "Return", value: t.return_date || t.returnDate },
            { label: "Driver", value: t.driver_name || t.external_driver?.name },
            { label: "Vehicle", value: t.vehicle_plate || t.vehicle?.plate_number },
          ]}
        />
      )}
    </EntityDetailShell>
  );
}