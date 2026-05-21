import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, UserPlus, Users2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi } from "@/services/api";
import { fleetApi, logisticsVendorsApi } from "@/services/logisticsApi";
import { EligiblePassengerPicker } from "./EligiblePassengerPicker";
import type { Trip, TripWorkflowStage } from "@/types/logistics";
import { getTripWorkflowStageLabel } from "@/utils/workflowStageLabels";

const LOGISTICS_ROLES = new Set([
  "logistics_manager",
  "logistics_officer",
  "logistics",
  "admin",
]);

const PROCUREMENT_ROLES = new Set(["procurement", "procurement_manager"]);

const SCD_ROLES = new Set(["supply_chain_director", "supply_chain"]);

interface TripWorkflowActionsProps {
  trip: Trip;
  userRole?: string;
  onUpdated?: () => void;
  onAssignVendor?: () => void;
  onCompareVendors?: () => void;
}

export function TripWorkflowActions({
  trip,
  userRole,
  onUpdated,
  onAssignVendor,
  onCompareVendors,
}: TripWorkflowActionsProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [signedPoOpen, setSignedPoOpen] = useState(false);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; name: string }>>([]);
  const [vendorId, setVendorId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [passengerIds, setPassengerIds] = useState<string[]>([]);
  const [driverUserId, setDriverUserId] = useState<string | undefined>();
  const [poNumber, setPoNumber] = useState("");
  const [unsignedPoUrl, setUnsignedPoUrl] = useState("");
  const [signedPoUrl, setSignedPoUrl] = useState("");

  const stage = ((trip as Trip & { workflow_stage?: TripWorkflowStage }).workflow_stage ||
    (trip as Trip & { workflowStage?: TripWorkflowStage }).workflowStage ||
    "trip_request") as TripWorkflowStage;

  const selectedVendorId =
    (trip as Trip & { selected_vendor_id?: string | number }).selected_vendor_id ||
    trip.vendorId;

  const isLogistics = userRole && LOGISTICS_ROLES.has(userRole);
  const isProcurement = userRole && PROCUREMENT_ROLES.has(userRole);
  const isScd = userRole && SCD_ROLES.has(userRole);

  const canConvert =
    isLogistics && (stage === "trip_request" || stage === "logistics_review");

  const loadConvertOptions = async () => {
    const [vRes, fleetRes] = await Promise.all([
      logisticsVendorsApi.getAll(),
      fleetApi.getAll(),
    ]);
    if (vRes.success && vRes.data) {
      const arr = Array.isArray(vRes.data) ? vRes.data : [];
      setVendors(
        arr.map((v: { id?: string | number; name?: string; company_name?: string }) => ({
          id: String(v.id),
          name: v.name || v.company_name || `Vendor ${v.id}`,
        })),
      );
    }
    if (fleetRes.success && fleetRes.data) {
      const arr = Array.isArray(fleetRes.data) ? fleetRes.data : [];
      setVehicles(
        arr.map((v: { id?: string | number; name?: string; plate?: string }) => ({
          id: String(v.id),
          name: v.name || v.plate || `Vehicle ${v.id}`,
        })),
      );
    }
  };

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res.success) {
        toast({ title: successMsg });
        onUpdated?.();
      } else {
        toast({ title: "Action failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  const hasUnsignedPo = Boolean(
    (trip as Trip & { unsigned_po_url?: string }).unsigned_po_url ||
      (trip as Trip & { unsignedPoUrl?: string }).unsignedPoUrl,
  );

  const showProcurementVendorActions =
    isProcurement && (stage === "vendor_selection" || stage === "procurement_review");

  return (
    <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
      <div>
        <p className="text-sm font-medium">Trip workflow</p>
        <p className="text-sm text-muted-foreground">{getTripWorkflowStageLabel(stage)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {canConvert && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              setConvertOpen(true);
              loadConvertOptions();
            }}
          >
            Convert to logistics request
          </Button>
        )}

        {showProcurementVendorActions && onAssignVendor && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onAssignVendor}>
            <UserPlus className="mr-2 h-4 w-4" />
            Assign vendor
          </Button>
        )}

        {showProcurementVendorActions && onCompareVendors && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onCompareVendors}>
            <Users2 className="mr-2 h-4 w-4" />
            Compare vendor quotes
          </Button>
        )}

        {stage === "procurement_review" && isProcurement && selectedVendorId && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              run(
                () => tripRequestApi.procurementApproveQuote(String(trip.id)),
                "Quote approved — routed to Supply Chain Director",
              )
            }
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve vendor quote
          </Button>
        )}

        {stage === "procurement_review" && isProcurement && !selectedVendorId && (
          <p className="text-xs text-amber-600 w-full">
            Select a vendor before approving the quote.
          </p>
        )}

        {stage === "scd_approval" && isScd && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              run(() => tripRequestApi.scdApprove(String(trip.id)), "SCD approval recorded")
            }
          >
            SCD approve trip
          </Button>
        )}

        {stage === "po_generation" && isProcurement && (
          <Button size="sm" disabled={busy} onClick={() => setPoOpen(true)}>
            Generate trip PO
          </Button>
        )}

        {stage === "po_generation" && isScd && hasUnsignedPo && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setSignedPoOpen(true)}>
            Upload signed PO
          </Button>
        )}
      </div>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert to logistics request</DialogTitle>
            <DialogDescription>Assign vendor, vehicle, passengers, and optional driver.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vehicle *</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <EligiblePassengerPicker
              selectedPassengerIds={passengerIds}
              onPassengersChange={setPassengerIds}
              driverUserId={driverUserId}
              onDriverChange={setDriverUserId}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={busy || !vendorId || !vehicleId}
              onClick={async () => {
                setBusy(true);
                try {
                  const conversionBody: import("@/types/logistics").TripConversionData = {
                    vendor_id: parseInt(vendorId, 10),
                    vehicle_id: parseInt(vehicleId, 10),
                    passenger_user_ids: passengerIds.map((id) => parseInt(id, 10)),
                    ...(driverUserId ? { driver_user_id: parseInt(driverUserId, 10) } : {}),
                  };
                  const res = await tripRequestApi.convertToLogisticsRequest(
                    String(trip.id),
                    conversionBody,
                  );
                  if (res.success) {
                    toast({ title: "Converted", description: "Procurement has been notified." });
                    setConvertOpen(false);
                    onUpdated?.();
                  } else {
                    toast({ title: "Failed", description: res.error, variant: "destructive" });
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate trip PO</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>PO number *</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unsigned PO URL *</Label>
              <Input value={unsignedPoUrl} onChange={(e) => setUnsignedPoUrl(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={busy || !poNumber || !unsignedPoUrl}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await tripRequestApi.generatePO(String(trip.id), {
                    po_number: poNumber,
                    unsigned_po_url: unsignedPoUrl,
                  });
                  if (res.success) {
                    toast({ title: "Trip PO generated" });
                    setPoOpen(false);
                    onUpdated?.();
                  } else {
                    toast({ title: "Failed", description: res.error, variant: "destructive" });
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signedPoOpen} onOpenChange={setSignedPoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload signed trip PO</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Signed PO URL *</Label>
            <Input value={signedPoUrl} onChange={(e) => setSignedPoUrl(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              disabled={busy || !signedPoUrl}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await tripRequestApi.uploadSignedPO(String(trip.id), {
                    signed_po_url: signedPoUrl,
                  });
                  if (res.success) {
                    toast({ title: "Signed PO uploaded" });
                    setSignedPoOpen(false);
                    onUpdated?.();
                  } else {
                    toast({ title: "Failed", description: res.error, variant: "destructive" });
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
