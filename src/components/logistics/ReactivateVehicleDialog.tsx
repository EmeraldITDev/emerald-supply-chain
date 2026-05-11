import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fleetApi } from "@/services/logisticsApi";
import { useAuth } from "@/contexts/AuthContext";
import type { FleetVehicle } from "@/types/logistics";

const MIN_REASON = 10;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: FleetVehicle | null;
  onReactivated?: () => void;
}

export const ReactivateVehicleDialog = ({ open, onOpenChange, vehicle, onReactivated }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason("");
      setSubmitting(false);
    }
  }, [open]);

  const reasonLength = reason.trim().length;
  const meetsMin = reasonLength >= MIN_REASON;

  const handleConfirm = async () => {
    if (!vehicle || !meetsMin) return;
    setSubmitting(true);
    try {
      const res = await fleetApi.updateStatus(vehicle.id, {
        status: "ACTIVE",
        reason: reason.trim(),
        override_by: user?.id ? String(user.id) : undefined,
      });
      if (res.success) {
        toast({
          title: "Vehicle Reactivated",
          description: `${vehicle.name || vehicle.plate} is now Active.`,
        });
        onOpenChange(false);
        onReactivated?.();
      } else {
        toast({
          title: "Reactivation Failed",
          description: res.error || "Unable to reactivate vehicle.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to reactivate vehicle.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reactivate Vehicle</DialogTitle>
          <DialogDescription>
            You are manually reactivating this vehicle. Please provide a reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reactivate-reason">Reason *</Label>
          <Textarea
            id="reactivate-reason"
            placeholder="Describe why you are reactivating this vehicle (min 10 characters)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            disabled={submitting}
          />
          <p className={`text-xs ${meetsMin ? "text-muted-foreground" : "text-destructive"}`}>
            {reasonLength} / {MIN_REASON} minimum characters
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!meetsMin || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Reactivation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReactivateVehicleDialog;