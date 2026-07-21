import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getDisplayId, getMrfApiId } from "@/utils/displayId";
import { LineItemPnLSection } from "@/components/LineItemPnLSection";
import { getSrfRequesterDisplayName } from "@/utils/srfRequester";
import { getWorkflowStageLabel } from "@/utils/workflowStageLabels";
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
  Users,
  Truck,
  ClipboardList,
  ShoppingCart,
  Building2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatMRFDate } from "@/utils/dateUtils";
import {
  formatAmount,
  formatDays,
  displayString,
} from "@/utils/normalizeQuotation";
import { normalizeAttachments } from "@/utils/attachments";
import { PORejectionDialog } from "@/components/PORejectionDialog";
import { PriceComparisonTable } from "@/components/PriceComparisonTable";
import { getRejectionReason } from "@/utils/poHelpers";
import { useScmAppRefreshListener } from "@/hooks/useScmAppRefreshListener";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import VendorRegistrationsList from "@/components/VendorRegistrationsList";
import { authApi, mrfApi, vendorApi, dashboardApi, srfApi, tripRequestApi } from "@/services/api";
import { fetchDashboardMrfs } from "@/utils/fetchDashboardMrfs";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { queryKeys } from "@/lib/queryKeys";
import { WORKFLOW_QUERY_OPTIONS } from "@/lib/queryOptions";
import { procurementApi } from "@/services/procurementApi";
import { buildEmeraldPoDisplayModel, coercePOTermsMode, userClausesFromStoredCustomTerms } from "@/utils/emeraldPoDocumentModel";
import { buildEmeraldPurchaseOrderPdf } from "@/utils/emeraldPOPdf";
import { ViewPoDocumentsButton } from "@/components/procurement/ViewPoDocumentsButton";
import { resolveUserSignatureDataUrl, readCachedUserSignature } from "@/utils/userSignature";
import { getPendingVendorRegistrations } from "@/services/pendingVendorRegistrations";
import type { VendorRegistration } from "@/types";
import type { MRF, SRF } from "@/types";
import { OneDriveLink } from "@/components/OneDriveLink";
import { SupplyChainActionButtons } from "@/components/SupplyChainActionButtons";
import { SupplyChainVendorApprovalButtons } from "@/components/SupplyChainVendorApprovalButtons";
import { MRFProgressTracker } from "@/components/MRFProgressTracker";
import { MRFApprovalDialog } from "@/components/MRFApprovalDialog";
import { SRFDirectorApprovalDialog } from "@/components/SRFDirectorApprovalDialog";
import {
  bucketScdMrfs,
} from "@/utils/mrfDashboardBuckets";
import { DashboardSummaryStats } from "@/components/dashboard/DashboardSummaryStats";
import { DashboardMrfHistoryList } from "@/components/dashboard/DashboardMrfHistoryList";

function readStoredUserSignatureUrl(): string | null {
  try {
    const raw =
      localStorage.getItem("userData") || sessionStorage.getItem("userData");
    if (!raw) return null;
    const o = JSON.parse(raw) as {
      signature_url?: string;
      signatureUrl?: string;
    };
    return o.signature_url || o.signatureUrl || null;
  } catch {
    return null;
  }
}

const SupplyChainDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: mrfRequests = [],
    isLoading: loading,
    refetch: fetchMRFs,
  } = useQuery({
    queryKey: queryKeys.dashboard.scdMrfs(),
    queryFn: async () => fetchDashboardMrfs("scd"),
    ...WORKFLOW_QUERY_OPTIONS,
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedMRFForRejection, setSelectedMRFForRejection] =
    useState<MRF | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [signedPOs, setSignedPOs] = useState<{ [key: string]: File | null }>(
    {},
  );
  const [attachSignatureFiles, setAttachSignatureFiles] = useState<{
    [key: string]: File | null;
  }>({});
  const [signaturePresenceTick, setSignaturePresenceTick] = useState(0);
  const [quotationDetailsDialogOpen, setQuotationDetailsDialogOpen] =
    useState(false);
  const [mrfDetailsDialogOpen, setMrfDetailsDialogOpen] = useState(false);
  const [selectedMRFForDetails, setSelectedMRFForDetails] =
    useState<MRF | null>(null);
  const [mrfFullDetails, setMrfFullDetails] = useState<any | null>(null);
  const [loadingFullDetails, setLoadingFullDetails] = useState(false);

  // Debug: log selected quotation (incl. attachments) when it changes
  useEffect(() => {
    if (mrfFullDetails?.selectedQuotation) {
    }
  }, [mrfFullDetails]);
  // (vendor registrations state replaced by useQuery below)

  const [approvingTripId, setApprovingTripId] = useState<string | null>(null);
  const [pendingFilter, setPendingFilter] = useState<
    "all" | "vendors" | "mrf" | "trips" | "srfs" | "pos"
  >("all");
  const [srfForDirectorApproval, setSrfForDirectorApproval] =
    useState<SRF | null>(null);
  const [srfDirectorApprovalOpen, setSrfDirectorApprovalOpen] =
    useState(false);

  // Single React Query owns the entire SCD dashboard payload; the derived
  // slices below (SRFs, trips, stats) are memoized reads, no extra requests.
  const {
    data: scdDashRaw = null,
    isLoading: pendingDirectorSrfsLoading,
    refetch: refetchScdDash,
  } = useQuery<Record<string, unknown> | null>({
    queryKey: queryKeys.dashboard.supplyChainDirectorRaw(),
    queryFn: async () => {
      const res = await dashboardApi.getSupplyChainDirectorDashboard();
      return res.success ? (res.data as Record<string, unknown>) : null;
    },
    ...WORKFLOW_QUERY_OPTIONS,
  });

  const pendingDirectorSrfs = useMemo<SRF[]>(() => {
    const list = scdDashRaw?.srfsAwaitingSupplyChainDirectorApproval;
    return Array.isArray(list) ? (list as SRF[]) : [];
  }, [scdDashRaw]);

  const {
    data: pendingTripApprovalsData = null,
    isLoading: pendingTripApprovalsLoading,
    refetch: refetchPendingTripApprovals,
  } = useQuery<import('@/types/trip-request').TripRequestsListResponse | null>({
    queryKey: ['dashboard', 'pending-trip-approvals'] as const,
    queryFn: async () => {
      const res = await tripRequestApi.listPendingForDirector();
      return res.success && res.data ? res.data : null;
    },
    ...WORKFLOW_QUERY_OPTIONS,
  });

  const pendingTripApprovals = useMemo<any[]>(() => {
    return pendingTripApprovalsData?.trips ?? [];
  }, [pendingTripApprovalsData]);

  const scdDashStats = useMemo(
    () =>
      (scdDashRaw?.stats as { pendingSrfDirectorApprovals?: number } | undefined) ??
      null,
    [scdDashRaw],
  );

  const fetchPendingDirectorSrfs = useCallback(
    () => refetchScdDash().then(() => undefined),
    [refetchScdDash],
  );
  const [mrfForFirstApproval, setMrfForFirstApproval] = useState<MRF | null>(
    null,
  );
  const [firstApprovalDialogOpen, setFirstApprovalDialogOpen] = useState(false);

  const {
    data: vendorRegistrations = [],
    isLoading: vendorRegistrationsLoading,
    refetch: refetchVendorRegistrations,
  } = useQuery<VendorRegistration[]>({
    queryKey: queryKeys.dashboard.pendingVendorRegistrations(),
    queryFn: async () => {
      const response = await getPendingVendorRegistrations();
      return response.success && response.data ? response.data : [];
    },
    ...WORKFLOW_QUERY_OPTIONS,
  });

  const fetchVendorRegistrations = useCallback(
    () => refetchVendorRegistrations().then(() => undefined),
    [refetchVendorRegistrations],
  );

  useScmAppRefreshListener(async () => {
    setSignaturePresenceTick((t) => t + 1);
    await Promise.all([
      fetchMRFs(),
      fetchPendingDirectorSrfs(),
      fetchVendorRegistrations(),
    ]);
  });

  const hasProfileSignature = useMemo(() => {
    void signaturePresenceTick;
    return Boolean(
      user?.signature_url ||
      readStoredUserSignatureUrl() ||
      (user?.id ? readCachedUserSignature(user.id) : null),
    );
  }, [user?.signature_url, user?.id, signaturePresenceTick]);

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

  // Parallel first approval + legacy Supply Chain Director first approval
  const pendingFirstApprovals = useMemo(() => {
    return mrfRequests.filter((mrf) => {
      const stage = getCurrentStage(mrf);
      const workflowState = getWorkflowState(mrf);
      return (
        stage === "parallel_first_approval" ||
        workflowState === "parallel_first_approval" ||
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

  const scdBuckets = useMemo(() => bucketScdMrfs(mrfRequests), [mrfRequests]);

  const scdBucketCounts = useMemo(
    () => ({
      pending: scdBuckets.pending.length,
      approved: scdBuckets.approved.length,
      rejected: scdBuckets.rejected.length,
      completed: scdBuckets.completed.length,
    }),
    [scdBuckets],
  );

  const scdExtraPendingCount =
    pendingDirectorSrfs.length + vendorRegistrations.length;

  const openMrfDetails = useCallback(async (mrf: MRF) => {
    setSelectedMRFForDetails(mrf);
    setMrfFullDetails(null);
    setMrfDetailsDialogOpen(true);
    setLoadingFullDetails(false);
    const apiId = getMrfApiId(mrf);
    try {
      const hydrate = await procurementApi.getMRFDetailsHydrate(apiId);
      if (hydrate.success && hydrate.data) {
        setSelectedMRFForDetails(hydrate.data as MRF);
      }
    } catch {
      // keep row payload
    }
    try {
      setLoadingFullDetails(true);
      const response = await mrfApi.getFullDetails(apiId);
      if (response.success && response.data) {
        setMrfFullDetails(response.data);
      }
    } catch {
      toast.error("Failed to load MRF details");
    } finally {
      setLoadingFullDetails(false);
    }
  }, []);

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

  const handleSrfDirectorApprove = async (remarks: string) => {
    const target = srfForDirectorApproval;
    if (!target) return;
    const srfId = getDisplayId(target) || String(target.id);
    setActionLoading(srfId);
    try {
      const response = await srfApi.supplyChainDirectorApprove(
        srfId,
        remarks,
      );
      if (response.success) {
        toast.success("SRF approved — routed to Procurement");
        window.dispatchEvent(new CustomEvent("app:refresh"));
      } else {
        toast.error(response.error || "Failed to approve SRF");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setActionLoading(null);
      setSrfDirectorApprovalOpen(false);
      setSrfForDirectorApproval(null);
      await fetchPendingDirectorSrfs();
    }
  };

  const handleSrfDirectorReject = async (reason: string) => {
    const target = srfForDirectorApproval;
    if (!target) return;
    const srfId = getDisplayId(target) || String(target.id);
    setActionLoading(srfId);
    try {
      const response = await srfApi.supplyChainDirectorReject(srfId, reason);
      if (response.success) {
        toast.error("SRF rejected — sent back to requester");
        window.dispatchEvent(new CustomEvent("app:refresh"));
      } else {
        toast.error(response.error || "Failed to reject SRF");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setActionLoading(null);
      setSrfDirectorApprovalOpen(false);
      setSrfForDirectorApproval(null);
      await fetchPendingDirectorSrfs();
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

  const handleAttachSignature = async (mrfId: string) => {
    const override = attachSignatureFiles[mrfId] || null;
    setActionLoading(mrfId);
    try {
      const fullRes = await mrfApi.getById(mrfId);
      if (!fullRes.success || !fullRes.data) {
        toast.error(fullRes.error || "Could not load MRF for signing");
        return;
      }
      const fullMrf = fullRes.data;

      const pcRes = await procurementApi.getPriceComparison(mrfId);
      const rows = pcRes.success && pcRes.data ? pcRes.data : [];

      const selectedRow = rows.find(
        (r) => (r as { is_selected?: boolean; isSelected?: boolean }).is_selected
          || (r as { is_selected?: boolean; isSelected?: boolean }).isSelected,
      );
      const vendorId =
        (selectedRow as { vendor_id?: string | number } | undefined)?.vendor_id
        ?? (fullMrf as { selected_vendor_id?: string | number; selectedVendorId?: string | number })
          .selected_vendor_id
        ?? (fullMrf as { selected_vendor_id?: string | number; selectedVendorId?: string | number })
          .selectedVendorId;

      let vendors: import("@/types").Vendor[] = [];
      if (vendorId) {
        const vRes = await vendorApi.getById(String(vendorId));
        if (vRes.success && vRes.data) vendors = [vRes.data];
      } else {
        const vendorsRes = await vendorApi.list({ page: 1, per_page: 25 });
        vendors =
          vendorsRes.success && vendorsRes.data?.items ? vendorsRes.data.items : [];
      }

      let sigDataUrl: string | null = null;
      const me = await authApi.getCurrentUser();
      const signatureUrl =
        (me.data as { signature_url?: string; signatureUrl?: string } | undefined)
          ?.signature_url ||
        (me.data as { signature_url?: string; signatureUrl?: string } | undefined)
          ?.signatureUrl ||
        user?.signature_url ||
        readStoredUserSignatureUrl() ||
        null;
      const userId = me.data?.id ?? user?.id ?? null;

      if (override) {
        if (override.size > 2 * 1024 * 1024) {
          toast.error("Signature image must be 2MB or less.");
          return;
        }
        sigDataUrl = await resolveUserSignatureDataUrl({
          userId,
          overrideFile: override,
        });
      } else {
        sigDataUrl = await resolveUserSignatureDataUrl({
          userId,
          signatureUrl,
        });
      }

      if (!sigDataUrl) {
        toast.error(
          "No signature available. Choose a PNG/JPG above, or upload one in Settings → Digital Signature.",
        );
        return;
      }

      const poType = String(
        (fullMrf as { po_type?: string }).po_type || "goods",
      ) as "goods" | "services" | "logistics";
      let standardTermsBody: string | undefined;
      const termsRes = await procurementApi.getPOTermsTemplate(poType);
      if (termsRes.success && termsRes.data) {
        standardTermsBody =
          termsRes.data.content || termsRes.data.standard_terms || undefined;
      }

      const model = buildEmeraldPoDisplayModel({
        mrf: fullMrf,
        rows,
        vendors,
        standardTermsBody,
        terms_mode: coercePOTermsMode(
          (fullMrf as { terms_mode?: string; termsMode?: string }).terms_mode ??
          (fullMrf as { terms_mode?: string; termsMode?: string }).termsMode,
        ),
        user_terms_text: userClausesFromStoredCustomTerms(
          (fullMrf as { custom_terms?: string; customTerms?: string }).custom_terms ??
          (fullMrf as { custom_terms?: string; customTerms?: string }).customTerms,
        ),
        includeSignature: true,
        signatureDataUrl: sigDataUrl,
      });

      const blob = await buildEmeraldPurchaseOrderPdf(model);
      const poNum = getPONumber(fullMrf);
      const file = new File([blob], `PO-${poNum}-signed.pdf`, {
        type: "application/pdf",
      });

      const response = await mrfApi.uploadSignedPO(mrfId, file);
      if (response.success) {
        toast.success(
          "Signature attached — opening the signed Purchase Order.",
        );
        setAttachSignatureFiles((prev) => ({ ...prev, [mrfId]: null }));
        setSignedPOs((prev) => ({ ...prev, [mrfId]: null }));
        try {
          window.dispatchEvent(new Event("app:refresh"));
        } catch {
          /* ignore */
        }
        // Take the SCD straight to the PO detail view she just signed, where she
        // can immediately download the signed PO PDF (with her signature).
        navigate(`/pos/${encodeURIComponent(mrfId)}?signed=1`);
      } else {
        toast.error(response.error || "Failed to attach signature");
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to attach signature",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileChange = (mrfId: string, file: File | null) => {
    setSignedPOs((prev) => ({ ...prev, [mrfId]: file }));
  };

  const handleDownloadPO = async (mrf: MRF) => {
    const { downloadMrfPurchaseOrderPdf } = await import(
      "@/utils/downloadMrfPurchaseOrderPdf"
    );
    const res = await downloadMrfPurchaseOrderPdf(mrf);
    if (res.success) {
      toast.success("PO download started", {
        description: "Emerald layout via server stream",
      });
      return;
    }
    toast.error(res.error || "PO document not available for download");
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
          await Promise.all([fetchMRFs(), fetchPendingDirectorSrfs()]);
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
              onClick={() => { void fetchMRFs(); }}
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

          <DashboardSummaryStats
            counts={scdBucketCounts}
            extraPending={scdExtraPendingCount}
            extraPendingLabel={`${pendingDirectorSrfs.length} SRF${pendingDirectorSrfs.length !== 1 ? "s" : ""}, ${vendorRegistrations.length} vendor registration${vendorRegistrations.length !== 1 ? "s" : ""}`}
          />

          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="pending">
                Pending
                {(scdBuckets.pending.length + scdExtraPendingCount) > 0 && (
                  <Badge variant="destructive" className="ml-2 text-xs">
                    {scdBuckets.pending.length + scdExtraPendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({scdBuckets.approved.length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({scdBuckets.rejected.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({scdBuckets.completed.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-6">
              {(() => { return null; })()}
              {/* Pending action breakdown — 5 clickable summary cards bound to backend payload keys */}
              {(() => {
                const readCount = (key: string, fallback: number): number => {
                  const raw = scdDashRaw as Record<string, unknown> | null;
                  const stats = (raw?.stats as Record<string, unknown> | undefined) ?? undefined;
                  const candidates = [raw?.[key], stats?.[key]];
                  for (const v of candidates) {
                    if (typeof v === "number") return v;
                    if (Array.isArray(v)) return v.length;
                  }
                  return fallback;
                };
                const cards: Array<{
                  key: "vendors" | "mrf" | "trips" | "srfs" | "pos";
                  label: string;
                  count: number;
                  icon: typeof Users;
                }> = [
                    {
                      key: "vendors",
                      label: "Vendor Registrations",
                      count: readCount("pending_vendor_registrations", vendorRegistrations.length),
                      icon: Building2,
                    },
                    {
                      key: "mrf",
                      label: "MRF First Approvals",
                      count: readCount("pending_mrf_scd_first_approval", pendingFirstApprovals.length),
                      icon: FileText,
                    },
                    {
                      key: "trips",
                      label: "Trip Approvals",
                      count: readCount("pending_trip_approvals", pendingTripApprovals.length),
                      icon: Truck,
                    },
                    {
                      key: "srfs",
                      label: "Service Requests (SRFs)",
                      count: readCount(
                        "pending_srf_scd_approval",
                        scdDashStats?.pendingSrfDirectorApprovals ?? pendingDirectorSrfs.length,
                      ),
                      icon: ClipboardList,
                    },
                    {
                      key: "pos",
                      label: "Purchase Orders",
                      count: readCount("pending_purchase_orders", pendingPOs.length),
                      icon: ShoppingCart,
                    },
                  ];
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm text-muted-foreground">
                        Click a card to filter items awaiting your action.
                      </p>
                      {pendingFilter !== "all" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingFilter("all")}
                        >
                          Show all
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
                      {cards.map(({ key, label, count, icon: Icon }) => {
                        const active = pendingFilter === key;
                        const empty = count === 0;
                        return (
                          <Card
                            key={key}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setPendingFilter(active ? "all" : key)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setPendingFilter(active ? "all" : key);
                              }
                            }}
                            className={`cursor-pointer transition-all hover:shadow-md ${active
                              ? "ring-2 ring-primary border-primary"
                              : ""
                              }`}
                          >
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
                              <CardTitle className="text-xs sm:text-sm font-medium">
                                {label}
                              </CardTitle>
                              <Icon
                                className={`h-4 w-4 ${empty ? "text-success" : "text-muted-foreground"}`}
                              />
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                              <div
                                className={`text-2xl font-bold ${empty ? "text-success" : ""}`}
                              >
                                {empty ? (
                                  <span className="inline-flex items-center gap-1">
                                    <CheckCircle className="h-5 w-5" />
                                    0
                                  </span>
                                ) : (
                                  count
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {empty
                                  ? "0 awaiting approval"
                                  : `${count} awaiting approval`}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Vendor Registrations Section */}
              {(pendingFilter === "all" || pendingFilter === "vendors") && (
                <VendorRegistrationsList
                  maxItems={3}
                  showTabs={false}
                  title="Pending Vendor Registrations"
                  externalRegistrations={vendorRegistrations}
                  externalLoading={vendorRegistrationsLoading}
                />
              )}

              {(pendingFilter === "all" || pendingFilter === "srfs") &&
                !pendingDirectorSrfsLoading &&
                pendingDirectorSrfs.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Service requests awaiting Supply Chain Director
                      </CardTitle>
                      <CardDescription>
                        Pending SRFs at{" "}
                        {getWorkflowStageLabel("supply_chain_director_review")}
                        <span className="font-mono text-xs text-muted-foreground">
                          {" "}
                          (supply_chain_director_review)
                        </span>
                        . Approve or reject here, or open in Procurement for
                        full details and progress.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {pendingDirectorSrfs.map((srf) => {
                          const srfActionId =
                            getDisplayId(srf) || String(srf.id);
                          const isSrfActionLoading =
                            actionLoading === srfActionId;
                          return (
                            <div
                              key={String(srf.id)}
                              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold truncate">
                                  {srf.title}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {getDisplayId(srf)} •{" "}
                                  {getSrfRequesterDisplayName(srf)}{" "}
                                  •{" "}
                                  {formatMRFDate(
                                    srf.createdAt ||
                                    srf.created_at ||
                                    srf.date ||
                                    "",
                                  )}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <Badge variant="secondary">{srf.status}</Badge>
                                <Button
                                  variant="default"
                                  size="sm"
                                  disabled={isSrfActionLoading}
                                  onClick={() => {
                                    setSrfForDirectorApproval(srf);
                                    setSrfDirectorApprovalOpen(true);
                                  }}
                                >
                                  {isSrfActionLoading ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                  )}
                                  Review & Approve / Reject
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isSrfActionLoading}
                                  onClick={() =>
                                    navigate(
                                      `/procurement?tab=srf&srf=${encodeURIComponent(getDisplayId(srf))}`,
                                    )
                                  }
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Open
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

              {(pendingFilter === "all" || pendingFilter === "trips") &&
                pendingTripApprovals.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Pending Trip Approvals</CardTitle>
                      <CardDescription>
                        Staff trip requests awaiting Supervising Director approval. Click a row to review and act.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {pendingTripApprovals.map((t) => {
                          const tid = String(
                            (t.id as string | number | undefined) ?? "",
                          );
                          const code =
                            (t.tripCode as string | undefined) ??
                            (t.trip_code as string | undefined) ??
                            tid;
                          const dest = (t.destination as string | undefined) ?? "—";
                          const requester =
                            (t.requesterName as string | undefined) ??
                            (t.requester_name as string | undefined) ??
                            "Unknown";
                          const dept =
                            (t.requesterDepartment as string | undefined) ??
                            (t.requester_department as string | undefined) ??
                            "";
                          const dep =
                            (t.scheduledDepartureAt as string | undefined) ??
                            (t.scheduled_departure_at as string | undefined);
                          const stageLabel =
                            (t.workflowStageLabel as string | undefined) ??
                            "Pending Director Approval";
                          return (
                            <div
                              key={tid}
                              className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4 hover:bg-accent/40 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold truncate">
                                  {code} — {dest}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {requester}
                                  {dept ? ` • ${dept}` : ""}
                                  {dep ? ` • Departs ${formatMRFDate(dep)}` : ""}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <Badge variant="secondary">{stageLabel}</Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    navigate(`/trip-requests/${encodeURIComponent(tid)}`)
                                  }
                                >
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={approvingTripId === tid}
                                  onClick={async () => {
                                    setApprovingTripId(tid);
                                    const res = await tripRequestApi.directorApprove(tid);
                                    if (res.success) {
                                      toast.success("Trip request approved");
                                      // Optimistically drop the row from the cached
                                      // SCD dashboard payload — avoids a full refetch flicker.
                                      queryClient.setQueryData<Record<string, unknown> | null>(
                                        queryKeys.dashboard.supplyChainDirectorRaw(),
                                        (prev) => {
                                          if (!prev) return prev;
                                          const filterList = (v: unknown) =>
                                            Array.isArray(v)
                                              ? v.filter(
                                                (p) =>
                                                  String(
                                                    ((p as Record<string, unknown>).id as
                                                      | string
                                                      | number
                                                      | undefined) ?? "",
                                                  ) !== tid,
                                              )
                                              : v;
                                          return {
                                            ...prev,
                                            pendingTripApprovals: filterList(prev.pendingTripApprovals),
                                            pending_trip_approvals: filterList(prev.pending_trip_approvals),
                                          };
                                        },
                                      );
                                      void fetchPendingDirectorSrfs();
                                      window.dispatchEvent(new CustomEvent("app:refresh"));
                                    } else {
                                      toast.error(res.error || "Failed to approve trip");
                                    }
                                    setApprovingTripId(null);
                                  }}
                                >
                                  {approvingTripId === tid ? "Approving…" : "Approve"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

              {/* Non-Emerald First Approvals (Supply Chain Director approves MRF first) */}
              {(pendingFilter === "all" || pendingFilter === "mrf") &&
                pendingFirstApprovals.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        MRFs Awaiting Supply Chain Director First Approval
                      </CardTitle>
                      <CardDescription>
                        Parallel with Executive — first approval wins; then Procurement review
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
                                      {getDisplayId(mrf)} • {getRequesterName(mrf)} •{" "}
                                      {mrf.department || "N/A"}
                                    </CardDescription>
                                  </div>
                                  <Badge>₦{estimatedCost.toLocaleString()}</Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                                  <p className="text-sm font-medium text-primary">
                                    First Approval: Supply Chain Director (parallel with Executive)
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
              {(pendingFilter === "all" || pendingFilter === "pos") &&
                pendingVendorApprovals.length > 0 && (
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
                                      {getDisplayId(mrf)} • {getRequesterName(mrf)} •{" "}
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
                                        if ((approveResponse.data as any)?.vendorInvoiceGateOpen) {
                                          toast.info(
                                            "Vendor invoice upload is now unlocked for this MRF (advance payment).",
                                          );
                                        }
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
                                    {getDisplayId(mrf)} • {getRequesterName(mrf)} •{" "}
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

              {(pendingFilter === "all" || pendingFilter === "pos") && (
                <Card>
                  <CardHeader>
                    <CardTitle>Purchase Orders</CardTitle>
                    <CardDescription>
                      Review, sign, and upload Purchase Orders from Procurement
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <TableSkeleton rows={3} />
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
                                      {getDisplayId(mrf)} • {getRequesterName(mrf)} •{" "}
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
                                    <ViewPoDocumentsButton
                                      mrfId={mrf.id}
                                      poNumber={poNumber}
                                      readOnly={false}
                                    />
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
                                  onAttachSignature={handleAttachSignature}
                                  onUploadSignedPO={handleUploadSignedPO}
                                  onRejectPO={() => {
                                    setSelectedMRFForRejection(mrf);
                                    setRejectDialogOpen(true);
                                  }}
                                  signedPOFile={signedPOs[mrf.id] || null}
                                  attachSignatureFile={
                                    attachSignatureFiles[mrf.id] || null
                                  }
                                  onSignedPOFileChange={(file) =>
                                    handleFileChange(mrf.id, file)
                                  }
                                  onAttachSignatureFileChange={(file) =>
                                    setAttachSignatureFiles((prev) => ({
                                      ...prev,
                                      [mrf.id]: file,
                                    }))
                                  }
                                  isLoading={isActionLoading}
                                  hasSavedProfileSignature={hasProfileSignature}
                                />
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Approved Requests</CardTitle>
                  <CardDescription>
                    MRFs approved by Supply Chain Director — newest first
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <TableSkeleton rows={3} />
                  ) : (
                    <DashboardMrfHistoryList
                      mrfs={scdBuckets.approved}
                      variant="approved"
                      role="supply_chain_director"
                      getRequesterName={getRequesterName}
                      getEstimatedCost={getEstimatedCost}
                      onViewDetails={(mrf) => void openMrfDetails(mrf)}
                      emptyMessage="No MRFs approved by Supply Chain Director yet"
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rejected" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Rejected Requests</CardTitle>
                  <CardDescription>
                    MRFs rejected by Supply Chain Director with reason
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <TableSkeleton rows={3} />
                  ) : (
                    <DashboardMrfHistoryList
                      mrfs={scdBuckets.rejected}
                      variant="rejected"
                      role="supply_chain_director"
                      getRequesterName={getRequesterName}
                      getEstimatedCost={getEstimatedCost}
                      onViewDetails={(mrf) => void openMrfDetails(mrf)}
                      emptyMessage="No rejected MRFs"
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recently Completed</CardTitle>
                  <CardDescription>
                    MRFs that reached final completion
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <TableSkeleton rows={3} />
                  ) : (
                    <DashboardMrfHistoryList
                      mrfs={scdBuckets.completed}
                      variant="completed"
                      role="supply_chain_director"
                      getRequesterName={getRequesterName}
                      getEstimatedCost={getEstimatedCost}
                      onViewDetails={(mrf) => void openMrfDetails(mrf)}
                      emptyMessage="No completed MRFs in the current list"
                    />
                  )}
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
        currentUserRole="supply_chain_director"
      />

      <SRFDirectorApprovalDialog
        srf={srfForDirectorApproval}
        open={srfDirectorApprovalOpen}
        onOpenChange={(open) => {
          setSrfDirectorApprovalOpen(open);
          if (!open) setSrfForDirectorApproval(null);
        }}
        onApprove={handleSrfDirectorApprove}
        onReject={handleSrfDirectorReject}
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
              {/* Rejection Reason Callout (visible when PO was returned/rejected) */}
              {(() => {
                const reason =
                  getRejectionReason(mrfFullDetails?.purchaseOrder) ||
                  getRejectionReason(selectedMRFForDetails) ||
                  (selectedMRFForDetails as any)?.po_rejection_reason ||
                  (selectedMRFForDetails as any)?.poRejectionReason;
                if (!reason) return null;
                return (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                    <p className="text-sm font-semibold text-destructive mb-1">
                      Rejection Reason
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-line">
                      {reason}
                    </p>
                  </div>
                );
              })()}

              {/* MRF Details */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 text-blue-900 dark:text-blue-100">
                  MRF Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">MRF ID</Label>
                    <p className="font-medium font-mono">
                      {getDisplayId(selectedMRFForDetails)}
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

              {/* Price Comparison */}
              <PriceComparisonTable
                po={
                  mrfFullDetails?.purchaseOrder ||
                  mrfFullDetails ||
                  selectedMRFForDetails
                }
              />

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
                                  {item.item_name || item.name ? (
                                    item.item_name || item.name
                                  ) : (
                                    <span className="text-muted-foreground italic">Unnamed item</span>
                                  )}
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

              {/* Supporting Documents */}
              {(() => {
                const docs = normalizeAttachments(
                  mrfFullDetails?.selectedQuotation?.attachments,
                );
                if (docs.length === 0) return null;
                return (
                  <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Supporting Documents</h4>
                    <div className="space-y-2">
                      {docs.map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-2 border rounded-md"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="text-sm truncate">{doc.name}</span>
                          </div>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline shrink-0"
                          >
                            View Document
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
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
          {!selectedMRFForDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            (
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
                    <p className="font-medium">{getDisplayId(selectedMRFForDetails)}</p>
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
                <LineItemPnLSection
                  type="mrf"
                  id={getMrfApiId(selectedMRFForDetails)}
                  initialPnL={
                    (selectedMRFForDetails as { profitAndLoss?: import("@/types").ProfitAndLoss })
                      .profitAndLoss ||
                    (mrfFullDetails as { profitAndLoss?: import("@/types").ProfitAndLoss } | null)
                      ?.profitAndLoss ||
                    (mrfFullDetails as { mrf?: { profitAndLoss?: import("@/types").ProfitAndLoss } } | null)
                      ?.mrf?.profitAndLoss
                  }
                />
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SupplyChainDashboard;
