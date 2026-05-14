import { useEffect, useMemo, useState } from "react";
import { FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDisplayId, getMrfApiId } from "@/utils/displayId";
import { formatMRFDate } from "@/utils/dateUtils";
import { SRFProgressTracker } from "@/components/SRFProgressTracker";
import { MRFProgressTracker } from "@/components/MRFProgressTracker";
import type { SRFRequest, MRFRequest } from "@/contexts/AppContext";
import type { SRF } from "@/types";
import type { MRF } from "@/types";

function statusBadgeClass(status: string): string {
  const s = (status || "").toLowerCase();
  if (s.includes("reject")) return "bg-destructive/15 text-destructive border-destructive/30";
  if (s.includes("complete") || s.includes("paid")) return "bg-success/15 text-success border-success/30";
  if (s.includes("progress") || s.includes("procurement")) return "bg-primary/15 text-primary border-primary/30";
  if (s.includes("approv")) return "bg-info/15 text-info border-info/30";
  return "bg-warning/15 text-warning border-warning/30";
}

function srfRequestToTrackerPayload(r: SRFRequest): SRF {
  const u = (r.urgency || "medium").toLowerCase();
  const urgencyCap =
    u === "low" ? "Low" : u === "high" || u === "critical" ? "High" : "Medium";
  const st = (r.status || "Pending") as SRF["status"];
  return {
    id: r.id,
    formatted_id: r.formatted_id,
    formattedId: r.formattedId,
    legacy_id: r.legacy_id,
    legacyId: r.legacyId,
    title: r.title,
    serviceType: r.serviceType,
    urgency: urgencyCap,
    description: r.description,
    duration: r.duration,
    estimatedCost: r.estimatedCost,
    justification: r.justification,
    requester: r.requester,
    date: r.date,
    status: st,
    current_stage: r.currentStage,
    currentStage: r.currentStage,
    department: r.department,
  };
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

export function LogisticsMyRequestsList({
  srfRequests,
  mrfRequests,
  filterRequester,
  isActive,
  onRefresh,
}: LogisticsMyRequestsListProps) {
  const [srfOpen, setSrfOpen] = useState(false);
  const [mrfOpen, setMrfOpen] = useState(false);
  const [selectedSrf, setSelectedSrf] = useState<SRFRequest | null>(null);
  const [selectedMrf, setSelectedMrf] = useState<MRFRequest | null>(null);

  useEffect(() => {
    if (isActive && onRefresh) {
      void onRefresh();
    }
  }, [isActive, onRefresh]);

  const rows: Row[] = useMemo(() => {
    const norm = (n: string | null | undefined) => (n || "").trim().toLowerCase();
    const fr = filterRequester ? norm(filterRequester) : "";
    const match = (requester: string) => !fr || norm(requester) === fr;

    const srfs = srfRequests.filter((s) => match(s.requester)).map((data) => ({ kind: "srf" as const, data }));
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
                    <Badge className={statusBadgeClass(request.status)}>{request.status}</Badge>
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
          setSrfOpen(open);
          if (!open) setSelectedSrf(null);
        }}
      >
        {selectedSrf && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedSrf.title}</DialogTitle>
              <DialogDescription>
                {getDisplayId(selectedSrf)} • {selectedSrf.requester}
              </DialogDescription>
            </DialogHeader>
            <SRFProgressTracker srf={srfRequestToTrackerPayload(selectedSrf)} showTitle={false} />
            <div className="grid gap-3 text-sm border-t pt-4">
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <Badge className={statusBadgeClass(selectedSrf.status)}>{selectedSrf.status}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p className="font-medium">{formatMRFDate(selectedSrf.createdAt || selectedSrf.date)}</p>
              </div>
              {selectedSrf.currentStage && (
                <div>
                  <Label className="text-muted-foreground">Workflow stage</Label>
                  <p className="font-medium font-mono text-xs">{selectedSrf.currentStage}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Service type</Label>
                <p className="font-medium">{selectedSrf.serviceType || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Estimated (₦)</Label>
                <p className="font-medium">
                  ₦{parseFloat(selectedSrf.estimatedCost || "0").toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Duration</Label>
                <p className="font-medium">{selectedSrf.duration || "—"}</p>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

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
