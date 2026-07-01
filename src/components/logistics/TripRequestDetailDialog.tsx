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

  const scopeLabel =
    trip?.bookingScopeLabel ??
    trip?.booking_scope_label ??
    (trip?.bookingScope === "international" || trip?.booking_scope === "international"
      ? "International (Out of Nigeria)"
      : trip?.bookingScope === "out_of_state_local" || trip?.booking_scope === "out_of_state_local"
        ? "Out of State (Local)"
        : trip?.bookingScope === "outside_state" || trip?.booking_scope === "outside_state"
          ? "Outside State"
          : "Within State");

  const handleDeleted = () => {
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                </div>
                <DeleteTripDraftButton trip={trip} onDeleted={handleDeleted} variant="destructive" />
              </div>
            )}
            {trip?.purpose && (
              <p className="text-sm text-muted-foreground">{trip.purpose}</p>
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
