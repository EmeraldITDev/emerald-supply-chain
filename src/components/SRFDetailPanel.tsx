import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SRFProgressTracker } from "@/components/SRFProgressTracker";
import { getDisplayId } from "@/utils/displayId";
import { formatMRFDate } from "@/utils/dateUtils";
import { getSrfStatusBadgeClass } from "@/utils/srfStatusBadge";
import type { SRFRequest } from "@/contexts/AppContext";
import type { SRF } from "@/types";

function detailToTrackerSrf(detail: SRFRequest): SRF {
  const u = String(detail.urgency || "medium").toLowerCase();
  const urgencyCap =
    u === "low" ? "Low" : u === "high" || u === "critical" ? "High" : "Medium";
  return {
    id: detail.id,
    formatted_id: detail.formatted_id,
    formattedId: detail.formattedId,
    legacy_id: detail.legacy_id,
    legacyId: detail.legacyId,
    title: detail.title,
    serviceType: detail.serviceType,
    urgency: urgencyCap as SRF["urgency"],
    description: detail.description,
    duration: detail.duration,
    estimatedCost: detail.estimatedCost,
    justification: detail.justification,
    requester: detail.requester,
    date: detail.date,
    status: detail.status as SRF["status"],
    current_stage: detail.currentStage,
    currentStage: detail.currentStage,
    department: detail.department,
  };
}

export interface SRFDetailPanelProps {
  detail: SRFRequest;
  /** When false, matches compact logistics dialog header inside tracker card. */
  trackerShowTitle?: boolean;
  /** Optional actions (e.g. Delete) rendered below workflow status. */
  footer?: ReactNode;
}

/**
 * Shared SRF detail body: progress tracker + fields + workflow blurb (same structure as Procurement).
 */
export function SRFDetailPanel({
  detail,
  trackerShowTitle = true,
  footer,
}: SRFDetailPanelProps) {
  const created =
    detail.createdAt ||
    (detail as { created_at?: string }).created_at ||
    detail.date;

  const st = String(detail.status || "").trim();
  const normalized = st.toLowerCase();

  let workflowHint = "Track progress using the steps above.";
  if (normalized === "pending") {
    workflowHint = "Awaiting Supply Chain Director Approval";
  } else if (normalized === "approved") {
    workflowHint = "In Procurement - Sourcing Quotes";
  } else if (normalized === "in progress") {
    workflowHint = "In PO Generation Phase";
  } else if (normalized === "completed") {
    workflowHint = "Process Complete";
  } else if (normalized === "rejected") {
    workflowHint = "Request Rejected - Please create a new SRF";
  }

  return (
    <div className="space-y-6 mt-4">
      <SRFProgressTracker srf={detailToTrackerSrf(detail)} showTitle={trackerShowTitle} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground">SRF ID</Label>
          <p className="font-medium">{getDisplayId(detail)}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Status</Label>
          <Badge className={getSrfStatusBadgeClass(detail.status)}>
            {detail.status}
          </Badge>
        </div>
        <div>
          <Label className="text-muted-foreground">Service Type</Label>
          <p className="font-medium">{detail.serviceType || "N/A"}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Urgency</Label>
          <Badge variant="outline">{detail.urgency || "Normal"}</Badge>
        </div>
        <div>
          <Label className="text-muted-foreground">Requester</Label>
          <p className="font-medium">{detail.requester || "N/A"}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Created Date</Label>
          <p className="font-medium">{formatMRFDate(created)}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Department</Label>
          <p className="font-medium">{detail.department || "N/A"}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Estimated Cost</Label>
          <p className="font-medium">
            ₦{parseFloat(detail.estimatedCost || "0").toLocaleString()}
          </p>
        </div>
        <div className="col-span-2">
          <Label className="text-muted-foreground">Description</Label>
          <p className="font-medium text-sm">
            {detail.description || "No description provided"}
          </p>
        </div>
        <div className="col-span-2">
          <Label className="text-muted-foreground">Justification</Label>
          <p className="font-medium text-sm">
            {detail.justification || "No justification provided"}
          </p>
        </div>
        <div className="col-span-2">
          <Label className="text-muted-foreground">Duration</Label>
          <p className="font-medium text-sm">{detail.duration || "Not specified"}</p>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-4">Workflow Status</h3>
        <div className="space-y-3">
          <div className="p-3 border rounded-lg bg-muted/50">
            <p className="text-sm font-medium mb-1">Current Step</p>
            <p className="text-sm text-muted-foreground">{workflowHint}</p>
          </div>
        </div>
      </div>

      {footer ? <div className="border-t pt-4 flex flex-wrap gap-2">{footer}</div> : null}
    </div>
  );
}
