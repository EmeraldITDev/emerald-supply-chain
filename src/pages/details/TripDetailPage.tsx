import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { tripsApi } from "@/services/logisticsApi";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";
import { TripCommentsPanel } from "@/components/logistics/TripCommentsPanel";
import { JourneyManagement } from "@/components/logistics/JourneyManagement";
import { Badge } from "@/components/ui/badge";
import type { Trip } from "@/types/logistics";

export default function TripDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
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

  const t = trip as Trip & Record<string, unknown> | null;
  const externalDriver = (t?.external_driver ?? t?.externalDriver) as
    | { name?: string; phone?: string }
    | undefined;

  return (
    <EntityDetailShell
      title={t?.tripNumber || t?.purpose || "Trip"}
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
        <div className="space-y-8">
          <DetailFields
            fields={[
              { label: "Trip number", value: trip.tripNumber },
              { label: "Origin", value: trip.origin },
              { label: "Destination", value: trip.destination },
              {
                label: "Scheduled departure",
                value: trip.scheduledDepartureAt
                  ? new Date(trip.scheduledDepartureAt).toLocaleString()
                  : undefined,
              },
              {
                label: "Scheduled arrival",
                value: trip.scheduledArrivalAt
                  ? new Date(trip.scheduledArrivalAt).toLocaleString()
                  : undefined,
              },
              { label: "Driver", value: trip.driverName || externalDriver?.name },
              { label: "Driver phone", value: trip.driverPhone || externalDriver?.phone },
              { label: "Vehicle", value: trip.vehiclePlate || trip.vehicleType },
              { label: "Vendor", value: trip.vendorName },
              { label: "Purpose", value: trip.purpose },
            ]}
          />

          {trip.passengers && trip.passengers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Passengers</h3>
              <div className="flex flex-wrap gap-2">
                {trip.passengers.map((p) => (
                  <Badge key={p.id} variant="secondary">
                    {p.name}
                    {p.department ? ` (${p.department})` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <TripCommentsPanel logisticsTripId={String(trip.id)} />

          <div>
            <h3 className="text-lg font-semibold mb-4">Journey tracking</h3>
            <JourneyManagement tripId={String(trip.id)} />
          </div>
        </div>
      )}
    </EntityDetailShell>
  );
}
