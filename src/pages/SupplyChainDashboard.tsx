import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Upload, Download, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PORejectionDialog } from "@/components/PORejectionDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import { ProcurementProgressTracker } from "@/components/ProcurementProgressTracker";
import VendorRegistrationsList from "@/components/VendorRegistrationsList";
import { mrfApi } from "@/services/api";
import type { MRF } from "@/types";
import { OneDriveLink } from "@/components/OneDriveLink";
import { SupplyChainActionButtons } from "@/components/SupplyChainActionButtons";

const SupplyChainDashboard = () => {
  const { user } = useAuth();
  const [mrfRequests, setMrfRequests] = useState<MRF[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedMRFForRejection, setSelectedMRFForRejection] = useState<MRF | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [signedPOs, setSignedPOs] = useState<{ [key: string]: File | null }>({});

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

  const getPONumber = (mrf: MRF) => {
    return mrf.po_number || mrf.poNumber || "N/A";
  };

  const getUnsignedPOUrl = (mrf: MRF) => {
    return mrf.unsigned_po_url || mrf.unsignedPOUrl;
  };

  const getSignedPOUrl = (mrf: MRF) => {
    return mrf.signed_po_url || mrf.signedPOUrl;
  };

  const getPFIUrl = (mrf: MRF) => {
    return mrf.pfi_share_url || mrf.pfiShareUrl || mrf.pfi_url || mrf.pfiUrl;
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

  const getUnsignedPOShareUrl = (mrf: MRF) => {
    return mrf.unsigned_po_share_url || mrf.unsignedPOShareUrl || getUnsignedPOUrl(mrf);
  };

  const getSignedPOShareUrl = (mrf: MRF) => {
    return mrf.signed_po_share_url || mrf.signedPOShareUrl || getSignedPOUrl(mrf);
  };

  const getPOVersion = (mrf: MRF) => {
    return mrf.po_version || mrf.poVersion || 1;
  };

  // Filter MRFs at supply chain stage with PO uploaded by Procurement
  const pendingPOs = useMemo(() => {
    return mrfRequests.filter(mrf => {
      const stage = (mrf.current_stage || mrf.currentStage || "").toLowerCase();
      const unsignedUrl = getUnsignedPOUrl(mrf);
      const signedUrl = getSignedPOUrl(mrf);
      
      return (
        stage === "supply_chain" && 
        unsignedUrl &&      // PO already uploaded by Procurement
        !signedUrl          // Not yet signed
      );
    });
  }, [mrfRequests]);

  const handleUploadSignedPO = async (mrfId: string) => {
    const file = signedPOs[mrfId];
    if (!file) {
      toast.error("Please select a signed PO file");
      return;
    }

    // Check available actions from backend before proceeding
    try {
      const response = await mrfApi.getAvailableActions(mrfId);
      if (response.success && response.data) {
        // Verify we can upload signed PO (check if unsigned PO exists)
        const mrf = mrfRequests.find(m => m.id === mrfId);
        if (!mrf || (!mrf.unsigned_po_url && !mrf.unsignedPOUrl)) {
          toast.error("PO document not available for signing");
          return;
        }
      } else {
        toast.error("Could not verify permissions. Please try again.");
        return;
      }
    } catch (error) {
      toast.error("Failed to check permissions. Please try again.");
      return;
    }

    setActionLoading(mrfId);

    try {
      // Call the real backend API endpoint
      const response = await mrfApi.uploadSignedPO(mrfId, file);
      
      if (response.success) {
        toast.success("Signed PO uploaded successfully - Forwarded to Finance for payment processing");
        setSignedPOs(prev => ({ ...prev, [mrfId]: null }));
        await fetchMRFs();
      } else {
        toast.error(response.error || "Failed to upload signed PO");
      }
    } catch (error) {
      toast.error("Failed to connect to server");
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileChange = (mrfId: string, file: File | null) => {
    setSignedPOs(prev => ({ ...prev, [mrfId]: file }));
  };

  const handleDownloadPO = (mrf: MRF) => {
    // Download the unsigned PO uploaded by Procurement
    const poShareUrl = getUnsignedPOShareUrl(mrf);
    const poUrl = getUnsignedPOUrl(mrf);
    const poUrlToUse = poShareUrl || poUrl;
    
    if (poUrlToUse) {
      // If it's a full URL (OneDrive share URL or full URL), open it directly
      if (poUrlToUse.startsWith('http')) {
        window.open(poUrlToUse, '_blank');
      } else {
        // Assume it's a relative path from the backend
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://supply-chain-backend-hwh6.onrender.com/api';
        window.open(`${baseUrl.replace('/api', '')}/${poUrlToUse}`, '_blank');
      }
    } else {
      toast.error("PO document not available for download");
    }
  };

  const handleRejectPO = async (reason: string, comments: string) => {
    if (!selectedMRFForRejection) return;

    // Check available actions from backend before proceeding
    try {
      const response = await mrfApi.getAvailableActions(selectedMRFForRejection.id);
      if (response.success && response.data) {
        // Verify we can reject PO (check if unsigned PO exists)
        if (!selectedMRFForRejection.unsigned_po_url && !selectedMRFForRejection.unsignedPOUrl) {
          toast.error("PO document not available for rejection");
          setRejectDialogOpen(false);
          setSelectedMRFForRejection(null);
          return;
        }
      } else {
        toast.error("Could not verify permissions. Please try again.");
        setRejectDialogOpen(false);
        setSelectedMRFForRejection(null);
        return;
      }
    } catch (error) {
      toast.error("Failed to check permissions. Please try again.");
      setRejectDialogOpen(false);
      setSelectedMRFForRejection(null);
      return;
    }

    setActionLoading(selectedMRFForRejection.id);

    try {
      // Call the real backend API endpoint
      const response = await mrfApi.rejectPO(selectedMRFForRejection.id, reason, comments);
      
      if (response.success) {
        const poNumber = getPONumber(selectedMRFForRejection);
        toast.error(`PO ${poNumber} rejected - Sent back to Procurement for revision`);
        setRejectDialogOpen(false);
        setSelectedMRFForRejection(null);
        await fetchMRFs();
      } else {
        toast.error(response.error || "Failed to reject PO");
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
            <h1 className="text-3xl font-bold text-foreground">Supply Chain Director Dashboard</h1>
            <p className="text-muted-foreground">Review, sign and upload Purchase Orders</p>
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
        <DashboardAlerts userRole="supply_chain" maxAlerts={5} />

        {/* Summary Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending POs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPOs.length}</div>
            <p className="text-xs text-muted-foreground">POs awaiting review and signature</p>
          </CardContent>
        </Card>

        {/* Vendor Registrations Section */}
        <VendorRegistrationsList 
          maxItems={3} 
          showTabs={false} 
          title="Pending Vendor Registrations"
        />

        {/* Progress Tracker */}
        <ProcurementProgressTracker mrfRequests={mrfRequests.map(mrf => ({
          id: mrf.id,
          title: mrf.title,
          category: mrf.category || "",
          description: mrf.description || "",
          quantity: String(mrf.quantity || ""),
          estimatedCost: String(mrf.estimated_cost || mrf.estimatedCost || ""),
          urgency: mrf.urgency || "medium",
          justification: mrf.justification || "",
          status: mrf.status,
          date: mrf.created_at || mrf.date || "",
          requester: mrf.requester_name || mrf.requester || "",
          currentStage: (mrf.current_stage || mrf.currentStage) as any,
          poNumber: mrf.po_number || mrf.poNumber,
          unsignedPOUrl: mrf.unsigned_po_url || mrf.unsignedPOUrl,
          signedPOUrl: mrf.signed_po_url || mrf.signedPOUrl,
        }))} />

        {/* PO Management */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders</CardTitle>
            <CardDescription>Review, sign, and upload Purchase Orders from Procurement</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingPOs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No POs pending processing</p>
                <p className="text-xs mt-2">All POs have been reviewed</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPOs.map((mrf) => {
                  const estimatedCost = getEstimatedCost(mrf);
                  const poNumber = getPONumber(mrf);
                  const poVersion = getPOVersion(mrf);
                  const isActionLoading = actionLoading === mrf.id;

                  return (
                    <Card key={mrf.id} className="border-l-4 border-l-primary">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{mrf.title}</CardTitle>
                            <CardDescription>
                              {mrf.id} • {getRequesterName(mrf)} • {mrf.department || "N/A"}
                            </CardDescription>
                          </div>
                          <Badge>₦{estimatedCost.toLocaleString()}</Badge>
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
                          <div>
                            <p className="font-semibold">PO Number:</p>
                            <p className="text-muted-foreground font-mono">
                              {poNumber}
                              {poVersion > 1 && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  v{poVersion} (Resubmitted)
                                </Badge>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold">Status:</p>
                            <Badge variant="outline">{mrf.status}</Badge>
                          </div>
                          <div className="md:col-span-2">
                            <p className="font-semibold">Description:</p>
                            <p className="text-muted-foreground">{mrf.description}</p>
                          </div>
                        </div>

                        {/* Invoice/PFI Access */}
                        {getPFIUrl(mrf) && (
                          <div className="flex flex-col gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Invoice/PFI Submitted by Staff</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleDownloadPFI(mrf)}
                                className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                View Invoice
                              </Button>
                              {(mrf.pfi_share_url || mrf.pfiShareUrl) && (
                                <OneDriveLink 
                                  webUrl={mrf.pfi_share_url || mrf.pfiShareUrl} 
                                  fileName="Invoice"
                                  variant="badge"
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Download unsigned PO */}
                        <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm flex-1">PO uploaded by Procurement Manager</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDownloadPO(mrf)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download PO
                            </Button>
                            {getUnsignedPOShareUrl(mrf) && (
                              <OneDriveLink 
                                webUrl={getUnsignedPOShareUrl(mrf)} 
                                fileName={`PO-${getPONumber(mrf)}.pdf`}
                                variant="badge"
                              />
                            )}
                          </div>
                        </div>

                        {/* Upload signed PO - Uses available actions */}
                        <SupplyChainActionButtons
                          mrf={mrf}
                          onUploadSignedPO={handleUploadSignedPO}
                          onRejectPO={() => {
                            setSelectedMRFForRejection(mrf);
                            setRejectDialogOpen(true);
                          }}
                          signedPOFile={signedPOs[mrf.id] || null}
                          onFileChange={(file) => handleFileChange(mrf.id, file)}
                          isLoading={isActionLoading}
                        />
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

      {/* PO Rejection Dialog */}
      <PORejectionDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        mrfTitle={selectedMRFForRejection?.title || ""}
        poNumber={getPONumber(selectedMRFForRejection || {} as MRF)}
        onReject={handleRejectPO}
      />
    </DashboardLayout>
  );
};

export default SupplyChainDashboard;