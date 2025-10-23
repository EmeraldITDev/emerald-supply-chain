import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, Package, ShoppingCart, Clock, CheckCircle2, XCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { MRFApprovalDialog } from "@/components/MRFApprovalDialog";
import type { MRFRequest } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";

const Procurement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { mrfRequests, srfRequests, purchaseOrders, approveMRF, rejectMRF } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedMRF, setSelectedMRF] = useState<MRFRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Get current user role for approval
  const canApprove = user?.role === "procurement";
  const currentUserRole = "procurement"; // Procurement page only for procurement managers

  const vendorFromState = (location.state as any)?.vendor as string | undefined;
  const vendorFromQuery = searchParams.get("vendor") || undefined;
  const vendorFilter = vendorFromState || vendorFromQuery || undefined;

  const [tab, setTab] = useState<string>(vendorFilter ? "po" : "mrf");

  useEffect(() => {
    if (vendorFromState && !vendorFromQuery) {
      setSearchParams({ vendor: vendorFromState } as any, { replace: true } as any);
    }
  }, [vendorFromState]);

  useEffect(() => {
    if (vendorFilter) setTab("po");
  }, [vendorFilter]);

  const filteredPOs = purchaseOrders.filter((po) => !vendorFilter || po.vendor === vendorFilter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
      case "Completed":
        return "bg-accent text-accent-foreground";
      case "Pending":
      case "Submitted":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "Procurement Approved":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Finance Approved":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "Rejected":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getApprovalTimerColor = (mrf: MRFRequest) => {
    if (!mrf.procurementManagerApprovalTime || mrf.currentStage === "approved" || mrf.currentStage === "rejected") {
      return null;
    }
    
    const startTime = new Date(mrf.procurementManagerApprovalTime);
    const now = new Date();
    const hoursElapsed = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursElapsed <= 48) return "text-emerald-600 dark:text-emerald-400";
    if (hoursElapsed <= 72) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  const handleMRFClick = (mrf: MRFRequest) => {
    setSelectedMRF(mrf);
    setDialogOpen(true);
  };

  const handleApprove = (remarks: string) => {
    if (!selectedMRF || !canApprove) return;
    
    approveMRF(selectedMRF.id, currentUserRole, user?.name || "Procurement Manager", remarks);
    
    toast({
      title: "MRF Approved",
      description: `${selectedMRF.id} has been approved and moved to the next stage.`,
    });

    // Simulate email notification
    console.log(`📧 Email sent to next approver for ${selectedMRF.id}`);
  };

  const handleReject = (remarks: string) => {
    if (!selectedMRF || !canApprove) return;
    
    rejectMRF(selectedMRF.id, currentUserRole, user?.name || "Procurement Manager", remarks);
    
    toast({
      title: "MRF Rejected",
      description: `${selectedMRF.id} has been rejected. The requester can edit and resubmit.`,
      variant: "destructive",
    });

    // Simulate email notification
    console.log(`📧 Rejection email sent to requester for ${selectedMRF.id}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Procurement</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Manage material and service requests</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="mrf" className="text-xs sm:text-sm">Material Requests</TabsTrigger>
            <TabsTrigger value="srf" className="text-xs sm:text-sm">Service Requests</TabsTrigger>
            <TabsTrigger value="po" className="text-xs sm:text-sm">Purchase Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="mrf" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => navigate("/procurement/mrf/new")}>
                <Plus className="mr-2 h-4 w-4" />
                New MRF
              </Button>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Material Request Forms</CardTitle>
                <CardDescription>List of all material requisition requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mrfRequests.map((request) => {
                    const timerColor = getApprovalTimerColor(request);
                    return (
                      <div
                        key={request.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div 
                          onClick={() => handleMRFClick(request)}
                          className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{request.title}</p>
                              {request.isResubmission && (
                                <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 rounded">
                                  Resubmission
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                              {request.id} • {request.requester} • {request.date}
                            </p>
                            {request.currentStage && (
                              <p className="text-xs text-muted-foreground capitalize mt-1">
                                Stage: {request.currentStage}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-center">
                          {timerColor && (
                            <Clock className={`h-4 w-4 ${timerColor}`} />
                          )}
                          {request.currentStage === "approved" && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          )}
                          {request.currentStage === "rejected" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate("/procurement/mrf/new", { state: { rejectedMRF: request } });
                                }}
                                className="text-xs"
                              >
                                Edit & Resubmit
                              </Button>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </>
                          )}
                          <span className={`text-xs px-3 py-1 rounded-full whitespace-nowrap ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="srf" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => navigate("/procurement/srf/new")}>
                <Plus className="mr-2 h-4 w-4" />
                New SRF
              </Button>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Service Request Forms</CardTitle>
                <CardDescription>List of all service requisition requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {srfRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{request.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {request.id} • {request.requester} • {request.date}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="po" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Orders</CardTitle>
                <CardDescription>List of all purchase orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredPOs.map((po) => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{po.items}</p>
                          <p className="text-sm text-muted-foreground">
                            {po.id} • {po.vendor} • {po.date}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Delivery: {po.deliveryDate} • {po.amount}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(po.status)}`}>
                        {po.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <MRFApprovalDialog
        mrf={selectedMRF}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onApprove={handleApprove}
        onReject={handleReject}
        currentUserRole={currentUserRole}
      />
    </DashboardLayout>
  );
};

export default Procurement;
