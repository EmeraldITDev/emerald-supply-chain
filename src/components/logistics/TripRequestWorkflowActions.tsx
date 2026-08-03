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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, XCircle, RotateCcw, CheckCircle, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi } from "@/services/api";
import type { StaffTripRequest } from "@/types/trip-request";
import { TripRequestConversionDialog } from "./TripRequestConversionDialog";
import { getScmRole } from "@/utils/scmRole";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  canScdApprove,
  canScdReject,
  canConvertToLogistics,
  isTripConverted,
  markTripDirectorApproved,
  markTripConverted,
} from "@/utils/tripApprovalState";
import { resolveTripWorkflowError, isStaleTripStateError } from "@/utils/tripApprovalErrors";

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
  const [reviewComments, setReviewComments] = useState("");
  const [reviewEstimatedCost, setReviewEstimatedCost] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);

  const isLm =
    role === "logistics_manager" || role === "logistics_officer" || role === "logistics" || role === "admin";
  const isDirector =
    role === "supply_chain_director" ||
    role === "supply_chain" ||
    role === "supervising_director" ||
    role === "director" ||
    role === "admin";

  // Backend `available_actions` is the single source of truth; the helpers fall
  // back to canonical workflow states only when the API omits it.
  const approveAllowed = canScdApprove(trip);
  const rejectAllowed = canScdReject(trip);

  const run = async (
    fn: () => Promise<{ success: boolean; error?: string; code?: string }>,
    successMsg: string,
  ) => {
    setBusy(true);
    try {
      const res = await fn();
      const stale = !res.success && isStaleTripStateError(res);
      if (res.success || stale) {
        toast(
          stale
            ? { title: "Already processed", description: resolveTripWorkflowError(res) }
            : { title: successMsg },
        );
        // Invalidate trip + dashboard queries so widgets update instantly
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["trips"] });
        void queryClient.invalidateQueries({ queryKey: ["trip-requests"] });
        // Refresh legacy local-state dashboards (SCD, Logistics) that listen for app:refresh
        window.dispatchEvent(new CustomEvent("app:refresh"));
        onUpdated?.();
      } else {
        toast({
          title: "Action failed",
          description: resolveTripWorkflowError(res),
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
      setReasonOpen(null);
      setReason("");
      setReviewComments("");
      setReviewEstimatedCost("");
    }
  };

  const showForward = isLm && actions.includes("forward");
  const showReject = isLm && actions.includes("reject");
  const showChanges = isLm && actions.includes("request_changes");
  // Convert disappears the moment the trip has a logistics record or the
  // backend stops offering the action.
  const showConvert = isLm && !isTripConverted(trip as unknown as Record<string, unknown>) &&
    canConvertToLogistics(trip as unknown as Record<string, unknown>);
  const showDirectorApprove = isDirector && approveAllowed;
  const showDirectorReject = isDirector && rejectAllowed;
  const showDirectorReturn =
    isDirector && (actions.includes("director_return") || approveAllowed);

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
            onClick={() =>
              run(
                () =>
                  tripRequestApi.logisticsReview(String(trip.id), {
                    action: "forward",
                  }),
                "Forwarded to Supervising Director",
              )
            }
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
            onClick={() =>
              run(
                async () => {
                  const res = await tripRequestApi.directorApprove(String(trip.id));
                  if (res.success) markTripDirectorApproved(trip.id);
                  return res;
                },
                "Trip approved. The Logistics Manager has been notified.",
              )
            }
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
          {reasonOpen === "changes" && isLm && (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label>Review comments (optional)</Label>
                <Textarea
                  rows={2}
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Updated estimated total cost (₦, optional)</Label>
                <Input
                  type="number"
                  min={0}
                  value={reviewEstimatedCost}
                  onChange={(e) => setReviewEstimatedCost(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || (reasonOpen !== "reject" && !reason.trim())}
              onClick={() => {
                if (reasonOpen === "changes") {
                  const cost = reviewEstimatedCost ? Number(reviewEstimatedCost) : undefined;
                  void run(
                    () =>
                      tripRequestApi.logisticsReview(String(trip.id), {
                        action: "request_changes",
                        reason,
                        comments: reviewComments.trim() || undefined,
                        estimated_cost:
                          cost != null && !Number.isNaN(cost) ? cost : undefined,
                      }),
                    "Change request sent",
                  );
                } else if (reasonOpen === "return") {
                  void run(() => tripRequestApi.directorReturn(String(trip.id), reason), "Returned to employee");
                } else if (reasonOpen === "reject" && isDirector && rejectAllowed) {
                  void run(() => tripRequestApi.directorReject(String(trip.id), reason), "Trip request rejected");
                } else {
                  void run(
                    () =>
                      tripRequestApi.logisticsReview(String(trip.id), {
                        action: "reject",
                        reason,
                      }),
                    "Trip request rejected",
                  );
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
        onConverted={() => {
          markTripConverted(trip.id);
          onUpdated?.();
        }}
      />
    </>
  );
}
