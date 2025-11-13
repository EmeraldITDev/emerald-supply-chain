import { useState, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { PullToRefresh } from "@/components/PullToRefresh";

const ExecutiveDashboard = () => {
  const { mrfRequests, updateMRF, approveMRF, rejectMRF } = useApp();
  const { user } = useAuth();
  const [selectedMRF, setSelectedMRF] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [key: string]: string }>({});

  // Filter MRFs awaiting executive approval
  const pendingMRFs = useMemo(() => {
    return mrfRequests.filter((mrf) => {
      const stage = (mrf.currentStage || "").toLowerCase().trim();
      const status = (mrf.status || "").toLowerCase().trim();
      
      // Explicitly exclude MRFs that have moved past executive stage
      if (stage === "procurement" || stage === "chairman" || stage === "rejected" || stage === "approved") {
        return false;
      }
      
      // Explicitly exclude approved or rejected statuses
      if (status.includes("approved by executive") || 
          status.includes("pending chairman") ||
          status === "rejected" ||
          status === "approved") {
        return false;
      }
      
      // Only include MRFs at executive stage or pending executive approval
      return (
        stage === "executive" ||
        (status === "submitted" && !stage) ||
        status === "pending executive approval" ||
        status.includes("pending executive") ||
        status.includes("awaiting executive")
      );
    });
  }, [mrfRequests]);

  // High value MRFs (> 1,000,000) need chairman approval
  const highValueMRFs = useMemo(() => {
    return pendingMRFs.filter(mrf => parseFloat(mrf.estimatedCost) > 1000000);
  }, [pendingMRFs]);

  const handleApprove = (mrfId: string) => {
    const mrf = mrfRequests.find(m => m.id === mrfId);
    if (!mrf) return;

    const estimatedCost = parseFloat(mrf.estimatedCost);
    
    if (estimatedCost > 1000000) {
      // High value - send to chairman
      updateMRF(mrfId, {
        status: "Pending Chairman Approval",
        currentStage: "chairman",
        executiveComments: comments[mrfId] || "Approved - Forwarded to Chairman for final approval"
      });
      approveMRF(mrfId, "executive", user?.name || "Executive", comments[mrfId] || "Approved - High value item forwarded to Chairman");
      toast.success("High-value MRF forwarded to Chairman for final approval");
    } else {
      // Normal value - proceed to procurement for PO upload
      updateMRF(mrfId, {
        status: "Approved by Executive",
        currentStage: "procurement",
        executiveComments: comments[mrfId] || "Approved"
      });
      approveMRF(mrfId, "executive", user?.name || "Executive", comments[mrfId] || "Approved");
      toast.success("MRF approved - Forwarded to Procurement Manager for PO upload");
    }
    
    setComments(prev => ({ ...prev, [mrfId]: "" }));
    setSelectedMRF(null);
  };

  const handleReject = (mrfId: string) => {
    if (!comments[mrfId]?.trim()) {
      toast.error("Please provide rejection reason");
      return;
    }

    updateMRF(mrfId, {
      status: "Rejected",
      currentStage: "rejected",
      rejectionReason: comments[mrfId]
    });
    rejectMRF(mrfId, "executive", user?.name || "Executive", comments[mrfId]);
    toast.success("MRF rejected");
    setComments(prev => ({ ...prev, [mrfId]: "" }));
    setSelectedMRF(null);
  };

  return (
    <DashboardLayout>
      <PullToRefresh onRefresh={async () => {
        toast.info("Refreshing data...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success("Data refreshed");
      }}>
        <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Executive Dashboard</h1>
          <p className="text-xs sm:text-sm lg:text-base text-muted-foreground mt-1">Review and approve Material Requisition Forms</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending Approval</CardTitle>
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">{pendingMRFs.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">High Value</CardTitle>
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">{highValueMRFs.length}</div>
              <p className="text-xs text-muted-foreground">&gt; ₦1M</p>
            </CardContent>
          </Card>

          <Card className="col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Value</CardTitle>
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">
                ₦{pendingMRFs.reduce((sum, mrf) => sum + parseFloat(mrf.estimatedCost || "0"), 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Pending requests</p>
            </CardContent>
          </Card>
        </div>

        {/* MRF List */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Material Requisition Forms</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Review and approve MRFs from procurement</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {pendingMRFs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No MRFs pending approval</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {pendingMRFs.map((mrf) => (
                  <Card key={mrf.id} className="border-l-4 border-l-primary">
                    <CardHeader className="p-3 sm:p-4 lg:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm sm:text-base lg:text-lg truncate">{mrf.title}</CardTitle>
                          <CardDescription className="text-xs sm:text-sm truncate">
                            {mrf.id} • {mrf.requester} • {mrf.department}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                          <Badge variant={parseFloat(mrf.estimatedCost) > 1000000 ? "destructive" : "default"} className="text-xs">
                            ₦{parseFloat(mrf.estimatedCost).toLocaleString()}
                          </Badge>
                          <Badge variant={mrf.urgency === "high" ? "destructive" : "secondary"} className="text-xs">
                            {mrf.urgency}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-4 lg:p-6 pt-0">
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

                      {parseFloat(mrf.estimatedCost) > 1000000 && (
                        <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                          <div className="flex gap-2">
                            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                            <p className="text-sm text-orange-900 dark:text-orange-100">
                              High value item - Will require Chairman approval after your review
                            </p>
                          </div>
                        </div>
                      )}

                      {selectedMRF === mrf.id && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Comments / Remarks:</label>
                          <Textarea
                            value={comments[mrf.id] || ""}
                            onChange={(e) => setComments(prev => ({ ...prev, [mrf.id]: e.target.value }))}
                            placeholder="Enter your comments or approval remarks..."
                            rows={3}
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        {selectedMRF === mrf.id ? (
                          <>
                            <Button 
                              onClick={() => handleApprove(mrf.id)}
                              className="flex-1"
                              variant="default"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Confirm Approval
                            </Button>
                            <Button 
                              onClick={() => handleReject(mrf.id)}
                              variant="destructive"
                              className="flex-1"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                            <Button 
                              onClick={() => setSelectedMRF(null)}
                              variant="outline"
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button 
                            onClick={() => setSelectedMRF(mrf.id)}
                            className="w-full"
                          >
                            Review & Approve
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </PullToRefresh>
    </DashboardLayout>
  );
};

export default ExecutiveDashboard;
