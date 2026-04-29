import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Upload,
  Download,
  CheckCircle,
  Loader2,
  RefreshCw,
  Eye,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  formatAmount,
  formatDays,
  displayString,
} from "@/utils/normalizeQuotation";
import { PORejectionDialog } from "@/components/PORejectionDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import VendorRegistrationsList from "@/components/VendorRegistrationsList";
import { mrfApi } from "@/services/api";
import { getPendingVendorRegistrations } from "@/services/pendingVendorRegistrations";
import type { VendorRegistration } from "@/types";
import type { MRF } from "@/types";
import { OneDriveLink } from "@/components/OneDriveLink";
import { SupplyChainActionButtons } from "@/components/SupplyChainActionButtons";
import { SupplyChainVendorApprovalButtons } from "@/components/SupplyChainVendorApprovalButtons";
import { MRFProgressTracker } from "@/components/MRFProgressTracker";
import { MRFApprovalDialog } from "@/components/MRFApprovalDialog";

const SupplyChainDashboard = () => {
  const { user } = useAuth();
  const [mrfRequests, setMrfRequests] = useState<MRF[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedMRFForRejection, setSelectedMRFForRejection] =
    useState<MRF | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [signedPOs, setSignedPOs] = useState<{ [key: string]: File | null }>(
    {},
  );
  const [quotationDetailsDialogOpen, setQuotationDetailsDialogOpen] =
    useState(false);
  const [mrfDetailsDialogOpen, setMrfDetailsDialogOpen] = useState(false);
  const [selectedMRFForDetails, setSelectedMRFForDetails] =
    useState<MRF | null>(null);
  const [mrfFullDetails, setMrfFullDetails] = useState<any | null>(null);
  const [loadingFullDetails, setLoadingFullDetails] = useState(false);
  const [vendorRegistrations, setVendorRegistrations] = useState<
    VendorRegistration[]
  >([]);
  const [vendorRegistrationsLoading, setVendorRegistrationsLoading] =
    useState(true);

  // Non-Emerald contract: Supply Chain Director first approval (MRF approval)
  const [mrfForFirstApproval, setMrfForFirstApproval] = useState<MRF | null>(
    null,
  );
  const [firstApprovalDialogOpen, setFirstApprovalDialogOpen] = useState(false);

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

  useEffect(() => {
    const fetchVendorRegistrations = async () => {
      setVendorRegistrationsLoading(true);
      try {
        const response = await getPendingVendorRegistrations();
        if (response.success && response.data) {
          setVendorRegistrations(response.data);
        }
      } catch (error) {
        // Silent fail - vendor registrations are supplementary
      } finally {
        setVendorRegistrationsLoading(false);
      }
    };
    fetchVendorRegistrations();
  }, []);

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
      if (pfiUrl.startsWith("http")) {
        window.open(pfiUrl, "_blank");
      } else {
        const baseUrl =
          import.meta.env.VITE_API_BASE_URL ||
          "https://supply-chain-backend-hwh6.onrender.com/api";
        window.open(`${baseUrl.replace("/api", "")}/${pfiUrl}`, "_blank");
      }
    }
  };

  const getUnsignedPOShareUrl = (mrf: MRF) => {
    return (
      mrf.unsigned_po_share_url ||
      mrf.unsignedPOShareUrl ||
      getUnsignedPOUrl(mrf)
    );
  };

  const getSignedPOShareUrl = (mrf: MRF) => {
    return (
      mrf.signed_po_share_url || mrf.signedPOShareUrl || getSignedPOUrl(mrf)
    );
  };

  const getPOVersion = (mrf: MRF) => {
    return mrf.po_version || mrf.poVersion || 1;
  };

  // Get workflow state helper
  const getWorkflowState = (mrf: MRF) => {
    return (mrf.workflow_state || mrf.workflowState || "").toLowerCase();
  };

  const getMRFContractType = (mrf: MRF): string => {
    const ct = (mrf as any).contract_type || (mrf as any).contractType || "";
    return typeof ct === "string" ? ct : String(ct || "");
  };

  const isEmeraldContract = (mrf: MRF): boolean => {
    return getMRFContractType(mrf).toLowerCase().includes("emerald");
  };

  const getCurrentStage = (mrf: MRF): string => {
    return (mrf.current_stage || mrf.currentStage || "").toLowerCase();
  };

  // Non-Emerald contract: Supply Chain Director first approval
  const pendingFirstApprovals = useMemo(() => {
    return mrfRequests.filter((mrf) => {
      if (isEmeraldContract(mrf)) return false;
      const stage = getCurrentStage(mrf);
      const workflowState = getWorkflowState(mrf);
      return (
        stage === "director_review" ||
        stage === "supply_chain_director_review" ||
        workflowState === "supply_chain_director_review"
      );
    });
  }, [mrfRequests]);

  // Final approval: SCD approves vendor selection/quotes before PO generation
  const pendingFinalApprovals = useMemo(() => {
    return mrfRequests.filter((mrf) => {
      const stage = getCurrentStage(mrf);
      return stage === "final_approval";
    });
  }, [mrfRequests]);

  const pendingVendorApprovals = useMemo(() => {
    return mrfRequests.filter((mrf) => {
      const workflowState = getWorkflowState(mrf);
      // Vendor selected by Procurement, awaiting Supply Chain Director approval
      return (
        workflowState === "vendor_selected" ||
        workflowState === "invoice_received"
      );
    });
  }, [mrfRequests]);

  // Filter MRFs at supply chain stage with PO uploaded by Procurement (for signing)
  const pendingPOs = useMemo(() => {
    return mrfRequests.filter((mrf) => {
      const stage = (mrf.current_stage || mrf.currentStage || "").toLowerCase();
      const workflowState = getWorkflowState(mrf);
      const unsignedUrl = getUnsignedPOUrl(mrf);
      const signedUrl = getSignedPOUrl(mrf);

      return (
        (stage === "supply_chain" || workflowState === "po_generated") &&
        unsignedUrl && // PO already uploaded by Procurement
        !signedUrl // Not yet signed
      );
    });
  }, [mrfRequests]);

  const handleFirstApprovalApprove = async (remarks: string) => {
    const target = mrfForFirstApproval;
    if (!target) return;

    const mrfId = target.id;
    setActionLoading(mrfId);
    try {
      const response = await mrfApi.supplyChainDirectorApprove(mrfId, remarks);
      if (response.success) {
        toast.success("MRF approved - routed to Procurement");
      } else {
        toast.error(response.error || "Failed to approve MRF");
      }
    } catch (error) {
      toast.error("Failed to connect to server");
    } finally {
      setActionLoading(null);
      setFirstApprovalDialogOpen(false);
      setMrfForFirstApproval(null);
      await fetchMRFs();
    }
  };

  const handleFirstApprovalReject = async (reason: string) => {
    const target = mrfForFirstApproval;
    if (!target) return;

    const mrfId = target.id;
    setActionLoading(mrfId);
    try {
      const response = await mrfApi.supplyChainDirectorReject(mrfId, reason);
      if (response.success) {
        toast.error("MRF rejected - sent back to requester");
      } else {
        toast.error(response.error || "Failed to reject MRF");
      }
    } catch (error) {
      toast.error("Failed to connect to server");
    } finally {
      setActionLoading(null);
      setFirstApprovalDialogOpen(false);
      setMrfForFirstApproval(null);
      await fetchMRFs();
    }
  };

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
        const mrf = mrfRequests.find((m) => m.id === mrfId);
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
        toast.success(
          "Signed PO uploaded successfully - Forwarded to Finance for payment processing",
        );
        setSignedPOs((prev) => ({ ...prev, [mrfId]: null }));
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
    setSignedPOs((prev) => ({ ...prev, [mrfId]: file }));
  };

  const handleDownloadPO = (mrf: MRF) => {
    // Download the unsigned PO uploaded by Procurement
    const poShareUrl = getUnsignedPOShareUrl(mrf);
    const poUrl = getUnsignedPOUrl(mrf);
    const poUrlToUse = poShareUrl || poUrl;

    if (poUrlToUse) {
      // If it's a full URL (OneDrive share URL or full URL), open it directly
      if (poUrlToUse.startsWith("http")) {
        window.open(poUrlToUse, "_blank");
      } else {
        // Assume it's a relative path from the backend
        const baseUrl =
          import.meta.env.VITE_API_BASE_URL ||
          "https://supply-chain-backend-hwh6.onrender.com/api";
        window.open(`${baseUrl.replace("/api", "")}/${poUrlToUse}`, "_blank");
      }
    } else {
      toast.error("PO document not available for download");
    }
  };

  // Handle reject vendor selection or PO
  const handleRejectPO = async (reason: string, comments: string) => {
    if (!selectedMRFForRejection) return;

    const workflowState = getWorkflowState(selectedMRFForRejection);
    const isVendorRejection =
      workflowState === "vendor_selected" ||
      workflowState === "invoice_received";
    const isPORejection =
      selectedMRFForRejection.unsigned_po_url ||
      selectedMRFForRejection.unsignedPOUrl;

    setActionLoading(selectedMRFForRejection.id);

    try {
      if (isVendorRejection) {
        // Reject vendor selection
        const response = await mrfApi.rejectVendorSelection(
          selectedMRFForRejection.id,
          reason,
          comments,
        );

        if (response.success) {
          toast.error(`Vendor selection rejected - Sent back to Procurement`);
          setRejectDialogOpen(false);
          setSelectedMRFForRejection(null);
          await fetchMRFs();
        } else {
          toast.error(response.error || "Failed to reject vendor selection");
        }
      } else if (isPORejection) {
        // Reject PO
        const response = await mrfApi.rejectPO(
          selectedMRFForRejection.id,
          reason,
          comments,
        );

        if (response.success) {
          const poNumber = getPONumber(selectedMRFForRejection);
          toast.error(
            `PO ${poNumber} rejected - Sent back to Procurement for revision`,
          );
          setRejectDialogOpen(false);
          setSelectedMRFForRejection(null);
          await fetchMRFs();
        } else {
          toast.error(response.error || "Failed to reject PO");
        }
      } else {
        toast.error("Cannot determine rejection type");
      }
    } catch (error) {
      toast.error("Failed to connect to server");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DashboardLayout>
      <PullToRefresh
        onRefresh={async () => {
          toast.info("Refreshing data...");
          await fetchMRFs();
          toast.success("Data refreshed");
        }}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Supply Chain Director Dashboard
              </h1>
              <p className="text-muted-foreground">
                Review, sign and upload Purchase Orders
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMRFs}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {/* Dashboard Alerts */}
          <DashboardAlerts userRole="supply_chain" maxAlerts={5} />

          {/* Tabs: Action Items vs All Requests */}
          <Tabs defaultValue="action-items" className="space-y-4">
            <TabsList>
              <TabsTrigger value="action-items">Action Items</TabsTrigger>
              <TabsTrigger value="all-requests">All Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="action-items" className="space-y-6">
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Vendor Selections
                    </CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {pendingVendorApprovals.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Awaiting approval
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Pending POs
                    </CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {pendingPOs.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      POs awaiting review and signature
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Vendor Registrations Section */}
              <VendorRegistrationsList
                maxItems={3}
                showTabs={false}
                title="Pending Vendor Registrations"
                externalRegistrations={vendorRegistrations}
                externalLoading={vendorRegistrationsLoading}
              />

              {/* Non-Emerald First Approvals (Supply Chain Director approves MRF first) */}
              {pendingFirstApprovals.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      MRFs Awaiting Supply Chain Director First Approval
                    </CardTitle>
                    <CardDescription>
                      Non-Emerald contracts move to Procurement only after this
                      step is approved
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {pendingFirstApprovals.map((mrf) => {
                        const estimatedCost = getEstimatedCost(mrf);
                        const isActionLoading = actionLoading === mrf.id;
                        return (
                          <Card
                            key={mrf.id}
                            className="border-l-4 border-l-primary"
                          >
                            <CardHeader className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <CardTitle className="text-base truncate">
                                    {mrf.title}
                                  </CardTitle>
                                  <CardDescription className="text-xs truncate">
                                    {mrf.id} • {getRequesterName(mrf)} •{" "}
                                    {mrf.department || "N/A"}
                                  </CardDescription>
                                </div>
                                <Badge>₦{estimatedCost.toLocaleString()}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                                <p className="text-sm font-medium text-primary">
                                  First Approval: Supply Chain Director
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Contract Type:{" "}
                                  {getMRFContractType(mrf) || "N/A"}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isActionLoading}
                                  className="flex-1"
                                  onClick={() => {
                                    setMrfForFirstApproval(mrf);
                                    setFirstApprovalDialogOpen(true);
                                  }}
                                >
                                  Review & Approve / Reject
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Vendor Selections Pending Approval */}
              {pendingVendorApprovals.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Vendor Selections Pending Approval</CardTitle>
                    <CardDescription>
                      Review and approve Procurement's vendor selections from
                      RFQ responses before PO generation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {pendingVendorApprovals.map((mrf) => {
                        const estimatedCost = getEstimatedCost(mrf);
                        const isActionLoading = actionLoading === mrf.id;

                        return (
                          <Card
                            key={mrf.id}
                            className="border-l-4 border-l-amber-500"
                          >
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="text-lg">
                                    {mrf.title}
                                  </CardTitle>
                                  <CardDescription>
                                    {mrf.id} • {getRequesterName(mrf)} •{" "}
                                    {mrf.department || "N/A"}
                                  </CardDescription>
                                </div>
                                <Badge>₦{estimatedCost.toLocaleString()}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="font-semibold">Category:</p>
                                  <p className="text-muted-foreground">
                                    {mrf.category}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold">Quantity:</p>
                                  <p className="text-muted-foreground">
                                    {mrf.quantity}
                                  </p>
                                </div>
                                <div className="md:col-span-2">
                                  <p className="font-semibold">Description:</p>
                                  <p className="text-muted-foreground">
                                    {mrf.description}
                                  </p>
                                </div>
                              </div>

                              {/* Vendor Selection Info */}
                              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                                  Procurement has selected a vendor from RFQ
                                  responses. Review and approve to allow PO
                                  generation.
                                </p>
                              </div>

                              {/* View Details and Quotation Details Buttons */}
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    setSelectedMRFForDetails(mrf);
                                    setMrfDetailsDialogOpen(true);
                                    setLoadingFullDetails(true);
                                    try {
                                      const response =
                                        await mrfApi.getFullDetails(mrf.id);
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
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Details
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    setSelectedMRFForDetails(mrf);
                                    setQuotationDetailsDialogOpen(true);
                                    setLoadingFullDetails(true);
                                    try {
                                      const response =
                                        await mrfApi.getFullDetails(mrf.id);
                                      if (response.success && response.data) {
                                        setMrfFullDetails(response.data);
                                      } else {
                                        toast.error(
                                          response.error ||
                                            "Failed to load quotation details. Please try again.",
                                        );
                                        setQuotationDetailsDialogOpen(false);
                                      }
                                    } catch (error: any) {
                                      console.error(
                                        "Error loading quotation details:",
                                        error,
                                      );
                                      toast.error(
                                        error?.message ||
                                          "Failed to load quotation details. Please try again.",
                                      );
                                      setQuotationDetailsDialogOpen(false);
                                    } finally {
                                      setLoadingFullDetails(false);
                                    }
                                  }}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Quotation Details
                                </Button>
                              </div>

                              {/* Action Buttons */}
                              <SupplyChainVendorApprovalButtons
                                mrf={mrf}
                                onApprove={async () => {
                                  setActionLoading(mrf.id);
                                  try {
                                    const response =
                                      await mrfApi.getAvailableActions(mrf.id);
                                    if (
                                      !response.success ||
                                      !response.data?.canApproveInvoice
                                    ) {
                                      toast.error(
                                        "You do not have permission to approve vendor selection at this time",
                                      );
                                      setActionLoading(null);
                                      return;
                                    }
                                    const approveResponse =
                                      await mrfApi.approveVendorSelection(
                                        mrf.id,
                                      );
                                    if (approveResponse.success) {
                                      toast.success(
                                        "Vendor selection approved - Procurement can now generate PO based on the approved RFQ",
                                      );
                                      await fetchMRFs();
                                    } else {
                                      toast.error(
                                        approveResponse.error ||
                                          "Failed to approve vendor selection",
                                      );
                                    }
                                  } catch (error) {
                                    toast.error("Failed to connect to server");
                                  } finally {
                                    setActionLoading(null);
                                  }
                                }}
                                onReject={() => {
                                  setSelectedMRFForRejection(mrf);
                                  setRejectDialogOpen(true);
                                }}
                                isLoading={isActionLoading}
                              />
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Final Approval — SCD approves quotes/vendor selection before PO generation */}
              {pendingFinalApprovals.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Final Quote Approval</CardTitle>
                    <CardDescription>
                      Review vendor quotes and approve before PO generation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {pendingFinalApprovals.map((mrf) => {
                        const estimatedCost = getEstimatedCost(mrf);
                        const isActionLoading = actionLoading === mrf.id;
                        return (
                          <Card
                            key={mrf.id}
                            className="border-l-4 border-l-primary"
                          >
                            <CardHeader className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <CardTitle className="text-base truncate">
                                    {mrf.title}
                                  </CardTitle>
                                  <CardDescription className="text-xs truncate">
                                    {mrf.id} • {getRequesterName(mrf)} •{" "}
                                    {mrf.department || "N/A"}
                                  </CardDescription>
                                </div>
                                <Badge>₦{estimatedCost.toLocaleString()}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                                <p className="text-sm font-medium text-primary">
                                  Final Approval: Review vendor selection before
                                  PO
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Contract Type:{" "}
                                  {getMRFContractType(mrf) || "N/A"}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    setSelectedMRFForDetails(mrf);
                                    setMrfDetailsDialogOpen(true);
                                    setLoadingFullDetails(true);
                                    try {
                                      const response =
                                        await mrfApi.getFullDetails(mrf.id);
                                      if (response.success && response.data) {
                                        setMrfFullDetails(response.data);
                                      }
                                    } catch {
                                      toast.error("Failed to load MRF details");
                                    } finally {
                                      setLoadingFullDetails(false);
                                    }
                                  }}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Details
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={isActionLoading}
                                  onClick={async () => {
                                    setActionLoading(mrf.id);
                                    try {
                                      const response =
                                        await mrfApi.supplyChainFinalApprove(
                                          mrf.id,
                                          "Approved",
                                        );
                                      if (response.success) {
                                        toast.success(
                                          "Final approval granted — Procurement can now generate PO",
                                        );
                                        await fetchMRFs();
                                      } else {
                                        toast.error(
                                          response.error || "Failed to approve",
                                        );
                                      }
                                    } catch {
                                      toast.error(
                                        "Failed to connect to server",
                                      );
                                    } finally {
                                      setActionLoading(null);
                                    }
                                  }}
                                >
                                  {isActionLoading ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                  )}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={isActionLoading}
                                  onClick={() => {
                                    setSelectedMRFForRejection(mrf);
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  <Upload className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Purchase Orders</CardTitle>
                  <CardDescription>
                    Review, sign, and upload Purchase Orders from Procurement
                  </CardDescription>
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
                          <Card
                            key={mrf.id}
                            className="border-l-4 border-l-primary"
                          >
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="text-lg">
                                    {mrf.title}
                                  </CardTitle>
                                  <CardDescription>
                                    {mrf.id} • {getRequesterName(mrf)} •{" "}
                                    {mrf.department || "N/A"}
                                  </CardDescription>
                                </div>
                                <Badge>₦{estimatedCost.toLocaleString()}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="font-semibold">Category:</p>
                                  <p className="text-muted-foreground">
                                    {mrf.category}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold">Quantity:</p>
                                  <p className="text-muted-foreground">
                                    {mrf.quantity}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold">PO Number:</p>
                                  <p className="text-muted-foreground font-mono">
                                    {poNumber}
                                    {poVersion > 1 && (
                                      <Badge
                                        variant="secondary"
                                        className="ml-2 text-xs"
                                      >
                                        v{poVersion} (Resubmitted)
                                      </Badge>
                                    )}
                                  </p>
                                </div>
                                <div className="md:col-span-2">
                                  <p className="font-semibold">Description:</p>
                                  <p className="text-muted-foreground">
                                    {mrf.description}
                                  </p>
                                </div>
                              </div>

                              {/* Invoice/PFI Access */}
                              {getPFIUrl(mrf) && (
                                <div className="flex flex-col gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                      Invoice/PFI Submitted by Staff
                                    </span>
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
                                        webUrl={
                                          mrf.pfi_share_url || mrf.pfiShareUrl
                                        }
                                        fileName="Invoice"
                                        variant="badge"
                                      />
                                    )}
                                  </div>
                                </div>
                              )}

                              {(mrf.attachmentUrl || mrf.attachment_url || mrf.attachmentShareUrl || mrf.attachment_share_url) && (
                                <div className="mt-3">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Supporting Document</p>
                                  <a
                                    href={mrf.attachmentShareUrl || mrf.attachment_share_url || mrf.attachmentUrl || mrf.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                                  >
                                    <FileText className="h-4 w-4" />
                                    {mrf.attachmentName || mrf.attachment_name || 'Download Attachment'}
                                  </a>
                                </div>
                              )}

                              {/* Download unsigned PO */}
                              <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span className="text-sm flex-1">
                                    PO uploaded by Procurement Manager
                                  </span>
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
                                      const response =
                                        await mrfApi.getFullDetails(mrf.id);
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
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Details
                                </Button>
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
                                onFileChange={(file) =>
                                  handleFileChange(mrf.id, file)
                                }
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
            </TabsContent>

            <TabsContent value="all-requests" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>All MRF Requests</CardTitle>
                  <CardDescription>
                    View all material request forms across all stages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="all-sub" className="space-y-4">
                    <TabsList>
                      <TabsTrigger value="all-sub">
                        All ({mrfRequests.length})
                      </TabsTrigger>
                      <TabsTrigger value="emerald">
                        Emerald (
                        {mrfRequests.filter((m) => isEmeraldContract(m)).length}
                        )
                      </TabsTrigger>
                      <TabsTrigger value="non-emerald">
                        Non-Emerald (
                        {
                          mrfRequests.filter((m) => !isEmeraldContract(m))
                            .length
                        }
                        )
                      </TabsTrigger>
                    </TabsList>

                    {["all-sub", "emerald", "non-emerald"].map((subTab) => (
                      <TabsContent key={subTab} value={subTab}>
                        {loading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          (() => {
                            const filtered =
                              subTab === "all-sub"
                                ? mrfRequests
                                : subTab === "emerald"
                                  ? mrfRequests.filter((m) =>
                                      isEmeraldContract(m),
                                    )
                                  : mrfRequests.filter(
                                      (m) => !isEmeraldContract(m),
                                    );

                            return filtered.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                                <p>No MRF requests found</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {filtered.map((mrf) => {
                                  const estimatedCost = getEstimatedCost(mrf);
                                  const stage = getCurrentStage(mrf);
                                  const workflowState = getWorkflowState(mrf);
                                  return (
                                    <Card
                                      key={mrf.id}
                                      className="hover:shadow-md transition-shadow"
                                    >
                                      <CardContent className="p-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold truncate">
                                              {mrf.title}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                              {mrf.id} • {getRequesterName(mrf)}{" "}
                                              • {mrf.department || "N/A"}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                              <span className="text-xs text-muted-foreground">
                                                Contract:{" "}
                                                {getMRFContractType(mrf) ||
                                                  "N/A"}
                                              </span>
                                              <span className="text-xs font-medium">
                                                {estimatedCost > 0
                                                  ? `₦${estimatedCost.toLocaleString()}`
                                                  : "-"}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <Badge>{mrf.status}</Badge>
                                            {mrf.last_action_by_role ===
                                              "supply_chain_director" &&
                                              stage === "procurement_review" &&
                                              !isEmeraldContract(mrf) && (
                                                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300">
                                                  SCD Approved
                                                </Badge>
                                              )}
                                            {mrf.last_action_by_role ===
                                              "executive" &&
                                              workflowState === "rejected" && (
                                                <Badge
                                                  variant="destructive"
                                                  className="flex items-center gap-1"
                                                >
                                                  <XCircle className="h-3 w-3" />
                                                  Executive Rejected
                                                </Badge>
                                              )}
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={async () => {
                                                setSelectedMRFForDetails(mrf);
                                                setMrfDetailsDialogOpen(true);
                                                setLoadingFullDetails(true);
                                                try {
                                                  const response =
                                                    await mrfApi.getFullDetails(
                                                      mrf.id,
                                                    );
                                                  if (
                                                    response.success &&
                                                    response.data
                                                  ) {
                                                    setMrfFullDetails(
                                                      response.data,
                                                    );
                                                  }
                                                } catch {
                                                  toast.error(
                                                    "Failed to load MRF details",
                                                  );
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
                            );
                          })()
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </PullToRefresh>

      {/* PO Rejection Dialog */}
      <PORejectionDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        mrfTitle={selectedMRFForRejection?.title || ""}
        poNumber={getPONumber(selectedMRFForRejection || ({} as MRF))}
        onReject={handleRejectPO}
      />

      {/* MRF First Approval Dialog (Non-Emerald contracts) */}
      <MRFApprovalDialog
        mrf={mrfForFirstApproval}
        open={firstApprovalDialogOpen}
        onOpenChange={(open) => {
          setFirstApprovalDialogOpen(open);
          if (!open) setMrfForFirstApproval(null);
        }}
        onApprove={handleFirstApprovalApprove}
        onReject={handleFirstApprovalReject}
        currentUserRole="supply_chain_director_review"
      />

      {/* Complete Quotation Details Dialog */}
      <Dialog
        open={quotationDetailsDialogOpen}
        onOpenChange={(open) => {
          setQuotationDetailsDialogOpen(open);
          if (!open) {
            setMrfFullDetails(null);
            setSelectedMRFForDetails(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Quotation Details</DialogTitle>
            <DialogDescription>
              Full quotation information for review and approval
            </DialogDescription>
          </DialogHeader>
          {loadingFullDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : mrfFullDetails?.selectedQuotation && selectedMRFForDetails ? (
            <div className="space-y-6 mt-4">
              {/* MRF Details */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 text-blue-900 dark:text-blue-100">
                  MRF Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">MRF ID</Label>
                    <p className="font-medium font-mono">
                      {selectedMRFForDetails.id}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="font-medium">{selectedMRFForDetails.title}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium">
                      {selectedMRFForDetails.category}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Contract Type
                    </Label>
                    <p className="font-medium">
                      {(selectedMRFForDetails as any).contract_type ||
                        (selectedMRFForDetails as any).contractType ||
                        "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Selected Quotation */}
              {mrfFullDetails?.selectedQuotation?.vendor && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-3 text-green-900 dark:text-green-100">
                    Vendor Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">
                        {mrfFullDetails.selectedQuotation.vendor.name ||
                          mrfFullDetails.selectedQuotation.vendor
                            .company_name ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">
                        {mrfFullDetails.selectedQuotation.vendor.email || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="font-medium">
                        {mrfFullDetails.selectedQuotation.vendor.phone || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Rating</Label>
                      <p className="font-medium">
                        {mrfFullDetails.selectedQuotation.vendor.rating ||
                          "N/A"}
                      </p>
                    </div>
                    {mrfFullDetails.selectedQuotation.vendor.address && (
                      <div className="col-span-2">
                        <Label className="text-muted-foreground">Address</Label>
                        <p className="font-medium">
                          {mrfFullDetails.selectedQuotation.vendor.address}
                        </p>
                      </div>
                    )}
                    {mrfFullDetails.selectedQuotation.vendor.contact_person && (
                      <div>
                        <Label className="text-muted-foreground">
                          Contact Person
                        </Label>
                        <p className="font-medium">
                          {
                            mrfFullDetails.selectedQuotation.vendor
                              .contact_person
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quotation Details */}
              <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-purple-900 dark:text-purple-100">
                  Quotation Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">
                      Total Amount
                    </Label>
                    <p className="font-bold text-lg">
                      {formatAmount(
                        mrfFullDetails.selectedQuotation.totalAmount ??
                          mrfFullDetails.selectedQuotation.total_amount ??
                          mrfFullDetails.selectedQuotation.price,
                        mrfFullDetails.selectedQuotation.currency ?? "NGN",
                      )}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Payment Terms
                    </Label>
                    <p className="font-medium">
                      {displayString(
                        mrfFullDetails.selectedQuotation.paymentTerms ??
                          mrfFullDetails.selectedQuotation.payment_terms,
                      )}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Delivery Date
                    </Label>
                    <p className="font-medium">
                      {displayString(
                        mrfFullDetails.selectedQuotation.deliveryDate ??
                          mrfFullDetails.selectedQuotation.delivery_date,
                      )}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Validity Days
                    </Label>
                    <p className="font-medium">
                      {formatDays(
                        mrfFullDetails.selectedQuotation.validityDays ??
                          mrfFullDetails.selectedQuotation.validity_days,
                      )}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Warranty Period
                    </Label>
                    <p className="font-medium">
                      {displayString(
                        mrfFullDetails.selectedQuotation.warrantyPeriod ??
                          mrfFullDetails.selectedQuotation.warranty_period,
                      )}
                    </p>
                  </div>
                  {mrfFullDetails.selectedQuotation.scopeOfWork && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">
                        Scope of Work
                      </Label>
                      <p className="font-medium">
                        {mrfFullDetails.selectedQuotation.scopeOfWork}
                      </p>
                    </div>
                  )}
                  {mrfFullDetails.selectedQuotation.specifications && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">
                        Specifications
                      </Label>
                      <p className="font-medium">
                        {mrfFullDetails.selectedQuotation.specifications}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="font-medium">
                      {displayString(mrfFullDetails.selectedQuotation.notes)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quotation Items */}
              {mrfFullDetails?.selectedQuotation?.quotationItems &&
                Array.isArray(
                  mrfFullDetails.selectedQuotation.quotationItems,
                ) &&
                mrfFullDetails.selectedQuotation.quotationItems.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Quotation Items</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Item</th>
                            <th className="text-right p-2">Qty</th>
                            <th className="text-right p-2">Unit Price</th>
                            <th className="text-right p-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mrfFullDetails.selectedQuotation.quotationItems.map(
                            (item: any, idx: number) => (
                              <tr key={idx} className="border-b">
                                <td className="p-2">
                                  {item.item_name || item.name || "N/A"}
                                </td>
                                <td className="text-right p-2">
                                  {item.quantity || "N/A"}
                                </td>
                                <td className="text-right p-2">
                                  ₦
                                  {parseFloat(
                                    String(item.unit_price || "0"),
                                  ).toLocaleString()}
                                </td>
                                <td className="text-right p-2 font-medium">
                                  ₦
                                  {parseFloat(
                                    String(
                                      (item.quantity || 0) *
                                        (item.unit_price || 0),
                                    ),
                                  ).toLocaleString()}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* Attachments */}
              {mrfFullDetails?.selectedQuotation?.attachments &&
                Array.isArray(mrfFullDetails.selectedQuotation.attachments) &&
                mrfFullDetails.selectedQuotation.attachments.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <h4 className="font-semibold mb-3 text-yellow-900 dark:text-yellow-100">
                      Attachments
                    </h4>
                    <div className="space-y-2">
                      {mrfFullDetails.selectedQuotation.attachments.map(
                        (att: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <a
                              href={att.url || att.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {att.name ||
                                att.filename ||
                                `Attachment ${idx + 1}`}
                            </a>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No quotation details available</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MRF Details Dialog */}
      <Dialog
        open={mrfDetailsDialogOpen}
        onOpenChange={setMrfDetailsDialogOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>MRF Details - {selectedMRFForDetails?.id}</DialogTitle>
            <DialogDescription>
              {selectedMRFForDetails?.title}
            </DialogDescription>
          </DialogHeader>
          {loadingFullDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            selectedMRFForDetails && (
              <div className="space-y-6 mt-4">
                {/* Progress Tracker */}
                {mrfFullDetails && (
                  <MRFProgressTracker
                    mrfId={selectedMRFForDetails.id}
                    contractType={
                      (selectedMRFForDetails as any).contract_type ||
                      (selectedMRFForDetails as any).contractType
                    }
                  />
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
                    <p className="font-medium">
                      {selectedMRFForDetails.category}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Urgency</Label>
                    <p className="font-medium">
                      {selectedMRFForDetails.urgency}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Quantity</Label>
                    <p className="font-medium">
                      {selectedMRFForDetails.quantity}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Estimated Cost
                    </Label>
                    <p className="font-medium">
                      ₦
                      {getEstimatedCost(selectedMRFForDetails).toLocaleString()}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="font-medium">
                      {selectedMRFForDetails.description}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">
                      Justification
                    </Label>
                    <p className="font-medium">
                      {selectedMRFForDetails.justification}
                    </p>
                  </div>
                </div>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SupplyChainDashboard;
