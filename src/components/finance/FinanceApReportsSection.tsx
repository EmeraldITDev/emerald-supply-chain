import { useCallback, useEffect, useState } from "react";
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
  Loader2,
  RefreshCw,
  AlertTriangle,
  Landmark,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { financeApReportsApi } from "@/services/financeApReportsApi";
import { fetchFinanceRoutingConfig } from "@/services/financeRoutingConfig";
import type {
  FinanceApAdvanceDeliveryRiskRow,
  FinanceApCycleTimesReport,
  FinanceApOutstandingMilestoneRow,
  FinanceApSummaryReport,
} from "@/types/finance-ap-reports";
import { StatCard } from "@/components/dashboard/StatCard";

const FINANCE_AP_REPORT_ROLES = new Set([
  "finance",
  "finance_officer",
  "procurement_manager",
  "procurement",
  "supply_chain_director",
  "supply_chain",
  "admin",
]);

interface FinanceApReportsSectionProps {
  userRole?: string | null;
}

const formatNaira = (n: number) =>
  Number.isFinite(n) ? `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";

const formatPct = (n: number) =>
  Number.isFinite(n) ? `${(n <= 1 ? n * 100 : n).toFixed(1)}%` : "—";

export const FinanceApReportsSection = ({ userRole }: FinanceApReportsSectionProps) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinanceApSummaryReport | null>(null);
  const [outstanding, setOutstanding] = useState<FinanceApOutstandingMilestoneRow[]>([]);
  const [risks, setRisks] = useState<FinanceApAdvanceDeliveryRiskRow[]>([]);
  const [cycleTimes, setCycleTimes] = useState<FinanceApCycleTimesReport | null>(null);

  const [routingConfigured, setRoutingConfigured] = useState<boolean | null>(null);
  const [cutoverDate, setCutoverDate] = useState<string | null>(null);

  const canView = FINANCE_AP_REPORT_ROLES.has(userRole || "");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = {
      from: from || undefined,
      to: to || undefined,
      limit: 50,
    };
    try {
      const routingConfig = await fetchFinanceRoutingConfig();
      setRoutingConfigured(routingConfig.routingConfigured);
      setCutoverDate(routingConfig.cutoverDate);

      const [sumRes, outRes, riskRes, cycleRes] = await Promise.all([
        financeApReportsApi.getSummary(params),
        financeApReportsApi.getOutstandingMilestones(params),
        financeApReportsApi.getAdvanceDeliveryRisk(params),
        financeApReportsApi.getCycleTimes(params),
      ]);

      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
        if (sumRes.data.routingConfigured != null) {
          setRoutingConfigured(sumRes.data.routingConfigured);
        }
        if (sumRes.data.cutoverDate != null) {
          setCutoverDate(sumRes.data.cutoverDate);
        }
      } else if (!sumRes.success) {
        setError(sumRes.error || "Failed to load summary");
      }

      if (outRes.success && outRes.data) setOutstanding(outRes.data.items);
      if (riskRes.success && riskRes.data) setRisks(riskRes.data.items);
      if (cycleRes.success && cycleRes.data) setCycleTimes(cycleRes.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load Finance AP reports");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

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
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Refresh
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

      {loading && !summary ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
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
