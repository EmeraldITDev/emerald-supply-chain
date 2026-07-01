import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, MapPin, RefreshCw, Edit } from "lucide-react";
import { tripRequestApi } from "@/services/api";
import type { StaffTripRequest } from "@/types/trip-request";
import { TripRequestDetailDialog } from "./TripRequestDetailDialog";
import { DeleteTripDraftButton } from "./DeleteTripDraftButton";
import { EditTripRequestDialog } from "./EditTripRequestDialog";
import { tripCanDeleteDraft } from "@/utils/tripDraftUi";
import {
  formatRequesterEditTimeRemaining,
  resolveRequesterEditAccess,
} from "@/utils/requesterEditWindow";
import { useAuth } from "@/contexts/AuthContext";

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
    (t.bookingScope === "international" || t.booking_scope === "international"
      ? "International (Out of Nigeria)"
      : t.bookingScope === "out_of_state_local" || t.booking_scope === "out_of_state_local"
        ? "Out of State (Local)"
        : t.bookingScope === "outside_state" || t.booking_scope === "outside_state"
          ? "Outside State"
          : "Within State")
  );
}

export function MyTripRequestsList({ refreshKey = 0 }: MyTripRequestsListProps) {
  const { user } = useAuth();
  const [trips, setTrips] = useState<StaffTripRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editTrip, setEditTrip] = useState<StaffTripRequest | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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

  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener("app:refresh", onRefresh);
    return () => window.removeEventListener("app:refresh", onRefresh);
  }, [load]);

  const openDetail = (id: string | number) => {
    setSelectedId(String(id));
    setDetailOpen(true);
  };

  const handleDeleted = (deletedId: string | number) => {
    setTrips((prev) => prev.filter((t) => String(t.id) !== String(deletedId)));
    if (selectedId === String(deletedId)) {
      setDetailOpen(false);
      setSelectedId(null);
    }
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
            const isDraft = trip.isDraft ?? trip.status === "draft";
            const editAccess = resolveRequesterEditAccess(trip, user);
            const editTimeLeft = formatRequesterEditTimeRemaining(editAccess.expiresAt);

            return (
              <Card
                key={String(trip.id)}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4 space-y-3">
                  <div
                    className="cursor-pointer"
                    onClick={() => openDetail(trip.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{trip.destination}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {tripLabel(trip)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline">{scopeLabel(trip)}</Badge>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {trip.status}
                          {isDraft ? " · draft" : ""}
                        </Badge>
                      </div>
                    </div>
                    {dep && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Departure:{" "}
                        {new Date(dep).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                    {summary && (
                      <div className="space-y-1 mt-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            {summary.currentStepLabel ??
                              summary.currentStepKey ??
                              "In progress"}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 min-w-[120px]"
                      onClick={() => openDetail(trip.id)}
                    >
                      View progress
                    </Button>
                    {editAccess.canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        title={editTimeLeft ?? undefined}
                        onClick={() => {
                          setEditTrip(trip);
                          setEditOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                    {tripCanDeleteDraft(trip) && (
                      <DeleteTripDraftButton
                        trip={trip}
                        onDeleted={() => handleDeleted(trip.id)}
                        variant="destructive"
                        stopPropagation
                      />
                    )}
                  </div>
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
        onDeleted={load}
      />

      <EditTripRequestDialog
        trip={editTrip}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={load}
      />
    </>
  );
}

export default MyTripRequestsList;
