import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, AlertCircle, FileText, Loader2, RefreshCw, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import { RecentActivities } from "@/components/RecentActivities";
import { mrfApi, vendorApi } from "@/services/api";
import type { MRF, VendorRegistration } from "@/types";
import { OneDriveLink } from "@/components/OneDriveLink";
import { ExecutiveActionButtons } from "@/components/ExecutiveActionButtons";
import { MRFProgressTracker } from "@/components/MRFProgressTracker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatMRFDate } from "@/utils/dateUtils";
import { useNavigate } from "react-router-dom";

const ExecutiveDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mrfRequests, setMrfRequests] = useState<MRF[]>([]);
  const [vendorRegistrations, setVendorRegistrations] = useState<VendorRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedMRF, setSelectedMRF] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [mrfDetailsDialogOpen, setMrfDetailsDialogOpen] = useState(false);
  const [selectedMRFForDetails, setSelectedMRFForDetails] = useState<MRF | null>(null);
  const [mrfFullDetails, setMrfFullDetails] = useState<any | null>(null);
  const [loadingFullDetails, setLoadingFullDetails] = useState(false);

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

  // Fetch vendor registrations from backend API
  const fetchVendorRegistrations = useCallback(async () => {
    setLoadingVendors(true);
    try {
      const response = await vendorApi.getRegistrations();
      if (response.success && response.data) {
        // Filter only pending registrations
        const pending = response.data.filter((reg: VendorRegistration) => 
          reg.status === 'Pending' || reg.status === 'Under Review'
        );
        setVendorRegistrations(pending);
      } else {
        console.error('Failed to load vendor registrations:', response.error);
      }
    } catch (error) {
      console.error('Failed to connect to server for vendor registrations');
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  useEffect(() => {
    fetchMRFs();
    fetchVendorRegistrations();
  }, [fetchMRFs, fetchVendorRegistrations]);

  // Helper to get estimated cost (handles both snake_case and camelCase)
  const getEstimatedCost = (mrf: MRF) => {
    return parseFloat(String(mrf.estimated_cost || mrf.estimatedCost || "0"));
  };

  // Helper to get requester name
  const getRequesterName = (mrf: MRF) => {
    return mrf.requester_name || mrf.requester || "Unknown";
  };

  // Helper to get date
  const getDate = (mrf: MRF) => {
    return mrf.created_at || mrf.date || "";
  };

  // Helper to get PFI/Supporting Document URL
  const getPFIUrl = (mrf: MRF) => {
    // Check all possible document URL fields
    return (mrf as any).invoice_onedrive_url || 
           (mrf as any).invoiceOneDriveUrl ||
           mrf.pfi_share_url || 
           mrf.pfiShareUrl || 
           mrf.pfi_url || 
           mrf.pfiUrl ||
           (mrf as any).invoice_url ||
           (mrf as any).invoiceUrl;
  };

  // Handle PFI download
  const handleDownloadPFI = (mrf: MRF) => {
    const pfiUrl = getPFIUrl(mrf);
    if (pfiUrl) {
      if (pfiUrl.startsWith('http')) {
        window.open(pfiUrl, '_blank');
      } else {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://supply-chain-backend-hwh6.onrender.com/api';
        window.open(`${baseUrl.replace('/api', '')}/${pfiUrl}`, '_blank');
      }
    }
  };

  // Filter MRFs awaiting executive approval
  const pendingMRFs = useMemo(() => {
    return mrfRequests.filter((mrf) => {
      const status = (mrf.status || "").toLowerCase().trim();
      const currentStage = (mrf.current_stage || mrf.currentStage || "").toLowerCase().trim();
      
      // Match backend status values
      return (
        status === "executive_review" ||
        currentStage === "executive_review" ||
        currentStage === "executive" ||
        status === "pending" ||
        status === "submitted" ||
        status.includes("pending executive") ||
        status.includes("awaiting executive")
      );
    });
  }, [mrfRequests]);

  // High value MRFs (> 1,000,000) need chairman approval
  const highValueMRFs = useMemo(() => {
    return pendingMRFs.filter(mrf => getEstimatedCost(mrf) > 1000000);
  }, [pendingMRFs]);

  // Calculate total value
  const totalValue = useMemo(() => {
    return pendingMRFs.reduce((sum, mrf) => sum + getEstimatedCost(mrf), 0);
  }, [pendingMRFs]);

  const handleApprove = async (mrfId: string) => {
    const mrf = mrfRequests.find(m => m.id === mrfId);
    if (!mrf) return;

    setActionLoading(mrfId);
    
    try {
      // Call the real backend API endpoint
      const response = await mrfApi.executiveApprove(mrfId, comments[mrfId] || "Approved");
      
      if (response.success) {
        const estimatedCost = parseFloat(String(mrf.estimated_cost || mrf.estimatedCost || "0"));
        
        if (estimatedCost > 1000000) {
          toast.success("High-value MRF forwarded to Chairman for final approval");
        } else {
          toast.success("MRF approved - Forwarded to Procurement Manager to generate RFQ");
        }
        
        // Refresh the list from backend
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
      // Call the real backend API endpoint
      const response = await mrfApi.workflowReject(mrfId, comments[mrfId], "Rejected by Executive");
      
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


  return (
    <DashboardLayout>
      <PullToRefresh onRefresh={async () => {
        toast.info("Refreshing data...");
        await Promise.all([fetchMRFs(), fetchVendorRegistrations()]);
        toast.success("Data refreshed");
      }}>
        <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Executive Dashboard</h1>
            <p className="text-xs sm:text-sm lg:text-base text-muted-foreground mt-1">Review and approve Material Requisition Forms</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              fetchMRFs();
              fetchVendorRegistrations();
            }}
            disabled={loading || loadingVendors}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading || loadingVendors ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Dashboard Alerts */}
        <DashboardAlerts userRole="executive" maxAlerts={5} />

        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending Approval</CardTitle>
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">
                {pendingMRFs.length + vendorRegistrations.length}
              </div>
              <p className="text-xs text-muted-foreground">
                {pendingMRFs.length} MRF{pendingMRFs.length !== 1 ? 's' : ''}, {vendorRegistrations.length} Vendor{vendorRegistrations.length !== 1 ? 's' : ''}
              </p>
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
                ₦{totalValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Pending requests</p>
            </CardContent>
          </Card>
        </div>



        {/* MRF List with Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              Pending Approval
              {(pendingMRFs.length > 0 || vendorRegistrations.length > 0) && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {pendingMRFs.length + vendorRegistrations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">All Requests ({mrfRequests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Pending Approval</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Review and approve MRFs and vendor registrations</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {loading || loadingVendors ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingMRFs.length === 0 && vendorRegistrations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No items pending approval</p>
                    <p className="text-xs mt-2">All MRFs and vendor registrations have been reviewed</p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {/* Vendor Registrations */}
                    {vendorRegistrations.map((reg) => (
                      <Card key={`vendor-${reg.id}`} className="border-l-4 border-l-blue-500">
                        <CardHeader className="p-3 sm:p-4 lg:p-6">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-sm sm:text-base lg:text-lg truncate">
                                Vendor Registration: {reg.companyName}
                              </CardTitle>
                              <CardDescription className="text-xs sm:text-sm truncate">
                                {reg.category} • {reg.contactPerson} • {reg.email}
                              </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              Vendor Registration
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-semibold">Company:</p>
                              <p className="text-muted-foreground">{reg.companyName}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Category:</p>
                              <p className="text-muted-foreground">{reg.category}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Contact:</p>
                              <p className="text-muted-foreground">{reg.contactPerson}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Email:</p>
                              <p className="text-muted-foreground">{reg.email}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Phone:</p>
                              <p className="text-muted-foreground">{reg.phone || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Submitted:</p>
                              <p className="text-muted-foreground">
                                {new Date(reg.createdAt || reg.submittedDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/vendors/registration/${reg.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Review Registration
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* MRFs */}
                    {pendingMRFs.map((mrf) => {
                      const estimatedCost = getEstimatedCost(mrf);
                      const isHighValue = estimatedCost > 1000000;
                      const isActionLoading = actionLoading === mrf.id;

                      return (
                        <Card key={mrf.id} className="border-l-4 border-l-primary">
                          <CardHeader className="p-3 sm:p-4 lg:p-6">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-sm sm:text-base lg:text-lg truncate">{mrf.title}</CardTitle>
                                <CardDescription className="text-xs sm:text-sm truncate">
                                  {mrf.id} • {getRequesterName(mrf)} • {mrf.department || "N/A"}
                                </CardDescription>
                              </div>
                              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                                <Badge variant={isHighValue ? "destructive" : "default"} className="text-xs">
                                  {estimatedCost > 0 ? `₦${estimatedCost.toLocaleString()}` : '-'}
                                </Badge>
                                <Badge variant={String(mrf.urgency).toLowerCase() === "high" ? "destructive" : "secondary"} className="text-xs">
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

                            {/* Invoice/PFI Access */}
                            {getPFIUrl(mrf) && (
                              <div className="flex flex-col gap-2 p-3 bg-info/5 border border-info/20 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-info" />
                                  <span className="text-sm font-medium">Supporting Document Submitted by Staff</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleDownloadPFI(mrf)}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    View Invoice
                                  </Button>
                                  {(() => {
                                    const shareUrl = (mrf as any).invoice_onedrive_url || 
                                                    (mrf as any).invoiceOneDriveUrl ||
                                                    mrf.pfi_share_url || 
                                                    mrf.pfiShareUrl;
                                    return shareUrl && (
                                      <OneDriveLink 
                                        webUrl={shareUrl} 
                                        fileName="Supporting Document"
                                        variant="badge"
                                      />
                                    );
                                  })()}
                                </div>
                              </div>
                            )}

                            {isHighValue && (
                              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                                <div className="flex gap-2">
                                  <AlertCircle className="h-5 w-5 text-warning" />
                                  <p className="text-sm">
                                    High value item - Will require Chairman approval after your review
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* View Details Button */}
                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  setSelectedMRFForDetails(mrf);
                                  setMrfDetailsDialogOpen(true);
                                  setLoadingFullDetails(true);
                                  try {
                                    const response = await mrfApi.getFullDetails(mrf.id);
                                    if (response.success && response.data) {
                                      setMrfFullDetails(response.data);
                                    }
                                  } catch (error) {
                                    toast.error("Failed to load MRF details");
                                  } finally {
                                    setLoadingFullDetails(false);
                                  }
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                            </div>

                            {selectedMRF === mrf.id ? (
                              <>
                                <ExecutiveActionButtons
                                  mrf={mrf}
                                  onApprove={handleApprove}
                                  onReject={handleReject}
                                  comments={comments[mrf.id] || ""}
                                  onCommentsChange={(value) => setComments(prev => ({ ...prev, [mrf.id]: value }))}
                                  isLoading={isActionLoading}
                                />
                                  <Button 
                                    onClick={() => setSelectedMRF(null)}
                                    variant="outline"
                                    disabled={isActionLoading}
                                  className="mt-2"
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
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">All Material Requisition Forms</CardTitle>
                <CardDescription className="text-xs sm:text-sm">View all MRFs including approved, processed, and completed</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : mrfRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No MRFs found</p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {mrfRequests.map((mrf) => {
                      const estimatedCost = getEstimatedCost(mrf);

                      return (
                        <Card key={mrf.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">{mrf.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {mrf.id} • {getRequesterName(mrf)} • {mrf.department || "N/A"}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {formatMRFDate(getDate(mrf))}
                                  </span>
                                  <span className="text-xs font-medium">
                                    {estimatedCost > 0 ? `₦${estimatedCost.toLocaleString()}` : '-'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge>{mrf.status}</Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    setSelectedMRFForDetails(mrf);
                                    setMrfDetailsDialogOpen(true);
                                    setLoadingFullDetails(true);
                                    try {
                                      const response = await mrfApi.getFullDetails(mrf.id);
                                      if (response.success && response.data) {
                                        setMrfFullDetails(response.data);
                                      }
                                    } catch (error) {
                                      toast.error("Failed to load MRF details");
                                    } finally {
                                      setLoadingFullDetails(false);
                                    }
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View Details
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Recent Activities */}
        <RecentActivities limit={10} />
      </div>
      </PullToRefresh>

      {/* MRF Details Dialog */}
      <Dialog open={mrfDetailsDialogOpen} onOpenChange={setMrfDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>MRF Details - {selectedMRFForDetails?.id}</DialogTitle>
            <DialogDescription>{selectedMRFForDetails?.title}</DialogDescription>
          </DialogHeader>
          {loadingFullDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : selectedMRFForDetails && (
            <div className="space-y-6 mt-4">
              {/* Progress Tracker */}
              {mrfFullDetails && (
                <MRFProgressTracker mrfId={selectedMRFForDetails.id} />
              )}

              {/* MRF Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">MRF ID</Label>
                  <p className="font-medium">{selectedMRFForDetails.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge>{selectedMRFForDetails.status}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{selectedMRFForDetails.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Urgency</Label>
                  <p className="font-medium">{selectedMRFForDetails.urgency}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quantity</Label>
                  <p className="font-medium">{selectedMRFForDetails.quantity}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Estimated Cost</Label>
                  <p className="font-medium">₦{getEstimatedCost(selectedMRFForDetails).toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="font-medium">{selectedMRFForDetails.description}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Justification</Label>
                  <p className="font-medium">{selectedMRFForDetails.justification}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ExecutiveDashboard;