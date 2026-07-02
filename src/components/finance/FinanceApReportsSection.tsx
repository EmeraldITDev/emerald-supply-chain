import { useCallback, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BarChart3,
  CheckCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Landmark,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canViewScmReports } from "@/utils/reportAccess";
import { financeApReportsApi } from "@/services/financeApReportsApi";
import { fetchFinanceRoutingConfig } from "@/services/financeRoutingConfig";
import type {
  FinanceApAdvanceDeliveryRiskRow,
  FinanceApCycleTimesReport,
  FinanceApOutstandingMilestoneRow,
  FinanceApSummaryReport,
} from "@/types/finance-ap-reports";
import { StatCard } from "@/components/dashboard/StatCard";
import { queryKeys } from "@/lib/queryKeys";
import { REPORT_QUERY_OPTIONS } from "@/lib/queryOptions";
import { TableSkeleton } from "@/components/LoadingSkeleton";

const FINANCE_AP_REPORT_ROLES = new Set([
  "finance",
  "finance_officer",
  "procurement_manager",
  "procurement",
  "supply_chain_director",
  "supply_chain",
  "admin",
  "executive",
]);

interface FinanceApReportsSectionProps {
  userRole?: string | null;
}

const formatNaira = (n: number) =>
  Number.isFinite(n) ? `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";

const formatPct = (n: number) =>
  Number.isFinite(n) ? `${(n <= 1 ? n * 100 : n).toFixed(1)}%` : "—";

function defaultFinanceApDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export const FinanceApReportsSection = ({ userRole }: FinanceApReportsSectionProps) => {
  const defaults = defaultFinanceApDateRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);

  const canView = FINANCE_AP_REPORT_ROLES.has(userRole || "");
  const reportLimit = 50;

  const applyDateRange = useCallback(() => {
    setAppliedFrom(from);
    setAppliedTo(to);
  }, [from, to]);

  const [
    routingQuery,
    summaryQuery,
    outstandingQuery,
    risksQuery,
    cycleQuery,
  ] = useQueries({
    queries: [
      {
        queryKey: ["finance-routing-config"] as const,
        queryFn: fetchFinanceRoutingConfig,
        enabled: canView,
        ...REPORT_QUERY_OPTIONS,
      },
      {
        queryKey: queryKeys.reports.financeAp.summary(appliedFrom, appliedTo),
        queryFn: async () => {
          const res = await financeApReportsApi.getSummary({
            from: appliedFrom || undefined,
            to: appliedTo || undefined,
          });
          if (!res.success || !res.data) {
            throw new Error(res.error || "Failed to load Finance AP summary");
          }
          return res.data;
        },
        enabled: canView,
        ...REPORT_QUERY_OPTIONS,
      },
      {
        queryKey: queryKeys.reports.financeAp.outstanding(appliedFrom, appliedTo, reportLimit),
        queryFn: async () => {
          const res = await financeApReportsApi.getOutstandingMilestones({
            from: appliedFrom || undefined,
            to: appliedTo || undefined,
            limit: reportLimit,
          });
          if (!res.success || !res.data) {
            throw new Error(res.error || "Failed to load outstanding milestones");
          }
          return res.data.items;
        },
        enabled: canView,
        ...REPORT_QUERY_OPTIONS,
      },
      {
        queryKey: queryKeys.reports.financeAp.advanceRisk(reportLimit),
        queryFn: async () => {
          const res = await financeApReportsApi.getAdvanceDeliveryRisk({ limit: reportLimit });
          if (!res.success || !res.data) {
            throw new Error(res.error || "Failed to load advance delivery risk");
          }
          return res.data.items;
        },
        enabled: canView,
        ...REPORT_QUERY_OPTIONS,
      },
      {
        queryKey: queryKeys.reports.financeAp.cycleTimes(appliedFrom, appliedTo),
        queryFn: async () => {
          const res = await financeApReportsApi.getCycleTimes({
            from: appliedFrom || undefined,
            to: appliedTo || undefined,
          });
          if (!res.success || !res.data) {
            throw new Error(res.error || "Failed to load cycle times");
          }
          return res.data;
        },
        enabled: canView,
        ...REPORT_QUERY_OPTIONS,
      },
    ],
  });

  const loading = summaryQuery.isLoading && !summaryQuery.isFetched;
  const error =
    summaryQuery.error instanceof Error
      ? summaryQuery.error.message
      : summaryQuery.error
        ? String(summaryQuery.error)
        : null;

  const routingConfigured =
    summaryQuery.data?.routingConfigured ?? routingQuery.data?.routingConfigured ?? null;
  const cutoverDate = summaryQuery.data?.cutoverDate ?? routingQuery.data?.cutoverDate ?? null;
  const summary = summaryQuery.data ?? null;
  const outstanding = outstandingQuery.data ?? [];
  const risks = risksQuery.data ?? [];
  const cycleTimes = cycleQuery.data ?? null;

  if (!canView) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Finance AP Reports
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Post-cutover cohort only — requires Finance AP cutover date on the server
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
          </div>
          <Button variant="outline" size="sm" onClick={applyDateRange} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Apply
          </Button>
        </div>
      </div>

      {!routingConfigured && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cutover not configured on server</AlertTitle>
          <AlertDescription>
            Set <code className="text-xs">FINANCE_AP_CUTOVER_DATE</code> in the backend environment.
            {cutoverDate ? ` Current value: ${cutoverDate}.` : " No cutover date is active — Finance AP cohort reports will be empty."}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <TableSkeleton rows={4} />
      ) : (
        <>
          {summary && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Cases pushed"
                value={summary.casesPushed ?? 0}
                icon={Landmark}
                iconColor="text-primary"
              />
              <StatCard
                title="In review"
                value={summary.inReview ?? 0}
                description={`Handoff ${summary.handoff ?? 0}`}
                icon={Clock}
                iconColor="text-warning"
              />
              <StatCard
                title="Closed"
                value={summary.closed ?? 0}
                description={`Rejection ${formatPct(summary.rejectionRate ?? 0)} · RFI ${formatPct(summary.rfiRate ?? 0)}`}
                icon={CheckCircle}
                iconColor="text-success"
              />
              <StatCard
                title="Outstanding milestones"
                value={formatNaira(summary.outstandingMilestoneBalance ?? 0)}
                description="Unpaid milestone balance"
                icon={TrendingUp}
                iconColor="text-primary"
              />
            </div>
          )}

          {cycleTimes && (
            <div className="grid gap-4 md:grid-cols-2">
              <StatCard
                title="PO signed → first milestone paid"
                value={
                  cycleTimes.avgDaysPoSignedToFirstMilestonePaid != null
                    ? `${cycleTimes.avgDaysPoSignedToFirstMilestonePaid.toFixed(1)} days`
                    : "—"
                }
                description={
                  cycleTimes.sampleSize
                    ? `Sample: ${cycleTimes.sampleSize} MRFs`
                    : undefined
                }
                icon={BarChart3}
                iconColor="text-primary"
              />
              <StatCard
                title="PO signed → closed"
                value={
                  cycleTimes.avgDaysPoSignedToClosed != null
                    ? `${cycleTimes.avgDaysPoSignedToClosed.toFixed(1)} days`
                    : "—"
                }
                icon={BarChart3}
                iconColor="text-primary"
              />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outstanding milestones</CardTitle>
                <CardDescription>Unpaid milestones on Finance AP MRFs</CardDescription>
              </CardHeader>
              <CardContent>
                {outstanding.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No rows</p>
                ) : (
                  <div className="max-h-80 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>MRF</TableHead>
                          <TableHead>Milestone</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outstanding.map((row, i) => (
                          <TableRow key={`${row.mrfId}-${row.milestoneId ?? i}`}>
                            <TableCell className="font-medium text-xs">
                              {row.mrfDisplayId ?? row.mrfId}
                              {row.mrfTitle && (
                                <p className="text-muted-foreground font-normal truncate max-w-[140px]">
                                  {row.mrfTitle}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{row.milestoneLabel ?? "—"}</TableCell>
                            <TableCell className="text-right text-xs">
                              {row.amount != null ? formatNaira(Number(row.amount)) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Advance delivery risk</CardTitle>
                <CardDescription>Advance paid but delivery docs missing</CardDescription>
              </CardHeader>
              <CardContent>
                {risks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No rows</p>
                ) : (
                  <div className="max-h-80 overflow-auto space-y-3">
                    {risks.map((row, i) => (
                      <div
                        key={`${row.mrfId}-${i}`}
                        className="border rounded-lg p-3 text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {row.mrfDisplayId ?? row.mrfId}
                          </span>
                          {row.daysSinceAdvance != null && (
                            <Badge variant="outline" className="text-[10px]">
                              {row.daysSinceAdvance}d since advance
                            </Badge>
                          )}
                        </div>
                        {row.mrfTitle && (
                          <p className="text-muted-foreground text-xs">{row.mrfTitle}</p>
                        )}
                        {(row.missingDocuments?.length ?? 0) > 0 && (
                          <p className="text-xs text-warning">
                            Missing: {row.missingDocuments!.join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceApReportsSection;
