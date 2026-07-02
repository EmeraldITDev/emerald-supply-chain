import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, FileText } from "lucide-react";
import { getDisplayId } from "@/utils/displayId";
import { formatMRFDate } from "@/utils/dateUtils";
import type { MRF } from "@/types";
import {
  getExecutiveApprovalDate,
  getMrfRejectionReason,
  getMrfSortDate,
  getScdApprovalDate,
  getMrfStatusLabel,
} from "@/utils/mrfDashboardBuckets";

type Props = {
  mrfs: MRF[];
  variant: "approved" | "rejected" | "completed";
  role: "executive" | "supply_chain_director";
  getRequesterName: (mrf: MRF) => string;
  getEstimatedCost: (mrf: MRF) => number;
  onViewDetails: (mrf: MRF) => void;
  emptyMessage: string;
};

export function DashboardMrfHistoryList({
  mrfs,
  variant,
  role,
  getRequesterName,
  getEstimatedCost,
  onViewDetails,
  emptyMessage,
}: Props) {
  if (mrfs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mrfs.map((mrf) => {
        const estimatedCost = getEstimatedCost(mrf);
        const approvalDate =
          role === "executive"
            ? getExecutiveApprovalDate(mrf)
            : getScdApprovalDate(mrf);
        const rejectionReason = getMrfRejectionReason(mrf);
        const submitted = formatMRFDate(
          new Date(getMrfSortDate(mrf)).toISOString(),
        );

        return (
          <Card key={mrf.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{mrf.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {getDisplayId(mrf)} • {getRequesterName(mrf)} •{" "}
                    {mrf.department || "N/A"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>Submitted {submitted}</span>
                    {estimatedCost > 0 && (
                      <span className="font-medium text-foreground">
                        ₦{estimatedCost.toLocaleString()}
                      </span>
                    )}
                    {variant === "approved" && approvalDate && (
                      <span>
                        Approved {formatMRFDate(approvalDate)}
                      </span>
                    )}
                    {variant === "rejected" && rejectionReason && (
                      <span className="text-destructive">
                        Reason: {rejectionReason}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <Badge variant={variant === "rejected" ? "destructive" : "secondary"}>
                    {getMrfStatusLabel(mrf)}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => onViewDetails(mrf)}>
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
