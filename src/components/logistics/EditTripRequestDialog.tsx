import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const access = trip ? resolveRequesterEditAccess(trip, user) : { canEdit: false, expiresAt: null };
  const timeLeft = formatRequesterEditTimeRemaining(access.expiresAt);

  if (!trip || !access.canEdit) {
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
        <TripRequestForm
          mode="edit"
          trip={trip}
          showCancel
          onCancel={() => onOpenChange(false)}
          onSuccess={() => {
            onOpenChange(false);
            onSaved?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
