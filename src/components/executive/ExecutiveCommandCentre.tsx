import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { ExecDrilldownSheet } from "@/components/chairman/ExecDrilldownSheet";
import {
  ActivityTrendChart,
  AttentionPanel,
  HealthOverview,
  InsightCards,
  KpiCard,
  PipelineBoard,
  Section,
} from "@/components/procurement/ProcurementIntelWidgets";
import { ExecutiveApprovalWorkspace } from "@/components/executive/ExecutiveApprovalWorkspace";
import { DashboardMrfHistoryList } from "@/components/dashboard/DashboardMrfHistoryList";
import { MRFProgressTracker } from "@/components/MRFProgressTracker";
import { TableSkeleton } from "@/components/LoadingSkeleton";

import { useAuth } from "@/contexts/AuthContext";
import { useScmAppRefreshListener } from "@/hooks/useScmAppRefreshListener";
import { dashboardApi, mrfApi, srfApi, vendorApi } from "@/services/api";
import { getPendingVendorRegistrations } from "@/services/pendingVendorRegistrations";
import { fetchDashboardMrfs } from "@/utils/fetchDashboardMrfs";
import { queryKeys } from "@/lib/queryKeys";
import { getDisplayId } from "@/utils/displayId";
import { getWorkflowStageLabel } from "@/utils/workflowStageLabels";
import {
  bucketExecutiveMrfs,
  isExecutivePendingApproval,
} from "@/utils/mrfDashboardBuckets";
import {
  hasPO,
  isPendingApproval,
  isRejected,
  mrfCost,
  mrfCreated,
  pctChange,
} from "@/utils/executiveIntelligence";
import {
  BUCKET_TITLES,
  activitySeries,
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
  periodRange,
  poAt,
  previousRange,
  sparkline,
  type PeriodKey,
  type ProcBucket,
} from "@/utils/procurementIntelligence";
import {
  buildApprovalQueue,
  buildApprovalSummary,
  formatValue,
  summariseMyRequests,
  type ApprovalItem,
} from "@/utils/executiveApprovalIntel";
import type { MRF, SRF, Vendor, VendorRegistration } from "@/types";

const EXEC_PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "ytd", label: "This year" },
];

const inRange = (d: Date | null, r: { from: Date; to: Date }) =>
  !!d && d >= r.from && d <= r.to;

const ExecutiveCommandCentre = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [drill, setDrill] = useState<ProcBucket | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [detailMrf, setDetailMrf] = useState<MRF | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [series, setSeriesVisible] = useState<Record<string, boolean>>({
    materialRequests: true,
    serviceRequests: true,
    approved: true,
    purchaseOrders: true,
  });

  /* ----------------------------- data ----------------------------- */

  const approvalQ = useQuery<MRF[]>({
    queryKey: queryKeys.dashboard.executiveMrfs(),
    queryFn: () => fetchDashboardMrfs("executive"),
    staleTime: 60 * 1000,
  });

  const orgQ = useQuery<MRF[]>({
    queryKey: ["exec-intel", "mrfs"],
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

  const srfQ = useQuery<SRF[]>({
    queryKey: ["exec-intel", "srfs"],
    queryFn: async () => {
      const res = await srfApi.list({ page: 1, per_page: 100, include_line_items: false });
      return res.success && res.data ? res.data.items : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const vendorQ = useQuery<Vendor[]>({
    queryKey: ["exec-intel", "vendors"],
    queryFn: async () => {
      const res = await vendorApi.list({ page: 1, per_page: 200 });
      return res.success && res.data ? res.data.items : [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const regQ = useQuery<VendorRegistration[]>({
    queryKey: queryKeys.dashboard.pendingVendorRegistrations(),
    queryFn: async () => {
      const res = await getPendingVendorRegistrations();
      return res.success && Array.isArray(res.data) ? (res.data as VendorRegistration[]) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const activityQ = useQuery({
    queryKey: ["exec-intel", "activities"],
    queryFn: async () => {
      const res = await dashboardApi.getRecentActivities(30);
      return res.success && Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const myQ = useQuery<MRF[]>({
    queryKey: ["exec-intel", "my-requests", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await mrfApi.list({ requester_id: user?.id, per_page: 100 });
      if (!res.success || !res.data) return [];
      return (res.data.items ?? []).filter((m: MRF) => {
        const rid =
          (m as unknown as Record<string, unknown>).requesterId ??
          (m as unknown as Record<string, unknown>).requester_id;
        return String(rid) === String(user?.id);
      });
    },
    staleTime: 2 * 60 * 1000,
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([
      approvalQ.refetch(),
      orgQ.refetch(),
      srfQ.refetch(),
      vendorQ.refetch(),
      regQ.refetch(),
      activityQ.refetch(),
      myQ.refetch(),
    ]);
  }, [approvalQ, orgQ, srfQ, vendorQ, regQ, activityQ, myQ]);

  useScmAppRefreshListener(refreshAll);

  const approvalMrfs = approvalQ.data ?? [];
  const orgMrfs = orgQ.data ?? [];
  const srfs = srfQ.data ?? [];
  const vendors = vendorQ.data ?? [];
  const registrations = regQ.data ?? [];
  const activities = activityQ.data ?? [];
  const myRequests = myQ.data ?? [];

  /* ---------------------------- derived ---------------------------- */

  const range = useMemo(() => periodRange(period), [period]);
  const prev = useMemo(() => previousRange(range), [range]);

  const buckets = useMemo(() => bucketExecutiveMrfs(approvalMrfs), [approvalMrfs]);
  const queue = useMemo(
    () => buildApprovalQueue(buckets.pending, registrations),
    [buckets.pending, registrations],
  );
  const approvalSummary = useMemo(
    () => buildApprovalSummary(queue, buckets, range),
    [queue, buckets, range],
  );

  const pipeline = useMemo(() => buildPipeline(orgMrfs), [orgMrfs]);
  const processing = useMemo(
    () => buildProcessing(orgMrfs, srfs, range),
    [orgMrfs, srfs, range],
  );
  const delivery = useMemo(() => buildDeliveryStats(orgMrfs, range), [orgMrfs, range]);
  const poStats = useMemo(() => buildPoStats(orgMrfs, range), [orgMrfs, range]);
  const vendorPerf = useMemo(
    () => buildVendorPerformance(orgMrfs, vendors),
    [orgMrfs, vendors],
  );
  const trend = useMemo(
    () => activitySeries(orgMrfs, srfs, range),
    [orgMrfs, srfs, range],
  );
  const insights = useMemo(
    () => buildInsights(trend, pipeline, delivery, vendorPerf, poStats, processing),
    [trend, pipeline, delivery, vendorPerf, poStats, processing],
  );
  const openWorkload = useMemo(
    () => orgMrfs.filter((m) => !isRejected(m) && !hasPO(m)).length,
    [orgMrfs],
  );
  const health = useMemo(
    () => buildHealth(pipeline, processing, delivery, vendorPerf, openWorkload, poStats.active),
    [pipeline, processing, delivery, vendorPerf, openWorkload, poStats.active],
  );
  const risks = useMemo(
    () => buildProcAlerts(orgMrfs, vendorPerf, delivery, processing, registrations.length),
    [orgMrfs, vendorPerf, delivery, processing, registrations.length],
  );
  const gaps = useMemo(() => detectDataGaps(orgMrfs, vendors), [orgMrfs, vendors]);
  const mine = useMemo(() => summariseMyRequests(myRequests), [myRequests]);

  const execEvents = useMemo(() => {
    const meaningful = activities.filter(
      (a) =>
        !/(login|logout|viewed|opened|session|token|heartbeat|comment)/i.test(
          `${a.type ?? ""} ${a.title ?? ""}`,
        ),
    );
    return meaningful.slice(0, 12);
  }, [activities]);

  const delayed = useMemo(() => bucketFor("stalled_approval", orgMrfs), [orgMrfs]);
  const atRisk = useMemo(() => bucketFor("overdue_delivery", orgMrfs), [orgMrfs]);
  const activeRequests = useMemo(
    () => orgMrfs.filter((m) => !isRejected(m) && !/complete|closed/i.test(String(m.status ?? ""))),
    [orgMrfs],
  );
  const activePrev = useMemo(
    () => orgMrfs.filter((m) => inRange(mrfCreated(m), prev)).length,
    [orgMrfs, prev],
  );
  const activeThis = useMemo(
    () => orgMrfs.filter((m) => inRange(mrfCreated(m), range)).length,
    [orgMrfs, range],
  );
  const posThis = useMemo(
    () => orgMrfs.filter((m) => hasPO(m) && inRange(poAt(m) ?? mrfCreated(m), range)).length,
    [orgMrfs, range],
  );
  const posPrev = useMemo(
    () => orgMrfs.filter((m) => hasPO(m) && inRange(poAt(m) ?? mrfCreated(m), prev)).length,
    [orgMrfs, prev],
  );
  const approvedThis = useMemo(
    () => orgMrfs.filter((m) => inRange(approvedAt(m), range)).length,
    [orgMrfs, range],
  );
  const approvedPrev = useMemo(
    () => orgMrfs.filter((m) => inRange(approvedAt(m), prev)).length,
    [orgMrfs, prev],
  );

  const drillRecords = useMemo(() => (drill ? bucketFor(drill, orgMrfs) : []), [drill, orgMrfs]);

  const loading = approvalQ.isLoading || orgQ.isLoading;

  /* ---------------------------- actions ---------------------------- */

  const actionable = useCallback(
    (item: ApprovalItem) => item.kind === "mrf" && !!item.mrf && isExecutivePendingApproval(item.mrf),
    [],
  );

  const openFull = useCallback(
    (item: ApprovalItem) => {
      if (item.kind === "vendor" && item.registration) {
        navigate(`/vendors/registration/${item.registration.id}`);
        return;
      }
      if (item.mrf) navigate(`/procurement?mrf=${encodeURIComponent(String(item.mrf.id))}`);
    },
    [navigate],
  );

  const viewDetails = useCallback((item: ApprovalItem) => {
    if (item.mrf) {
      setDetailMrf(item.mrf);
      setDetailOpen(true);
    }
  }, []);

  const approve = useCallback(
    async (item: ApprovalItem) => {
      if (!item.mrf) return;
      setBusyKey(item.key);
      try {
        const res = await mrfApi.executiveApprove(item.mrf.id, remarks[item.key] ?? "");
        if (res.success) {
          toast.success("Approved — routed to Procurement for sourcing");
          setRemarks((p) => ({ ...p, [item.key]: "" }));
          await approvalQ.refetch();
        } else {
          toast.error(res.error || "Failed to approve request");
        }
      } catch {
        toast.error("Failed to connect to server");
      } finally {
        setBusyKey(null);
      }
    },
    [remarks, approvalQ],
  );

  const reject = useCallback(
    async (item: ApprovalItem) => {
      if (!item.mrf) return;
      const reason = (remarks[item.key] ?? "").trim();
      if (!reason) {
        toast.error("Add a remark explaining the rejection first");
        return;
      }
      setBusyKey(item.key);
      try {
        const res = await mrfApi.executiveReject(item.mrf.id, reason);
        if (res.success) {
          toast.success("Rejected — sent back to the requester");
          setRemarks((p) => ({ ...p, [item.key]: "" }));
          await approvalQ.refetch();
        } else {
          toast.error(res.error || "Failed to reject request");
        }
      } catch {
        toast.error("Failed to connect to server");
      } finally {
        setBusyKey(null);
      }
    },
    [remarks, approvalQ],
  );

  /* ----------------------------- render ----------------------------- */

  const kpis = [
    {
      label: "Awaiting your approval",
      value: String(approvalSummary.pending),
      context: approvalSummary.pending
        ? `${approvalSummary.dueToday} need action today • oldest waiting ${approvalSummary.oldestWaitingDays} day(s)`
        : "You are fully caught up",
      tone: approvalSummary.pending > 0 ? ("warning" as const) : ("success" as const),
      onClick: () => document.getElementById("approval-workspace")?.scrollIntoView({ behavior: "smooth" }),
    },
    {
      label: "High-priority requests",
      value: String(approvalSummary.highPriority),
      context: `${approvalSummary.highValuePending} high-value • ${formatValue(approvalSummary.highValueTotal || null)} committed`,
      tone: approvalSummary.highPriority > 0 ? ("danger" as const) : undefined,
      onClick: () => setDrill("high_value"),
    },
    {
      label: "Active procurement requests",
      value: String(activeRequests.length),
      delta: pctChange(activeThis, activePrev),
      context: `${activeThis} raised in ${range.label.toLowerCase()}`,
      spark: sparkline(orgMrfs, range, mrfCreated),
      onClick: () => setDrill("open"),
    },
    {
      label: "Approved this period",
      value: String(approvedThis),
      delta: pctChange(approvedThis, approvedPrev),
      context: `${approvalSummary.approvedThisWeek} approved by you in the last 7 days`,
      spark: sparkline(orgMrfs, range, approvedAt),
      onClick: () => setDrill("pending_approval"),
    },
    {
      label: "Purchase orders generated",
      value: String(poStats.created),
      delta: pctChange(posThis, posPrev),
      context: `${poStats.active} purchase order(s) currently active`,
      spark: sparkline(orgMrfs.filter(hasPO), range, (m) => poAt(m) ?? mrfCreated(m)),
      onClick: () => setDrill("active_po"),
    },
    {
      label: "Delayed requests",
      value: String(delayed.length),
      context: `${processing.pendingBeyondSla} past the approval window`,
      tone: delayed.length > 0 ? ("warning" as const) : undefined,
      onClick: () => setDrill("stalled_approval"),
    },
    {
      label: "Deliveries at risk",
      value: String(atRisk.length),
      context:
        delivery.onTimePct != null
          ? `${delivery.onTimePct}% on-time delivery this period`
          : "No goods-received records in this period",
      tone: atRisk.length > 0 ? ("danger" as const) : undefined,
      onClick: () => setDrill("overdue_delivery"),
    },
    {
      label: "Vendor registrations to review",
      value: String(registrations.length),
      context: registrations.length ? "Sourcing stays blocked until reviewed" : "None waiting",
      tone: registrations.length > 0 ? ("warning" as const) : undefined,
      onClick: () => navigate("/vendors"),
    },
  ];

  const topAttention = queue.slice(0, 5);

  return (
    <DashboardLayout>
      <PullToRefresh
        onRefresh={async () => {
          await refreshAll();
          toast.success("Dashboard refreshed");
        }}
      >
        <div className="space-y-4 sm:space-y-5">
          {/* Header */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Executive Intelligence &amp; Approval Centre
                </p>
                <h1 className="mt-1 text-xl font-bold sm:text-2xl lg:text-3xl">
                  Executive Dashboard
                </h1>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Procurement and supply chain overview • {range.label}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                  <SelectTrigger className="h-9 w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXEC_PERIODS.map((p) => (
                      <SelectItem key={p.key} value={p.key} className="text-xs">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => void refreshAll()} disabled={loading}>
                  <RefreshCw className={cn("h-4 w-4 sm:mr-2", loading && "animate-spin")} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <Button size="sm" onClick={() => navigate("/new-mrf")}>
                  <FileText className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">New MRF</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/new-srf")}>
                  <FileText className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">New SRF</span>
                </Button>
              </div>
            </div>
          </div>

          {/* 1. Requires your attention */}
          <Section
            title="Requires your attention"
            description="Prioritised by urgency, value and how long each item has been waiting"
          >
            {loading ? (
              <TableSkeleton rows={4} />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Immediate action
                  </p>
                  {topAttention.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Nothing is waiting for your decision.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {topAttention.map((item) => (
                        <div
                          key={item.key}
                          className={cn(
                            "flex items-start justify-between gap-3 rounded-lg border border-l-4 p-3",
                            item.priority === "high"
                              ? "border-l-destructive bg-destructive/5"
                              : "border-l-amber-500 bg-amber-500/5",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{item.title}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {item.typeLabel} • {item.unit}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Waiting {item.waitingDays} day{item.waitingDays === 1 ? "" : "s"}
                              {item.value ? ` • ${formatValue(item.value, item.currency)}` : ""}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() =>
                              actionable(item)
                                ? document
                                    .getElementById("approval-workspace")
                                    ?.scrollIntoView({ behavior: "smooth" })
                                : openFull(item)
                            }
                          >
                            Review
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Procurement risks &amp; exceptions
                  </p>
                  <AttentionPanel alerts={risks} onSelect={(a) => setDrill(a.bucket)} />
                </div>
              </div>
            )}
          </Section>

          {/* 2. Executive overview */}
          <Section
            title="Executive overview"
            description="Every figure opens the underlying records"
          >
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((k) => (
                  <KpiCard key={k.label} {...k} />
                ))}
              </div>
            )}
          </Section>

          {/* 3. Approval workspace */}
          <div id="approval-workspace">
            <Section
              title="Approval workspace"
              description="Scan the summary, expand only when you need more, then decide"
              action={
                <Badge variant={approvalSummary.pending ? "destructive" : "secondary"}>
                  {approvalSummary.pending} pending
                </Badge>
              }
            >
              {/* Approval summary strip */}
              <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                <MiniStat label="Pending" value={approvalSummary.pending} tone="warning" />
                <MiniStat
                  label="Approved this period"
                  value={approvalSummary.approvedThisPeriod}
                  tone="success"
                />
                <MiniStat label="Rejected" value={approvalSummary.rejected} />
                <MiniStat label="Recently completed" value={approvalSummary.completed} />
              </div>
              <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  Oldest pending: <strong>{approvalSummary.oldestWaitingDays} day(s)</strong>
                </span>
                <span>
                  High priority: <strong>{approvalSummary.highPriority}</strong>
                </span>
                <span>
                  Average approval time:{" "}
                  <strong>
                    {approvalSummary.avgApprovalDays != null
                      ? `${approvalSummary.avgApprovalDays.toFixed(1)} day(s)`
                      : "not recorded"}
                  </strong>
                </span>
                <span>
                  Approved in the last 7 days: <strong>{approvalSummary.approvedThisWeek}</strong>
                </span>
              </div>

              <Tabs defaultValue="pending" className="space-y-3">
                <TabsList className="flex h-auto flex-wrap gap-1">
                  <TabsTrigger value="pending">
                    Pending
                    {queue.length > 0 && (
                      <Badge variant="destructive" className="ml-2 text-[10px]">
                        {queue.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="approved">Approved ({buckets.approved.length})</TabsTrigger>
                  <TabsTrigger value="rejected">Rejected ({buckets.rejected.length})</TabsTrigger>
                  <TabsTrigger value="completed">Completed ({buckets.completed.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                  {loading ? (
                    <TableSkeleton rows={4} />
                  ) : (
                    <ExecutiveApprovalWorkspace
                      items={queue}
                      actionable={actionable}
                      busyKey={busyKey}
                      remarks={remarks}
                      onRemarkChange={(key, value) =>
                        setRemarks((p) => ({ ...p, [key]: value }))
                      }
                      onApprove={(i) => void approve(i)}
                      onReject={(i) => void reject(i)}
                      onViewDetails={viewDetails}
                      onOpenFull={openFull}
                    />
                  )}
                </TabsContent>

                <TabsContent value="approved">
                  <DashboardMrfHistoryList
                    mrfs={buckets.approved}
                    variant="approved"
                    role="executive"
                    getRequesterName={(m) => m.requester_name || m.requester || "Unknown"}
                    getEstimatedCost={mrfCost}
                    onViewDetails={(m) => {
                      setDetailMrf(m);
                      setDetailOpen(true);
                    }}
                    emptyMessage="No requests approved by you yet"
                  />
                </TabsContent>

                <TabsContent value="rejected">
                  <DashboardMrfHistoryList
                    mrfs={buckets.rejected}
                    variant="rejected"
                    role="executive"
                    getRequesterName={(m) => m.requester_name || m.requester || "Unknown"}
                    getEstimatedCost={mrfCost}
                    onViewDetails={(m) => {
                      setDetailMrf(m);
                      setDetailOpen(true);
                    }}
                    emptyMessage="No rejected requests"
                  />
                </TabsContent>

                <TabsContent value="completed">
                  <DashboardMrfHistoryList
                    mrfs={buckets.completed}
                    variant="completed"
                    role="executive"
                    getRequesterName={(m) => m.requester_name || m.requester || "Unknown"}
                    getEstimatedCost={mrfCost}
                    onViewDetails={(m) => {
                      setDetailMrf(m);
                      setDetailOpen(true);
                    }}
                    emptyMessage="No completed requests in the current list"
                  />
                </TabsContent>
              </Tabs>
            </Section>
          </div>

          {/* 4. Trends + workflow */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Section
              title="Procurement activity"
              description={`Requests, approvals and purchase orders — ${range.label.toLowerCase()}`}
              className="xl:col-span-2"
              action={
                <div className="flex flex-wrap gap-1">
                  {Object.keys(series).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSeriesVisible((s) => ({ ...s, [key]: !s[key] }))}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                        series[key]
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                    </button>
                  ))}
                </div>
              }
            >
              {loading ? <Skeleton className="h-64 w-full" /> : <ActivityTrendChart data={trend} visible={series} />}
            </Section>

            <Section
              title="Workflow overview"
              description="Where active requests are accumulating"
            >
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <PipelineBoard
                  stages={pipeline}
                  onSelect={(key) => setDrill(key as ProcBucket)}
                />
              )}
            </Section>
          </div>

          {/* 5. Health */}
          <Section
            title="Procurement health"
            description="Assessed from recorded data only — areas without data are marked as such"
          >
            {loading ? <Skeleton className="h-24 w-full" /> : <HealthOverview items={health} />}
          </Section>

          {/* 6. Insights */}
          {insights.length > 0 && (
            <Section title="Key insights" description="Changes worth knowing about this period">
              <InsightCards insights={insights} />
            </Section>
          )}

          {/* 7. Performance snapshot + my activity */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Section
              title="Performance snapshot"
              description="Summarised supply chain performance"
              className="lg:col-span-2"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Total active requests" value={activeRequests.length} />
                <MiniStat label="Completed this period" value={delivery.onTime + delivery.late} />
                <MiniStat
                  label="Avg processing time"
                  value={
                    processing.avgMrfCycleDays != null
                      ? `${processing.avgMrfCycleDays.toFixed(1)}d`
                      : "-"
                  }
                />
                <MiniStat label="Purchase orders" value={poStats.created} />
                <MiniStat label="Active vendors" value={vendors.length} />
                <MiniStat
                  label="On-time delivery"
                  value={delivery.onTimePct != null ? `${delivery.onTimePct}%` : "-"}
                  tone={delivery.onTimePct != null && delivery.onTimePct < 75 ? "warning" : undefined}
                />
                <MiniStat
                  label="Delayed activities"
                  value={delayed.length}
                  tone={delayed.length ? "warning" : undefined}
                />
                <MiniStat
                  label="Deliveries at risk"
                  value={atRisk.length}
                  tone={atRisk.length ? "danger" : undefined}
                />
              </div>
            </Section>

            <Section title="My activity" description="Requests you submitted yourself">
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Submitted" value={mine.submitted} />
                <MiniStat label="Pending" value={mine.pending} />
                <MiniStat label="Approved" value={mine.approved} />
                <MiniStat label="Completed" value={mine.completed} />
              </div>
              <div className="mt-3 space-y-1">
                {myRequests.slice(0, 4).map((m) => (
                  <button
                    key={String(m.id)}
                    type="button"
                    onClick={() => {
                      setDetailMrf(m);
                      setDetailOpen(true);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-md border-b px-1 py-1.5 text-left last:border-0 hover:bg-muted/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{m.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {getDisplayId(m)} •{" "}
                        {getWorkflowStageLabel(m.current_stage || m.currentStage || m.status)}
                      </span>
                    </span>
                  </button>
                ))}
                {myRequests.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    You have not submitted any requests yet.
                  </p>
                )}
              </div>
            </Section>
          </div>

          {/* 8. Executive activity timeline */}
          <Section
            title="Executive activity timeline"
            description="Significant events across procurement and supply chain"
          >
            {activityQ.isLoading ? (
              <TableSkeleton rows={4} />
            ) : execEvents.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No significant activity recorded yet.
              </p>
            ) : (
              <ol className="relative space-y-3 border-l pl-4">
                {execEvents.map((e) => (
                  <li key={String(e.id)} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium leading-snug">{e.title}</p>
                    {e.description && (
                      <p className="text-xs text-muted-foreground">{e.description}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {e.timestamp ? new Date(e.timestamp).toLocaleString() : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {/* 9. Data gaps */}
          {gaps.length > 0 && (
            <Section
              title="Data not currently captured"
              description="These metrics show placeholders until the backend records the fields below"
            >
              <ul className="space-y-2">
                {gaps.map((g) => (
                  <li key={g.field} className="flex items-start gap-2 rounded-lg border p-3">
                    <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{g.field}</p>
                      <p className="text-xs text-muted-foreground">{g.purpose}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </PullToRefresh>

      <ExecDrilldownSheet
        open={drill != null}
        onOpenChange={(o) => !o && setDrill(null)}
        title={drill ? (BUCKET_TITLES[drill] ?? "Records") : "Records"}
        records={drillRecords}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailMrf ? getDisplayId(detailMrf) : "Request"}</DialogTitle>
            <DialogDescription>{detailMrf?.title}</DialogDescription>
          </DialogHeader>
          {detailMrf && (
            <div className="space-y-5">
              <MRFProgressTracker
                mrfId={detailMrf.id}
                contractType={
                  (detailMrf as unknown as Record<string, string>).contract_type ??
                  (detailMrf as unknown as Record<string, string>).contractType
                }
              />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Status" value={String(detailMrf.status ?? "—")} />
                <Field label="Category" value={String(detailMrf.category ?? "—")} />
                <Field label="Urgency" value={String(detailMrf.urgency ?? "—")} />
                <Field label="Quantity" value={String(detailMrf.quantity ?? "—")} />
                <Field
                  label="Estimated cost"
                  value={formatValue(
                    mrfCost(detailMrf) || null,
                    (detailMrf as unknown as Record<string, string>).currency,
                  )}
                />
                <Field
                  label="Requester"
                  value={detailMrf.requester_name || detailMrf.requester || "—"}
                />
                <Field label="Description" value={String(detailMrf.description ?? "—")} full />
                <Field label="Justification" value={String(detailMrf.justification ?? "—")} full />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

const MiniStat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "warning" | "danger" | "success";
}) => (
  <div
    className={cn(
      "rounded-lg border p-3",
      tone === "warning" && "border-amber-500/40 bg-amber-500/5",
      tone === "danger" && "border-destructive/40 bg-destructive/5",
      tone === "success" && "border-emerald-500/40 bg-emerald-500/5",
    )}
  >
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{value}</p>
  </div>
);

const Field = ({ label, value, full }: { label: string; value: string; full?: boolean }) => (
  <div className={cn(full && "col-span-2")}>
    <Label className="text-muted-foreground">{label}</Label>
    <p className="mt-0.5 break-words text-sm font-medium">{value}</p>
  </div>
);

export default ExecutiveCommandCentre;
