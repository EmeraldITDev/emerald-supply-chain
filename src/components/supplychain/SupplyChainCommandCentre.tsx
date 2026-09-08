/**
 * Supply Chain Command Centre — the Supply Chain Director's landing view.
 *
 * Powerful underneath, simple on the surface: everything the director must act
 * on is answered in plain language first (what needs you, what is happening
 * today), with the analytical depth available directly beneath it.
 *
 * All numbers come from live API data. Anything the backend does not yet return
 * is shown as a dash and listed under "Data not yet available".
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Info,
  Loader2,
  RefreshCw,
  ShoppingCart,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { ExecDrilldownSheet } from "@/components/chairman/ExecDrilldownSheet";
import {
  ActivityTrendChart,
  SERIES_META,
  DeliveryBreakdown,
  HealthOverview,
  InsightCards,
  KpiCard,
  PipelineBoard,
  Section,
  VendorPerformanceTable,
  money,
} from "@/components/procurement/ProcurementIntelWidgets";
import {
  BUCKET_TITLES,
  DEFAULT_FILTERS,
  PERIOD_OPTIONS,
  activitySeries,
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
  previousRange,
  type PeriodKey,
  type ProcBucket,
} from "@/utils/procurementIntelligence";
import {
  isRejected,
  mrfCost,
  mrfCreated,
  isPendingApproval,
  daysSince,
  mrfDate,
} from "@/utils/executiveIntelligence";
import {
  buildGlance,
  buildScdApprovalQueue,
  type ApprovalKind,
  type ScdApprovalItem,
} from "@/components/supplychain/scdCommandCentre";
import { mrfApi, srfApi, vendorApi, tripRequestApi } from "@/services/api";
import { queryKeys } from "@/lib/queryKeys";
import { WORKFLOW_QUERY_OPTIONS } from "@/lib/queryOptions";
import { formatMRFDate } from "@/utils/dateUtils";
import type { MRF, SRF, Vendor, VendorRegistration } from "@/types";

interface Props {
  /** MRFs already waiting on the director (shared cache with the page). */
  pendingMrfs: MRF[];
  pendingSrfs: SRF[];
  pendingTrips: Record<string, unknown>[];
  vendorRegistrations: VendorRegistration[];
  /** MRFs with an unsigned PO awaiting the director's review and signature. */
  pendingPOs: MRF[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onOpenMrf: (mrf: MRF) => void;
  onOpenSrf: (srf: SRF) => void;
  onOpenTrip: (trip: Record<string, unknown>) => void;
  /** Full inline purchase-order tools (download, documents, sign, upload, reject). */
  renderPoWorkspace: (mrf: MRF) => React.ReactNode;
}

const toneRing: Record<string, string> = {
  neutral: "border-border",
  good: "border-emerald-500/40 bg-emerald-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  critical: "border-destructive/40 bg-destructive/5",
};

const kindIcon: Record<ApprovalKind, typeof ClipboardList> = {
  mrf: ClipboardList,
  srf: Info,
  trip: Truck,
  vendor: Users,
  po: ShoppingCart,
};

export const SupplyChainCommandCentre = ({
  pendingMrfs,
  pendingSrfs,
  pendingTrips,
  vendorRegistrations,
  pendingPOs,
  loading,
  onRefresh,
  onOpenMrf,
  onOpenSrf,
  onOpenTrip,
  renderPoWorkspace,
}: Props) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ title: string; records: MRF[] } | null>(
    null,
  );

  /* ---------------- Organisation-wide context (analytics only) ------------- */

  const { data: allMrfs = [], isLoading: mrfsLoading } = useQuery<MRF[]>({
    queryKey: ["scd-command", "mrfs"] as const,
    queryFn: async () => {
      const res = await mrfApi.list({ per_page: 200 });
      return res.success && res.data ? res.data.items : [];
    },
    ...WORKFLOW_QUERY_OPTIONS,
  });

  const { data: allSrfs = [] } = useQuery<SRF[]>({
    queryKey: ["scd-command", "srfs"] as const,
    queryFn: async () => {
      const res = await srfApi.list({ per_page: 200 });
      return res.success && res.data ? res.data.items : [];
    },
    ...WORKFLOW_QUERY_OPTIONS,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["scd-command", "vendors"] as const,
    queryFn: async () => {
      const res = await vendorApi.list({ per_page: 200 });
      return res.success && res.data ? res.data.items : [];
    },
    ...WORKFLOW_QUERY_OPTIONS,
  });

  /* ---------------- Derived intelligence ---------------- */

  const range = useMemo(() => periodRange(period), [period]);
  const prev = useMemo(() => previousRange(range), [range]);

  const inRange = useCallback(
    (r: { from: Date; to: Date }) =>
      allMrfs.filter((m) => {
        const d = mrfCreated(m) ?? mrfDate(m);
        return d ? d >= r.from && d <= r.to : false;
      }),
    [allMrfs],
  );

  const periodMrfs = useMemo(() => inRange(range), [inRange, range]);
  const prevMrfs = useMemo(() => inRange(prev), [inRange, prev]);

  const pipeline = useMemo(() => buildPipeline(allMrfs), [allMrfs]);
  const delivery = useMemo(
    () => buildDeliveryStats(allMrfs, range),
    [allMrfs, range],
  );
  const poStats = useMemo(
    () => buildPoStats(allMrfs, range),
    [allMrfs, range],
  );
  const processing = useMemo(
    () => buildProcessing(allMrfs, allSrfs, range),
    [allMrfs, allSrfs, range],
  );
  const vendorPerf = useMemo(
    () => buildVendorPerformance(allMrfs, vendors),
    [allMrfs, vendors],
  );
  const series = useMemo(
    () => activitySeries(allMrfs, allSrfs, range),
    [allMrfs, allSrfs, range],
  );
  const openWorkload = useMemo(
    () => allMrfs.filter((m) => !isRejected(m)).length,
    [allMrfs],
  );
  const health = useMemo(
    () =>
      buildHealth(
        pipeline,
        processing,
        delivery,
        vendorPerf,
        openWorkload,
        poStats.active,
      ),
    [pipeline, processing, delivery, vendorPerf, openWorkload, poStats.active],
  );
  const alerts = useMemo(
    () =>
      buildProcAlerts(
        allMrfs,
        vendorPerf,
        delivery,
        processing,
        vendorRegistrations.length,
      ),
    [allMrfs, vendorPerf, delivery, processing, vendorRegistrations.length],
  );
  const insights = useMemo(
    () => buildInsights(series, pipeline, delivery, vendorPerf, poStats, processing),
    [series, pipeline, delivery, vendorPerf, poStats, processing],
  );
  const gaps = useMemo(
    () => detectDataGaps(allMrfs, vendors),
    [allMrfs, vendors],
  );

  const queue = useMemo(
    () =>
      buildScdApprovalQueue({
        mrfs: pendingMrfs.filter(isPendingApproval),
        srfs: pendingSrfs,
        trips: pendingTrips,
        registrations: vendorRegistrations,
        pos: pendingPOs,
      }),
    [pendingMrfs, pendingSrfs, pendingTrips, vendorRegistrations, pendingPOs],
  );

  const stalled = useMemo(() => bucketFor("stalled_approval", allMrfs), [allMrfs]);
  const overdue = useMemo(
    () => bucketFor("overdue_delivery", allMrfs),
    [allMrfs],
  );

  const glance = useMemo(
    () =>
      buildGlance({
        queue,
        activeRequests: bucketFor("open", allMrfs).length,
        issues: stalled.length + overdue.length,
        overdueDeliveries: overdue.length,
        stalledRequests: stalled.length,
        vendorsNeedingAttention: vendorPerf.filter((v) => v.late > 0).length,
        totalVendorsWithHistory: vendorPerf.filter((v) => v.delivered > 0).length,
      }),
    [queue, allMrfs, stalled.length, overdue.length, vendorPerf],
  );

  const spend = useMemo(
    () => periodMrfs.reduce((s, m) => s + mrfCost(m), 0),
    [periodMrfs],
  );
  const prevSpend = useMemo(
    () => prevMrfs.reduce((s, m) => s + mrfCost(m), 0),
    [prevMrfs],
  );
  const pct = (now: number, before: number) =>
    before > 0 ? ((now - before) / before) * 100 : null;

  const openDrill = (bucket: ProcBucket) =>
    setDrill({ title: BUCKET_TITLES[bucket], records: bucketFor(bucket, allMrfs) });

  /* ---------------- Approval actions ---------------- */

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      queryClient.invalidateQueries({ queryKey: ["scd-command"] }),
    ]);
    await onRefresh();
  }, [queryClient, onRefresh]);

  const act = async (
    item: ScdApprovalItem,
    mode: "approve" | "reject",
  ): Promise<void> => {
    const note = (remarks[item.key] ?? "").trim();
    if (mode === "reject" && note.length < 5) {
      toast.error("Please give a short reason so the requester knows what to fix");
      return;
    }
    setBusy(item.key);
    try {
      let ok = false;
      let error = "";
      if (item.kind === "mrf") {
        const res =
          mode === "approve"
            ? await mrfApi.supplyChainDirectorApprove(item.apiId, note || undefined)
            : await mrfApi.supplyChainDirectorReject(item.apiId, note);
        ok = res.success;
        error = res.error ?? "";
      } else if (item.kind === "srf") {
        const res =
          mode === "approve"
            ? await srfApi.supplyChainDirectorApprove(item.apiId, note || undefined)
            : await srfApi.supplyChainDirectorReject(item.apiId, note);
        ok = res.success;
        error = res.error ?? "";
      } else if (item.kind === "trip") {
        const res = await tripRequestApi.scdApprove(item.apiId, {
          action: mode,
          remarks: note || null,
        });
        ok = res.success;
        error = res.error ?? "";
      } else {
        navigate("/vendors?tab=registrations");
        setBusy(null);
        return;
      }

      if (!ok) {
        toast.error(error || `Could not ${mode} this request`);
        return;
      }
      toast.success(
        mode === "approve"
          ? `${item.typeLabel} ${item.reference} approved`
          : `${item.typeLabel} ${item.reference} returned to the requester`,
      );
      setExpanded(null);
      setRejecting(null);
      setRemarks((r) => ({ ...r, [item.key]: "" }));
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach the server");
    } finally {
      setBusy(null);
    }
  };

  const openItem = (item: ScdApprovalItem) => {
    if ((item.kind === "mrf" || item.kind === "po") && item.mrf) onOpenMrf(item.mrf);
    else if (item.kind === "srf" && item.srf) onOpenSrf(item.srf);
    else if (item.kind === "trip" && item.trip) onOpenTrip(item.trip);
    else navigate("/vendors?tab=registrations");
  };

  const filtered = (kind: "all" | ApprovalKind) =>
    kind === "all" ? queue : queue.filter((i) => i.kind === kind);

  const busyAll = loading || mrfsLoading;

  /* ---------------- Render ---------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">Supply Chain Command Centre</h1>
          <p className="text-sm text-muted-foreground">
            What needs you, what is happening, and where to act — in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.filter((o) => o.key !== "custom").map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void invalidate()}
            disabled={busyAll}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", busyAll && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Today at a glance */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {glance.map((g) => (
          <Card key={g.id} className={cn("border", toneRing[g.tone])}>
            <CardContent className="p-4">
              <p className="text-sm font-semibold leading-snug">{g.headline}</p>
              <p className="mt-1 text-xs text-muted-foreground">{g.detail}</p>
              {g.actionLabel && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0 text-xs"
                  onClick={() => {
                    if (g.action === "approvals")
                      document
                        .getElementById("scd-approvals")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    else if (g.action === "issues") openDrill("stalled_approval");
                    else if (g.action === "vendors") navigate("/vendors");
                    else openDrill("open");
                  }}
                >
                  {g.actionLabel} <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Needs your attention */}
      <Section
        title="Needs your attention"
        description="Ranked by urgency, value and how long each item has been waiting."
      >
        {busyAll ? (
          <TableSkeleton rows={3} />
        ) : queue.length === 0 && alerts.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nothing needs your attention right now.
          </p>
        ) : (
          <div className="space-y-2">
            {queue.slice(0, 4).map((item) => (
              <button
                key={`att-${item.key}`}
                type="button"
                onClick={() => {
                  setExpanded(item.key);
                  document
                    .getElementById("scd-approvals")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex w-full items-start justify-between gap-3 rounded-lg border border-l-4 border-l-amber-500 p-3 text-left transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.typeLabel} • {item.reference} • waiting {item.waitingDays} day
                    {item.waitingDays === 1 ? "" : "s"}
                    {item.highValue ? " • high value" : ""}
                  </p>
                </div>
                <Badge
                  variant={item.priority === "high" ? "destructive" : "secondary"}
                  className="shrink-0 text-[10px] capitalize"
                >
                  {item.priority}
                </Badge>
              </button>
            ))}
            {alerts.slice(0, 3).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => openDrill(a.bucket)}
                className="flex w-full items-start justify-between gap-3 rounded-lg border border-l-4 border-l-destructive/60 p-3 text-left transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                </div>
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Approval workspace */}
      <div id="scd-approvals">
        <Section
          title="Approval workspace"
          description="Material requests, service requests, trips, vendor registrations and purchase orders — review, approve, sign or return without leaving this page."
        >
          <Tabs defaultValue="all">
            <TabsList className="mb-3 flex w-full flex-wrap justify-start gap-1">
              {(
                [
                  ["all", "All"],
                  ["mrf", "Material"],
                  ["srf", "Service"],
                  ["trip", "Trips"],
                  ["vendor", "Vendors"],
                  ["po", "Purchase orders"],
                ] as const
              ).map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="text-xs">
                  {label}
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">
                    {filtered(key as "all" | ApprovalKind).length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {(["all", "mrf", "srf", "trip", "vendor", "po"] as const).map((key) => {
              const rows = filtered(key);
              return (
                <TabsContent key={key} value={key} className="mt-0 space-y-2">
                  {busyAll ? (
                    <TableSkeleton rows={4} />
                  ) : rows.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Nothing waiting here.
                    </p>
                  ) : (
                    rows.map((item) => {
                      const Icon = kindIcon[item.kind];
                      const isOpen = expanded === item.key;
                      const working = busy === item.key;
                      return (
                        <div
                          key={item.key}
                          className={cn(
                            "rounded-lg border transition-colors",
                            isOpen && "border-primary/40 bg-muted/30",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : item.key)}
                            className="flex w-full items-start gap-3 p-3 text-left"
                          >
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{item.title}</p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {item.reference} • {item.requester} • {item.unit}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <Badge
                                  variant={
                                    item.priority === "high" ? "destructive" : "secondary"
                                  }
                                  className="text-[10px] capitalize"
                                >
                                  {item.priority} priority
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  {item.waitingDays}d waiting
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  {item.value ? money(item.value) : "-"}
                                </Badge>
                              </div>
                            </div>
                            <ChevronDown
                              className={cn(
                                "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                isOpen && "rotate-180",
                              )}
                            />
                          </button>

                          {isOpen && (
                            <div className="space-y-3 border-t p-3">
                              <div className="grid gap-2 text-xs sm:grid-cols-2">
                                <p>
                                  <span className="text-muted-foreground">Summary: </span>
                                  {item.summary}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">Submitted: </span>
                                  {item.submitted ? formatMRFDate(item.submitted.toISOString()) : "-"}
                                </p>
                              </div>

                              {rejecting === item.key && (
                                <Textarea
                                  value={remarks[item.key] ?? ""}
                                  onChange={(e) =>
                                    setRemarks((r) => ({ ...r, [item.key]: e.target.value }))
                                  }
                                  placeholder="Tell the requester what needs to change (required)"
                                  className="min-h-[70px] text-sm"
                                />
                              )}

                              <div className="flex flex-wrap gap-2">
                                {item.kind === "vendor" ? (
                                  <Button size="sm" onClick={() => openItem(item)}>
                                    Review registration
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      disabled={working}
                                      onClick={() => void act(item, "approve")}
                                    >
                                      {working ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                      )}
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={working}
                                      onClick={() => {
                                        if (rejecting !== item.key) {
                                          setRejecting(item.key);
                                          return;
                                        }
                                        void act(item, "reject");
                                      }}
                                    >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      {rejecting === item.key ? "Confirm return" : "Return"}
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openItem(item)}
                                >
                                  View full details
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </Section>
      </div>

      {/* Supply chain health */}
      <Section
        title="Supply chain health"
        description="A simple read on approvals, sourcing, deliveries, vendors and workload."
      >
        <HealthOverview items={health} />
      </Section>

      {/* Key metrics */}
      <Section title="Key numbers" description="Compared with the previous period.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Requests raised"
            value={periodMrfs.length}
            delta={pct(periodMrfs.length, prevMrfs.length)}
            context="Material requests created in this period"
            onClick={() => openDrill("open")}
          />
          <KpiCard
            label="Awaiting approval"
            value={queue.length}
            context="Everything currently waiting on you"
            tone={queue.length ? "warning" : "default"}
            onClick={() => openDrill("pending_approval")}
          />
          <KpiCard
            label="Purchase commitments"
            value={spend > 0 ? money(spend) : "-"}
            delta={pct(spend, prevSpend)}
            context="Estimated value of requests raised"
            onClick={() => openDrill("high_value")}
          />
          <KpiCard
            label="Deliveries on time"
            value={delivery.onTimePct == null ? "-" : `${delivery.onTimePct}%`}
            delta={
              delivery.onTimePct != null && delivery.prevOnTimePct != null
                ? delivery.onTimePct - delivery.prevOnTimePct
                : null
            }
            context={
              delivery.onTimePct == null
                ? "No delivery dates recorded yet"
                : `${delivery.onTime} on time, ${delivery.late} late`
            }
            onClick={() => openDrill("awaiting_delivery")}
          />
        </div>
      </Section>

      {/* Workflow + activity */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Where work is sitting" description="Requests by workflow stage.">
          <PipelineBoard stages={pipeline} onSelect={() => openDrill("open")} />
        </Section>
        <Section title="Activity over time" description="Requests and approvals per period.">
          <ActivityTrendChart
            data={series}
            visible={Object.fromEntries(SERIES_META.map((m) => [m.key, true]))}
          />
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Delivery performance" description="How purchase orders are landing.">
          <DeliveryBreakdown stats={delivery} onSelect={() => openDrill("overdue_delivery")} />
        </Section>
        <Section title="Vendor performance" description="Based on recorded deliveries.">
          <VendorPerformanceTable rows={vendorPerf.slice(0, 8)} />
        </Section>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Section title="What this means" description="Read directly from the live data.">
          <InsightCards insights={insights} />
        </Section>
      )}

      {/* Data gaps */}
      {gaps.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4" /> Data not yet available
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {gaps.map((g) => (
              <p key={g.field} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{g.field}:</span> {g.purpose}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <ExecDrilldownSheet
        open={Boolean(drill)}
        onOpenChange={(o) => !o && setDrill(null)}
        title={drill?.title ?? ""}
        records={drill?.records ?? []}
      />
    </div>
  );
};

export default SupplyChainCommandCentre;
