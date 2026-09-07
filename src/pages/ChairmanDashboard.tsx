import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getDisplayId } from "@/utils/displayId";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, ShieldAlert, Activity } from "lucide-react";
import { toast } from "sonner";
import { useScmAppRefreshListener } from "@/hooks/useScmAppRefreshListener";
import { PullToRefresh } from "@/components/PullToRefresh";
import { fetchDashboardMrfs } from "@/utils/fetchDashboardMrfs";
import { mrfApi, srfApi, vendorApi, dashboardApi } from "@/services/api";
import { getWorkflowStageLabel } from "@/utils/workflowStageLabels";
import { queryKeys } from "@/lib/queryKeys";
import { WORKFLOW_QUERY_OPTIONS } from "@/lib/queryOptions";
import type { MRF, SRF, Vendor } from "@/types";
import {
  AlertsPanel,
  ConcentrationChart,
  ExecMetric,
  PipelineFlow,
  SectionCard,
  SpendTrendChart,
  money,
} from "@/components/chairman/ExecutiveWidgets";
import { ExecDrilldownSheet } from "@/components/chairman/ExecDrilldownSheet";
import {
  BUCKET_LABELS,
  buildAlerts,
  buildSnapshot,
  bucketRecords,
  mrfCost,
  pctChange,
  type DrillBucket,
} from "@/utils/executiveIntelligence";

const ChairmanDashboard = () => {
  const navigate = useNavigate();

  const {
    data: mrfRequests = [],
    isLoading: loading,
    refetch: fetchMRFs,
  } = useQuery({
    queryKey: queryKeys.dashboard.chairmanMrfs(),
    queryFn: async () => fetchDashboardMrfs("chairman"),
    ...WORKFLOW_QUERY_OPTIONS,
  });

  const { data: srfs = [] } = useQuery<SRF[]>({
    queryKey: ["chairman-exec", "srfs"],
    queryFn: async () => {
      const res = await srfApi.list({ page: 1, per_page: 50, include_line_items: false });
      return res.success && res.data ? res.data.items : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["chairman-exec", "vendors"],
    queryFn: async () => {
      const res = await vendorApi.list({ page: 1, per_page: 100 });
      return res.success && res.data ? res.data.items : [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: activities = [] } = useQuery({
    queryKey: queryKeys.dashboard.recentActivities(12),
    queryFn: async () => {
      const res = await dashboardApi.getRecentActivities(12);
      return res.success && Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: chairmanQueue = [],
    isLoading: queueLoading,
    refetch: refetchQueue,
  } = useQuery<MRF[]>({
    queryKey: ["chairman-pending-approvals"],
    queryFn: async () => {
      const res = await mrfApi.list({ workflow_state: "chairman_review", per_page: 50 });
      return res.success && res.data ? res.data.items : [];
    },
    ...WORKFLOW_QUERY_OPTIONS,
  });

  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingMrfId, setRejectingMrfId] = useState<string | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [drill, setDrill] = useState<{ bucket: DrillBucket; title: string } | null>(null);

  const getApiId = (mrf: MRF) =>
    String((mrf as unknown as Record<string, unknown>).mrf_id ?? mrf.id);

  const snapshot = useMemo(() => buildSnapshot(mrfRequests, srfs), [mrfRequests, srfs]);
  const alerts = useMemo(
    () => buildAlerts(snapshot, mrfRequests, vendors),
    [snapshot, mrfRequests, vendors],
  );

  const activeVendors = useMemo(
    () =>
      vendors.filter((v) =>
        /active|approved/i.test(String((v as { status?: string }).status ?? "active")),
      ).length,
    [vendors],
  );

  const drillRecords = useMemo(
    () => (drill ? bucketRecords(drill.bucket, mrfRequests) : []),
    [drill, mrfRequests],
  );

  const openDrill = (bucket: DrillBucket) =>
    setDrill({ bucket, title: BUCKET_LABELS[bucket] });

  const handleChairmanApprove = async (mrf: MRF) => {
    const id = getApiId(mrf);
    setActionId(id);
    const res = await mrfApi.chairmanApprove(id, "");
    setActionId(null);
    if (res.success) {
      toast.success("Request approved and sent to Procurement.");
      await Promise.all([refetchQueue(), fetchMRFs()]);
    } else {
      toast.error(res.error || "Approval failed.");
    }
  };

  const confirmChairmanReject = async () => {
    if (!rejectingMrfId) return;
    if (!rejectRemarks.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    setActionId(rejectingMrfId);
    const res = await mrfApi.chairmanReject(rejectingMrfId, rejectRemarks.trim());
    setActionId(null);
    if (res.success) {
      toast.success("Request rejected.");
      setRejectDialogOpen(false);
      setRejectRemarks("");
      setRejectingMrfId(null);
      await Promise.all([refetchQueue(), fetchMRFs()]);
    } else {
      toast.error(res.error || "Rejection failed.");
    }
  };

  useScmAppRefreshListener(async () => {
    await fetchMRFs();
    await refetchQueue();
  });

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const healthTone =
    criticalCount > 0 ? "Needs attention" : alerts.length > 0 ? "Watchlist" : "Stable";

  return (
    <DashboardLayout>
      <PullToRefresh
        onRefresh={async () => {
          await Promise.all([fetchMRFs(), refetchQueue()]);
          toast.success("Data refreshed");
        }}
      >
        <div className="space-y-5 sm:space-y-6">
          {/* Header + health */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Executive Supply Chain Command Centre
                </p>
                <h1 className="mt-1 text-xl font-bold sm:text-3xl">Chairman's View</h1>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Organisation-wide procurement, purchase order, vendor and delivery oversight.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={criticalCount > 0 ? "destructive" : "secondary"}
                  className="h-7 px-3 text-xs"
                >
                  <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                  {healthTone}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void fetchMRFs();
                    void refetchQueue();
                  }}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
              ) : (
                <>
                  <ExecMetric
                    label="Active SCM cases"
                    value={snapshot.activeCases}
                    hint={`${snapshot.openMaterial} material • ${snapshot.openService} service`}
                    onClick={() => openDrill("open_material")}
                  />
                  <ExecMetric
                    label="Active PO value"
                    value={money(snapshot.activeValue)}
                    hint={`${snapshot.activePOs} purchase orders`}
                    delta={pctChange(snapshot.monthValue, snapshot.prevMonthValue)}
                    onClick={() => openDrill("po_active")}
                  />
                  <ExecMetric
                    label="Pending approvals"
                    value={snapshot.pendingApproval}
                    hint={money(snapshot.pendingValue)}
                    tone={snapshot.stalled.length > 0 ? "warning" : "default"}
                    onClick={() => openDrill("pending_approval")}
                  />
                  <ExecMetric
                    label="Delayed / at risk"
                    value={snapshot.posOverdue}
                    hint={`${money(snapshot.atRiskValue)} exposed`}
                    tone={snapshot.posOverdue > 0 ? "danger" : "success"}
                    onClick={() => openDrill("po_overdue")}
                  />
                </>
              )}
            </div>
          </div>

          {/* Requires attention */}
          <SectionCard
            title="Requires attention"
            description="Risks, bottlenecks and exposures ranked by severity"
          >
            <AlertsPanel alerts={alerts} onSelect={(a) => openDrill(a.bucket)} />
          </SectionCard>

          {/* Chairman approvals queue */}
          <SectionCard
            title="Awaiting your approval"
            description="Executive-originated requests routed to the Chairman"
            action={<Badge variant="outline">{chairmanQueue.length}</Badge>}
          >
            <div className="space-y-3">
              {queueLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : chairmanQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests pending your approval.</p>
              ) : (
                chairmanQueue.map((mrf) => {
                  const apiId = getApiId(mrf);
                  const cost = mrfCost(mrf);
                  return (
                    <div key={mrf.id} className="space-y-2 rounded-lg border p-3 sm:p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{mrf.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {getDisplayId(mrf)} • {mrf.requester_name || mrf.requester || "Unknown"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {mrf.category || "—"} • {cost > 0 ? `₦${cost.toLocaleString()}` : "-"}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {getWorkflowStageLabel(
                            mrf.current_stage || mrf.currentStage || "chairman_review",
                          )}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/mrfs/${apiId}`)}>
                          View details
                        </Button>
                        <Button
                          size="sm"
                          disabled={actionId === apiId}
                          onClick={() => {
                            void handleChairmanApprove(mrf);
                          }}
                        >
                          {actionId === apiId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={actionId === apiId}
                          onClick={() => {
                            setRejectingMrfId(apiId);
                            setRejectRemarks("");
                            setRejectDialogOpen(true);
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          {/* Pipeline + spend trend */}
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard
              title="Request pipeline"
              description="Where work is accumulating"
              className="lg:col-span-1"
            >
              <PipelineFlow
                stages={snapshot.pipeline}
                onSelect={(bucket) => openDrill(bucket as DrillBucket)}
              />
            </SectionCard>

            <SectionCard
              title="Procurement value trend"
              description="Committed value raised per month"
              className="lg:col-span-2"
            >
              <SpendTrendChart data={snapshot.trend} />
            </SectionCard>
          </div>

          {/* Purchase order overview */}
          <SectionCard
            title="Purchase order overview"
            description="Commitment status across the organisation"
          >
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              <ExecMetric
                label="Active POs"
                value={snapshot.activePOs}
                hint={money(snapshot.activeValue)}
                onClick={() => openDrill("po_active")}
              />
              <ExecMetric
                label="Pending approval"
                value={snapshot.posPendingApproval}
                onClick={() => openDrill("po_pending")}
              />
              <ExecMetric
                label="Awaiting delivery"
                value={snapshot.posAwaitingDelivery}
                hint={money(snapshot.awaitingDeliveryValue)}
                onClick={() => openDrill("po_awaiting_delivery")}
              />
              <ExecMetric
                label="Completed"
                value={snapshot.posCompleted}
                hint={money(snapshot.completedValue)}
                tone="success"
                onClick={() => openDrill("po_completed")}
              />
            </div>
          </SectionCard>

          {/* Exposure concentration */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Exposure by project" description="Where commitments are concentrated">
              <ConcentrationChart data={snapshot.byProject} />
            </SectionCard>
            <SectionCard title="Exposure by vendor" description="Largest active vendor commitments">
              <ConcentrationChart data={snapshot.byVendor} />
            </SectionCard>
          </div>

          {/* Vendors + activity */}
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard title="Vendor overview" description="Supply base at a glance">
              <div className="grid grid-cols-2 gap-2">
                <ExecMetric
                  label="Active vendors"
                  value={activeVendors}
                  onClick={() => navigate("/vendors")}
                />
                <ExecMetric
                  label="Total on record"
                  value={vendors.length}
                  onClick={() => navigate("/vendors")}
                />
              </div>
              <div className="mt-3 space-y-2">
                {snapshot.byVendor.slice(0, 4).map((v) => (
                  <div
                    key={v.name}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                  >
                    <span className="truncate">{v.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{money(v.value)}</span>
                  </div>
                ))}
                {snapshot.byVendor.length === 0 && (
                  <p className="text-xs text-muted-foreground">No active vendor commitments yet.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Executive activity"
              description="Significant recent supply chain events"
              className="lg:col-span-2"
            >
              <div className="space-y-3">
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
                ) : (
                  activities.slice(0, 8).map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{event.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{event.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {event.timestamp ? new Date(event.timestamp).toLocaleString() : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </PullToRefresh>

      <ExecDrilldownSheet
        open={Boolean(drill)}
        onOpenChange={(open) => !open && setDrill(null)}
        title={drill?.title ?? ""}
        records={drillRecords}
      />

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectRemarks}
            onChange={(e) => setRejectRemarks(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectRemarks.trim() || actionId === rejectingMrfId}
              onClick={() => {
                void confirmChairmanReject();
              }}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ChairmanDashboard;
