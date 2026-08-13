import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getDisplayId } from "@/utils/displayId";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { FileText, DollarSign, Loader2, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { useScmAppRefreshListener } from "@/hooks/useScmAppRefreshListener";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import { fetchDashboardMrfs } from "@/utils/fetchDashboardMrfs";
import { mrfApi } from "@/services/api";
import { getWorkflowStageLabel } from "@/utils/workflowStageLabels";
import { queryKeys } from "@/lib/queryKeys";
import { WORKFLOW_QUERY_OPTIONS } from "@/lib/queryOptions";
import type { MRF } from "@/types";
import { mrfUsesFinanceAp } from "@/utils/financeAPRouting";

const ChairmanDashboard = () => {
  const { user } = useAuth();
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

  // Executive-originated MRFs awaiting Chairman approval
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

  const getApiId = (mrf: MRF) =>
    String((mrf as unknown as Record<string, unknown>).mrf_id ?? mrf.id);

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

  // Helper functions for field access
  const getEstimatedCost = (mrf: MRF) => {
    return parseFloat(String(mrf.estimated_cost || mrf.estimatedCost || "0"));
  };

  const getRequesterName = (mrf: MRF) => {
    return mrf.requester_name || mrf.requester || "Unknown";
  };

  // Filter MRFs awaiting chairman approval (high-value items)
  const pendingApproval = useMemo(() => {
    return mrfRequests.filter(mrf => {
      const status = (mrf.status || "").toLowerCase();
      const stage = (mrf.current_stage || mrf.currentStage || "").toLowerCase();
      
      return (
        stage === "chairman_review" ||
        stage === "chairman" ||
        status.includes("pending chairman") ||
        status.includes("awaiting chairman")
      );
    });
  }, [mrfRequests]);

  // Filter MRFs awaiting payment approval (legacy internal only — not Finance AP)
  const pendingPayment = useMemo(() => {
    return mrfRequests.filter(mrf => {
      if (mrfUsesFinanceAp(mrf)) return false;
      const status = (mrf.status || "").toLowerCase();
      const stage = (mrf.current_stage || mrf.currentStage || "").toLowerCase();
      
      return (
        stage === "chairman_payment" ||
        status === "processing payment" ||
        status.includes("payment pending chairman")
      );
    });
  }, [mrfRequests]);

  useScmAppRefreshListener(async () => {
    await fetchMRFs();
    await refetchQueue();
  });

  // Calculate total value
  const totalValue = useMemo(() => {
    return [...pendingApproval, ...pendingPayment].reduce((sum, mrf) => sum + getEstimatedCost(mrf), 0);
  }, [pendingApproval, pendingPayment]);

  return (
    <DashboardLayout>
      <PullToRefresh onRefresh={async () => {
        toast.info("Refreshing data...");
        await fetchMRFs();
        toast.success("Data refreshed");
      }}>
        <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chairman Dashboard</h1>
            <p className="text-muted-foreground">Monitor high-value items and payments</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { void fetchMRFs(); }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Dashboard Alerts */}
        <DashboardAlerts userRole="chairman" maxAlerts={5} />

        {/* Executive requests awaiting Chairman approval */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>Executive requests awaiting your approval</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {queueLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : chairmanQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No requests pending your approval.
              </p>
            ) : (
              chairmanQueue.map((mrf) => {
                const apiId = getApiId(mrf);
                const cost = getEstimatedCost(mrf);
                return (
                  <div key={mrf.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{mrf.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getDisplayId(mrf)} • Submitted by {getRequesterName(mrf)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/mrfs/${apiId}`)}
                      >
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        disabled={actionId === apiId}
                        onClick={() => { void handleChairmanApprove(mrf); }}
                      >
                        {actionId === apiId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Approve"
                        )}
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
          </CardContent>
        </Card>

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
                onClick={() => { void confirmChairmanReject(); }}
              >
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingApproval.length}</div>
              <p className="text-xs text-muted-foreground">High-value MRFs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Approval</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingPayment.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₦{totalValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Pending decisions</p>
            </CardContent>
          </Card>
        </div>

        {/* High-Value MRF Approvals */}
        <Card>
          <CardHeader>
            <CardTitle>High-Value MRF Approvals</CardTitle>
            <CardDescription>Items exceeding ₦1,000,000 requiring final approval</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingApproval.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No high-value MRFs pending approval</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApproval.map((mrf) => {
                  const estimatedCost = getEstimatedCost(mrf);

                  return (
                    <Card key={mrf.id} className="border-l-4 border-l-destructive">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{mrf.title}</CardTitle>
                            <CardDescription>
                              {getDisplayId(mrf)} • {getRequesterName(mrf)} • {mrf.department || "N/A"}
                            </CardDescription>
                          </div>
                          <Badge variant="destructive">
                            ₦{estimatedCost.toLocaleString()}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-semibold">Category:</p>
                            <p className="text-muted-foreground">{mrf.category}</p>
                          </div>
                          <div>
                            <p className="font-semibold">Quantity:</p>
                            <p className="text-muted-foreground">{mrf.quantity}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="font-semibold">Description:</p>
                            <p className="text-muted-foreground">{mrf.description}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="font-semibold">Justification:</p>
                            <p className="text-muted-foreground">{mrf.justification}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="secondary">
                            <Eye className="h-3 w-3 mr-1" />
                            Read-Only View
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Approvals */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Approvals</CardTitle>
            <CardDescription>Final payment authorization from Finance</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingPayment.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No payments pending approval</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPayment.map((mrf) => {
                  const estimatedCost = getEstimatedCost(mrf);

                  return (
                    <Card key={mrf.id} className="border-l-4 border-l-primary">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{mrf.title}</CardTitle>
                            <CardDescription>
                              {getDisplayId(mrf)} • PO: {mrf.po_number || mrf.poNumber || "N/A"}
                            </CardDescription>
                          </div>
                          <Badge>₦{estimatedCost.toLocaleString()}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Badge variant="secondary">
                          <Eye className="h-3 w-3 mr-1" />
                          Read-Only View
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </PullToRefresh>
    </DashboardLayout>
  );
};

export default ChairmanDashboard;