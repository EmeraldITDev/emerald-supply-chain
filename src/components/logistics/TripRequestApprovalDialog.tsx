import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Truck, User, Users, BedDouble, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi, passengerApi } from "@/services/api";
import { fleetApi } from "@/services/logisticsApi";
import { formatPoAmount } from "@/utils/currency";
import { TripCommentsPanel } from "./TripCommentsPanel";
import type { StaffTripRequest } from "@/types/trip-request";
import type { EligiblePassenger, FleetVehicle } from "@/types/logistics";

interface TripRequestApprovalDialogProps {
  request: StaffTripRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved?: (logisticsTripId?: string | number) => void;
}

export function TripRequestApprovalDialog({
  request,
  open,
  onOpenChange,
  onApproved,
}: TripRequestApprovalDialogProps) {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [drivers, setDrivers] = useState<EligiblePassenger[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [driverType, setDriverType] = useState<"internal" | "external">("internal");
  const [driverUserId, setDriverUserId] = useState("");
  const [externalName, setExternalName] = useState("");
  const [externalPhone, setExternalPhone] = useState("");
  const [externalEmail, setExternalEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [fullRequest, setFullRequest] = useState<StaffTripRequest | null>(null);

  useEffect(() => {
    if (!open || !request) {
      setFullRequest(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingOptions(true);
      const [detailRes, fleetRes, driversRes] = await Promise.all([
        tripRequestApi.getById(String(request.id)),
        fleetApi.getAll(),
        passengerApi.getEligible(undefined, 1),
      ]);
      if (cancelled) return;
      if (detailRes.success && detailRes.data?.trip) {
        setFullRequest(detailRes.data.trip);
      } else {
        setFullRequest(request);
      }
      if (fleetRes.success && fleetRes.data) {
        const arr = Array.isArray(fleetRes.data) ? fleetRes.data : [];
        setVehicles(arr.filter((v) => v.approvalStatus !== "rejected"));
      }
      if (driversRes.success && driversRes.data) {
        const payload = driversRes.data as { users?: EligiblePassenger[] };
        setDrivers(payload.users ?? []);
      }
      setLoadingOptions(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, request]);

  useEffect(() => {
    if (!open) {
      setVehicleId("");
      setDriverType("internal");
      setDriverUserId("");
      setExternalName("");
      setExternalPhone("");
      setExternalEmail("");
      setNotes("");
    }
  }, [open]);

  const trip = fullRequest ?? request;
  if (!trip) return null;

  const passengers = trip.passengers ?? [];
  const externalPassengers =
    trip.externalPassengers ?? trip.external_passengers ?? [];

  const canSubmit =
    vehicleId &&
    (driverType === "internal"
      ? driverUserId
      : externalName.trim() && externalPhone.trim());

  const handleApprove = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: import("@/types/trip-request").TripConfirmAssignmentData = {
        vehicle_id: vehicleId,
        driver_type: driverType,
        notes: notes.trim() || undefined,
        ...(driverType === "internal"
          ? { driver_user_id: parseInt(driverUserId, 10) }
          : {
              external_driver: {
                name: externalName.trim(),
                phone: externalPhone.trim(),
                email: externalEmail.trim() || undefined,
              },
            }),
      };
      const res = await tripRequestApi.confirm(String(trip.id), payload);
      if (res.success) {
        toast({
          title: "Trip approved",
          description: "Vehicle and driver assigned. Passengers will be notified.",
        });
        onOpenChange(false);
        onApproved?.(res.data?.logistics_trip_id);
      } else {
        toast({
          title: "Approval failed",
          description: res.error || "Could not approve trip request",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const departure = trip.scheduledDepartureAt ?? trip.scheduled_departure_at;
  const arrival = trip.scheduledArrivalAt ?? trip.scheduled_arrival_at;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve &amp; assign trip</DialogTitle>
          <DialogDescription>
            Review the request, assign a vehicle and driver, then confirm. This creates the
            linked logistics trip for journey tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2 bg-muted/20">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{trip.tripCode ?? trip.trip_code ?? `TR-${trip.id}`}</Badge>
              <Badge>{trip.bookingScopeLabel ?? trip.booking_scope_label ?? "Trip"}</Badge>
            </div>
            <p className="font-medium">
              {trip.origin ?? "—"} → {trip.destination}
            </p>
            {trip.purpose && (
              <p className="text-sm text-muted-foreground">Purpose: {trip.purpose}</p>
            )}
            {departure && (
              <p className="text-sm text-muted-foreground">
                Departure: {new Date(departure).toLocaleString()}
                {arrival ? ` · Return: ${new Date(arrival).toLocaleString()}` : ""}
              </p>
            )}
            {(trip.requesterName ?? trip.requester_name) && (
              <p className="text-sm">
                Requested by: {trip.requesterName ?? trip.requester_name}
              </p>
            )}
            
            {/* Accommodation & Escort Section */}
            {(trip.accommodationRequired ?? trip.accommodation_required || trip.escortRequired ?? trip.escort_required) && (
              <>
                <Separator className="my-2" />
                <div className="grid gap-2 sm:grid-cols-2 mt-3">
                  {(trip.accommodationRequired ?? trip.accommodation_required) && (
                    <div className="rounded-md border border-border/40 bg-background/60 p-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <BedDouble className="h-3 w-3 text-primary" />
                        Accommodation Requested
                      </div>
                      {trip.accommodationName || trip.accommodation_name ||
                      trip.accommodationAddress || trip.accommodation_address ||
                      trip.accommodationContact || trip.accommodation_contact ||
                      trip.accommodationDetails || trip.accommodation_details ||
                      trip.accommodationEstimatedCost || trip.accommodation_estimated_cost ? (
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {(trip.accommodationName ?? trip.accommodation_name) && (
                            <div className="text-[11px]">
                              <span className="font-medium text-foreground">Hotel:</span> {trip.accommodationName ?? trip.accommodation_name}
                            </div>
                          )}
                          {(trip.accommodationAddress ?? trip.accommodation_address) && (
                            <div className="text-[11px]">
                              <span className="font-medium text-foreground">Address:</span> {trip.accommodationAddress ?? trip.accommodation_address}
                            </div>
                          )}
                          {(trip.accommodationEstimatedCost ?? trip.accommodation_estimated_cost) != null && (
                            <div className="text-[11px]">
                              <span className="font-medium text-foreground">Est. Cost:</span>{" "}
                              {formatPoAmount(Number(trip.accommodationEstimatedCost ?? trip.accommodation_estimated_cost), "NGN")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          No specific accommodation provided
                        </p>
                      )}
                    </div>
                  )}
                  {(trip.escortRequired ?? trip.escort_required) && (
                    <div className="rounded-md border border-border/40 bg-background/60 p-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <ShieldCheck className="h-3 w-3 text-primary" />
                        Escort Requested
                      </div>
                      {trip.escortDescription ?? trip.escort_description ? (
                        <p className="text-xs text-muted-foreground">{trip.escortDescription ?? trip.escort_description}</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          No specific escort details provided
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {(passengers.length > 0 || externalPassengers.length > 0) && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Users className="h-4 w-4" /> Passengers
              </Label>
              <div className="flex flex-wrap gap-2">
                {passengers.map((p, i) => (
                  <Badge key={p.id ?? i} variant="secondary">
                    {p.name} {p.department ? `(${p.department})` : ""}
                  </Badge>
                ))}
                {externalPassengers.map((p, i) => (
                  <Badge key={`ext-${i}`} variant="outline">
                    {p.name} (external)
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {loadingOptions ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading fleet…
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Truck className="h-4 w-4" /> Vehicle *
                </Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.name} — {v.plate}
                        {v.status !== "available" ? ` (${v.status})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-1">
                  <User className="h-4 w-4" /> Driver *
                </Label>
                <RadioGroup
                  value={driverType}
                  onValueChange={(v) => setDriverType(v as "internal" | "external")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="internal" id="driver-internal" />
                    <label htmlFor="driver-internal" className="text-sm cursor-pointer">
                      System user
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="external" id="driver-external" />
                    <label htmlFor="driver-external" className="text-sm cursor-pointer">
                      External driver
                    </label>
                  </div>
                </RadioGroup>

                {driverType === "internal" ? (
                  <Select value={driverUserId} onValueChange={setDriverUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                          {d.department ? ` — ${d.department}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Full name *</Label>
                      <Input
                        value={externalName}
                        onChange={(e) => setExternalName(e.target.value)}
                        placeholder="Driver name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone *</Label>
                      <Input
                        value={externalPhone}
                        onChange={(e) => setExternalPhone(e.target.value)}
                        placeholder="+234…"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Email (optional)</Label>
                      <Input
                        type="email"
                        value={externalEmail}
                        onChange={(e) => setExternalEmail(e.target.value)}
                        placeholder="driver@example.com"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes for passengers (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Pickup instructions, contact number, etc."
                  rows={2}
                />
              </div>
            </>
          )}

          <TripCommentsPanel tripRequestId={String(trip.id)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve &amp; assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TripRequestApprovalDialog;
