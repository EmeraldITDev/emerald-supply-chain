import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi } from "@/services/api";
import { EligiblePassengerPicker } from "./EligiblePassengerPicker";

const BLOCKED_ROLES = ["vendor", "admin", "executive", "chairman"];

interface TripRequestDialogProps {
  userRole?: string;
  onCreated?: () => void;
}

export function TripRequestDialog({ userRole, onCreated }: TripRequestDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [origin, setOrigin] = useState("HQ");
  const [departureAt, setDepartureAt] = useState("");
  const [arrivalAt, setArrivalAt] = useState("");
  const [passengerIds, setPassengerIds] = useState<string[]>([]);
  const [driverUserId, setDriverUserId] = useState<string | undefined>();

  if (!userRole || BLOCKED_ROLES.includes(userRole)) {
    return null;
  }

  const handleSubmit = async () => {
    if (!destination.trim() || !purpose.trim() || !origin.trim() || !departureAt) {
      toast({
        title: "Validation error",
        description: "Destination, purpose, origin, and departure time are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await tripRequestApi.create({
        destination: destination.trim(),
        purpose: purpose.trim(),
        origin: origin.trim(),
        scheduled_departure_at: new Date(departureAt).toISOString(),
        scheduled_arrival_at: arrivalAt ? new Date(arrivalAt).toISOString() : new Date(departureAt).toISOString(),
        passenger_user_ids: passengerIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)),
        driver_user_id: driverUserId ? parseInt(driverUserId, 10) : undefined,
      });

      if (res.success) {
        toast({
          title: "Trip request submitted",
          description: "Your request has been sent to logistics for review.",
        });
        setOpen(false);
        setDestination("");
        setPurpose("");
        setOrigin("HQ");
        setDepartureAt("");
        setArrivalAt("");
        setPassengerIds([]);
        setDriverUserId(undefined);
        onCreated?.();
      } else {
        toast({
          title: "Submission failed",
          description: res.error || "Could not create trip request",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          New Trip Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Trip Request</DialogTitle>
          <DialogDescription>
            Submit a travel request for logistics review and vendor assignment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Origin *</Label>
            <Input value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Destination *</Label>
            <Input
              placeholder="e.g. Lagos Airport"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Purpose *</Label>
            <Input
              placeholder="e.g. Client meeting"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Departure *</Label>
              <Input
                type="datetime-local"
                value={departureAt}
                onChange={(e) => setDepartureAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Arrival</Label>
              <Input
                type="datetime-local"
                value={arrivalAt}
                onChange={(e) => setArrivalAt(e.target.value)}
              />
            </div>
          </div>
          <EligiblePassengerPicker
            selectedPassengerIds={passengerIds}
            onPassengersChange={setPassengerIds}
            driverUserId={driverUserId}
            onDriverChange={setDriverUserId}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
