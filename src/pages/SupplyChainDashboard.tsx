import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getDisplayId, getMrfApiId } from "@/utils/displayId";
import { LineItemPnLSection } from "@/components/LineItemPnLSection";
import { getSrfRequesterDisplayName } from "@/utils/srfRequester";
import { getWorkflowStageLabel } from "@/utils/workflowStageLabels";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TripRequestDetailDialog } from "@/components/logistics/TripRequestDetailDialog";
import { TripRequestDialog } from "@/components/logistics/TripRequestDialog";
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
import {
  authApi,
  mrfApi,
  vendorApi,
  dashboardApi,
  srfApi,
  tripRequestApi,
} from "@/services/api";
import {
  canScdApprove,
  isTripAwaitingDirectorApproval,
  tripStatusPlainLabel,
  resolveTripDisplayStatus,
  markTripDirectorApproved,
} from "@/utils/tripApprovalState";
import {
  resolveTripWorkflowError,
  isStaleTripStateError,
} from "@/utils/tripApprovalErrors";
import { fetchDashboardMrfs } from "@/utils/fetchDashboardMrfs";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { queryKeys } from "@/lib/queryKeys";
import { WORKFLOW_QUERY_OPTIONS } from "@/lib/queryOptions";
import { procurementApi } from "@/services/procurementApi";
import {
  buildEmeraldPoDisplayModel,
  coercePOTermsMode,
  userClausesFromStoredCustomTerms,
} from "@/utils/emeraldPoDocumentModel";
import { buildEmeraldPurchaseOrderPdf } from "@/utils/emeraldPOPdf";
import { ViewPoDocumentsButton } from "@/components/procurement/ViewPoDocumentsButton";
import {
  resolveUserSignatureDataUrl,
  readCachedUserSignature,
} from "@/utils/userSignature";
import { getPendingVendorRegistrations } from "@/services/pendingVendorRegistrations";
import type { VendorRegistration } from "@/types";
import type { MRF, SRF } from "@/types";
import { OneDriveLink } from "@/components/OneDriveLink";
import { SupplyChainActionButtons } from "@/components/SupplyChainActionButtons";
import { SupplyChainVendorApprovalButtons } from "@/components/SupplyChainVendorApprovalButtons";
import { MRFProgressTracker } from "@/components/MRFProgressTracker";
import { MRFApprovalDialog } from "@/components/MRFApprovalDialog";
import { SRFDirectorApprovalDialog } from "@/components/SRFDirectorApprovalDialog";
import { bucketScdMrfs } from "@/utils/mrfDashboardBuckets";
import { DashboardSummaryStats } from "@/components/dashboard/DashboardSummaryStats";
import { DashboardMrfHistoryList } from "@/components/dashboard/DashboardMrfHistoryList";
import { SupplyChainCommandCentre } from "@/components/supplychain/SupplyChainCommandCentre";

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

  const removeMrfFromScdDashboardCache = useCallback(
    (mrfId: string | number | undefined) => {
      const normalizedId = String(mrfId ?? "").trim();
      if (!normalizedId) return;

      queryClient.setQueryData<MRF[] | undefined>(
        queryKeys.dashboard.scdMrfs(),
        (prev) => {
          if (!prev) return prev;
          return prev.filter((m) => {
            const currentId = String(
              m.id ?? (m as { mrf_id?: string }).mrf_id ?? "",
            );
            const formattedId = String(
              m.formatted_id ??
                (m as { formattedId?: string }).formattedId ??
                "",
            );
            return currentId !== normalizedId && formattedId !== normalizedId;
          });
        },
      );
    },
    [queryClient],
  );

  const refreshScdDashboardCaches = useCallback(
    async (mrfId?: string | number) => {
      if (mrfId !== undefined && mrfId !== null && mrfId !== "") {
        removeMrfFromScdDashboardCache(mrfId);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.scdMrfs(),
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.supplyChainDirectorRaw(),
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.all,
          refetchType: "active",
        }),
      ]);
    },
    [queryClient, removeMrfFromScdDashboardCache],
  );

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
  const [selectedTripForDetails, setSelectedTripForDetails] = useState<
    any | null
  >(null);

  const [approvingTripId, setApprovingTripId] = useState<string | null>(null);
  const [downloadingPoId, setDownloadingPoId] = useState<string | null>(null);
  const [pendingFilter, setPendingFilter] = useState<
    "all" | "vendors" | "mrf" | "trips" | "srfs" | "pos"
  >("all");
  const [srfForDirectorApproval, setSrfForDirectorApproval] =
    useState<SRF | null>(null);
  const [srfDirectorApprovalOpen, setSrfDirectorApprovalOpen] = useState(false);

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
  } = useQuery({
    queryKey: ["dashboard", "pending-trip-approvals"] as const,
    queryFn: async () => {
      // Use listAll to fetch organization-wide trip requests instead of just departmental ones
      const res = await tripRequestApi.listAll({ per_page: 50 });
      return res.success && res.data ? res.data : null;
    },
    ...WORKFLOW_QUERY_OPTIONS,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const pendingTripApprovals = useMemo<any[]>(() => {
    const data = (pendingTripApprovalsData ?? {}) as any;
    const listTrips = Array.isArray(data)
      ? data
      : data.trips || data.trip_requests || data.items || data.data || [];

    // Second source: the SCD dashboard payload exposes its own pending queue.
    const raw = (scdDashRaw ?? {}) as Record<string, any>;
    const dashTrips: any[] =
      [
        raw.pending_trip_approvals,
        raw.pendingTripApprovals,
        raw.tripsAwaitingSupplyChainDirectorApproval,
        raw.trips_awaiting_scd_approval,
      ].find((c) => Array.isArray(c)) ?? [];

    const merged = [...dashTrips, ...listTrips];
    const seen = new Set<string>();
    const allTrips = merged.filter((t: any) => {
      const key = String(
        t?.id ?? t?.trip_id ?? t?.request_number ?? JSON.stringify(t),
      );
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Single source of truth — never surface trips the backend has already
    // approved, rejected, or moved past the SCD stage.
    return allTrips.filter((t: any) => isTripAwaitingDirectorApproval(t));
  }, [pendingTripApprovalsData, scdDashRaw]);

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

  // The rendered queues are the only source of truth for these counts. Do not
  // let a later dashboard-stats response overwrite them with a stale aggregate;
  // that race made the cards flash from correct values to incorrect ones.
  const pendingBreakdownCounts = useMemo(
    () => ({
      vendors: vendorRegistrations.length,
      mrf: pendingFirstApprovals.length,
      trips: pendingTripApprovals.length,
      srfs: pendingDirectorSrfs.length,
      pos: pendingPOs.length,
    }),
    [
      vendorRegistrations.length,
      pendingFirstApprovals.length,
      pendingTripApprovals.length,
      pendingDirectorSrfs.length,
      pendingPOs.length,
    ],
  );

  const pendingBreakdownTotal = useMemo(
    () =>
      pendingBreakdownCounts.vendors +
      pendingBreakdownCounts.mrf +
      pendingBreakdownCounts.trips +
      pendingBreakdownCounts.srfs +
      pendingBreakdownCounts.pos,
    [pendingBreakdownCounts],
  );

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

  /**
   * Turn backend approval errors into a message that tells the SCD exactly
   * what happened, especially the common "already approved by another
   * approver" case which otherwise looks like the click was ignored.
   */
  const mapApprovalError = (
    error: string | undefined,
    label: "MRF" | "SRF" = "MRF",
  ): string => {
    const raw = (error || "").toLowerCase();
    if (!raw) return `Failed to approve ${label}`;
    if (
      raw.includes("already approved") ||
      raw.includes("already_approved") ||
      raw.includes("already been approved")
    ) {
      return `This ${label} has already been approved. Refreshing the list…`;
    }
    if (raw.includes("not pending") || raw.includes("wrong stage")) {
      return `This ${label} is no longer awaiting your approval.`;
    }
    if (
      raw.includes("403") ||
      raw.includes("forbidden") ||
      raw.includes("permission")
    ) {
      return "You do not have permission to approve this request.";
    }
    return error || `Failed to approve ${label}`;
  };

  /**
   * Backend returns a 422 with "No unsigned PO found" when the PO record it
   * expects to sign is either missing or was generated against a different
   * MRF identifier. Give the SCD a next step instead of a raw error string.
   */
  const mapSignedPoError = (error: string | undefined): string => {
    const raw = (error || "").toLowerCase();
    if (!raw) return "Failed to upload signed PO";
    if (raw.includes("no unsigned po") || raw.includes("po not found")) {
      return "The unsigned Purchase Order could not be found on the server. Ask Procurement to regenerate the PO, then try attaching your signature again.";
    }
    if (raw.includes("already signed") || raw.includes("already_signed")) {
      return "This Purchase Order has already been signed. Refresh to see the latest status.";
    }
    if (raw.includes("413") || raw.includes("too large")) {
      return "The signed PO file is too large. Please compress the document and try again.";
    }
    return error || "Failed to upload signed PO";
  };

  const handleFirstApprovalApprove = async (remarks: string) => {
    const target = mrfForFirstApproval;
    if (!target) return;

    const mrfId = getMrfApiId(target) || target.id;
    setActionLoading(mrfId);
    try {
      const response = await mrfApi.supplyChainDirectorApprove(mrfId, remarks);
      if (response.success) {
        toast.success("MRF approved - routed to Procurement");
        await refreshScdDashboardCaches(mrfId);
      } else {
        toast.error(mapApprovalError(response.error, "MRF"));
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

    const mrfId = getMrfApiId(target) || target.id;
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
      const response = await srfApi.supplyChainDirectorApprove(srfId, remarks);
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
    const targetMrf = mrfRequests.find(
      (m) => m.id === mrfId || getMrfApiId(m) === mrfId,
    );
    const localKey = targetMrf?.id ?? mrfId;
    const apiId = targetMrf ? getMrfApiId(targetMrf) || mrfId : mrfId;
    const file = signedPOs[localKey];
    if (!file) {
      toast.error("Please select a signed PO file");
      return;
    }

    if (targetMrf && !targetMrf.unsigned_po_url && !targetMrf.unsignedPOUrl) {
      toast.error(
        "The system could not locate the unsigned Purchase Order. Please refresh the page and try again, or contact your Procurement Manager to confirm the PO has been generated.",
      );
      return;
    }

    setActionLoading(localKey);

    try {
      // Call the real backend API endpoint. Use the resolved API id (prefers
      // formatted_id, same as every other MRF mutation) so the backend can
      // locate the same PO record that was generated for this MRF.
      const response = await mrfApi.uploadSignedPO(apiId, file);

      if (response.success) {
        toast.success(
          "Signed PO uploaded successfully - Forwarded to Finance for payment processing",
        );
        setSignedPOs((prev) => ({ ...prev, [localKey]: null }));
        await queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.scdMrfs(),
        });
        await fetchMRFs();
      } else {
        toast.error(mapSignedPoError(response.error));
      }
    } catch (error) {
      toast.error("Failed to connect to server");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAttachSignature = async (mrfId: string) => {
    const targetMrf = mrfRequests.find(
      (m) => m.id === mrfId || getMrfApiId(m) === mrfId,
    );
    const localKey = targetMrf?.id ?? mrfId;
    const apiId = targetMrf ? getMrfApiId(targetMrf) || mrfId : mrfId;
    const override = attachSignatureFiles[localKey] || null;
    setActionLoading(localKey);
    try {
      const fullRes = await mrfApi.getById(apiId);
      if (!fullRes.success || !fullRes.data) {
        toast.error(fullRes.error || "Could not load MRF for signing");
        return;
      }
      const fullMrf = fullRes.data;

      const pcRes = await procurementApi.getPriceComparison(apiId);
      const rows = pcRes.success && pcRes.data ? pcRes.data : [];

      const selectedRow = rows.find(
        (r) =>
          (r as { is_selected?: boolean; isSelected?: boolean }).is_selected ||
          (r as { is_selected?: boolean; isSelected?: boolean }).isSelected,
      );
      const vendorId =
        (selectedRow as { vendor_id?: string | number } | undefined)
          ?.vendor_id ??
        (
          fullMrf as {
            selected_vendor_id?: string | number;
            selectedVendorId?: string | number;
          }
        ).selected_vendor_id ??
        (
          fullMrf as {
            selected_vendor_id?: string | number;
            selectedVendorId?: string | number;
          }
        ).selectedVendorId;

      let vendors: import("@/types").Vendor[] = [];
      if (vendorId) {
        const vRes = await vendorApi.getById(String(vendorId));
        if (vRes.success && vRes.data) vendors = [vRes.data];
      } else {
        const vendorsRes = await vendorApi.list({ page: 1, per_page: 25 });
        vendors =
          vendorsRes.success && vendorsRes.data?.items
            ? vendorsRes.data.items
            : [];
      }

      let sigDataUrl: string | null = null;
      const me = await authApi.getCurrentUser();
      const signatureUrl =
        (
          me.data as
            | { signature_url?: string; signatureUrl?: string }
            | undefined
        )?.signature_url ||
        (
          me.data as
            | { signature_url?: string; signatureUrl?: string }
            | undefined
        )?.signatureUrl ||
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
          (fullMrf as { custom_terms?: string; customTerms?: string })
            .custom_terms ??
            (fullMrf as { custom_terms?: string; customTerms?: string })
              .customTerms,
        ),
        includeSignature: true,
        signatureDataUrl: sigDataUrl,
      });

      const blob = await buildEmeraldPurchaseOrderPdf(model);
      const poNum = getPONumber(fullMrf);
      const file = new File([blob], `PO-${poNum}-signed.pdf`, {
        type: "application/pdf",
      });

      const response = await mrfApi.uploadSignedPO(apiId, file);
      if (response.success) {
        toast.success(
          "Signature attached — opening the signed Purchase Order.",
        );
        setAttachSignatureFiles((prev) => ({ ...prev, [localKey]: null }));
        setSignedPOs((prev) => ({ ...prev, [localKey]: null }));
        await queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.scdMrfs(),
        });
        try {
          window.dispatchEvent(new Event("app:refresh"));
        } catch {
          /* ignore */
        }
        // Take the SCD straight to the PO detail view she just signed, where she
        // can immediately download the signed PO PDF (with her signature).
        navigate(`/pos/${encodeURIComponent(apiId)}?signed=1`);
      } else {
        toast.error(mapSignedPoError(response.error));
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
    if (downloadingPoId) return;
    setDownloadingPoId(String(mrf.id));
    const loadingToast = toast.loading("Preparing PO download...");
    try {
      const { downloadMrfPurchaseOrderPdf } =
        await import("@/utils/downloadMrfPurchaseOrderPdf");
      const res = await downloadMrfPurchaseOrderPdf(mrf);
      if (res.success) {
        toast.success("PO download started", {
          id: loadingToast,
          description: "Emerald layout via server stream",
        });
        return;
      }
      toast.error(res.error || "PO document not available for download", {
        id: loadingToast,
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "PO document could not be downloaded",
        { id: loadingToast },
      );
    } finally {
      setDownloadingPoId(null);
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
          await Promise.all([fetchMRFs(), fetchPendingDirectorSrfs()]);
          toast.success("Data refreshed");
        }}
      >
        <div className="space-y-6">
          <SupplyChainCommandCentre
            pendingMrfs={mrfRequests}
            pendingSrfs={pendingDirectorSrfs}
            pendingTrips={pendingTripApprovals}
            vendorRegistrations={vendorRegistrations}
            loading={loading || pendingDirectorSrfsLoading}
            onRefresh={async () => {
              await Promise.all([
                fetchMRFs(),
                fetchPendingDirectorSrfs(),
                fetchVendorRegistrations(),
                refetchPendingTripApprovals(),
              ]);
            }}
            onOpenMrf={(mrf) => void openMrfDetails(mrf)}
            onOpenSrf={(srf) => {
              setSrfForDirectorApproval(srf);
              setSrfDirectorApprovalOpen(true);
            }}
            onOpenTrip={(trip) => setSelectedTripForDetails(trip)}
            pendingPOs={pendingPOs}
            renderPoWorkspace={(mrf) => {
              const poNumber = getPONumber(mrf);
              const poVersion = getPOVersion(mrf);
              const isActionLoading = actionLoading === mrf.id;
              const pfiUrl = getPFIUrl(mrf);
              const unsignedShare = getUnsignedPOShareUrl(mrf);
              return (
                <div className="space-y-3">
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">PO number: </span>
                      <span className="font-mono">{poNumber}</span>
                      {poVersion > 1 && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          v{poVersion} (Resubmitted)
                        </Badge>
                      )}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Value: </span>₦
                      {getEstimatedCost(mrf).toLocaleString()}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Category: </span>
                      {mrf.category || "-"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Quantity: </span>
                      {mrf.quantity ?? "-"}
                    </p>
                  </div>

                  {mrf.description && (
                    <p className="text-xs text-muted-foreground">
                      {mrf.description}
                    </p>
                  )}

                  {pfiUrl && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                      <span className="text-xs font-medium">
                        Invoice / PFI submitted by staff
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadPFI(mrf)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        View invoice
                      </Button>
                      {(mrf.pfi_share_url || mrf.pfiShareUrl) && (
                        <OneDriveLink
                          webUrl={mrf.pfi_share_url || mrf.pfiShareUrl}
                          fileName="Invoice"
                          variant="badge"
                        />
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPO(mrf)}
                      disabled={downloadingPoId === String(mrf.id)}
                    >
                      {downloadingPoId === String(mrf.id) ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Preparing...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Download PO
                        </>
                      )}
                    </Button>
                    <ViewPoDocumentsButton
                      mrfId={mrf.id}
                      poNumber={poNumber}
                      readOnly={false}
                    />
                    {unsignedShare && (
                      <OneDriveLink
                        webUrl={unsignedShare}
                        fileName={`PO-${poNumber}.pdf`}
                        variant="badge"
                      />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void openMrfDetails(mrf)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Price comparison &amp; full details
                    </Button>
                  </div>

                  <SupplyChainActionButtons
                    mrf={mrf}
                    onAttachSignature={handleAttachSignature}
                    onUploadSignedPO={handleUploadSignedPO}
                    onRejectPO={() => {
                      setSelectedMRFForRejection(mrf);
                      setRejectDialogOpen(true);
                    }}
                    signedPOFile={signedPOs[mrf.id] || null}
                    attachSignatureFile={attachSignatureFiles[mrf.id] || null}
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
                </div>
              );
            }}
          />
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
                                    <span className="text-muted-foreground italic">
                                      Unnamed item
                                    </span>
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
                  <p className="font-medium">
                    {getDisplayId(selectedMRFForDetails)}
                  </p>
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
                  <p className="font-medium">{selectedMRFForDetails.urgency}</p>
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
                    {(selectedMRFForDetails as any).currency === "USD"
                      ? "$"
                      : (selectedMRFForDetails as any).currency === "GBP"
                        ? "£"
                        : (selectedMRFForDetails as any).currency === "EUR"
                          ? "€"
                          : "₦"}
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
                  <Label className="text-muted-foreground">Justification</Label>
                  <p className="font-medium">
                    {selectedMRFForDetails.justification}
                  </p>
                </div>
              </div>
              <LineItemPnLSection
                type="mrf"
                id={getMrfApiId(selectedMRFForDetails)}
                initialPnL={
                  (
                    selectedMRFForDetails as {
                      profitAndLoss?: import("@/types").ProfitAndLoss;
                    }
                  ).profitAndLoss ||
                  (
                    mrfFullDetails as {
                      profitAndLoss?: import("@/types").ProfitAndLoss;
                    } | null
                  )?.profitAndLoss ||
                  (
                    mrfFullDetails as {
                      mrf?: { profitAndLoss?: import("@/types").ProfitAndLoss };
                    } | null
                  )?.mrf?.profitAndLoss
                }
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Trip Details — full server record (accommodation, escort, passengers,
          audit trail, progress) fetched by the shared detail dialog. */}
      <TripRequestDetailDialog
        tripId={
          selectedTripForDetails
            ? String(
                selectedTripForDetails.id ??
                  selectedTripForDetails.trip_id ??
                  "",
              )
            : null
        }
        open={!!selectedTripForDetails}
        onOpenChange={(open) => !open && setSelectedTripForDetails(null)}
        onUpdated={() => {
          refetchPendingTripApprovals();
          setSelectedTripForDetails(null);
        }}
      />
    </DashboardLayout>
  );
};

export default SupplyChainDashboard;
