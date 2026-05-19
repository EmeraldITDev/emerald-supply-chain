import { useState } from "react";
import { getDisplayId } from "@/utils/displayId";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle } from "lucide-react";
import { getSrfRequesterDisplayName } from "@/utils/srfRequester";
import type { SRF } from "@/types";

interface SRFDirectorApprovalDialogProps {
  srf: SRF | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (remarks: string) => void;
  onReject: (reason: string) => void;
}

export function SRFDirectorApprovalDialog({
  srf,
  open,
  onOpenChange,
  onApprove,
  onReject,
}: SRFDirectorApprovalDialogProps) {
  const [remarks, setRemarks] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  if (!srf) return null;

  const serviceType =
    srf.serviceType || (srf as { service_type?: string }).service_type || "—";
  const requester = getSrfRequesterDisplayName(srf);
  const est =
    srf.estimatedCost ||
    (srf as { estimated_cost?: string }).estimated_cost ||
    "0";
  const stage =
    (srf as { current_stage?: string }).current_stage ||
    srf.currentStage ||
    "—";

  const handleApprove = () => {
    setIsApproving(true);
    onApprove(remarks);
    setRemarks("");
    setIsApproving(false);
    onOpenChange(false);
  };

  const handleReject = () => {
    const reason = remarks.trim();
    if (reason.length < 5) {
      alert(
        "Please provide a rejection reason of at least 5 characters (required by the server).",
      );
      return;
    }
    if (reason.length > 2000) {
      alert("Rejection reason must be at most 2000 characters.");
      return;
    }
    onReject(reason);
    setRemarks("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Service request — Supply Chain Director
            <span className="text-xs font-mono text-muted-foreground">
              {getDisplayId(srf)}
            </span>
          </DialogTitle>
          <DialogDescription>
            Approve to send this SRF to Procurement, or reject with a reason for the requester.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Title</Label>
            <p className="font-medium">{srf.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Service type</Label>
              <p className="font-medium capitalize">{serviceType}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Urgency</Label>
              <p className="font-medium capitalize">{String(srf.urgency || "—")}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Requester</Label>
              <p className="font-medium">{requester}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Estimated (₦)</Label>
              <p className="font-medium">₦{parseFloat(String(est)).toLocaleString()}</p>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground">Workflow stage</Label>
            <p className="text-sm font-mono">{stage}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Description</Label>
            <p className="text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
              {srf.description || "—"}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Justification</Label>
            <p className="text-sm whitespace-pre-wrap">{srf.justification || "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Duration</Label>
            <p className="text-sm">{srf.duration || "—"}</p>
          </div>

          <Separator />
          <div className="space-y-2">
            <Label htmlFor="srf-scd-remarks">
              Comments / remarks{" "}
              <span className="text-muted-foreground font-normal">
                (optional for approval; rejection requires 5–2000 characters)
              </span>
            </Label>
            <Textarea
              id="srf-scd-remarks"
              placeholder="Add comments for the requester or procurement team…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isApproving}>
            Cancel
          </Button>
          <Button variant="destructive" type="button" onClick={handleReject} disabled={isApproving}>
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button type="button" onClick={handleApprove} disabled={isApproving}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
