import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send, XCircle, RotateCcw, CheckCircle, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi } from "@/services/api";
import type { StaffTripRequest } from "@/types/trip-request";
import { TripRequestConversionDialog } from "./TripRequestConversionDialog";
import { getScmRole } from "@/utils/scmRole";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface TripRequestWorkflowActionsProps {
  trip: StaffTripRequest;
  onUpdated?: () => void;
}

export function TripRequestWorkflowActions({ trip, onUpdated }: TripRequestWorkflowActionsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const role = getScmRole(user);
  const actions = trip.availableActions ?? [];
  const [busy, setBusy] = useState(false);
  const [reasonOpen, setReasonOpen] = useState<"reject" | "changes" | "return" | null>(null);
  const [reason, setReason] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);

  const isLm =
    role === "logistics_manager" || role === "logistics_officer" || role === "logistics" || role === "admin";
  const isDirector =
    role === "supply_chain_director" ||
    role === "supply_chain" ||
    role === "supervising_director" ||
    role === "director" ||
    role === "admin";

  const stage = String(
    trip.workflowStage ?? trip.workflow_stage ?? trip.status ?? "",
  )
    .toLowerCase()
    .replace(/\s+/g, "_");
  const isPendingDirector =
    stage.includes("director") &&
    (stage.includes("pending") || stage.includes("forward") || stage.includes("review")) ||
    stage === "forwarded" ||
    stage === "pending_director_approval";

  // Debug: verify what role/status the frontend is seeing
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.debug("[TripRequestWorkflowActions]", {
      role,
      status: trip.status,
      workflowStage: trip.workflowStage ?? trip.workflow_stage,
      availableActions: actions,
      isDirector,
      isPendingDirector,
    });
  }

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res.success) {
        toast({ title: successMsg });
        // Invalidate trip + dashboard queries so widgets update instantly
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["trips"] });
        void queryClient.invalidateQueries({ queryKey: ["trip-requests"] });
        // Refresh legacy local-state dashboards (SCD, Logistics) that listen for app:refresh
        window.dispatchEvent(new CustomEvent("app:refresh"));
        onUpdated?.();
      } else {
        toast({ title: "Action failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusy(false);
      setReasonOpen(null);
      setReason("");
    }
  };

  const showForward = isLm && actions.includes("forward");
  const showReject = isLm && actions.includes("reject");
  const showChanges = isLm && actions.includes("request_changes");
  const showConvert = isLm && actions.includes("convert");
  // Fall back to status-derived visibility when the backend omits availableActions
  // for director-stage trips (common when status="pending_director_approval").
  const showDirectorApprove =
    isDirector && (actions.includes("director_approve") || isPendingDirector);
  const showDirectorReject =
    isDirector && (actions.includes("director_reject") || isPendingDirector);
  const showDirectorReturn =
    isDirector && (actions.includes("director_return") || isPendingDirector);

  if (
    !showForward &&
    !showReject &&
    !showChanges &&
    !showConvert &&
    !showDirectorApprove &&
    !showDirectorReject &&
    !showDirectorReturn
  ) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {showForward && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(() => tripRequestApi.forward(String(trip.id)), "Forwarded to Supervising Director")}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Forward to Director
          </Button>
        )}
        {showChanges && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setReasonOpen("changes")}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Request changes
          </Button>
        )}
        {showReject && (
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setReasonOpen("reject")}>
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
        )}
        {showDirectorApprove && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(() => tripRequestApi.directorApprove(String(trip.id)), "Trip request approved")}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Approve
          </Button>
        )}
        {showDirectorReturn && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setReasonOpen("return")}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Return for revision
          </Button>
        )}
        {showDirectorReject && (
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setReasonOpen("reject")}>
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
        )}
        {showConvert && (
          <Button size="sm" onClick={() => setConvertOpen(true)}>
            <Truck className="mr-2 h-4 w-4" />
            Convert to logistics request
          </Button>
        )}
      </div>

      <Dialog open={reasonOpen !== null} onOpenChange={(o) => !o && setReasonOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonOpen === "return"
                ? "Return for revision"
                : reasonOpen === "changes"
                  ? "Request changes"
                  : "Reject trip request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason{reasonOpen === "reject" && !isDirector ? " (optional)" : " (required)"}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || (reasonOpen !== "reject" && !reason.trim())}
              onClick={() => {
                if (reasonOpen === "changes") {
                  void run(() => tripRequestApi.requestChanges(String(trip.id), reason), "Change request sent");
                } else if (reasonOpen === "return") {
                  void run(() => tripRequestApi.directorReturn(String(trip.id), reason), "Returned to employee");
                } else if (reasonOpen === "reject" && isDirector && actions.includes("director_reject")) {
                  void run(() => tripRequestApi.directorReject(String(trip.id), reason), "Trip request rejected");
                } else {
                  void run(() => tripRequestApi.reject(String(trip.id), reason), "Trip request rejected");
                }
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TripRequestConversionDialog
        request={trip}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={() => onUpdated?.()}
      />
    </>
  );
}
