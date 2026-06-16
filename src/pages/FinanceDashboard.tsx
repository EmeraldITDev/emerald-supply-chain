import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, Calendar, Loader2, FileText, CheckCircle, TrendingUp, Landmark, Info } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { dashboardApi } from "@/services/api";
import type { FinanceMRFRow } from "@/types";
import type { FinanceDashboardData, FinanceDashboardListKey } from "@/types/finance-dashboard";
import { getMrfFromFinanceRow } from "@/types/finance-dashboard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { FinanceMRFCard } from "@/components/finance/FinanceMRFCard";
import { FinanceApReportsSection } from "@/components/finance/FinanceApReportsSection";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getScmRole, formatScmRoleLabel } from "@/utils/scmRole";

const FinanceDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<FinanceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [listFilter, setListFilter] = useState<FinanceDashboardListKey>("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const fetchFinanceData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await dashboardApi.getFinanceDashboard();
      if (response.success && response.data) {
        setDashboard(response.data);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load finance data",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  const activeList = useMemo((): FinanceMRFRow[] => {
    if (!dashboard) return [];
    if (listFilter === "legacy") return dashboard.legacyFinanceMRFs;
    if (listFilter === "finance_ap") return dashboard.financeApMRFs;
    return dashboard.financeMRFs;
  }, [dashboard, listFilter]);

  const filterRows = useCallback(
    (rows: FinanceMRFRow[]) => {
      let filtered = [...rows];

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((row) => {
          const mrf = getMrfFromFinanceRow(row);
          const vendor = (row as FinanceMRFRow & { vendor?: { name?: string } }).vendor;
          return (
            mrf.title?.toLowerCase().includes(q) ||
            String(mrf.id).toLowerCase().includes(q) ||
            (mrf.requester_name || mrf.requester || "").toLowerCase().includes(q) ||
            vendor?.name?.toLowerCase().includes(q)
          );
        });
      }

      if (dateFilter !== "all") {
        const now = new Date();
        filtered = filtered.filter((row) => {
          const mrf = getMrfFromFinanceRow(row);
          const dateStr = mrf.created_at || mrf.date;
          if (!dateStr) return false;
          const mrfDate = new Date(dateStr);
          const daysDiff = (now.getTime() - mrfDate.getTime()) / (1000 * 60 * 60 * 24);
          if (dateFilter === "today") return daysDiff < 1;
          if (dateFilter === "week") return daysDiff < 7;
          if (dateFilter === "month") return daysDiff < 30;
          return true;
        });
      }

      if (minAmount || maxAmount) {
        filtered = filtered.filter((row) => {
          const q = (row as FinanceMRFRow & { quotation?: Record<string, unknown> }).quotation ?? {};
          const rawAmount =
            q.totalAmount ?? q.total_amount ?? q.total_order_value ?? q.totalOrderValue ?? q.price;
          const numAmount = rawAmount != null && rawAmount !== "" ? Number(rawAmount) : 0;
          const min = minAmount ? parseFloat(minAmount) : 0;
          const max = maxAmount ? parseFloat(maxAmount) : Infinity;
          return numAmount >= min && numAmount <= max;
        });
      }

      return filtered;
    },
    [searchQuery, dateFilter, minAmount, maxAmount],
  );

  const filteredRequests = useMemo(
    () => filterRows(activeList),
    [activeList, filterRows],
  );

  const stats = dashboard?.stats;
  const routing = dashboard?.routing;
  const legacyStats = stats?.legacy;
  const financeApStats = stats?.financeAp;

  const statusOptions = [{ label: "All", value: "all" }];

  const activeFiltersCount =
    (dateFilter !== "all" ? 1 : 0) + (minAmount ? 1 : 0) + (maxAmount ? 1 : 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Finance Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Legacy internal payments and Finance AP–routed MRFs in one view
          </p>
        </div>

        {routing && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle className="text-sm">Finance routing</AlertTitle>
            <AlertDescription className="text-sm flex flex-wrap items-center gap-2">
              {routing.description}
              {routing.cutoverDate && (
                <Badge variant="outline" className="text-xs">
                  Cutover: {routing.cutoverDate}
                </Badge>
              )}
              {!routing.routingConfigured && (
                <Badge variant="secondary" className="text-xs">
                  Cutover not configured — all MRFs use legacy internal finance
                </Badge>
              )}
            </AlertDescription>
          </Alert>
        )}

        {stats && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Finance MRFs"
                value={stats.totalFinanceMRFs ?? dashboard?.financeMRFs.length ?? 0}
                description="Unified finance-stage list"
                icon={FileText}
                iconColor="text-primary"
              />
              <StatCard
                title="Legacy — Pending internal"
                value={
                  legacyStats?.pendingInternal ??
                  stats.pendingPayments ??
                  dashboard?.legacyFinanceMRFs.length ??
                  0
                }
                description={
                  legacyStats?.totalPendingAmount != null
                    ? `₦${legacyStats.totalPendingAmount.toLocaleString()}`
                    : "Internal payment queue"
                }
                icon={Clock}
                iconColor="text-warning"
              />
              <StatCard
                title="Legacy — Chairman payment"
                value={legacyStats?.chairmanPayment ?? stats.approvedPayments ?? 0}
                description="Awaiting chairman sign-off"
                icon={CheckCircle}
                iconColor="text-success"
              />
              <StatCard
                title="Finance AP — In pipeline"
                value={
                  financeApStats
                    ? (financeApStats.handoff ?? 0) +
                      (financeApStats.inReview ?? 0) +
                      (financeApStats.packagePushed ?? 0)
                    : (dashboard?.financeApMRFs.length ?? 0)
                }
                description={`Handoff ${financeApStats?.handoff ?? 0} · Review ${financeApStats?.inReview ?? 0} · Pushed ${financeApStats?.packagePushed ?? 0}`}
                icon={Landmark}
                iconColor="text-primary"
              />
            </div>

            {(stats.processedPayments != null || stats.totalProcessedAmount != null) && (
              <div className="grid gap-4 md:grid-cols-2">
                <StatCard
                  title="Processed (legacy)"
                  value={stats.processedPayments ?? 0}
                  description={
                    stats.totalProcessedAmount
                      ? `₦${stats.totalProcessedAmount.toLocaleString()}`
                      : undefined
                  }
                  icon={TrendingUp}
                  iconColor="text-primary"
                />
              </div>
            )}
          </div>
        )}

        <FinanceApReportsSection userRole={getScmRole(user)} />

        <Card>
          <CardHeader>
            <CardTitle>Finance MRF Overview</CardTitle>
            <CardDescription>
              Legacy rows support internal Process Payment and chairman approval. Finance AP rows
              link to the sync view — payment runs in Accounts Payable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={listFilter}
              onValueChange={(v) => setListFilter(v as FinanceDashboardListKey)}
              className="mb-4"
            >
              <TabsList>
                <TabsTrigger value="all">
                  All ({dashboard?.financeMRFs.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="legacy">
                  Legacy ({dashboard?.legacyFinanceMRFs.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="finance_ap">
                  Finance AP ({dashboard?.financeApMRFs.length ?? 0})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4">
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                statusOptions={statusOptions}
                placeholder="Search by title, ID, or requester..."
                activeFiltersCount={activeFiltersCount}
                onClearFilters={() => {
                  setDateFilter("all");
                  setMinAmount("");
                  setMaxAmount("");
                }}
                additionalFilters={
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Date Range</label>
                      <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="week">This Week</SelectItem>
                          <SelectItem value="month">This Month</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Amount Range</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min ₦"
                          value={minAmount}
                          onChange={(e) => setMinAmount(e.target.value)}
                        />
                        <Input
                          type="number"
                          placeholder="Max ₦"
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                }
              />

              <div className="space-y-3 mt-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No requests found</p>
                    <p className="text-sm mt-1">No finance MRFs match this filter</p>
                  </div>
                ) : (
                  filteredRequests.map((row) => {
                    const mrf = getMrfFromFinanceRow(row);
                    return (
                      <FinanceMRFCard
                        key={String(mrf.id)}
                        row={row}
                        onRefresh={fetchFinanceData}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FinanceDashboard;
