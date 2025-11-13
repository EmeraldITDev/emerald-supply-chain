import { useState } from "react";
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
import { MRFRequest } from "@/contexts/AppContext";
import { CheckCircle2, XCircle, Clock, User, Calendar } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface MRFApprovalDialogProps {
  mrf: MRFRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (remarks: string) => void;
  onReject: (remarks: string) => void;
  currentUserRole: "executive" | "finance" | "chairman";
}

export function MRFApprovalDialog({
  mrf,
  open,
  onOpenChange,
  onApprove,
  onReject,
  currentUserRole,
}: MRFApprovalDialogProps) {
  const [remarks, setRemarks] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  if (!mrf) return null;

  const handleApprove = () => {
    setIsApproving(true);
    onApprove(remarks);
    setRemarks("");
    setIsApproving(false);
    onOpenChange(false);
  };

  const handleReject = () => {
    if (!remarks.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    onReject(remarks);
    setRemarks("");
    onOpenChange(false);
  };

  const getTimeElapsed = () => {
    if (!mrf.procurementManagerApprovalTime) return null;
    
    const startTime = new Date(mrf.procurementManagerApprovalTime);
    const now = new Date();
    const hoursElapsed = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    
    return hoursElapsed;
  };

  const getTimerColor = () => {
    const hours = getTimeElapsed();
    if (!hours) return "text-muted-foreground";
    
    if (hours <= 48) return "text-emerald-600 dark:text-emerald-400";
    if (hours <= 72) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  const formatTimeElapsed = () => {
    const hours = getTimeElapsed();
    if (!hours) return "N/A";
    
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    
    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${remainingHours}h`;
  };

  const canApprove = mrf.currentStage === currentUserRole;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            MRF Approval - {mrf.id}
            {mrf.isResubmission && (
              <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-1 rounded">
                Resubmission
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Review and approve or reject this material request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Timer */}
          <div className={`flex items-center gap-2 p-3 rounded-lg bg-muted ${getTimerColor()}`}>
            <Clock className="h-5 w-5" />
            <div>
              <p className="font-semibold">Time Elapsed</p>
              <p className="text-sm">{formatTimeElapsed()} since procurement submission</p>
            </div>
          </div>

          {/* MRF Details */}
          <div className="space-y-3">
            <div>
              <Label className="text-muted-foreground">Title</Label>
              <p className="font-medium">{mrf.title}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Category</Label>
                <p className="font-medium capitalize">{mrf.category.replace("-", " ")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Urgency</Label>
                <p className="font-medium capitalize">{mrf.urgency}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Quantity</Label>
                <p className="font-medium">{mrf.quantity}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Estimated Cost</Label>
                <p className="font-medium">₦{Number(mrf.estimatedCost).toLocaleString()}</p>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Description</Label>
              <p className="text-sm">{mrf.description}</p>
            </div>

            <div>
              <Label className="text-muted-foreground">Justification</Label>
              <p className="text-sm">{mrf.justification}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-muted-foreground text-xs">Requester</Label>
                  <p className="text-sm font-medium">{mrf.requester}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-muted-foreground text-xs">Date</Label>
                  <p className="text-sm font-medium">{mrf.date}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Approval History */}
          {mrf.approvalHistory && mrf.approvalHistory.length > 0 && (
            <>
              <Separator />
              <div>
                <Label className="text-lg font-semibold">Approval History</Label>
                <div className="mt-3 space-y-3">
                  {mrf.approvalHistory.map((action, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      {action.action === "approved" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium capitalize">{action.stage}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            action.action === "approved" 
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                              : "bg-destructive/10 text-destructive"
                          }`}>
                            {action.action}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          by {action.approver} • {new Date(action.timestamp).toLocaleString()}
                        </p>
                        {action.remarks && (
                          <p className="text-sm mt-2 bg-muted p-2 rounded">{action.remarks}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Rejection Reason (if resubmission) */}
          {mrf.isResubmission && mrf.rejectionReason && (
            <>
              <Separator />
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <Label className="text-destructive font-semibold">Previous Rejection Reason</Label>
                <p className="text-sm mt-2">{mrf.rejectionReason}</p>
              </div>
            </>
          )}

          {/* Current Status */}
          <Separator />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Current Stage:</span>
            <span className="font-semibold capitalize">{mrf.currentStage}</span>
          </div>

          {/* Remarks Input */}
          {canApprove && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="remarks">
                  Your Remarks {!remarks.trim() && <span className="text-muted-foreground">(Optional for approval, required for rejection)</span>}
                </Label>
                <Textarea
                  id="remarks"
                  placeholder="Add your comments or remarks here..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={4}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {canApprove ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={handleApprove} disabled={isApproving}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
