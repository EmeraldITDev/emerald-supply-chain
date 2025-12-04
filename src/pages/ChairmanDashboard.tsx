import { useState, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, FileText, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { PullToRefresh } from "@/components/PullToRefresh";

const ChairmanDashboard = () => {
  const { mrfRequests, updateMRF, approveMRF, rejectMRF } = useApp();
  const { user } = useAuth();
  const [selectedMRF, setSelectedMRF] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [key: string]: string }>({});

  // Filter MRFs awaiting chairman approval and payment approval
  const pendingApproval = useMemo(() => {
    return mrfRequests.filter(mrf => 
      mrf.currentStage === "chairman" && 
      (mrf.status === "Pending Chairman Approval" || mrf.status === "Awaiting Chairman")
    );
  }, [mrfRequests]);

  const pendingPayment = useMemo(() => {
    return mrfRequests.filter(mrf => mrf.status === "Processing Payment");
  }, [mrfRequests]);

  const handleApprove = (mrfId: string) => {
    const mrf = mrfRequests.find(m => m.id === mrfId);
    if (!mrf) return;

    // Chairman approved high-value MRF - send to Procurement for PO generation
    updateMRF(mrfId, {
      status: "Chairman Approved - Pending PO",
      currentStage: "procurement",
      chairmanComments: comments[mrfId] || "Approved"
    });
    approveMRF(mrfId, "chairman", user?.name || "Chairman", comments[mrfId] || "Approved");
    toast.success("High-value MRF approved - Forwarded to Procurement for PO generation");
    
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
    rejectMRF(mrfId, "chairman", user?.name || "Chairman", comments[mrfId]);
    toast.success("MRF rejected");
    setComments(prev => ({ ...prev, [mrfId]: "" }));
    setSelectedMRF(null);
  };

  const handlePaymentApproval = (mrfId: string) => {
    updateMRF(mrfId, {
      status: "Paid",
      currentStage: "completed"
    });
    toast.success("Payment approved successfully");
    setComments(prev => ({ ...prev, [mrfId]: "" }));
    setSelectedMRF(null);
  };

  const handleRefresh = async () => {
    // Simulate data refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <DashboardLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Chairman Dashboard</h1>
          <p className="text-muted-foreground">Final approval authority for high-value items and payments</p>
        </div>

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
                ₦{[...pendingApproval, ...pendingPayment].reduce((sum, mrf) => sum + parseFloat(mrf.estimatedCost || "0"), 0).toLocaleString()}
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
            {pendingApproval.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No high-value MRFs pending approval</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApproval.map((mrf) => (
                  <Card key={mrf.id} className="border-l-4 border-l-destructive">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{mrf.title}</CardTitle>
                          <CardDescription>
                            {mrf.id} • {mrf.requester} • {mrf.department}
                          </CardDescription>
                        </div>
                        <Badge variant="destructive">
                          ₦{parseFloat(mrf.estimatedCost).toLocaleString()}
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
                        {mrf.executiveComments && (
                          <div className="md:col-span-2 bg-muted p-3 rounded-lg">
                            <p className="font-semibold text-sm">Executive Comments:</p>
                            <p className="text-sm">{mrf.executiveComments}</p>
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
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        {selectedMRF === mrf.id ? (
                          <>
                            <Button 
                              onClick={() => handleApprove(mrf.id)}
                              className="flex-1"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
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
                            Review
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

        {/* Payment Approvals */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Approvals</CardTitle>
            <CardDescription>Final payment authorization from Finance</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingPayment.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No payments pending approval</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPayment.map((mrf) => (
                  <Card key={mrf.id} className="border-l-4 border-l-primary">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{mrf.title}</CardTitle>
                          <CardDescription>{mrf.id} • PO: {mrf.poNumber}</CardDescription>
                        </div>
                        <Badge>₦{parseFloat(mrf.estimatedCost).toLocaleString()}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => handlePaymentApproval(mrf.id)} className="w-full">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve Payment
                      </Button>
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

export default ChairmanDashboard;
