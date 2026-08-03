import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { tripRequestApi } from "@/services/api";
import type { StaffTripRequest } from "@/types/trip-request";
import { TripRequestForm } from "./TripRequestForm";
import {
  formatRequesterEditTimeRemaining,
  resolveRequesterEditAccess,
} from "@/utils/requesterEditWindow";
import { useAuth } from "@/contexts/AuthContext";

interface EditTripRequestDialogProps {
  trip: StaffTripRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function EditTripRequestDialog({
  trip,
  open,
  onOpenChange,
  onSaved,
}: EditTripRequestDialogProps) {
  const { user } = useAuth();
  // List payloads are partial — always hydrate the full record (accommodation,
  // escort, passengers, transport mode) before rendering the form.
  const [fullTrip, setFullTrip] = useState<StaffTripRequest | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !trip) {
      setFullTrip(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const res = await tripRequestApi.getById(String(trip.id));
      if (cancelled) return;
      setFullTrip(res.success && res.data?.trip ? res.data.trip : trip);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, trip]);

  const record = fullTrip ?? trip;
  const access = record ? resolveRequesterEditAccess(record, user) : { canEdit: false, expiresAt: null };
  const timeLeft = formatRequesterEditTimeRemaining(access.expiresAt);

  if (!record || !access.canEdit) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit trip request</DialogTitle>
          <DialogDescription>
            Update this trip within 48 hours of submission. Logistics and other reviewers
            will see your changes.
            {timeLeft ? ` · ${timeLeft}` : ""}
          </DialogDescription>
        </DialogHeader>
        {loading && !fullTrip ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TripRequestForm
            mode="edit"
            trip={record}
            showCancel
            onCancel={() => onOpenChange(false)}
            onSuccess={() => {
              onOpenChange(false);
              onSaved?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
