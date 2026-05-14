import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { getDisplayId, getMrfApiId } from "@/utils/displayId";
import { getSrfRequesterDisplayName } from "@/utils/srfRequester";
import { formatMRFDate } from "@/utils/dateUtils";
import { MRFProgressTracker } from "@/components/MRFProgressTracker";
import { SRFDetailPanel } from "@/components/SRFDetailPanel";
import { getSrfStatusBadgeClass } from "@/utils/srfStatusBadge";
import { srfApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { SRFRequest, MRFRequest } from "@/contexts/AppContext";
import type { MRF } from "@/types";

function statusBadgeClass(status: string): string {
  const s = (status || "").toLowerCase();
  if (s.includes("reject")) return "bg-destructive/15 text-destructive border-destructive/30";
  if (s.includes("complete") || s.includes("paid")) return "bg-success/15 text-success border-success/30";
  if (s.includes("progress") || s.includes("procurement")) return "bg-primary/15 text-primary border-primary/30";
  if (s.includes("approv")) return "bg-info/15 text-info border-info/30";
  return "bg-warning/15 text-warning border-warning/30";
}

function mrfRequestToMrf(m: MRFRequest): MRF {
  return {
    id: m.id,
    title: m.title,
    category: m.category,
    urgency: m.urgency as MRF["urgency"],
    description: m.description,
    quantity: m.quantity,
    estimatedCost: m.estimatedCost,
    justification: m.justification,
    requester: m.requester,
    requesterId: "",
    date: m.date,
    status: m.status,
    currentStage: m.currentStage as MRF["currentStage"],
    department: m.department,
  } as MRF;
}

type Row =
  | { kind: "srf"; data: SRFRequest }
  | { kind: "mrf"; data: MRFRequest };

export interface LogisticsMyRequestsListProps {
  srfRequests: SRFRequest[];
  mrfRequests: MRFRequest[];
  /** When set, only rows whose requester matches (case-insensitive trim) are shown. */
  filterRequester?: string | null;
  isActive?: boolean;
  onRefresh?: () => void | Promise<void>;
}

function canDeletePendingSrf(s: SRFRequest): boolean {
  return String(s.status || "").trim().toLowerCase() === "pending";
}

export function LogisticsMyRequestsList({
  srfRequests,
  mrfRequests,
  filterRequester,
  isActive,
  onRefresh,
}: LogisticsMyRequestsListProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [srfOpen, setSrfOpen] = useState(false);
  const [mrfOpen, setMrfOpen] = useState(false);
  const [selectedSrf, setSelectedSrf] = useState<SRFRequest | null>(null);
  const [selectedMrf, setSelectedMrf] = useState<MRFRequest | null>(null);
  const [deleteSrfOpen, setDeleteSrfOpen] = useState(false);
  const [deletingSrf, setDeletingSrf] = useState(false);

  useEffect(() => {
    if (isActive && onRefresh) {
      void onRefresh();
    }
  }, [isActive, onRefresh]);

  const rows: Row[] = useMemo(() => {
    const norm = (n: string | null | undefined) => (n || "").trim().toLowerCase();
    const fr = filterRequester ? norm(filterRequester) : "";
    const match = (requester: string) => !fr || norm(requester) === fr;

    const srfs = srfRequests
      .filter((s) => match(getSrfRequesterDisplayName(s)))
      .map((data) => ({ kind: "srf" as const, data }));
    const mrfs = mrfRequests.filter((m) => match(m.requester)).map((data) => ({ kind: "mrf" as const, data }));
    return [...srfs, ...mrfs].sort((a, b) => {
      const da = new Date((a.kind === "srf" ? a.data.createdAt || a.data.date : a.data.date) || 0).getTime();
      const db = new Date((b.kind === "srf" ? b.data.createdAt || b.data.date : b.data.date) || 0).getTime();
      return db - da;
    });
  }, [srfRequests, mrfRequests, filterRequester]);

  const createdLabel = (r: Row) => {
    const raw =
      r.kind === "srf" ? r.data.createdAt || r.data.date : r.data.date;
    return formatMRFDate(raw);
  };

  const closeSrfDialog = () => {
    setSrfOpen(false);
    setSelectedSrf(null);
    setDeleteSrfOpen(false);
  };

  const handleConfirmDeleteSrf = async () => {
    if (!selectedSrf) return;
    const apiId = getDisplayId(selectedSrf) || selectedSrf.id;
    setDeletingSrf(true);
    try {
      const res = await srfApi.delete(apiId);
      if (res.success) {
        toast({ title: "SRF deleted", description: `${apiId} has been removed.` });
        window.dispatchEvent(new CustomEvent("app:refresh"));
        closeSrfDialog();
        void onRefresh?.();
      } else {
        toast({
          title: "Could not delete",
          description: res.error || "The server rejected this delete request.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to connect to the server.",
        variant: "destructive",
      });
    } finally {
      setDeletingSrf(false);
      setDeleteSrfOpen(false);
    }
  };

  const showSrfDelete =
    !!selectedSrf &&
    canDeletePendingSrf(selectedSrf) &&
    (!!filterRequester
      ? true
      : (user?.name || "").trim().toLowerCase() ===
        (selectedSrf.requester || "").trim().toLowerCase());

  return (
    <>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            You haven&apos;t submitted any requests yet. Use New MRF, New SRF, or Initiate SRF from Fleet.
          </p>
        ) : (
          rows.map((row) => {
            if (row.kind === "srf") {
              const request = row.data;
              return (
                <div
                  key={`srf-${request.id}`}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border rounded-xl bg-card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{request.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {getDisplayId(request)} • {request.requester} • {createdLabel(row)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Service request (SRF)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={getSrfStatusBadgeClass(request.status)}>{request.status}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSrf(request);
                        setSrfOpen(true);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              );
            }
            const mrf = row.data;
            return (
              <div
                key={`mrf-${mrf.id}`}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border rounded-xl bg-card hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 shrink-0 bg-muted rounded-lg flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{mrf.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {getDisplayId(mrf)} • {mrf.requester} • {createdLabel(row)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Material request (MRF)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={statusBadgeClass(mrf.status)}>{mrf.status}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedMrf(mrf);
                      setMrfOpen(true);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog
        open={srfOpen}
        onOpenChange={(open) => {
          if (!open) closeSrfDialog();
          else setSrfOpen(true);
        }}
      >
        {selectedSrf && (
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Service Request Form Details</DialogTitle>
              <DialogDescription>
                {selectedSrf.title} — {getDisplayId(selectedSrf)}
              </DialogDescription>
            </DialogHeader>
            <SRFDetailPanel detail={selectedSrf} trackerShowTitle />
            {showSrfDelete ? (
              <DialogFooter className="gap-2 sm:justify-between border-t pt-4">
                <Button type="button" variant="outline" onClick={() => closeSrfDialog()}>
                  Close
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deletingSrf}
                  onClick={() => setDeleteSrfOpen(true)}
                >
                  {deletingSrf ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete SRF
                </Button>
              </DialogFooter>
            ) : (
              <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={() => closeSrfDialog()}>
                  Close
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        )}
      </Dialog>

      <AlertDialog open={deleteSrfOpen} onOpenChange={setDeleteSrfOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this SRF?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              {selectedSrf ? getDisplayId(selectedSrf) : "this SRF"} from the system. You can only
              delete requests that are still <strong>Pending</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSrf}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingSrf}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteSrf();
              }}
            >
              {deletingSrf ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={mrfOpen}
        onOpenChange={(open) => {
          setMrfOpen(open);
          if (!open) setSelectedMrf(null);
        }}
      >
        {selectedMrf && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedMrf.title}</DialogTitle>
              <DialogDescription>
                {getDisplayId(selectedMrf)} • {selectedMrf.requester}
              </DialogDescription>
            </DialogHeader>
            <MRFProgressTracker
              mrfId={getMrfApiId(mrfRequestToMrf(selectedMrf))}
              showTitle={false}
              contractType={(selectedMrf as unknown as { contract_type?: string }).contract_type}
            />
            <div className="grid gap-2 text-sm border-t pt-4">
              <div>
                <Label className="text-muted-foreground">Stage</Label>
                <p className="font-medium">{selectedMrf.currentStage || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Estimated (₦)</Label>
                <p className="font-medium">
                  ₦{parseFloat(selectedMrf.estimatedCost || "0").toLocaleString()}
                </p>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
