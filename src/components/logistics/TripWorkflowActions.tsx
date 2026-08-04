import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { TripRequestConversionDialog } from "./TripRequestConversionDialog";
import type { TripConversionResult } from "./TripRequestConversionDialog";
import type { StaffTripRequest } from "@/types/trip-request";
import type { Trip, TripWorkflowStage } from "@/types/logistics";
import { getTripWorkflowStageLabel } from "@/utils/workflowStageLabels";
import {
  isTripConverted,
  markTripConverted,
} from "@/utils/tripApprovalState";

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
  onConverted?: (result: TripConversionResult) => void;
  onAssignVendor?: () => void;
  onCompareVendors?: () => void;
}

export function TripWorkflowActions({
  trip,
  userRole,
  onUpdated,
  onConverted,
  onAssignVendor,
  onCompareVendors,
}: TripWorkflowActionsProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [signedPoOpen, setSignedPoOpen] = useState(false);
  const [converted, setConverted] = useState(() =>
    isTripConverted(trip as unknown as Record<string, unknown>),
  );
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

  useEffect(() => {
    setConverted(isTripConverted(trip as unknown as Record<string, unknown>));
  }, [trip]);

  const canConvert =
    isLogistics &&
    !converted &&
    (stage === "trip_request" || stage === "logistics_review");

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
            onClick={() => setConvertOpen(true)}
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

      <TripRequestConversionDialog
        request={
          {
            ...(trip as unknown as StaffTripRequest),
            id: trip.id,
          } as StaffTripRequest
        }
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={(result) => {
          markTripConverted(trip.id);
          setConverted(true);
          setConvertOpen(false);
          if (onConverted) onConverted(result);
          else onUpdated?.();
        }}
      />

      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate trip PO</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>PO number (optional)</Label>
              <Input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Leave blank to auto-generate (PO-DDMMYY-Supplier-NNNN)"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank and the system generates the PO number from the
                carrier/vendor name.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Unsigned PO URL *</Label>
              <Input value={unsignedPoUrl} onChange={(e) => setUnsignedPoUrl(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={busy || !unsignedPoUrl}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await tripRequestApi.generatePO(String(trip.id), {
                    ...(poNumber.trim()
                      ? { po_number: poNumber.trim() }
                      : {}),
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
