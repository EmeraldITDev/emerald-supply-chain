import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { tripRequestApi } from "@/services/api";
import type { StaffTripRequest } from "@/types/trip-request";
import { TripRequestDetailDialog } from "./TripRequestDetailDialog";

interface MyTripRequestsListProps {
  refreshKey?: number;
}

function tripLabel(t: StaffTripRequest): string {
  return t.tripCode ?? `TRQ-${t.id}`;
}

function scopeLabel(t: StaffTripRequest): string {
  return (
    t.bookingScopeLabel ??
    t.booking_scope_label ??
    (t.bookingScope === "outside_state" ? "Outside State" : "Within State")
  );
}

export function MyTripRequestsList({ refreshKey = 0 }: MyTripRequestsListProps) {
  const [trips, setTrips] = useState<StaffTripRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tripRequestApi.list({ limit: 50 });
      if (res.success && res.data) {
        setTrips(res.data.trips ?? []);
      } else {
        setTrips([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const openDetail = (id: string | number) => {
    setSelectedId(String(id));
    setDetailOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>No trip requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => {
            const summary = trip.progressSummary;
            const pct = summary?.progressPercent ?? 0;
            const dep =
              trip.scheduledDepartureAt ??
              trip.scheduled_departure_at ??
              trip.createdAt ??
              trip.created_at;
            return (
              <Card
                key={String(trip.id)}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openDetail(trip.id)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{trip.destination}</p>
                      <p className="text-xs text-muted-foreground font-mono">{tripLabel(trip)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline">{scopeLabel(trip)}</Badge>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {trip.status}
                      </Badge>
                    </div>
                  </div>
                  {dep && (
                    <p className="text-xs text-muted-foreground">
                      Departure:{" "}
                      {new Date(dep).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                  {summary && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {summary.currentStepLabel ?? summary.currentStepKey ?? "In progress"}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(trip.id);
                    }}
                  >
                    View progress
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TripRequestDetailDialog
        tripId={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}

export default MyTripRequestsList;
