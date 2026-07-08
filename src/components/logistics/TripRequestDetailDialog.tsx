import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { tripRequestApi } from "@/services/api";
import type { StaffTripRequest, TripProgressStep } from "@/types/trip-request";
import { SimpleProgressStepper } from "@/components/progress/SimpleProgressStepper";
import { DeleteTripDraftButton } from "./DeleteTripDraftButton";
import { TripCommentsPanel } from "./TripCommentsPanel";
import { TripRequestWorkflowActions } from "./TripRequestWorkflowActions";
import { resolveTripBookingScopeLabel } from "@/utils/tripBookingValidation";
import { Separator } from "@/components/ui/separator";
import { CalendarClock, MapPin, Plane, Car, Users } from "lucide-react";
import type { ReactNode } from "react";

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value || "—"}</span>
    </div>
  );
}

interface TripRequestDetailDialogProps {
  tripId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
}

const STAFF_TRIP_STEPS_FALLBACK: TripProgressStep[] = [
  { key: "submitted", label: "Submitted", status: "in_progress", step: 1 },
  { key: "logistics_review", label: "Logistics Manager Review", status: "pending", step: 2 },
  { key: "director_approval", label: "Supervising Director Approval", status: "pending", step: 3 },
  { key: "converted", label: "Logistics Request", status: "pending", step: 4 },
];

export function TripRequestDetailDialog({
  tripId,
  open,
  onOpenChange,
  onDeleted,
  onUpdated,
}: TripRequestDetailDialogProps) {
  const [trip, setTrip] = useState<StaffTripRequest | null>(null);
  const [steps, setSteps] = useState<TripProgressStep[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !tripId) {
      setTrip(null);
      setSteps([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const [detailRes, progressRes] = await Promise.all([
        tripRequestApi.getById(tripId),
        tripRequestApi.getProgressTracker(tripId),
      ]);
      if (cancelled) return;

      if (detailRes.success && detailRes.data?.trip) {
        setTrip(detailRes.data.trip);
      }

      const progressSteps =
        progressRes.data?.steps ??
        detailRes.data?.trip?.progress?.steps ??
        STAFF_TRIP_STEPS_FALLBACK;
      setSteps(progressSteps.length ? progressSteps : STAFF_TRIP_STEPS_FALLBACK);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, tripId]);

  const scopeLabel = resolveTripBookingScopeLabel(
    trip?.bookingScope ?? trip?.booking_scope,
    trip?.bookingScopeLabel ?? trip?.booking_scope_label,
  );

  const transportMode =
    trip?.internationalTransportMode ?? trip?.international_transport_mode;
  const transportModeLabel =
    transportMode === "flight"
      ? "By Flight"
      : transportMode === "road"
        ? "By Road"
        : null;
  const passengers = trip?.passengers ?? [];
  const externalPassengers = trip?.externalPassengers ?? trip?.external_passengers ?? [];
  const totalPassengers = passengers.length + externalPassengers.length;

  const handleDeleted = () => {
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{trip?.destination ?? "Trip request"}</DialogTitle>
          <DialogDescription>
            {trip?.tripCode ?? (tripId ? `Trip #${tripId}` : "")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {trip && (
              <div className="flex flex-wrap gap-2 text-sm items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{scopeLabel}</Badge>
                  <Badge variant="secondary" className="capitalize">
                    {trip.status}
                    {trip.isDraft ? " · draft" : ""}
                  </Badge>
                  {transportModeLabel && (
                    <Badge variant="outline" className="gap-1">
                      {transportMode === "flight" ? (
                        <Plane className="h-3 w-3" />
                      ) : (
                        <Car className="h-3 w-3" />
                      )}
                      {transportModeLabel}
                    </Badge>
                  )}
                </div>
                <DeleteTripDraftButton trip={trip} onDeleted={handleDeleted} variant="destructive" />
              </div>
            )}
            {trip && (
              <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <DetailRow
                    label="Origin"
                    value={
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {trip.origin ?? "—"}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Destination"
                    value={
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {trip.destination ?? "—"}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Departure"
                    value={
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3 text-muted-foreground" />
                        {formatDateTime(trip.scheduledDepartureAt ?? trip.scheduled_departure_at)}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Return"
                    value={
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3 text-muted-foreground" />
                        {formatDateTime(trip.scheduledArrivalAt ?? trip.scheduled_arrival_at)}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Requester"
                    value={trip.requesterName ?? trip.requester_name}
                  />
                  <DetailRow
                    label="Department"
                    value={trip.requesterDepartment ?? trip.requester_department}
                  />
                  <DetailRow
                    label="Total Passengers"
                    value={
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {totalPassengers}
                      </span>
                    }
                  />
                  {transportModeLabel && (
                    <DetailRow label="Transport Mode" value={transportModeLabel} />
                  )}
                </div>
                {trip.purpose && (
                  <>
                    <Separator />
                    <DetailRow label="Purpose" value={trip.purpose} />
                  </>
                )}
                {(passengers.length > 0 || externalPassengers.length > 0) && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                        Passengers
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {passengers.map((p, i) => (
                          <Badge key={p.id ?? `p-${i}`} variant="secondary" className="font-normal">
                            {p.name}
                            {p.department ? ` · ${p.department}` : ""}
                          </Badge>
                        ))}
                        {externalPassengers.map((p, i) => (
                          <Badge key={`ext-${i}`} variant="outline" className="font-normal">
                            {p.name} (external)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {trip && (trip.availableActions?.length ?? 0) > 0 && (
              <TripRequestWorkflowActions
                trip={trip}
                onUpdated={() => {
                  onUpdated?.();
                  if (!tripId) return;
                  void (async () => {
                    const [detailRes, progressRes] = await Promise.all([
                      tripRequestApi.getById(tripId),
                      tripRequestApi.getProgressTracker(tripId),
                    ]);
                    if (detailRes.success && detailRes.data?.trip) {
                      setTrip(detailRes.data.trip);
                    }
                    const progressSteps =
                      progressRes.data?.steps ??
                      detailRes.data?.trip?.progress?.steps ??
                      STAFF_TRIP_STEPS_FALLBACK;
                    setSteps(progressSteps.length ? progressSteps : STAFF_TRIP_STEPS_FALLBACK);
                  })();
                }}
              />
            )}
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Progress
              </p>
              <SimpleProgressStepper
                steps={steps.map((s) => ({
                  key: s.key,
                  label: s.label,
                  status: s.status,
                  completedAt: s.completedAt,
                }))}
              />
            </div>
            {tripId && <TripCommentsPanel tripRequestId={tripId} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TripRequestDetailDialog;
