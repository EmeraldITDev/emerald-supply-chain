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
import { Loader2, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi, vendorApi } from "@/services/api";
import { resolveTripWorkflowError } from "@/utils/tripApprovalErrors";
import { fleetApi } from "@/services/logisticsApi";
import { EligiblePassengerPicker } from "./EligiblePassengerPicker";
import type { StaffTripRequest } from "@/types/trip-request";
import type { FleetVehicle } from "@/types/logistics";
import type { Vendor } from "@/types";

interface TripRequestConversionDialogProps {
  request: StaffTripRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted?: (result: TripConversionResult) => void;
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
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehiclesLoaded, setVehiclesLoaded] = useState(false);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [driverType, setDriverType] = useState<"internal" | "external">("internal");
  const [driverUserId, setDriverUserId] = useState("");
  const [externalName, setExternalName] = useState("");
  const [externalPhone, setExternalPhone] = useState("");
  const [externalEmail, setExternalEmail] = useState("");
  const [externalLicence, setExternalLicence] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Full server record — list payloads are partial. */
  const [detail, setDetail] = useState<StaffTripRequest | null>(null);
  const [externalPassengers, setExternalPassengers] = useState<
    Array<{ name: string; email?: string; phone?: string }>
  >([]);
  const [accommodationRequired, setAccommodationRequired] = useState(false);
  const [accommodationName, setAccommodationName] = useState("");
  const [accommodationAddress, setAccommodationAddress] = useState("");
  const [accommodationContact, setAccommodationContact] = useState("");
  const [accommodationCost, setAccommodationCost] = useState("");
  const [escortRequired, setEscortRequired] = useState(false);
  const [escortDescription, setEscortDescription] = useState("");
  const [escortCost, setEscortCost] = useState("");
  const [softWarning, setSoftWarning] = useState<string | null>(null);

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

  // Always hydrate the full record on open — the list payload omits
  // accommodation, escort and external passenger details.
  useEffect(() => {
    if (!open || !request) return;
    let cancelled = false;
    seedPassengers(request);
    setLoading(true);
    void (async () => {
      const res = await tripRequestApi.getById(String(request.id));
      if (cancelled) return;
      const full = res.success && res.data?.trip ? res.data.trip : request;
      setDetail(full);
      seedPassengers(full);
      const ext = full.externalPassengers ?? full.external_passengers ?? [];
      setExternalPassengers(
        (Array.isArray(ext) ? ext : []).map((p) => ({
          name: p.name ?? "",
          email: p.email ?? "",
          phone: p.phone ?? "",
        })),
      );
      setAccommodationRequired(
        Boolean(full.accommodationRequired ?? full.accommodation_required),
      );
      setAccommodationName(String(full.accommodationName ?? full.accommodation_name ?? ""));
      setAccommodationAddress(
        String(full.accommodationAddress ?? full.accommodation_address ?? ""),
      );
      setAccommodationContact(
        String(full.accommodationContact ?? full.accommodation_contact ?? ""),
      );
      const accCost = full.accommodationEstimatedCost ?? full.accommodation_estimated_cost;
      setAccommodationCost(accCost != null ? String(accCost) : "");
      setEscortRequired(Boolean(full.escortRequired ?? full.escort_required));
      setEscortDescription(String(full.escortDescription ?? full.escort_description ?? ""));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, request, seedPassengers]);

  // Fetch fleet vehicles the moment the user picks Internal Vehicle (not on
  // dialog mount). Loaded once per open session, then filtered client-side.
  // 1. Fetch Fleet Vehicles (With Debug Logging)
  useEffect(() => {
    if (!open || fulfillmentType !== "internal_vehicle" || vehiclesLoaded) return;
    setVehiclesLoading(true);

    fleetApi.list({ page: 1, per_page: 200 })
      .then((res) => {
        console.log("FLEET API RESPONSE:", res); // <-- ADDED THIS LINE

        let items: any[] = [];
        if (res.success && res.data) {
          const dataAny = res.data as any;
          const rawData = Array.isArray(dataAny) ? dataAny : (dataAny.items || dataAny.vehicles || dataAny.fleet || dataAny.data || []);

          items = rawData.filter((v: any) => v.approvalStatus !== "rejected" && v.approval_status !== "rejected");
        }
        setVehicles(items);
        setVehiclesLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load vehicles:", err);
        setVehicles([]);
      })
      .finally(() => setVehiclesLoading(false));
  }, [open, fulfillmentType, vehiclesLoaded]);

  // Vendor selector — fetch an initial slate on switching to external vendor
  // so the dropdown is populated immediately, then debounce further search.
  useEffect(() => {
    if (!open || fulfillmentType !== "external_vendor") return;

    const handle = window.setTimeout(async () => {
      setVendorLoading(true);
      try {
        const res = await vendorApi.list({
          page: 1,
          per_page: 100,
          search: vendorSearch.trim() || undefined,
        });

        if (res.success && res.data) {
          const dataAny = res.data as any;
          const rawVendors = Array.isArray(dataAny) ? dataAny : (dataAny.items || dataAny.vendors || dataAny.data || []);
          setVendorResults(rawVendors);
        } else {
          setVendorResults([]);
        }
      } catch (err) {
        console.error("Failed to load vendors:", err);
        setVendorResults([]);
      } finally {
        setVendorLoading(false);
      }
    }, vendorSearch.trim() ? 300 : 0);

    return () => window.clearTimeout(handle);
  }, [vendorSearch, fulfillmentType, open]);

  // Reset per-open state so a re-opened dialog re-fetches fresh data.
  useEffect(() => {
    if (!open) {
      setVehiclesLoaded(false);
      setVehicles([]);
      setVehicleSearch("");
      setVendorResults([]);
      setVendorSearch("");
    }
  }, [open]);

  const filteredVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => {
      const plate = (v as any).plateNumber ?? (v as any).plate_number ?? v.plate ?? "";
      const label = `${plate} ${v.make ?? ""} ${v.model ?? ""} ${v.vehicleNumber ?? ""}`.toLowerCase();
      return label.includes(q);
    });
  }, [vehicles, vehicleSearch]);

  // At least one passenger, and either a fleet vehicle or a transport vendor.
  // Everything else (driver, costs, accommodation, escort) is optional here.
  const canSubmit = useMemo(() => {
    const hasPassenger =
      passengerIds.length > 0 || externalPassengers.some((p) => p.name.trim());
    if (!hasPassenger) return false;
    return fulfillmentType === "external_vendor" ? Boolean(vendorId) : Boolean(vehicleId);
  }, [passengerIds, externalPassengers, fulfillmentType, vendorId, vehicleId]);

  const totalEstimatedCost = useMemo(() => {
    const nums = [estimatedCost, accommodationCost, escortCost]
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    return nums.reduce((a, b) => a + b, 0);
  }, [estimatedCost, accommodationCost, escortCost]);

  /** Soft check — the requester flagged a need the plan no longer covers. */
  const softWarningMessage = (): string | null => {
    const accNeeded = Boolean(
      detail?.accommodationRequired ?? detail?.accommodation_required,
    );
    const escNeeded = Boolean(detail?.escortRequired ?? detail?.escort_required);
    if (accNeeded && !accommodationName.trim()) {
      return "Accommodation was marked as required but no details are filled. Continue anyway?";
    }
    if (escNeeded && !escortDescription.trim()) {
      return "An escort was marked as required but no escort details are filled. Continue anyway?";
    }
    return null;
  };

  /** Canonical driver object contract shared with the backend. */
  const buildDriverPayload = () => {
    if (driverType === "internal" && !driverUserId) return undefined;
    if (driverType === "external" && !externalName.trim()) return undefined;
    if (driverType === "internal") {
      return {
        driver_type: "existing" as const,
        driver_id: parseInt(driverUserId, 10),
        driver_name: null,
        driver_phone: null,
        driver_licence: null,
        driver_source: "system" as const,
      };
    }
    return {
      driver_type: "external" as const,
      driver_id: null,
      driver_name: externalName.trim(),
      driver_phone: externalPhone.trim() || null,
      driver_licence: externalLicence.trim() || null,
      driver_source: "manual" as const,
    };
  };

  const handleSubmit = async (skipSoftCheck = false) => {
    if (!request || !canSubmit) return;
    if (!skipSoftCheck) {
      const warning = softWarningMessage();
      if (warning) {
        setSoftWarning(warning);
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        fulfillment_type: fulfillmentType,
        passenger_user_ids: passengerIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)),
        external_passengers: externalPassengers
          .filter((p) => p.name.trim())
          .map((p) => ({
            name: p.name.trim(),
            email: p.email?.trim() || undefined,
            phone: p.phone?.trim() || undefined,
          })),
        accommodation_required: accommodationRequired,
        accommodation_name: accommodationName.trim() || null,
        accommodation_address: accommodationAddress.trim() || null,
        accommodation_contact: accommodationContact.trim() || null,
        accommodation_estimated_cost: accommodationCost ? Number(accommodationCost) : null,
        escort_required: escortRequired,
        escort_description: escortDescription.trim() || null,
        escort_estimated_cost: escortCost ? Number(escortCost) : null,
        total_estimated_cost: totalEstimatedCost || null,
        notes: notes || undefined,
        driver: buildDriverPayload(),
        driver_type: driverType,
        driver_user_id: driverType === "internal" ? parseInt(driverUserId, 10) : undefined,
        external_driver:
          driverType === "external"
            ? {
              name: externalName.trim(),
              phone: externalPhone.trim() || undefined,
              email: externalEmail.trim() || undefined,
              licence: externalLicence.trim() || undefined,
            }
            : undefined,
        ...(fulfillmentType === "external_vendor"
          ? {
            vendor_id: parseInt(vendorId, 10),
            vehicle_type: vehicleType.trim() || null,
            estimated_vendor_cost: estimatedCost ? parseFloat(estimatedCost) : null,
          }
          : { vehicle_id: parseInt(vehicleId, 10) }),
      };

      const res = await tripRequestApi.convert(
        String(request.id),
        payload as unknown as Parameters<typeof tripRequestApi.convert>[1],
      );
      if (res.success) {
        const data = (res.data ?? {}) as Record<string, unknown>;
        const result: TripConversionResult = {
          tripRequestId: request.id,
          logisticsTripId: (data.logistics_trip_id ??
            data.logisticsTripId ??
            data.logistics_request_id) as string | number | undefined,
          journeyId: (data.journey_id ?? data.journeyId) as string | number | undefined,
          journeyReference: (data.journey_reference ?? data.journeyReference) as
            | string
            | undefined,
          quotationRequired: Boolean(data.quotation_required ?? data.quotationRequired),
          workflowState: (data.workflow_state ?? data.workflowState) as string | undefined,
        };
        toast({
          title: "Converted",
          description: result.quotationRequired
            ? "Pending Vendor Quotation — Send RFQ to vendors to continue."
            : "Awaiting Supply Chain Director Approval.",
        });
        onOpenChange(false);
        onConverted?.(result);
      } else {
        toast({
          title: "Conversion failed",
          description: resolveTripWorkflowError(res),
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
            {/* Read-only summary carried forward from the trip request */}
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <div className="font-medium">
                {detail?.tripCode ?? detail?.trip_code ?? request?.tripCode ?? "Trip request"}
              </div>
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-muted-foreground">
                <span>Origin: {detail?.origin || "—"}</span>
                <span>Destination: {detail?.destination || "—"}</span>
                <span>
                  Departure:{" "}
                  {detail?.scheduledDepartureAt ?? detail?.scheduled_departure_at
                    ? new Date(
                      String(detail?.scheduledDepartureAt ?? detail?.scheduled_departure_at),
                    ).toLocaleString()
                    : "—"}
                </span>
                <span>Purpose: {detail?.purpose || "—"}</span>
              </div>
            </div>

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
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      placeholder="Type to filter vendors…"
                    />
                  </div>
                  <Select value={vendorId} onValueChange={setVendorId}>
                    <SelectTrigger>
                      <SelectValue placeholder={vendorLoading ? "Loading vendors…" : "Select vendor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorLoading && (
                        <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading vendors…
                        </div>
                      )}
                      {!vendorLoading && vendorResults.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No vendors found
                        </div>
                      )}
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
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    placeholder="Filter by plate, make or model…"
                    disabled={vehiclesLoading}
                  />
                </div>
                <Select value={vehicleId} onValueChange={setVehicleId} disabled={vehiclesLoading}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        vehiclesLoading
                          ? "Loading fleet vehicles…"
                          : filteredVehicles.length === 0
                            ? "No vehicles available"
                            : "Select vehicle"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {vehiclesLoading && (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading vehicles…
                      </div>
                    )}
                    {!vehiclesLoading && filteredVehicles.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {vehicles.length === 0
                          ? "No vehicles found in the fleet. Please add a vehicle in Fleet Management."
                          : "No vehicles match your search."}
                      </div>
                    )}
                    {filteredVehicles.map((v) => {
                      const plate = (v as any).plateNumber ?? (v as any).plate_number ?? v.plate ?? v.vehicleNumber;
                      return (
                        <SelectItem key={String(v.id)} value={String(v.id)}>
                          {plate} — {v.make} {v.model}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Driver</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={driverType === "internal" ? "default" : "outline"}
                  onClick={() => setDriverType("internal")}
                >
                  Select from system
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={driverType === "external" ? "default" : "outline"}
                  onClick={() => setDriverType("external")}
                >
                  Enter manually
                </Button>
              </div>
              {driverType === "internal" ? (
                <EligiblePassengerPicker
                  selectedPassengerIds={driverUserId ? [driverUserId] : []}
                  onPassengersChange={(ids) => setDriverUserId(ids[0] ?? "")}
                  showDriver={false}
                  label="Select Driver"
                  placeholder="Search drivers by name or department…"
                  emptyLabel="No eligible drivers found."
                  selectedSuffix="driver selected"
                />
              ) : (
                <div className="grid gap-2">
                  <Input
                    placeholder="Driver name *"
                    value={externalName}
                    onChange={(e) => setExternalName(e.target.value)}
                    required
                  />
                  <Input
                    placeholder="Phone number (optional)"
                    value={externalPhone}
                    onChange={(e) => setExternalPhone(e.target.value)}
                  />
                  <Input
                    placeholder="Licence number (optional)"
                    value={externalLicence}
                    onChange={(e) => setExternalLicence(e.target.value)}
                  />
                  <Input
                    placeholder="Email (optional)"
                    value={externalEmail}
                    onChange={(e) => setExternalEmail(e.target.value)}
                  />
                  {!externalName.trim() && (
                    <p className="text-xs text-muted-foreground">
                      Driver name is required for manually entered drivers.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            {/* External passengers carried forward from the request */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>External passengers</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setExternalPassengers((prev) => [...prev, { name: "", email: "", phone: "" }])
                  }
                >
                  Add
                </Button>
              </div>
              {externalPassengers.length === 0 ? (
                <p className="text-xs text-muted-foreground">None on this request.</p>
              ) : (
                externalPassengers.map((p, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-3">
                    <Input
                      placeholder="Name"
                      value={p.name}
                      onChange={(e) =>
                        setExternalPassengers((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      placeholder="Email"
                      value={p.email ?? ""}
                      onChange={(e) =>
                        setExternalPassengers((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, email: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      placeholder="Phone"
                      value={p.phone ?? ""}
                      onChange={(e) =>
                        setExternalPassengers((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, phone: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                ))
              )}
            </div>

            {/* Accommodation */}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="conv-acc"
                  checked={accommodationRequired}
                  onCheckedChange={(v) => setAccommodationRequired(Boolean(v))}
                />
                <Label htmlFor="conv-acc" className="font-normal cursor-pointer">
                  Accommodation required
                </Label>
              </div>
              {accommodationRequired && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Hotel / accommodation name"
                    value={accommodationName}
                    onChange={(e) => setAccommodationName(e.target.value)}
                  />
                  <Input
                    placeholder="Address"
                    value={accommodationAddress}
                    onChange={(e) => setAccommodationAddress(e.target.value)}
                  />
                  <Input
                    placeholder="Contact"
                    value={accommodationContact}
                    onChange={(e) => setAccommodationContact(e.target.value)}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Estimated cost (₦)"
                    value={accommodationCost}
                    onChange={(e) => setAccommodationCost(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Escort / security */}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="conv-escort"
                  checked={escortRequired}
                  onCheckedChange={(v) => setEscortRequired(Boolean(v))}
                />
                <Label htmlFor="conv-escort" className="font-normal cursor-pointer">
                  Security escort required
                </Label>
              </div>
              {escortRequired && (
                <div className="grid gap-2">
                  <Textarea
                    rows={2}
                    placeholder="Escort arrangement details"
                    value={escortDescription}
                    onChange={(e) => setEscortDescription(e.target.value)}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Escort estimated cost (₦)"
                    value={escortCost}
                    onChange={(e) => setEscortCost(e.target.value)}
                  />
                </div>
              )}
            </div>

            {totalEstimatedCost > 0 && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">Total estimated cost</span>
                <span className="font-semibold">₦{totalEstimatedCost.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => handleSubmit()} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Convert
          </Button>
        </DialogFooter>

        <AlertDialog open={softWarning != null} onOpenChange={(o) => !o && setSoftWarning(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm conversion</AlertDialogTitle>
              <AlertDialogDescription>{softWarning}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go back</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setSoftWarning(null);
                  void handleSubmit(true);
                }}
              >
                Continue anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
