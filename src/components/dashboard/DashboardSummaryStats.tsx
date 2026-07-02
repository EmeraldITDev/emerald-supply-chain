import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  Clock,
  FileText,
  XCircle,
} from "lucide-react";
import type { MrfDashboardBucket } from "@/utils/mrfDashboardBuckets";

type Props = {
  counts: Record<MrfDashboardBucket, number>;
  /** Extra pending items not in MRF buckets (e.g. vendor registrations, SRFs) */
  extraPending?: number;
  extraPendingLabel?: string;
};

const LABELS: Record<MrfDashboardBucket, string> = {
  pending: "Pending Approvals",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Recently Completed",
};

const ICONS = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  completed: FileText,
} as const;

export function DashboardSummaryStats({
  counts,
  extraPending = 0,
  extraPendingLabel,
}: Props) {
  const pendingTotal = counts.pending + extraPending;

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      {(["pending", "approved", "rejected", "completed"] as const).map((key) => {
        const Icon = ICONS[key];
        const value = key === "pending" ? pendingTotal : counts[key];
        return (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-medium">
                {LABELS[key]}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold">{value}</div>
              {key === "pending" && extraPending > 0 && extraPendingLabel && (
                <p className="text-xs text-muted-foreground mt-1">
                  {extraPendingLabel}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
