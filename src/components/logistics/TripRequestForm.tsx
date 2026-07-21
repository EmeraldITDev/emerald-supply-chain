import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi } from "@/services/api";
import { EligiblePassengerPicker } from "./EligiblePassengerPicker";
import type {
  TripBookingScope,
  TripBookingScopeRule,
  StaffTripRequest,
  InternationalTransportMode,
} from "@/types/trip-request";
import {
  DEFAULT_BOOKING_RULES,
  formatMinimumTripDateHint,
  validateTripBookingLeadTime,
} from "@/utils/tripBookingValidation";

interface TripRequestFormProps {
  mode?: "create" | "edit";
  /** Required when mode is edit — pre-fills the form. */
  trip?: StaffTripRequest | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TripRequestForm({
  mode = "create",
  trip = null,
  onSuccess,
  onCancel,
  showCancel = false,
}: TripRequestFormProps) {
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
  const [bookingScope, setBookingScope] = useState<TripBookingScope>("out_of_state_local");
  const [internationalTransportMode, setInternationalTransportMode] =
    useState<InternationalTransportMode | null>(null);
  const [externalPassengers, setExternalPassengers] = useState<
    Array<{ name: string; email: string; phone: string }>
  >([]);
  const [tripType, setTripType] = useState<string>("");
  const [accommodationRequired, setAccommodationRequired] = useState(false);
  const [accommodationName, setAccommodationName] = useState("");
  const [accommodationAddress, setAccommodationAddress] = useState("");
  const [accommodationContact, setAccommodationContact] = useState("");
  const [accommodationDetails, setAccommodationDetails] = useState("");
  const [accommodationEstimatedCost, setAccommodationEstimatedCost] = useState<string>("");
  const [escortRequired, setEscortRequired] = useState(false);
  const [escortDescription, setEscortDescription] = useState("");

  const isEdit = mode === "edit" && trip != null;

  useEffect(() => {
    if (!isEdit || !trip) return;
    setDestination(trip.destination || "");
    setPurpose(trip.purpose || "");
    setOrigin(trip.origin || "HQ");
    setDepartureAt(
      toDatetimeLocalValue(trip.scheduledDepartureAt ?? trip.scheduled_departure_at),
    );
    setArrivalAt(
      toDatetimeLocalValue(trip.scheduledArrivalAt ?? trip.scheduled_arrival_at),
    );
    const ids =
      trip.passengerUserIds ??
      trip.passenger_user_ids ??
      (trip.passengers ?? [])
        .map((p) => p.userId ?? p.user_id)
        .filter((id): id is number => id != null)
        .map(String);
    setPassengerIds(ids.map(String));
    setBookingScope(
      (trip.bookingScope ?? trip.booking_scope ?? "out_of_state_local") as TripBookingScope,
    );
    setInternationalTransportMode(
      (trip.internationalTransportMode ?? trip.international_transport_mode ?? null) as
        | InternationalTransportMode
        | null,
    );
    const ext = trip.externalPassengers ?? trip.external_passengers ?? [];
    setExternalPassengers(
      ext.map((p) => ({
        name: p.name || "",
        email: p.email || "",
        phone: p.phone || "",
      })),
    );
    setTripType(String(trip.tripType ?? trip.trip_type ?? ""));
    setAccommodationRequired(Boolean(trip.accommodationRequired ?? trip.accommodation_required));
    setAccommodationName(String(trip.accommodationName ?? trip.accommodation_name ?? ""));
    setAccommodationAddress(String(trip.accommodationAddress ?? trip.accommodation_address ?? ""));
    setAccommodationContact(String(trip.accommodationContact ?? trip.accommodation_contact ?? ""));
    setAccommodationDetails(String(trip.accommodationDetails ?? trip.accommodation_details ?? ""));
    const cost = trip.accommodationEstimatedCost ?? trip.accommodation_estimated_cost;
    setAccommodationEstimatedCost(cost != null ? String(cost) : "");
    setEscortRequired(Boolean(trip.escortRequired ?? trip.escort_required));
    setEscortDescription(String(trip.escortDescription ?? trip.escort_description ?? ""));
  }, [isEdit, trip]);

  useEffect(() => {
    if (bookingScope !== "international" && internationalTransportMode !== null) {
      setInternationalTransportMode(null);
    }
  }, [bookingScope, internationalTransportMode]);

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

  const originalDepartureIso = isEdit
    ? trip!.scheduledDepartureAt ?? trip!.scheduled_departure_at
    : null;
  const departureUnchanged =
    isEdit &&
    Boolean(originalDepartureIso && departureAt) &&
    new Date(departureAt).toISOString() === new Date(String(originalDepartureIso)).toISOString();
  const effectiveLeadTimeCheck = departureUnchanged
    ? { valid: true as const }
    : leadTimeCheck;

  const canSubmit =
    destination.trim() &&
    purpose.trim() &&
    origin.trim() &&
    departureAt &&
    (passengerIds.length > 0 || externalPassengers.some((p) => p.name.trim() && p.email.trim())) &&
    effectiveLeadTimeCheck.valid &&
    (!accommodationRequired ||
      (accommodationName.trim() && accommodationAddress.trim())) &&
    (!escortRequired || escortDescription.trim()) &&
    !submitting;

  const submit = async (asDraft: boolean) => {
    if (!destination.trim() || !purpose.trim() || !origin.trim() || !departureAt) {
      toast({
        title: "Validation error",
        description: "Destination, purpose, origin, and departure time are required.",
        variant: "destructive",
      });
      return;
    }
    const validExternal = externalPassengers
      .filter((p) => p.name.trim() && p.email.trim())
      .map((p) => ({
        name: p.name.trim(),
        email: p.email.trim(),
        phone: p.phone.trim() || undefined,
      }));
    const invalidExternalEmail = externalPassengers.some(
      (p) => (p.name.trim() || p.email.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim()),
    );
    if (invalidExternalEmail) {
      toast({
        title: "Validation error",
        description: "Each external passenger needs a valid email address.",
        variant: "destructive",
      });
      return;
    }
    if (!asDraft && passengerIds.length === 0 && validExternal.length === 0) {
      toast({
        title: "Validation error",
        description: "Select at least one staff passenger or add an external passenger.",
        variant: "destructive",
      });
      return;
    }
    if (!asDraft && !effectiveLeadTimeCheck.valid) {
      toast({
        title: "Advance booking required",
        description: leadTimeCheck.valid === false ? leadTimeCheck.violationMessage : undefined,
        variant: "destructive",
      });
      return;
    }
    if (!asDraft && accommodationRequired && (!accommodationName.trim() || !accommodationAddress.trim())) {
      toast({
        title: "Accommodation details required",
        description: "Provide at least a hotel/venue name and address.",
        variant: "destructive",
      });
      return;
    }
    if (!asDraft && escortRequired && !escortDescription.trim()) {
      toast({
        title: "Escort description required",
        description: "Describe the escort or security detail needed.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const accommodationCostNumber = accommodationEstimatedCost
        ? Number(accommodationEstimatedCost)
        : undefined;
      const payload = {
        destination: destination.trim(),
        purpose: purpose.trim(),
        origin: origin.trim() || "Office",
        scheduled_departure_at: new Date(departureAt).toISOString(),
        scheduled_arrival_at: arrivalAt
          ? new Date(arrivalAt).toISOString()
          : new Date(departureAt).toISOString(),
        passenger_user_ids: passengerIds
          .map((id) => parseInt(id, 10))
          .filter((n) => !Number.isNaN(n)),
        bookingScope,
        external_passengers: validExternal.length > 0 ? validExternal : undefined,
        international_transport_mode:
          bookingScope === "international" ? internationalTransportMode : null,
        trip_type: tripType || undefined,
        accommodation_required: accommodationRequired,
        accommodation_name: accommodationRequired ? accommodationName.trim() || undefined : undefined,
        accommodation_address: accommodationRequired ? accommodationAddress.trim() || undefined : undefined,
        accommodation_contact: accommodationRequired ? accommodationContact.trim() || undefined : undefined,
        accommodation_details: accommodationRequired ? accommodationDetails.trim() || undefined : undefined,
        accommodation_estimated_cost:
          accommodationRequired && accommodationCostNumber != null && !Number.isNaN(accommodationCostNumber)
            ? accommodationCostNumber
            : undefined,
        escort_required: escortRequired,
        escort_description: escortRequired ? escortDescription.trim() || undefined : undefined,
        save_as_draft: asDraft || undefined,
      };

      const res = isEdit
        ? await tripRequestApi.update(String(trip!.id), payload)
        : await tripRequestApi.create(payload);

      if (res.success) {
        toast({
          title: isEdit
            ? "Trip request updated"
            : asDraft
              ? "Draft saved"
              : "Trip request submitted",
          description: isEdit
            ? "Your changes were saved. Logistics and other reviewers will see the updated trip."
            : asDraft
              ? "You can resume this draft later from your trip requests list."
              : "Your request has been sent to logistics for review.",
        });
        if (!isEdit) {
          setDestination("");
          setPurpose("");
          setOrigin("HQ");
          setDepartureAt("");
          setArrivalAt("");
          setPassengerIds([]);
          setBookingScope("out_of_state_local");
          setInternationalTransportMode(null);
          setExternalPassengers([]);
          setTripType("");
          setAccommodationRequired(false);
          setAccommodationName("");
          setAccommodationAddress("");
          setAccommodationContact("");
          setAccommodationDetails("");
          setAccommodationEstimatedCost("");
          setEscortRequired(false);
          setEscortDescription("");
        }
        if (isEdit) {
          window.dispatchEvent(new Event("app:refresh"));
        }
        onSuccess?.();
      } else {
        toast({
          title: isEdit ? "Update failed" : "Submission failed",
          description: res.error || `Could not ${isEdit ? "update" : "create"} trip request`,
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => submit(false);
  const handleSaveDraft = () => submit(true);

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

      {bookingScope === "international" && (
        <div className="space-y-2">
          <Label>Transport Mode</Label>
          <Select
            value={internationalTransportMode ?? ""}
            onValueChange={(v) =>
              setInternationalTransportMode((v || null) as InternationalTransportMode | null)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select transport mode (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flight">By Flight</SelectItem>
              <SelectItem value="road">By Road</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Optional — how passengers will travel internationally.
          </p>
        </div>
      )}

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

      <div className="space-y-2">
        <Label>Trip type</Label>
        <Select value={tripType} onValueChange={setTripType}>
          <SelectTrigger>
            <SelectValue placeholder="Select trip type (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="client_visit">Client Visit</SelectItem>
            <SelectItem value="training">Training</SelectItem>
            <SelectItem value="conference">Conference</SelectItem>
            <SelectItem value="field_work">Field Work</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 border rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="accommodation-required"
            checked={accommodationRequired}
            onCheckedChange={(v) => setAccommodationRequired(Boolean(v))}
          />
          <Label htmlFor="accommodation-required" className="cursor-pointer">
            Accommodation required
          </Label>
        </div>
        <div className={accommodationRequired ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 opacity-60"}>
          <div className="space-y-1">
            <Label className="text-xs">
              Hotel / Venue name{accommodationRequired ? " *" : ""}
            </Label>
            <Input
              value={accommodationName}
              onChange={(e) => setAccommodationName(e.target.value)}
              disabled={!accommodationRequired}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              Address{accommodationRequired ? " *" : ""}
            </Label>
            <Input
              value={accommodationAddress}
              onChange={(e) => setAccommodationAddress(e.target.value)}
              disabled={!accommodationRequired}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact number</Label>
            <Input
              value={accommodationContact}
              onChange={(e) => setAccommodationContact(e.target.value)}
              disabled={!accommodationRequired}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estimated cost (₦)</Label>
            <Input
              type="number"
              min={0}
              value={accommodationEstimatedCost}
              onChange={(e) => setAccommodationEstimatedCost(e.target.value)}
              disabled={!accommodationRequired}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Additional details</Label>
            <Textarea
              rows={2}
              value={accommodationDetails}
              onChange={(e) => setAccommodationDetails(e.target.value)}
              disabled={!accommodationRequired}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="escort-required"
            checked={escortRequired}
            onCheckedChange={(v) => setEscortRequired(Boolean(v))}
          />
          <Label htmlFor="escort-required" className="cursor-pointer">
            Escort / security required
          </Label>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            Escort details{escortRequired ? " *" : ""}
          </Label>
          <Textarea
            rows={2}
            value={escortDescription}
            onChange={(e) => setEscortDescription(e.target.value)}
            disabled={!escortRequired}
            placeholder="Describe the escort/security detail required for this trip"
          />
        </div>
      </div>

      <div className="space-y-2 border rounded-lg p-3">
        <div className="flex items-center justify-between">
          <Label>External passengers (non-staff)</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setExternalPassengers((prev) => [...prev, { name: "", email: "", phone: "" }])
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        {externalPassengers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add guests, clients, or contractors who will travel on this trip. They'll receive a
            confirmation email once the Logistics Manager approves the trip.
          </p>
        ) : (
          <div className="space-y-2">
            {externalPassengers.map((p, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input
                    value={p.name}
                    onChange={(e) =>
                      setExternalPassengers((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs">Email *</Label>
                  <Input
                    type="email"
                    value={p.email}
                    onChange={(e) =>
                      setExternalPassengers((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, email: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={p.phone}
                    onChange={(e) =>
                      setExternalPassengers((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, phone: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setExternalPassengers((prev) => prev.filter((_, i) => i !== idx))
                    }
                    aria-label="Remove external passenger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Badge variant="secondary" className="text-xs">
              {externalPassengers.length} external passenger
              {externalPassengers.length === 1 ? "" : "s"} pending confirmation
            </Badge>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-end pt-2">
        {showCancel && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        {!isEdit && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleSaveDraft}
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save as draft
          </Button>
        )}
        <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Save changes" : "Submit Request"}
        </Button>
      </div>
    </div>
  );
}
