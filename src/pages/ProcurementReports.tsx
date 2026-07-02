import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { procurementReportsApi } from "@/services/api";
import { queryKeys } from "@/lib/queryKeys";
import { REPORT_QUERY_OPTIONS } from "@/lib/queryOptions";
import type { ProcurementReportData } from "@/types";
import { FinanceApReportsSection } from "@/components/finance/FinanceApReportsSection";
import { ProcurementReportingEngine } from "@/components/reports/ProcurementReportingEngine";
import { getScmRole } from "@/utils/scmRole";
import { canViewScmReports } from "@/utils/reportAccess";

import { TableSkeleton } from "@/components/LoadingSkeleton";

function defaultReportDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const ProcurementReports = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const scmRole = useMemo(() => getScmRole(user), [user]);
  const canView = canViewScmReports(scmRole);

  const [from, setFrom] = useState(() => defaultReportDateRange().from);
  const [to, setTo] = useState(() => defaultReportDateRange().to);
  const [exporting, setExporting] = useState(false);

  const {
    data: report,
    isLoading: loading,
    isFetched: initialLoadDone,
    refetch: loadReport,
  } = useQuery({
    queryKey: queryKeys.reports.procurement(from, to),
    queryFn: async () => {
      const res = await procurementReportsApi.getReport(from || undefined, to || undefined);
      if (!res.success || !res.data) {
        throw new Error(res.error || "Could not fetch procurement report");
      }
      return res.data;
    },
    enabled: Boolean(canView),
    ...REPORT_QUERY_OPTIONS,
  });

  if (!canView) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await procurementReportsApi.exportCSV(from || undefined, to || undefined);
      if (res.success && res.data) {
        const url = window.URL.createObjectURL(res.data);
        const link = document.createElement("a");
        link.href = url;
        link.download = `procurement-report-${from || "all"}-${to || "all"}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        toast({ title: "Export complete", description: "Procurement report CSV downloaded from server." });
      } else {
        toast({
          title: "Export failed",
          description: res.error || "Could not export CSV",
          variant: "destructive",
        });
      }
    } finally {
      setExporting(false);
    }
  };

  const totals = report?.totals;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Procurement Reports</h1>
            <p className="text-muted-foreground text-sm">
              Budget vs actuals, approvals, and price comparison summaries
            </p>
          </div>
          <Button onClick={handleExport} disabled={exporting || loading}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Date range</CardTitle>
            <CardDescription>Filter report metrics (optional)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2 flex-1">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button onClick={loadReport} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply
            </Button>
          </CardContent>
        </Card>

        {loading && !initialLoadDone ? (
          <TableSkeleton rows={4} />
        ) : loading && initialLoadDone ? (
          <div className="flex justify-center py-8 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Updating report…
          </div>
        ) : null}

        {!loading && totals ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Savings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    ₦{totals.totalSavings.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Loss</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5" />
                    ₦{totals.totalLoss.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Net Variance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${totals.netVariance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ₦{totals.netVariance.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Line items with budget</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totals.lineItemsWithBudget}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">POs generated</p>
                  <p className="text-xl font-bold">{totals.posGenerated}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">MRFs approved</p>
                  <p className="text-xl font-bold">{totals.mrfsApproved}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">SRFs approved</p>
                  <p className="text-xl font-bold">{totals.srfsApproved}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Price comparison MRFs</p>
                  <p className="text-xl font-bold">{totals.priceComparisonMrfs}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Price comparison summaries</CardTitle>
                <CardDescription>
                  Period: {report.period.from} — {report.period.to}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.priceComparisonSummaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No price comparisons in this period.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>MRF ID</TableHead>
                        <TableHead>Comparisons</TableHead>
                        <TableHead className="text-right">Lowest unit (₦)</TableHead>
                        <TableHead className="text-right">Highest unit (₦)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.priceComparisonSummaries.map((row) => (
                        <TableRow key={row.mrfId}>
                          <TableCell className="font-mono">{row.mrfId}</TableCell>
                          <TableCell>{row.comparisonCount}</TableCell>
                          <TableCell className="text-right">₦{row.lowestUnitPrice.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₦{row.highestUnitPrice.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        ) : !loading && initialLoadDone ? (
          <p className="text-center text-muted-foreground py-8">No report data available.</p>
        ) : null}

        <div id="finance-ap">
          <FinanceApReportsSection userRole={scmRole} />
        </div>

        <ProcurementReportingEngine initialFrom={from} initialTo={to} />
      </div>
    </DashboardLayout>
  );
};

export default ProcurementReports;
