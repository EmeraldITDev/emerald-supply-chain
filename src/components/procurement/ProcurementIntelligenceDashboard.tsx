import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CalendarDays,
  Database,
  Filter,
  Package,
  RefreshCw,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

import { ExecDrilldownSheet } from "@/components/chairman/ExecDrilldownSheet";
import {
  ActivityTrendChart,
  AttentionPanel,
  DeliveryBreakdown,
  DeliveryTrendChart,
  HealthOverview,
  InsightCards,
  KpiCard,
  PipelineBoard,
  SERIES_META,
  Section,
  ValueBarChart,
  ValueTrendChart,
  VendorPerformanceTable,
  money,
} from "@/components/procurement/ProcurementIntelWidgets";

import { dashboardApi, dashboardKpiApi, mrfApi, srfApi, vendorApi } from "@/services/api";
import { getPendingVendorRegistrations } from "@/services/pendingVendorRegistrations";
import { resolveTotalVendorCount } from "@/utils/normalizeProcurementDashboard";
import { useScmAppRefreshListener } from "@/hooks/useScmAppRefreshListener";
import { formatRelativeTime } from "@/utils/dateUtils";
import type { MRF, SRF, Vendor, VendorRegistration } from "@/types";
import {
  hasPO,
  isPendingApproval,
  isRejected,
  mrfCreated,
  pctChange,
} from "@/utils/executiveIntelligence";
import {
  BUCKET_TITLES,
  DEFAULT_FILTERS,
  PERIOD_OPTIONS,
  activitySeries,
  applyFilters,
  approvedAt,
  bucketFor,
  buildDeliveryStats,
  buildHealth,
  buildInsights,
  buildPipeline,
  buildPoStats,
  buildProcAlerts,
  buildProcessing,
  buildVendorPerformance,
  detectDataGaps,
  filterOptions,
  groupActivities,
  periodRange,
  poAt,
  previousRange,
  sparkline,
  type ProcBucket,
  type ProcFilters,
} from "@/utils/procurementIntelligence";

const inRange = (d: Date | null, r: { from: Date; to: Date }) =>
  !!d && d >= r.from && d <= r.to;

const ProcurementIntelligenceDashboard = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ProcFilters>(DEFAULT_FILTERS);
  const [drill, setDrill] = useState<ProcBucket | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    materialRequests: true,
    serviceRequests: true,
    approved: true,
    purchaseOrders: true,
  });

  /* ------------------------- data ------------------------- */

  const mrfQuery = useQuery<MRF[]>({
    queryKey: ["procurement-intel", "mrfs"],
    queryFn: async () => {
      const res = await mrfApi.list({
        page: 1,
        per_page: 200,
        sort_by: "updated_at",
        sort_direction: "desc",
      });
      return res.success && res.data ? res.data.items : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const srfQuery = useQuery<SRF[]>({
    queryKey: ["procurement-intel", "srfs"],
    queryFn: async () => {
      const res = await srfApi.list({ page: 1, per_page: 100, include_line_items: false });
      return res.success && res.data ? res.data.items : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const vendorQuery = useQuery<Vendor[]>({
    queryKey: ["procurement-intel", "vendors"],
    queryFn: async () => {
      const res = await vendorApi.list({ page: 1, per_page: 200 });
      return res.success && res.data ? res.data.items : [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const kpiQuery = useQuery({
    queryKey: ["procurement-intel", "kpis"],
    queryFn: async () => {
      const res = await dashboardKpiApi.getKpis();
      return res.success && res.data?.kpis ? res.data.kpis : null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const pmQuery = useQuery({
    queryKey: ["procurement-intel", "pm-dashboard"],
    queryFn: async () => {
      const res = await dashboardApi.getProcurementManagerDashboard();
      return res.success && res.data ? res.data : null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const registrationsQuery = useQuery<VendorRegistration[]>({
    queryKey: ["procurement-intel", "pending-registrations"],
    queryFn: async () => {
      const res = await getPendingVendorRegistrations();
      return res.success && Array.isArray(res.data) ? (res.data as VendorRegistration[]) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const activitiesQuery = useQuery({
    queryKey: ["procurement-intel", "activities"],
    queryFn: async () => {
      const res = await dashboardApi.getRecentActivities(30);
      return res.success && Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const periodDays = useMemo(() => {
    const r = periodRange(filters.period, { from: filters.from, to: filters.to });
    return Math.max(1, Math.round((r.to.getTime() - r.from.getTime()) / 86_400_000));
  }, [filters.period, filters.from, filters.to]);

  // Backend period comparison snapshot (current vs previous period).
  const statsQuery = useQuery({
    queryKey: ["procurement-intel", "period-stats", periodDays],
    queryFn: async () => {
      const res = await dashboardApi.getProcurementStats(periodDays);
      return res.success && res.data ? res.data.stats : null;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Backend stage timings (average days per workflow stage, slow-stage flags).
  const stageQuery = useQuery({
    queryKey: ["procurement-intel", "pipeline-stats", periodDays],
    queryFn: async () => {
      const res = await dashboardApi.getProcurementPipelineStats(periodDays);
      return res.success && res.data ? res.data : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const refreshAll = async () => {
    await Promise.all([
      mrfQuery.refetch(),
      srfQuery.refetch(),
      vendorQuery.refetch(),
      kpiQuery.refetch(),
      pmQuery.refetch(),
      registrationsQuery.refetch(),
      activitiesQuery.refetch(),
      statsQuery.refetch(),
      stageQuery.refetch(),
    ]);
  };

  useScmAppRefreshListener(refreshAll);

  const loading = mrfQuery.isLoading;
  const allMrfs = mrfQuery.data ?? [];
  const srfs = srfQuery.data ?? [];
  const vendors = vendorQuery.data ?? [];
  const kpis = kpiQuery.data ?? null;
  const pmStats = pmQuery.data?.stats;
  const registrations = registrationsQuery.data ?? [];
  const activities = activitiesQuery.data ?? [];
  const periodStats = statsQuery.data ?? null;
  const stageTimings = stageQuery.data ?? [];

  /** Backend-supplied percentage change for a metric, when it exists. */
  const backendDelta = (key: string): number | undefined => {
    const v = periodStats?.[`${key}_change_pct`];
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
    return Number.isFinite(n) ? n : undefined;
  };


  /* ------------------------- derived ------------------------- */

  const range = useMemo(
    () => periodRange(filters.period, { from: filters.from, to: filters.to }),
    [filters.period, filters.from, filters.to],
  );
  const prev = useMemo(() => previousRange(range), [range]);

  const options = useMemo(() => filterOptions(allMrfs), [allMrfs]);
  const mrfs = useMemo(() => applyFilters(allMrfs, filters), [allMrfs, filters]);

  const pipeline = useMemo(() => buildPipeline(mrfs), [mrfs]);
  const processing = useMemo(() => buildProcessing(mrfs, srfs, range), [mrfs, srfs, range]);
  const delivery = useMemo(() => buildDeliveryStats(mrfs, range), [mrfs, range]);
  const poStats = useMemo(() => buildPoStats(mrfs, range), [mrfs, range]);
  const vendorPerf = useMemo(() => buildVendorPerformance(mrfs, vendors), [mrfs, vendors]);
  const series = useMemo(() => activitySeries(mrfs, srfs, range), [mrfs, srfs, range]);
  const insights = useMemo(
    () => buildInsights(series, pipeline, delivery, vendorPerf, poStats, processing),
    [series, pipeline, delivery, vendorPerf, poStats, processing],
  );

  const openWorkload = useMemo(
    () => mrfs.filter((m) => !isRejected(m) && !hasPO(m)).length,
    [mrfs],
  );

  const pendingKyc = pmStats?.pendingKYC ?? registrations.length;

  const health = useMemo(
    () =>
      buildHealth(pipeline, processing, delivery, vendorPerf, openWorkload, poStats.active),
    [pipeline, processing, delivery, vendorPerf, openWorkload, poStats.active],
  );

  const alerts = useMemo(
    () => buildProcAlerts(mrfs, vendorPerf, delivery, processing, pendingKyc),
    [mrfs, vendorPerf, delivery, processing, pendingKyc],
  );

  const gaps = useMemo(() => detectDataGaps(allMrfs, vendors), [allMrfs, vendors]);
  const groupedActivity = useMemo(
    () =>
      groupActivities(
        activities.map((a) => ({
          id: String(a.id),
          type: a.type,
          title: a.title,
          description: a.description,
          status: a.status,
          date: a.timestamp,
          actionUrl:
            a.entityType === "mrf" && a.entityId
              ? `/procurement?mrf=${encodeURIComponent(String(a.entityId))}`
              : "/procurement",
        })),
      ),
    [activities],
  );

  /* ------------------------- KPI values ------------------------- */

  const countIn = (rows: MRF[], fn: (m: MRF) => Date | null, r: { from: Date; to: Date }) =>
    rows.filter((m) => inRange(fn(m), r)).length;

  const posThis = countIn(mrfs.filter(hasPO), (m) => poAt(m) ?? mrfCreated(m), range);
  const posPrev = countIn(mrfs.filter(hasPO), (m) => poAt(m) ?? mrfCreated(m), prev);
  const approvedThis = countIn(mrfs, approvedAt, range);
  const approvedPrev = countIn(mrfs, approvedAt, prev);
  const srfApprovedThis = srfs.length;
  const pendingMrfs = mrfs.filter((m) => isPendingApproval(m) && !isRejected(m));
  const pendingPrev = mrfs.filter(
    (m) => isPendingApproval(m) && inRange(mrfCreated(m), prev),
  ).length;
  const totalVendors = resolveTotalVendorCount(pmStats, vendors);
  const newVendorsHint = `${vendors.filter((v) => /active/i.test(String(v.status ?? ""))).length} active on record`;
  const ratedVendors = vendorPerf.filter((v) => v.rating != null);
  const avgRating = ratedVendors.length
    ? ratedVendors.reduce((s, v) => s + (v.rating ?? 0), 0) / ratedVendors.length
    : (pmStats?.avgRating ?? null);

  const onTimePct = delivery.onTimePct ?? pmStats?.onTimeDelivery ?? null;

  const kpiCards = [
    {
      label: "Purchase orders generated",
      value: String(kpis?.totalPosGenerated ?? poStats.created),
      delta: backendDelta("pos_generated") ?? pctChange(posThis, posPrev),
      context: `${posThis} created in ${range.label.toLowerCase()}`,
      spark: sparkline(mrfs.filter(hasPO), range, (m) => poAt(m) ?? mrfCreated(m)),
      bucket: "active_po" as ProcBucket,
    },
    {
      label: "MRFs approved",
      value: String(kpis?.totalMrfsApproved ?? approvedThis),
      delta: backendDelta("approved_mrfs") ?? pctChange(approvedThis, approvedPrev),
      context: `${pendingMrfs.length} currently awaiting approval`,
      spark: sparkline(mrfs, range, approvedAt),
      bucket: "pending_approval" as ProcBucket,
    },
    {
      label: "SRFs approved",
      value: String(kpis?.totalSrfsApproved ?? srfApprovedThis),
      context: `${srfs.length} service request(s) on record`,
      bucket: "open" as ProcBucket,
    },
    {
      label: "Price comparisons",
      value: String(kpis?.priceComparisonCount ?? 0),
      context: "Requests with vendor quote comparisons",
      bucket: "open" as ProcBucket,
    },
    {
      label: "Total vendors",
      value: String(totalVendors),
      context: newVendorsHint,
      concern: pendingKyc > 0 ? `${pendingKyc} awaiting KYC completion` : undefined,
    },
    {
      label: "Pending KYC",
      value: String(pendingKyc),
      context: "Vendor registrations to review",
      tone: pendingKyc > 0 ? ("warning" as const) : undefined,
    },
    {
      label: "Awaiting review",
      value: String(pmStats?.awaitingReview ?? registrations.length),
      context: "Registrations pending a decision",
    },
    {
      label: "Average vendor rating",
      value: avgRating != null ? `${avgRating.toFixed(1)}/5.0` : "-",
      context: `${ratedVendors.length} rated supplier(s) with purchase orders`,
    },
    {
      label: "On-time delivery",
      value: onTimePct != null ? `${onTimePct}%` : "-",
      delta:
        backendDelta("on_time_delivery_rate") ??
        (delivery.onTimePct != null && delivery.prevOnTimePct != null
          ? delivery.onTimePct - delivery.prevOnTimePct
          : null),
      deltaLabel: "points vs previous period",
      context: `${delivery.late} late • ${delivery.overdue} overdue`,
      tone: delivery.overdue > 0 ? ("danger" as const) : undefined,
      bucket: "overdue_delivery" as ProcBucket,
    },
    {
      label: "Pending MRFs",
      value: String(pmStats?.pendingMRFs ?? pendingMrfs.length),
      delta: backendDelta("pending_mrfs") ?? pctChange(pendingMrfs.length, pendingPrev),
      invertDelta: true,
      context:
        processing.oldestPendingDays > 0
          ? `Oldest pending request: ${processing.oldestPendingDays} day(s)`
          : "Nothing waiting",
      tone: processing.pendingBeyondSla > 0 ? ("warning" as const) : undefined,
      bucket: "pending_approval" as ProcBucket,
    },
  ];

  const drillRecords = useMemo(() => (drill ? bucketFor(drill, mrfs) : []), [drill, mrfs]);

  const filterActive =
    filters.project !== "all" || filters.vendor !== "all" || filters.period !== "30d";

  /* ------------------------- render ------------------------- */

  return (
    <DashboardLayout>
      <PullToRefresh
        onRefresh={async () => {
          await refreshAll();
          toast.success("Dashboard refreshed");
        }}
      >
        <div className="space-y-4 sm:space-y-5">
          {/* Header + filters */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Procurement &amp; Supply Chain Intelligence
                </p>
                <h1 className="mt-1 text-xl font-bold sm:text-2xl lg:text-3xl">
                  Procurement Dashboard
                </h1>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Showing procurement analytics: {range.label}
                  {filters.project !== "all" && ` • ${filters.project}`}
                  {filters.vendor !== "all" && ` • ${filters.vendor}`}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refreshAll()} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 sm:mr-2", loading && "animate-spin")} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Filter className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
              <Select
                value={filters.period}
                onValueChange={(v) => setFilters((f) => ({ ...f, period: v as ProcFilters["period"] }))}
              >
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.key} value={p.key} className="text-xs">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filters.period === "custom" && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 text-xs">
                        <CalendarDays className="mr-2 h-3.5 w-3.5" />
                        {filters.from ? filters.from.toLocaleDateString() : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.from}
                        onSelect={(d) => setFilters((f) => ({ ...f, from: d ?? undefined }))}
                        initialFocus
                        className="pointer-events-auto p-3"
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 text-xs">
                        <CalendarDays className="mr-2 h-3.5 w-3.5" />
                        {filters.to ? filters.to.toLocaleDateString() : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.to}
                        onSelect={(d) => setFilters((f) => ({ ...f, to: d ?? undefined }))}
                        initialFocus
                        className="pointer-events-auto p-3"
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}

              <Select
                value={filters.project}
                onValueChange={(v) => setFilters((f) => ({ ...f, project: v }))}
              >
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All projects
                  </SelectItem>
                  {options.projects.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.vendor}
                onValueChange={(v) => setFilters((f) => ({ ...f, vendor: v }))}
              >
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="All vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All vendors
                  </SelectItem>
                  {options.vendors.map((v) => (
                    <SelectItem key={v} value={v} className="text-xs">
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filterActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {/* Layer 1 — health */}
          <Section
            title="Procurement health"
            description="Overall condition of the procurement operation — hover any card for the reason"
          >
            {loading ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : (
              <HealthOverview items={health} />
            )}
          </Section>

          {/* Layer 6 — requires attention (kept high, it drives action) */}
          <Section
            title="Requires attention"
            description="Exceptions ranked by severity — select one to open the affected records"
            action={
              <Badge variant={alerts.some((a) => a.severity === "critical") ? "destructive" : "secondary"}>
                {alerts.length}
              </Badge>
            }
          >
            {loading ? <Skeleton className="h-24 w-full" /> : (
              <AttentionPanel alerts={alerts} onSelect={(a) => setDrill(a.bucket)} />
            )}
          </Section>

          {/* Layer 2 — KPIs */}
          <Section
            title="Key performance indicators"
            description="Current value, direction against the previous period, and context"
          >
            {loading ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5">
                {kpiCards.map((k) => (
                  <KpiCard
                    key={k.label}
                    label={k.label}
                    value={k.value}
                    delta={"delta" in k ? k.delta : undefined}
                    deltaLabel={"deltaLabel" in k ? k.deltaLabel : undefined}
                    context={k.context}
                    concern={"concern" in k ? k.concern : undefined}
                    invertDelta={"invertDelta" in k ? k.invertDelta : undefined}
                    spark={"spark" in k ? k.spark : undefined}
                    tone={"tone" in k ? k.tone : undefined}
                    onClick={
                      "bucket" in k && k.bucket
                        ? () => setDrill(k.bucket as ProcBucket)
                        : k.label.toLowerCase().includes("vendor") || k.label.includes("KYC") || k.label.includes("review")
                          ? () => navigate("/vendors")
                          : undefined
                    }
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Quick insights */}
          {!loading && <InsightCards insights={insights} />}

          {/* Layer 3 — trends */}
          <Section
            title="Procurement activity over time"
            description="Requests raised, approvals granted and purchase orders issued"
            action={
              <div className="flex flex-wrap gap-1">
                {SERIES_META.map((s) => (
                  <Toggle
                    key={s.key as string}
                    size="sm"
                    pressed={visibleSeries[s.key as string]}
                    onPressedChange={(p) =>
                      setVisibleSeries((v) => ({ ...v, [s.key as string]: p }))
                    }
                    className="h-7 gap-1.5 px-2 text-[11px]"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.label}
                  </Toggle>
                ))}
              </div>
            }
          >
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ActivityTrendChart data={series} visible={visibleSeries} />
            )}
          </Section>

          {/* Layer 4 — workflow */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Section
              title="Procurement pipeline"
              description="Volume and average time in each stage"
              className="lg:col-span-2"
            >
              {loading ? <Skeleton className="h-64 w-full" /> : (
                <PipelineBoard stages={pipeline} onSelect={(key) => {
                  const map: Record<string, ProcBucket> = {
                    created: "open",
                    under_review: "pending_approval",
                    awaiting_approval: "pending_approval",
                    approved: "open",
                    sourcing: "open",
                    po: "active_po",
                    awaiting_delivery: "awaiting_delivery",
                    delivered: "completed",
                  };
                  setDrill(map[key] ?? "open");
                }} />
              )}
            </Section>

            <Section title="Approval &amp; processing speed" description="Current period vs the previous one">
              <div className="space-y-3">
                {[
                  {
                    label: "Average approval time",
                    now: processing.avgApprovalDays,
                    before: processing.prevApprovalDays,
                  },
                  {
                    label: "Average time to purchase order",
                    now: processing.avgTimeToPoDays,
                    before: processing.prevTimeToPoDays,
                  },
                  {
                    label: "Average MRF cycle time",
                    now: processing.avgMrfCycleDays,
                    before: null,
                  },
                  {
                    label: "Average SRF cycle time",
                    now: processing.avgSrfCycleDays,
                    before: null,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-right text-sm font-semibold tabular-nums">
                      {row.now == null ? "-" : `${row.now.toFixed(1)}d`}
                      {row.before != null && row.now != null && (
                        <span
                          className={cn(
                            "ml-2 text-[11px] font-medium",
                            row.now <= row.before
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive",
                          )}
                        >
                          {row.now <= row.before ? "↓" : "↑"} from {row.before.toFixed(1)}d
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDrill("stalled_approval")}
                  className="flex w-full items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-left text-xs"
                >
                  <span>Requests pending beyond the 3-day target</span>
                  <span className="font-semibold tabular-nums">{processing.pendingBeyondSla}</span>
                </button>
              </div>
            </Section>
          </div>

          {/* Layer 5 — vendor + delivery */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Section
              title="Top performing vendors"
              description="Ranked on rating, on-time delivery and completed orders"
              action={
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/vendors")}>
                  All vendors
                </Button>
              }
            >
              <VendorPerformanceTable rows={vendorPerf.slice(0, 6)} onSelect={() => navigate("/vendors")} />
            </Section>

            <Section
              title="Vendors requiring attention"
              description="Late deliveries, low ratings or incomplete KYC"
            >
              <VendorPerformanceTable
                rows={vendorPerf
                  .filter(
                    (v) =>
                      v.overdue > 0 ||
                      v.late > 0 ||
                      v.kycPending ||
                      (v.rating != null && v.rating < 3) ||
                      (v.onTimePct != null && v.onTimePct < 75),
                  )
                  .slice(0, 6)}
                onSelect={() => navigate("/vendors")}
              />
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Delivery status" description="Distribution of purchase order deliveries">
              <DeliveryBreakdown stats={delivery} onSelect={(b) => setDrill(b)} />
            </Section>
            <Section title="Delivery trend" description="On-time versus late deliveries over the period">
              <DeliveryTrendChart data={delivery.trend} />
            </Section>
          </div>

          {/* Purchase order analytics */}
          <Section
            title="Purchase order performance"
            description="Commitment volume, value and completion"
          >
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
              <KpiCard
                label="POs created"
                value={poStats.created}
                delta={pctChange(poStats.created, poStats.createdPrev)}
                context={range.label}
                onClick={() => setDrill("active_po")}
              />
              <KpiCard
                label="Active POs"
                value={poStats.active}
                context={money(poStats.activeValue)}
                onClick={() => setDrill("awaiting_delivery")}
              />
              <KpiCard
                label="Completed POs"
                value={poStats.completed}
                tone="success"
                onClick={() => setDrill("completed")}
              />
              <KpiCard
                label="Delayed POs"
                value={poStats.delayed}
                tone={poStats.delayed > 0 ? "danger" : "success"}
                onClick={() => setDrill("overdue_delivery")}
              />
              <KpiCard
                label="Avg completion time"
                value={poStats.avgCompletionDays == null ? "-" : `${poStats.avgCompletionDays.toFixed(1)}d`}
                context="Purchase order to goods received"
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Procurement value trend</p>
                <ValueTrendChart data={poStats.valueTrend} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Highest value active POs</p>
                <div className="space-y-1.5">
                  {poStats.topActive.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No active purchase orders.
                    </p>
                  ) : (
                    poStats.topActive.map((m) => (
                      <button
                        key={String(m.id)}
                        type="button"
                        onClick={() => navigate(`/mrfs/${String((m as { mrf_id?: string }).mrf_id ?? m.id)}`)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60"
                      >
                        <span className="min-w-0 truncate">{m.title}</span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {money(Number(String(m.estimated_cost ?? m.estimatedCost ?? "0").replace(/[^0-9.]/g, "")))}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* Project + vendor concentration */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Section
              title="Procurement by project"
              description="Where purchase order value is concentrated"
            >
              <ValueBarChart
                data={poStats.byProject}
                emptyLabel="No project-linked purchase orders yet."
              />
            </Section>
            <Section title="Purchase order value by vendor" description="Largest supplier commitments">
              <ValueBarChart data={poStats.byVendor} emptyLabel="No vendor-linked purchase orders yet." />
            </Section>
          </div>

          {/* Pending vendor registrations */}
          {registrations.length > 0 && (
            <Section
              title="Pending vendor registrations"
              description={`${registrations.length} awaiting review`}
              action={
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/vendors")}>
                  View all
                </Button>
              }
            >
              <div className="space-y-2">
                {registrations.slice(0, 5).map((reg) => (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => navigate(`/vendors/registration/${reg.id}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{reg.companyName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {reg.category} • {reg.contactPerson || "No contact"}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      Pending review
                    </Badge>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Layer 7 — activity */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Section
              title="Recent procurement activity"
              description="Grouped by day, noise filtered out"
              className="lg:col-span-2"
            >
              {activitiesQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : groupedActivity.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No recent activity recorded.
                </p>
              ) : (
                <div className="space-y-4">
                  {groupedActivity.slice(0, 4).map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </p>
                      <div className="space-y-1.5">
                        {group.events.slice(0, 6).map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => e.actionUrl && navigate(e.actionUrl)}
                            className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                          >
                            <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                              <ActivityIcon className="h-3 w-3 text-primary" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{e.title}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {e.description || e.type} • {formatRelativeTime(e.date)}
                              </span>
                            </span>
                            {e.status && (
                              <Badge variant="secondary" className="shrink-0 text-[10px]">
                                {e.status}
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Quick actions" description="Jump straight into the work">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Procurement", icon: ShoppingCart, to: "/procurement" },
                  { label: "Vendors", icon: Package, to: "/vendors" },
                  { label: "Logistics", icon: Truck, to: "/logistics" },
                  { label: "Warehouse", icon: Warehouse, to: "/warehouse" },
                ].map((a) => (
                  <Card
                    key={a.label}
                    className="cursor-pointer transition-colors hover:bg-accent"
                    onClick={() => navigate(a.to)}
                  >
                    <CardContent className="flex flex-col items-center p-3 text-center">
                      <a.icon className="mb-1.5 h-6 w-6 text-primary" />
                      <p className="text-xs font-medium">{a.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>
          </div>

          {/* Data gaps */}
          {gaps.length > 0 && (
            <Section
              title="Data not yet captured"
              description="These analytics stay estimated until the backend records the fields below"
              action={<Database className="h-4 w-4 text-muted-foreground" />}
            >
              <div className="space-y-2">
                {gaps.map((g) => (
                  <div key={g.field} className="flex items-start gap-2 rounded-lg border border-dashed p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{g.field}</p>
                      <p className="text-xs text-muted-foreground">{g.purpose}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </PullToRefresh>

      <ExecDrilldownSheet
        open={drill != null}
        onOpenChange={(open) => !open && setDrill(null)}
        title={drill ? BUCKET_TITLES[drill] : ""}
        description={`${drillRecords.length} record(s) • ${range.label}`}
        records={drillRecords}
      />
    </DashboardLayout>
  );
};

export default ProcurementIntelligenceDashboard;
