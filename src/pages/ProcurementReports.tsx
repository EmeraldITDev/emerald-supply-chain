import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { procurementReportsApi } from "@/services/api";
import { reportsApi } from "@/services/reportsApi";
import { queryKeys } from "@/lib/queryKeys";
import { REPORT_QUERY_OPTIONS } from "@/lib/queryOptions";
import { FinanceApReportsSection } from "@/components/finance/FinanceApReportsSection";
import { ProcurementReportingEngine } from "@/components/reports/ProcurementReportingEngine";
import { PoRegisterTable } from "@/components/reports/PoRegisterTable";
import { getScmRole } from "@/utils/scmRole";
import { canViewScmReports } from "@/utils/reportAccess";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function defaultReportDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const formatMoney = (value: number | null, currency = "NGN") => {
  const safeCurrency = currency && currency.trim() !== "" ? currency.toUpperCase() : "NGN";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(value ?? 0);
  } catch {
    return `₦${(value ?? 0).toLocaleString()}`;
  }
};

const PoRegisterSection = () => {
  const { toast } = useToast();
  const location = useLocation();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateBasis, setDateBasis] = useState("po_generated_at");
  const [poStatus, setPoStatus] = useState("");
  const [signingStatus, setSigningStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [grnStatus, setGrnStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [vendor, setVendor] = useState("");
  const [contractType, setContractType] = useState("");
  const [currency, setCurrency] = useState("");
  const [procurementManager, setProcurementManager] = useState("");
  const [poValueMin, setPoValueMin] = useState("");
  const [poValueMax, setPoValueMax] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [mrfNumber, setMrfNumber] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  useEffect(() => {
    if (location.hash === "#po-register") {
      document.getElementById("po-register")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  const params = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      date_basis: dateBasis || undefined,
      po_status: poStatus || undefined,
      signing_status: signingStatus || undefined,
      payment_status: paymentStatus || undefined,
      grn_status: grnStatus || undefined,
      department: department || undefined,
      vendor: vendor || undefined,
      contract_type: contractType || undefined,
      currency: currency || undefined,
      procurement_manager: procurementManager || undefined,
      po_value_min: poValueMin ? Number(poValueMin) : undefined,
      po_value_max: poValueMax ? Number(poValueMax) : undefined,
      po_number: poNumber || undefined,
      mrf_number: mrfNumber || undefined,
      search: search || undefined,
      page,
      per_page: 10,
      sort_by: "po_generated_at",
      sort_direction: "desc" as const,
    }),
    [from, to, dateBasis, poStatus, signingStatus, paymentStatus, grnStatus, department, vendor, contractType, currency, procurementManager, poValueMin, poValueMax, poNumber, mrfNumber, search, page],
  );

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.reports.poRegister(params),
    queryFn: async () => {
      const response = await reportsApi.getPORegister(params);
      if (!response.success || !response.data) {
        throw new Error(response.error || "Unable to load the PO register");
      }
      return response.data;
    },
    ...REPORT_QUERY_OPTIONS,
  });

  const summary = data?.summary;
  const pagination = data?.pagination;
  const monthlyTrend = summary?.monthlyTrend ?? [];
  const vendorTrend = summary?.topVendors ?? [];
  const currencyBreakdown = summary?.totalPoValueByCurrency ?? [];

  const resetFilters = () => {
    setFrom("");
    setTo("");
    setDateBasis("po_generated_at");
    setPoStatus("");
    setSigningStatus("");
    setPaymentStatus("");
    setGrnStatus("");
    setDepartment("");
    setVendor("");
    setContractType("");
    setCurrency("");
    setProcurementManager("");
    setPoValueMin("");
    setPoValueMax("");
    setPoNumber("");
    setMrfNumber("");
    setSearch("");
    setPage(1);
  };

  const handleExport = async (format: "xlsx" | "pdf") => {
    setExporting(format);
    try {
      const response = await reportsApi.exportPORegister(format, {
        from: from || undefined,
        to: to || undefined,
        date_basis: dateBasis || undefined,
        po_status: poStatus || undefined,
        signing_status: signingStatus || undefined,
        payment_status: paymentStatus || undefined,
        grn_status: grnStatus || undefined,
        department: department || undefined,
        vendor: vendor || undefined,
        contract_type: contractType || undefined,
        currency: currency || undefined,
        procurement_manager: procurementManager || undefined,
        po_value_min: poValueMin ? Number(poValueMin) : undefined,
        po_value_max: poValueMax ? Number(poValueMax) : undefined,
        po_number: poNumber || undefined,
        mrf_number: mrfNumber || undefined,
        search: search || undefined,
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Export failed");
      }
      const extension = format === "xlsx" ? "xlsx" : "pdf";
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `po-register.${extension}`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: `PO register ${format.toUpperCase()} downloaded.` });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export the PO register",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <section id="po-register" className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-600">Purchase Order Register</p>
          <h2 className="text-2xl font-bold tracking-tight">Generated PO Register</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { void refetch(); }} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")} disabled={!!exporting}>
            {exporting === "xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
            {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Combined server-side filtering across all generated purchase orders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="po-from">From</Label>
              <Input id="po-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-to">To</Label>
              <Input id="po-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-date-basis">Date basis</Label>
              <select id="po-date-basis" value={dateBasis} onChange={(e) => { setDateBasis(e.target.value); setPage(1); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="po_generated_at">PO generated date</option>
                <option value="po_signed_at">Signing date</option>
                <option value="created_at">Created date</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-status">PO status</Label>
              <select id="po-status" value={poStatus} onChange={(e) => { setPoStatus(e.target.value); setPage(1); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="">All</option>
                <option value="generated">Generated</option>
                <option value="signed">Signed</option>
                <option value="unsigned">Unsigned</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-signing-status">Signing status</Label>
              <select id="po-signing-status" value={signingStatus} onChange={(e) => { setSigningStatus(e.target.value); setPage(1); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="">All</option>
                <option value="signed">Signed</option>
                <option value="unsigned">Unsigned</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-payment-status">Payment status</Label>
              <select id="po-payment-status" value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="">All</option>
                <option value="Pending">Pending</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-grn-status">GRN status</Label>
              <select id="po-grn-status" value={grnStatus} onChange={(e) => { setGrnStatus(e.target.value); setPage(1); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="">All</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-department">Department</Label>
              <Input id="po-department" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} placeholder="Operations" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-vendor">Vendor</Label>
              <Input id="po-vendor" value={vendor} onChange={(e) => { setVendor(e.target.value); setPage(1); }} placeholder="Vendor name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-contract-type">Contract type</Label>
              <Input id="po-contract-type" value={contractType} onChange={(e) => { setContractType(e.target.value); setPage(1); }} placeholder="Framework / Direct" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-currency">Currency</Label>
              <Input id="po-currency" value={currency} onChange={(e) => { setCurrency(e.target.value); setPage(1); }} placeholder="NGN / USD" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-manager">Procurement manager</Label>
              <Input id="po-manager" value={procurementManager} onChange={(e) => { setProcurementManager(e.target.value); setPage(1); }} placeholder="Manager name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-value-min">Min value</Label>
              <Input id="po-value-min" type="number" value={poValueMin} onChange={(e) => { setPoValueMin(e.target.value); setPage(1); }} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-value-max">Max value</Label>
              <Input id="po-value-max" type="number" value={poValueMax} onChange={(e) => { setPoValueMax(e.target.value); setPage(1); }} placeholder="5000000" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-number">PO number</Label>
              <Input id="po-number" value={poNumber} onChange={(e) => { setPoNumber(e.target.value); setPage(1); }} placeholder="PO-123" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mrf-number">MRF number</Label>
              <Input id="mrf-number" value={mrfNumber} onChange={(e) => { setMrfNumber(e.target.value); setPage(1); }} placeholder="MRF-001" />
            </div>
            <div className="space-y-1 md:col-span-2 xl:col-span-4">
              <Label htmlFor="po-search">Search</Label>
              <Input id="po-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="PO number, MRF, title, vendor" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={resetFilters}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            Unable to load the PO register. Please try again.
          </CardContent>
        </Card>
      )}

      {!isError && summary && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Generated POs</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{summary.totalGeneratedPos ?? 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Signed POs</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-emerald-600">{summary.signedPos ?? 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unsigned POs</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-amber-600">{summary.unsignedPos ?? 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total PO value</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {summary.totalPoValue != null ? formatMoney(summary.totalPoValue, currency || (currencyBreakdown[0]?.currency ?? "NGN")) : "Multi-currency"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly PO trend</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {monthlyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [value, "POs"]} />
                      <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground flex h-full items-center justify-center">No monthly trend data.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top vendors by value</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {vendorTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendorTrend} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip formatter={(value: number) => [formatMoney(value), "PO value"]} />
                      <Bar dataKey="totalPoValue" fill="#0f766e" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground flex h-full items-center justify-center">No vendor data available.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Currency breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {currencyBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {currencyBreakdown.map((entry) => (
                    <div key={entry.currency} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div>
                        <p className="font-medium">{entry.currency}</p>
                        <p className="text-sm text-muted-foreground">{entry.count} purchase orders</p>
                      </div>
                      <p className="font-semibold">{formatMoney(entry.totalValue, entry.currency)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No currency totals to display.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!isError && isLoading && !data ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading PO register…</CardContent>
        </Card>
      ) : null}

      {data && (
        <>
          <PoRegisterTable rows={data.items ?? []} loading={false} onExport={handleExport} exporting={exporting} />
          {pagination && pagination.totalPages > 1 ? (
            <Card>
              <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} records
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((prev) => prev + 1)}>
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </section>
  );
};

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
            <Button onClick={() => { void loadReport(); }} disabled={loading}>
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
                  <p className="text-sm text-muted-foreground">POs signed</p>
                  <p className="text-xl font-bold">{totals.posSigned}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Approvals pending</p>
                  <p className="text-xl font-bold">{totals.approvalsPending}</p>
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

        <PoRegisterSection />

        <div id="finance-ap">
          <FinanceApReportsSection userRole={scmRole} />
        </div>

        <ProcurementReportingEngine initialFrom={from} initialTo={to} />
      </div>
    </DashboardLayout>
  );
};

export default ProcurementReports;
