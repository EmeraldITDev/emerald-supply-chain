import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi } from "@/services/api";
import { EligiblePassengerPicker } from "./EligiblePassengerPicker";
import type { TripBookingScope, TripBookingScopeRule } from "@/types/trip-request";
import {
  DEFAULT_BOOKING_RULES,
  formatMinimumTripDateHint,
  validateTripBookingLeadTime,
} from "@/utils/tripBookingValidation";

interface TripRequestFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

export function TripRequestForm({ onSuccess, onCancel, showCancel = false }: TripRequestFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [loadingRules, setLoadingRules] = useState(true);
  const [rules, setRules] = useState<TripBookingScopeRule[]>(DEFAULT_BOOKING_RULES);
  const [referenceDate, setReferenceDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [origin, setOrigin] = useState("HQ");
  const [departureAt, setDepartureAt] = useState("");
  const [arrivalAt, setArrivalAt] = useState("");
  const [passengerIds, setPassengerIds] = useState<string[]>([]);
  const [bookingScope, setBookingScope] = useState<TripBookingScope>("within_state");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRules(true);
      const res = await tripRequestApi.getBookingRules();
      if (!cancelled) {
        if (res.success && res.data?.scopes?.length) {
          setRules(res.data.scopes);
          setReferenceDate(res.data.referenceDate);
        }
        setLoadingRules(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const leadTimeCheck = useMemo(() => {
    if (!departureAt) return { valid: true as const };
    return validateTripBookingLeadTime(
      new Date(departureAt).toISOString(),
      bookingScope,
      rules,
      referenceDate,
    );
  }, [departureAt, bookingScope, rules, referenceDate]);

  const canSubmit =
    destination.trim() &&
    purpose.trim() &&
    origin.trim() &&
    departureAt &&
    passengerIds.length > 0 &&
    leadTimeCheck.valid &&
    !submitting;

  const handleSubmit = async () => {
    if (!destination.trim() || !purpose.trim() || !origin.trim() || !departureAt) {
      toast({
        title: "Validation error",
        description: "Destination, purpose, origin, and departure time are required.",
        variant: "destructive",
      });
      return;
    }
    if (passengerIds.length === 0) {
      toast({
        title: "Validation error",
        description: "Select at least one passenger.",
        variant: "destructive",
      });
      return;
    }
    if (!leadTimeCheck.valid) {
      toast({
        title: "Advance booking required",
        description: leadTimeCheck.violationMessage,
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
        passenger_user_ids: passengerIds
          .map((id) => parseInt(id, 10))
          .filter((n) => !Number.isNaN(n)),
        bookingScope,
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
        setBookingScope("within_state");
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

  const selectedRule = rules.find((r) => r.value === bookingScope);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Trip type *</Label>
        {loadingRules ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading booking rules…
          </div>
        ) : (
          <RadioGroup
            value={bookingScope}
            onValueChange={(v) => setBookingScope(v as TripBookingScope)}
            className="grid gap-2"
          >
            {rules.map((r) => (
              <div key={r.value} className="flex items-start space-x-2 border rounded-lg p-3">
                <RadioGroupItem value={r.value} id={`scope-${r.value}`} className="mt-1" />
                <label htmlFor={`scope-${r.value}`} className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">{r.label}</span>
                  <span className="block text-muted-foreground text-xs mt-0.5">
                    Book at least {r.minimumLeadDays} calendar day
                    {r.minimumLeadDays === 1 ? "" : "s"} before travel
                  </span>
                </label>
              </div>
            ))}
          </RadioGroup>
        )}
      </div>

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

      {!leadTimeCheck.valid && departureAt && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {leadTimeCheck.violationMessage}
            {leadTimeCheck.minimumDate && (
              <>
                {" "}
                Earliest trip date: {formatMinimumTripDateHint(leadTimeCheck.minimumDate)}.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {selectedRule && departureAt && leadTimeCheck.valid && (
        <p className="text-xs text-muted-foreground">
          {selectedRule.label}: departure meets the {selectedRule.minimumLeadDays}-day advance
          requirement (reference {referenceDate}).
        </p>
      )}

      <EligiblePassengerPicker
        selectedPassengerIds={passengerIds}
        onPassengersChange={setPassengerIds}
        showDriver={false}
      />

      <div className="flex flex-wrap gap-2 justify-end pt-2">
        {showCancel && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Request
        </Button>
      </div>
    </div>
  );
}
