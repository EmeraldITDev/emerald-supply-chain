import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, FileText, DollarSign, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import { mrfApi } from "@/services/api";
import type { MRF } from "@/types";

const ChairmanDashboard = () => {
  const { user } = useAuth();
  const [mrfRequests, setMrfRequests] = useState<MRF[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedMRF, setSelectedMRF] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [key: string]: string }>({});

  // Fetch MRFs from backend API
  const fetchMRFs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await mrfApi.getAll();
      if (response.success && response.data) {
        setMrfRequests(response.data);
      } else {
        toast.error(response.error || "Failed to load MRFs");
      }
    } catch (error) {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMRFs();
  }, [fetchMRFs]);

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

  // Filter MRFs awaiting payment approval
  const pendingPayment = useMemo(() => {
    return mrfRequests.filter(mrf => {
      const status = (mrf.status || "").toLowerCase();
      const stage = (mrf.current_stage || mrf.currentStage || "").toLowerCase();
      
      return (
        stage === "chairman_payment" ||
        status === "processing payment" ||
        status.includes("payment pending chairman")
      );
    });
  }, [mrfRequests]);

  // Calculate total value
  const totalValue = useMemo(() => {
    return [...pendingApproval, ...pendingPayment].reduce((sum, mrf) => sum + getEstimatedCost(mrf), 0);
  }, [pendingApproval, pendingPayment]);

  const handleApprove = async (mrfId: string) => {
    setActionLoading(mrfId);
    
    try {
      // Call the real backend API endpoint for chairman approval
      const response = await mrfApi.chairmanApprove(mrfId, comments[mrfId] || "Approved");
      
      if (response.success) {
        toast.success("High-value MRF approved - Forwarded to Procurement to generate RFQ");
        await fetchMRFs();
        setComments(prev => ({ ...prev, [mrfId]: "" }));
        setSelectedMRF(null);
      } else {
        toast.error(response.error || "Failed to approve MRF");
      }
    } catch (error) {
      toast.error("Failed to connect to server");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (mrfId: string) => {
    if (!comments[mrfId]?.trim()) {
      toast.error("Please provide rejection reason");
      return;
    }

    setActionLoading(mrfId);

    try {
      const response = await mrfApi.workflowReject(mrfId, comments[mrfId], "Rejected by Chairman");
      
      if (response.success) {
        toast.success("MRF rejected");
        await fetchMRFs();
        setComments(prev => ({ ...prev, [mrfId]: "" }));
        setSelectedMRF(null);
      } else {
        toast.error(response.error || "Failed to reject MRF");
      }
    } catch (error) {
      toast.error("Failed to connect to server");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePaymentApproval = async (mrfId: string) => {
    setActionLoading(mrfId);
    
    try {
      // Call the real backend API endpoint for payment approval
      const response = await mrfApi.approvePayment(mrfId);
      
      if (response.success) {
        toast.success("Payment approved successfully - MRF workflow completed");
        await fetchMRFs();
        setComments(prev => ({ ...prev, [mrfId]: "" }));
        setSelectedMRF(null);
      } else {
        toast.error(response.error || "Failed to approve payment");
      }
    } catch (error) {
      toast.error("Failed to connect to server");
    } finally {
      setActionLoading(null);
    }
  };

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
            <p className="text-muted-foreground">Final approval authority for high-value items and payments</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchMRFs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Dashboard Alerts */}
        <DashboardAlerts userRole="chairman" maxAlerts={5} />


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
                  const isActionLoading = actionLoading === mrf.id;

                  return (
                    <Card key={mrf.id} className="border-l-4 border-l-destructive">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{mrf.title}</CardTitle>
                            <CardDescription>
                              {mrf.id} • {getRequesterName(mrf)} • {mrf.department || "N/A"}
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
                          {(mrf.executiveComments || mrf.executive_remarks) && (
                            <div className="md:col-span-2 bg-muted p-3 rounded-lg">
                              <p className="font-semibold text-sm">Executive Comments:</p>
                              <p className="text-sm">{mrf.executiveComments || mrf.executive_remarks}</p>
                            </div>
                          )}
                        </div>

                        {selectedMRF === mrf.id && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Chairman Comments:</label>
                            <Textarea
                              value={comments[mrf.id] || ""}
                              onChange={(e) => setComments(prev => ({ ...prev, [mrf.id]: e.target.value }))}
                              placeholder="Enter your comments..."
                              rows={3}
                              disabled={isActionLoading}
                            />
                          </div>
                        )}

                        <div className="flex gap-2">
                          {selectedMRF === mrf.id ? (
                            <>
                              <Button 
                                onClick={() => handleApprove(mrf.id)}
                                className="flex-1"
                                disabled={isActionLoading}
                              >
                                {isActionLoading ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                )}
                                Approve
                              </Button>
                              <Button 
                                onClick={() => handleReject(mrf.id)}
                                variant="destructive"
                                className="flex-1"
                                disabled={isActionLoading}
                              >
                                {isActionLoading ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="mr-2 h-4 w-4" />
                                )}
                                Reject
                              </Button>
                              <Button 
                                onClick={() => setSelectedMRF(null)}
                                variant="outline"
                                disabled={isActionLoading}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button 
                              onClick={() => setSelectedMRF(mrf.id)}
                              className="w-full"
                            >
                              Review
                            </Button>
                          )}
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
                  const isActionLoading = actionLoading === mrf.id;

                  return (
                    <Card key={mrf.id} className="border-l-4 border-l-primary">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{mrf.title}</CardTitle>
                            <CardDescription>
                              {mrf.id} • PO: {mrf.po_number || mrf.poNumber || "N/A"}
                            </CardDescription>
                          </div>
                          <Badge>₦{estimatedCost.toLocaleString()}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          onClick={() => handlePaymentApproval(mrf.id)} 
                          className="w-full"
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-2 h-4 w-4" />
                          )}
                          Approve Payment
                        </Button>
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