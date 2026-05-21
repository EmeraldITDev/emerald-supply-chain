import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi } from "@/services/api";
import { EligiblePassengerPicker } from "./EligiblePassengerPicker";

interface TripRequestFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

export function TripRequestForm({ onSuccess, onCancel, showCancel = false }: TripRequestFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [origin, setOrigin] = useState("HQ");
  const [departureAt, setDepartureAt] = useState("");
  const [arrivalAt, setArrivalAt] = useState("");
  const [passengerIds, setPassengerIds] = useState<string[]>([]);
  const [driverUserId, setDriverUserId] = useState<string | undefined>();

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
        scheduled_arrival_at: arrivalAt
          ? new Date(arrivalAt).toISOString()
          : new Date(departureAt).toISOString(),
        passenger_user_ids: passengerIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)),
        driver_user_id: driverUserId ? parseInt(driverUserId, 10) : undefined,
      });

      if (res.success) {
        toast({
          title: "Trip request submitted",
          description: "Your request has been sent to logistics for review.",
        });
        setDestination("");
        setPurpose("");
        setOrigin("HQ");
        setDepartureAt("");
        setArrivalAt("");
        setPassengerIds([]);
        setDriverUserId(undefined);
        onSuccess?.();
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <div className="flex flex-wrap gap-2 justify-end pt-2">
        {showCancel && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Request
        </Button>
      </div>
    </div>
  );
}
