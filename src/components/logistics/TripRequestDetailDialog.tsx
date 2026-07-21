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
import { CalendarClock, MapPin, Plane, Car, Users, BedDouble, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { formatPoAmount } from "@/utils/currency";

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

  const accommodationRequired = Boolean(
    trip?.accommodationRequired ?? trip?.accommodation_required,
  );
  const accName = trip?.accommodationName ?? trip?.accommodation_name ?? null;
  const accAddress = trip?.accommodationAddress ?? trip?.accommodation_address ?? null;
  const accContact = trip?.accommodationContact ?? trip?.accommodation_contact ?? null;
  const accDetails = trip?.accommodationDetails ?? trip?.accommodation_details ?? null;
  const accCost = trip?.accommodationEstimatedCost ?? trip?.accommodation_estimated_cost ?? null;
  const escortRequired = Boolean(trip?.escortRequired ?? trip?.escort_required);
  const escortDescription = trip?.escortDescription ?? trip?.escort_description ?? null;
  const auditTrail = trip?.auditTrail ?? trip?.audit_trail ?? [];
  const approvalStatus = trip?.approvalStatus ?? trip?.approval_status ?? null;

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
                {(accommodationRequired || escortRequired) && (
                  <>
                    <Separator />
                    <div className="grid gap-3 sm:grid-cols-2">
                      {accommodationRequired && (
                        <div className="rounded-md border border-border/40 bg-background/60 p-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <BedDouble className="h-4 w-4 text-primary" />
                            Accommodation requested
                          </div>
                          {accName || accAddress || accContact || accDetails || accCost ? (
                            <div className="space-y-1 text-xs text-muted-foreground">
                              {accName && <div><span className="font-medium text-foreground">Hotel:</span> {accName}</div>}
                              {accAddress && <div><span className="font-medium text-foreground">Address:</span> {accAddress}</div>}
                              {accContact && <div><span className="font-medium text-foreground">Contact:</span> {accContact}</div>}
                              {accDetails && <div><span className="font-medium text-foreground">Notes:</span> {accDetails}</div>}
                              {accCost != null && (
                                <div><span className="font-medium text-foreground">Est. cost:</span> {formatPoAmount(Number(accCost), 'NGN')}</div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              Requester did not specify a hotel. Logistics will arrange accommodation.
                            </p>
                          )}
                        </div>
                      )}
                      {escortRequired && (
                        <div className="rounded-md border border-border/40 bg-background/60 p-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Escort requested
                          </div>
                          {escortDescription ? (
                            <p className="text-xs text-muted-foreground">{escortDescription}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              Requester did not specify an escort. Logistics will assign one.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
                {approvalStatus && (
                  <>
                    <Separator />
                    <DetailRow label="Approval Status" value={<span className="capitalize">{approvalStatus.replace(/_/g, " ")}</span>} />
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
            {auditTrail.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Edit history
                </p>
                <div className="space-y-2">
                  {auditTrail.map((entry, idx) => {
                    const field = entry.field_name ?? entry.fieldName ?? "field";
                    const oldV = entry.original_value ?? entry.originalValue;
                    const newV = entry.new_value ?? entry.newValue;
                    const who = entry.editor_name ?? entry.editorName ?? "System";
                    const when = entry.created_at ?? entry.createdAt;
                    return (
                      <div key={entry.id ?? idx} className="rounded-md border border-border/40 p-2 text-xs">
                        <div className="font-medium capitalize">{String(field).replace(/_/g, " ")}</div>
                        <div className="text-muted-foreground">
                          {oldV != null && <span className="line-through mr-2">{String(oldV)}</span>}
                          {newV != null && <span className="text-foreground">{String(newV)}</span>}
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          {who}{when ? ` · ${formatDateTime(when)}` : ""}
                          {entry.reason ? ` — ${entry.reason}` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
