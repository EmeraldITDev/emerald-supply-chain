import { useCallback, useEffect, useMemo, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi, vendorApi } from "@/services/api";
import { fleetApi } from "@/services/logisticsApi";
import { EligiblePassengerPicker } from "./EligiblePassengerPicker";
import type { StaffTripRequest } from "@/types/trip-request";
import type { FleetVehicle } from "@/types/logistics";
import type { Vendor } from "@/types";

interface TripRequestConversionDialogProps {
  request: StaffTripRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted?: (logisticsTripId?: string | number) => void;
}

export function TripRequestConversionDialog({
  request,
  open,
  onOpenChange,
  onConverted,
}: TripRequestConversionDialogProps) {
  const { toast } = useToast();
  const [fulfillmentType, setFulfillmentType] = useState<"external_vendor" | "internal_vehicle">(
    "internal_vehicle",
  );
  const [passengerIds, setPassengerIds] = useState<string[]>([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorResults, setVendorResults] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [driverType, setDriverType] = useState<"internal" | "external">("internal");
  const [driverUserId, setDriverUserId] = useState("");
  const [externalName, setExternalName] = useState("");
  const [externalPhone, setExternalPhone] = useState("");
  const [externalEmail, setExternalEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const seedPassengers = useCallback((trip: StaffTripRequest) => {
    const ids: (string | number)[] =
      trip.passengerUserIds ??
      trip.passenger_user_ids ??
      (trip.passengers ?? [])
        .map((p) => p.userId ?? p.user_id)
        .filter((id): id is number => id != null)
        .map(String);
    setPassengerIds(ids.map(String));
  }, []);

  useEffect(() => {
    if (!open || !request) return;
    seedPassengers(request);
    setLoading(true);
    fleetApi.getAll().then((res) => {
      if (res.success && res.data) {
        const arr = Array.isArray(res.data) ? res.data : [];
        setVehicles(arr.filter((v) => v.approvalStatus !== "rejected"));
      }
      setLoading(false);
    });
  }, [open, request, seedPassengers]);

  useEffect(() => {
    if (!open || fulfillmentType !== "external_vendor") return;
    const handle = window.setTimeout(async () => {
      const res = await vendorApi.list({
        page: 1,
        per_page: 25,
        search: vendorSearch.trim() || undefined,
      });
      if (res.success && res.data?.items) {
        setVendorResults(res.data.items);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [vendorSearch, fulfillmentType, open]);

  const canSubmit = useMemo(() => {
    if (passengerIds.length === 0) return false;
    if (driverType === "internal" && !driverUserId) return false;
    if (driverType === "external" && !externalName.trim()) return false;
    if (fulfillmentType === "external_vendor") {
      return Boolean(vendorId && vehicleType.trim() && estimatedCost);
    }
    return Boolean(vehicleId);
  }, [passengerIds, driverType, driverUserId, externalName, fulfillmentType, vendorId, vehicleType, estimatedCost, vehicleId]);

  const handleSubmit = async () => {
    if (!request || !canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        fulfillment_type: fulfillmentType,
        passenger_user_ids: passengerIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)),
        external_passengers: request.externalPassengers ?? request.external_passengers,
        notes: notes || undefined,
        driver_type: driverType,
        driver_user_id: driverType === "internal" ? parseInt(driverUserId, 10) : undefined,
        external_driver:
          driverType === "external"
            ? {
                name: externalName.trim(),
                phone: externalPhone.trim() || undefined,
                email: externalEmail.trim() || undefined,
              }
            : undefined,
        ...(fulfillmentType === "external_vendor"
          ? {
              vendor_id: parseInt(vendorId, 10),
              vehicle_type: vehicleType.trim(),
              estimated_vendor_cost: parseFloat(estimatedCost),
            }
          : { vehicle_id: parseInt(vehicleId, 10) }),
      };

      const res = await tripRequestApi.convert(String(request.id), payload);
      if (res.success) {
        toast({ title: "Converted", description: "Trip request converted to logistics request." });
        onOpenChange(false);
        const data = res.data as Record<string, unknown> | undefined;
        const logisticsId = data?.logistics_trip_id ?? data?.logisticsTripId;
        onConverted?.(logisticsId as string | number | undefined);
      } else {
        toast({ title: "Conversion failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert to logistics request</DialogTitle>
          <DialogDescription>
            Passengers from the trip request are pre-filled. Choose internal fleet or external vendor transport.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Transport option</Label>
              <RadioGroup
                value={fulfillmentType}
                onValueChange={(v) => setFulfillmentType(v as typeof fulfillmentType)}
                className="grid gap-2"
              >
                <div className="flex items-center gap-2 border rounded-md p-3">
                  <RadioGroupItem value="internal_vehicle" id="ft-internal" />
                  <Label htmlFor="ft-internal" className="font-normal cursor-pointer">
                    Internal vehicle (company fleet)
                  </Label>
                </div>
                <div className="flex items-center gap-2 border rounded-md p-3">
                  <RadioGroupItem value="external_vendor" id="ft-external" />
                  <Label htmlFor="ft-external" className="font-normal cursor-pointer">
                    External vendor (cost visible to procurement)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Passengers</Label>
              <EligiblePassengerPicker
                selectedPassengerIds={passengerIds}
                onPassengersChange={setPassengerIds}
              />
            </div>

            {fulfillmentType === "external_vendor" ? (
              <>
                <div className="space-y-2">
                  <Label>Vendor search</Label>
                  <Input
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    placeholder="Type to search vendors…"
                  />
                  <Select value={vendorId} onValueChange={setVendorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorResults.map((v) => (
                        <SelectItem key={String(v.id)} value={String(v.id)}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vehicle type</Label>
                  <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="e.g. SUV, Coaster" />
                </div>
                <div className="space-y-2">
                  <Label>Estimated vendor cost (₦)</Label>
                  <Input type="number" min={0} value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Company vehicle</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={String(v.id)} value={String(v.id)}>
                        {(v as any).plateNumber ?? (v as any).plate_number ?? v.plate} — {v.make} {v.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Driver</Label>
              <RadioGroup
                value={driverType}
                onValueChange={(v) => setDriverType(v as "internal" | "external")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="internal" id="drv-int" />
                  <Label htmlFor="drv-int">System user</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="external" id="drv-ext" />
                  <Label htmlFor="drv-ext">External driver</Label>
                </div>
              </RadioGroup>
              {driverType === "internal" ? (
                <EligiblePassengerPicker
                  selectedPassengerIds={driverUserId ? [driverUserId] : []}
                  onPassengersChange={(ids) => setDriverUserId(ids[0] ?? "")}
                />
              ) : (
                <div className="grid gap-2">
                  <Input placeholder="Driver name" value={externalName} onChange={(e) => setExternalName(e.target.value)} />
                  <Input placeholder="Phone" value={externalPhone} onChange={(e) => setExternalPhone(e.target.value)} />
                  <Input placeholder="Email" value={externalEmail} onChange={(e) => setExternalEmail(e.target.value)} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
