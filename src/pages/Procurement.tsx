import { Button } from "@/components/ui/button";
import {
  getDisplayId,
  getMrfApiId,
  collectMrfIdAliases,
  collectSrfIdAliases,
  resolveMrfInList,
  findMrfByAnyLinkId,
  matchesSrfQueryParam,
} from "@/utils/displayId";
import { getSrfRequesterDisplayName } from "@/utils/srfRequester";
import { getWorkflowStageLabel } from "@/utils/workflowStageLabels";
import {
  getSrfWorkflowState,
  isSrfPastSupplyChainDirectorForRfq,
} from "@/utils/srfWorkflow";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  FileText,
  Package,
  ShoppingCart,
  Clock,
  CheckCircle2,
  XCircle,
  Download,
  Calendar,
  AlertCircle,
  Upload,
  Send,
  Loader2,
  RefreshCw,
  Trash2,
  Star,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { POGenerationDialog } from "@/components/POGenerationDialog";
import { CreatePOForm, ManualPOQuickStartDialog } from "@/components/procurement";
import {
  Dialog as CreatePODialog,
  DialogContent as CreatePODialogContent,
  DialogHeader as CreatePODialogHeader,
  DialogTitle as CreatePODialogTitle,
} from "@/components/ui/dialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import { RFQManagement } from "@/components/RFQManagement";
import { MRFProgressTracker } from "@/components/MRFProgressTracker";
import { SRFDetailPanel } from "@/components/SRFDetailPanel";
import { LineItemPnLSection } from "@/components/LineItemPnLSection";
import VendorRegistrationsList from "@/components/VendorRegistrationsList";
import GRNCompletionDialog from "@/components/GRNCompletionDialog";
import ProcurementDocumentsPanel from "@/components/procurement/ProcurementDocumentsPanel";
import WorkflowGatesPanel from "@/components/procurement/WorkflowGatesPanel";
import DeliveryConfirmationPanel from "@/components/procurement/DeliveryConfirmationPanel";
import MrfFinanceSyncSection from "@/components/procurement/MrfFinanceSyncSection";
import { getPendingVendorRegistrations } from "@/services/pendingVendorRegistrations";

import type { MRFRequest, SRFRequest } from "@/contexts/AppContext";
import {
  dashboardApi,
  dashboardKpiApi,
  mrfApi,
  grnApi,
  rfqApi,
  quotationApi,
  vendorApi,
  poApi,
  srfApi,
} from "@/services/api";
import {
  normalizeQuotation,
  displayNumeric,
  displayString,
  formatDays,
  formatAmount,
} from "@/utils/normalizeQuotation";
import type { VendorRegistration, MRF, RFQ } from "@/types";
import { OneDriveLink } from "@/components/OneDriveLink";
import { formatMRFDate, formatDateLagos } from "@/utils/dateUtils";
import { normalizeAttachments } from "@/utils/attachments";
import { isPORevisionRequired, getRejectionReason } from "@/utils/poHelpers";
import { openEmeraldPurchaseOrderForMrf } from "@/utils/emeraldPoPdfActions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function convertSrfToPseudoMrfRequest(srf: SRFRequest): MRFRequest {
  return {
    id: getDisplayId(srf) || String(srf.id),
    title: srf.title,
    category: srf.serviceType || "Services",
    description: srf.description,
    quantity: "1",
    estimatedCost: srf.estimatedCost,
    urgency: srf.urgency,
    justification: srf.justification,
    status: srf.status,
    date: srf.date,
    requester: getSrfRequesterDisplayName(srf),
    department: srf.department,
    currentStage: srf.currentStage as MRFRequest["currentStage"],
  };
}

const Procurement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    srfRequests,
    purchaseOrders,
    mrns,
    updateMRN,
    convertMRNToMRF,
    addPO,
    refreshSRFs,
  } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();

  // MRF requests from backend API
  const [mrfRequests, setMrfRequests] = useState<MRF[]>([]);
  const [mrfLoading, setMrfLoading] = useState(true);
  const [poGenerating, setPoGenerating] = useState(false);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);

  const [poDialogOpen, setPODialogOpen] = useState(false);
  const [selectedMRFForPO, setSelectedMRFForPO] = useState<MRFRequest | null>(
    null,
  );
  const [grnCompletionDialogOpen, setGrnCompletionDialogOpen] = useState(false);
  const [selectedMRFForGRN, setSelectedMRFForGRN] = useState<MRF | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mrfToDelete, setMrfToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePODialogOpen, setDeletePODialogOpen] = useState(false);
  const [selectedMRFForPODelete, setSelectedMRFForPODelete] =
    useState<MRF | null>(null);
  const [isDeletingPO, setIsDeletingPO] = useState(false);
  const [platformKpis, setPlatformKpis] = useState<import("@/types").DashboardKPIs | null>(null);
  const [mrfDetailsDialogOpen, setMrfDetailsDialogOpen] = useState(false);
  const [selectedMRFForDetails, setSelectedMRFForDetails] =
    useState<MRF | null>(null);
  const [mrfFullDetails, setMrfFullDetails] = useState<any | null>(null);
  const [loadingFullDetails, setLoadingFullDetails] = useState(false);

  // SRF Details Dialog
  const [srfDetailsDialogOpen, setSRFDetailsDialogOpen] = useState(false);
  const [selectedSRFForDetails, setSelectedSRFForDetails] =
    useState<any | null>(null);

  // New PO Generator (two-section form with price comparison)
  const [createPOOpen, setCreatePOOpen] = useState(false);
  const [createPOMrfId, setCreatePOMrfId] = useState<string | null>(null);
  /** True when Create PO was opened from Purchase Orders tab → manual MRF (sends fast_track on generate-po). */
  const [createPOFastTrack, setCreatePOFastTrack] = useState(false);
  /** True when opening PO generator without an RFQ (manual PO or MRF overview no-RFQ path). */
  const [createPOAllowMissingRfq, setCreatePOAllowMissingRfq] = useState(false);
  const [manualPOOpen, setManualPOOpen] = useState(false);
  /** RFQ dialog opened from MRF row vs SRF row (affects `rfqApi.create` payload). */
  const [rfqCreateSource, setRfqCreateSource] = useState<"mrf" | "srf">("mrf");

  /** "Select & Send for Approval" — collect justification before RFQ + MRF/SRF calls */
  const [vendorSelectionDialogOpen, setVendorSelectionDialogOpen] =
    useState(false);
  const [vendorSelectionTarget, setVendorSelectionTarget] = useState<
    | {
        kind: "mrf";
        request: MRFRequest;
        rfq: RFQ;
        quotation: Record<string, unknown>;
      }
    | {
        kind: "srf";
        request: SRFRequest;
        rfq: RFQ;
        quotation: Record<string, unknown>;
      }
    | null
  >(null);
  const [vendorSelectionReason, setVendorSelectionReason] = useState("");
  const [vendorSelectionSubmitting, setVendorSelectionSubmitting] =
    useState(false);

  // Vendor registrations from dashboard API
  const [vendorRegistrations, setVendorRegistrations] = useState<
    VendorRegistration[]
  >([]);
  const [vendorRegistrationsLoading, setVendorRegistrationsLoading] =
    useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  // Fetch MRFs from backend API
  const fetchMRFs = useCallback(async () => {
    setMrfLoading(true);
    try {
      const response = await mrfApi.getAll();
      if (response.success && response.data) {
        setMrfRequests(response.data);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load MRFs",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setMrfLoading(false);
    }
  }, [toast]);

  // Fetch RFQs for tracking which MRFs have RFQs
  const fetchRFQs = useCallback(async () => {
    try {
      const response = await rfqApi.getAll();
      if (response.success && response.data) {
        setRfqs(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch RFQs:", error);
    }
  }, []);

  // Fetch quotations for MRFs
  const fetchQuotations = useCallback(async () => {
    if (rfqs.length === 0) {
      setQuotations([]);
      return;
    }

    try {
      // Fetch quotations for all RFQs using the RFQ quotations endpoint
      const allQuotations: any[] = [];
      const quotationIds = new Set<string>(); // Track unique quotations by ID

      for (const rfq of rfqs) {
        try {
          const response = await rfqApi.getQuotations(rfq.id);
          if (response.success && response.data && response.data.quotations) {
            
            // The response includes quotations with vendor info
            response.data.quotations.forEach((item: any) => {
            const n = normalizeQuotation(item, rfq.id);
            if (n.id && !quotationIds.has(n.id)) {
              quotationIds.add(n.id);

              // Explicitly resolve attachments from all possible locations
              const rawAtt = item.quotation?.attachments 
                ?? item.attachments 
                ?? n.attachments 
                ?? [];
              const resolvedAttachments = (Array.isArray(rawAtt) ? rawAtt : [rawAtt])
                .flat(Infinity)
                .filter((a: any) => a && typeof a === 'object' && a.url);

              allQuotations.push({
                ...n,
                delivery_days: n.deliveryDays,
                payment_terms: n.paymentTerms,
                total_amount: n.price,
                totalAmount: n.price,
                attachments: resolvedAttachments,
              });
            }
          });

          }
        } catch (error) {
          console.error(`Failed to fetch quotations for RFQ ${getDisplayId(rfq)}:`, error);
        }
      }
      setQuotations(allQuotations);
      if (import.meta.env.DEV) {
      }
    } catch (error) {
      console.error("Failed to fetch quotations:", error);
    }
  }, [rfqs]);

  /** RFQ linked to this MRF — match any alias so RFQ rows keyed by formatted_id still resolve. */
  const getRFQForMRF = (mrf: MRF | MRFRequest | null | undefined) => {
    if (!mrf) return null;
    const ids = new Set(collectMrfIdAliases(mrf));
    if (ids.size === 0) return null;
    return (
      rfqs.find((rfq) => {
        const link = rfq.mrfId ?? (rfq as { mrf_id?: string }).mrf_id;
        return link != null && ids.has(String(link));
      }) ?? null
    );
  };

  const getQuotationsForMRF = (mrf: MRF | MRFRequest | null | undefined) => {
    if (!mrf) return [];
    const ids = new Set(collectMrfIdAliases(mrf));
    const mrfRfqs = rfqs.filter((rfq) => {
      const link = rfq.mrfId ?? (rfq as { mrf_id?: string }).mrf_id;
      return link != null && ids.has(String(link));
    });
    if (mrfRfqs.length === 0) return [];

    const mrfQuotations: any[] = [];
    mrfRfqs.forEach((rfq) => {
      const rfqQuotations = quotations.filter(
        (q) =>
          q.rfqId === rfq.id ||
          q.rfq_id === rfq.id ||
          String(q.rfq_id) === String(rfq.id) ||
          q.rfqId === rfq.id,
      );
      mrfQuotations.push(...rfqQuotations);
    });
    return mrfQuotations;
  };

  const getRFQForSRF = (srf: SRFRequest | null | undefined) => {
    if (!srf) return null;
    const ids = new Set(collectSrfIdAliases(srf));
    if (ids.size === 0) return null;
    return (
      rfqs.find((rfq) => {
        const link = (rfq as { srf_id?: string }).srf_id ?? (rfq as { srfId?: string }).srfId;
        return link != null && ids.has(String(link));
      }) ?? null
    );
  };

  const getQuotationsForSRF = (srf: SRFRequest | null | undefined) => {
    if (!srf) return [];
    const ids = new Set(collectSrfIdAliases(srf));
    const srfRfqs = rfqs.filter((rfq) => {
      const link = (rfq as { srf_id?: string }).srf_id ?? (rfq as { srfId?: string }).srfId;
      return link != null && ids.has(String(link));
    });
    if (srfRfqs.length === 0) return [];
    const out: any[] = [];
    srfRfqs.forEach((rfq) => {
      const qs = quotations.filter(
        (q) =>
          q.rfqId === rfq.id ||
          q.rfq_id === rfq.id ||
          String(q.rfq_id) === String(rfq.id),
      );
      out.push(...qs);
    });
    return out;
  };

  useEffect(() => {
    fetchMRFs();
    fetchRFQs();
  }, [fetchMRFs, fetchRFQs]);

  useEffect(() => {
    dashboardKpiApi.getKpis().then((res) => {
      if (res.success && res.data?.kpis) setPlatformKpis(res.data.kpis);
    });
  }, []);

  useEffect(() => {
    if (rfqs.length > 0) {
      fetchQuotations();
    }
  }, [rfqs, fetchQuotations]);

  // Auto-poll procurement data every 30s while tab is visible
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchMRFs();
        fetchRFQs();
        fetchQuotations();
        void refreshSRFs();
      }
    }, 30000);
    return () => clearInterval(poll);
  }, [fetchMRFs, fetchRFQs, fetchQuotations, refreshSRFs]);

  // Listen for global refresh button clicks from the header
  useEffect(() => {
    const handler = () => {
      fetchMRFs();
      fetchRFQs();
      fetchQuotations();
      void refreshSRFs();
    };
    window.addEventListener("app:refresh", handler);
    return () => window.removeEventListener("app:refresh", handler);
  }, [fetchMRFs, fetchRFQs, fetchQuotations, refreshSRFs]);

  // Helper functions for MRF field access (handles both camelCase and snake_case)
  const getMRFEstimatedCost = (mrf: MRF) =>
    String(mrf.estimated_cost || mrf.estimatedCost || "0");
  const getMRFRequester = (mrf: MRF) =>
    mrf.requester_name || mrf.requester || "Unknown";
  const getMRFDate = (mrf: MRF) => mrf.created_at || mrf.date || "";
  const getMRFStage = (mrf: MRF) =>
    (mrf.current_stage || mrf.currentStage || "").toLowerCase();

  const getMRFPOUrl = (mrf: MRF) => mrf.unsigned_po_url || mrf.unsignedPOUrl;
  const getMRFRejectionReason = (mrf: MRF) =>
    mrf.po_rejection_reason || mrf.poRejectionReason;
  const getMRFPONumber = (mrf: MRF) => mrf.po_number || mrf.poNumber;
  const getMRFPOVersion = (mrf: MRF) => mrf.po_version || mrf.poVersion || 1;
  const getMRFPOShareUrl = (mrf: MRF) =>
    mrf.unsigned_po_share_url || mrf.unsignedPOShareUrl || getMRFPOUrl(mrf);
  const getMRFSignedPOShareUrl = (mrf: MRF) =>
    mrf.signed_po_share_url ||
    mrf.signedPOShareUrl ||
    mrf.signed_po_url ||
    mrf.signedPOUrl;
  const getMRFPFIUrl = (mrf: MRF) => {
    // Check all possible document URL fields
    return (
      (mrf as any).invoice_onedrive_url ||
      (mrf as any).invoiceOneDriveUrl ||
      mrf.pfi_share_url ||
      mrf.pfiShareUrl ||
      mrf.pfi_url ||
      mrf.pfiUrl ||
      (mrf as any).invoice_url ||
      (mrf as any).invoiceUrl
    );
  };

  // Handle PFI/Invoice download
  const handleDownloadPFI = (mrf: MRF) => {
    const pfiUrl = getMRFPFIUrl(mrf);
    if (pfiUrl) {
      if (pfiUrl.startsWith("http")) {
        window.open(pfiUrl, "_blank");
      } else {
        const baseUrl =
          import.meta.env.VITE_API_BASE_URL ||
          "https://supply-chain-backend-hwh6.onrender.com/api";
        window.open(`${baseUrl.replace("/api", "")}/${pfiUrl}`, "_blank");
      }
    } else {
      toast({
        title: "Invoice Not Available",
        description: "Invoice/PFI document is not available",
        variant: "destructive",
      });
    }
  };

  // Convert MRF (API type) to MRFRequest (UI component type)
  const convertToMRFRequest = (mrf: MRF): MRFRequest => ({
    id: getMrfApiId(mrf) || String(mrf.id ?? ""),
    title: mrf.title,
    category: mrf.category,
    description: mrf.description,
    quantity: String(mrf.quantity),
    estimatedCost: getMRFEstimatedCost(mrf),
    urgency: String(mrf.urgency).toLowerCase() as any,
    justification: mrf.justification,
    status: mrf.status,
    date: getMRFDate(mrf),
    requester: getMRFRequester(mrf),
    department: mrf.department,
    currentStage: getMRFStage(mrf) as any,
    approvalHistory: (mrf.approval_history || mrf.approvalHistory || []) as any,
    rejectionReason: mrf.rejection_reason || mrf.rejectionReason,
    isResubmission: mrf.is_resubmission || mrf.isResubmission,
    poNumber: getMRFPONumber(mrf),
    unsignedPOUrl: getMRFPOUrl(mrf),
    signedPOUrl: mrf.signed_po_url || mrf.signedPOUrl,
    executiveComments: mrf.executive_remarks || mrf.executiveComments,
    chairmanComments: mrf.chairman_remarks || mrf.chairmanComments,
    supplyChainComments: mrf.supplyChainComments,
    poRejectionReason: getMRFRejectionReason(mrf),
    poVersion: getMRFPOVersion(mrf),
  });

  // Get workflow state helper
  const getWorkflowState = (mrf: MRF) => {
    return (mrf.workflow_state || mrf.workflowState || "").toLowerCase();
  };

  /** Primary status line for list badges — maps fast-track / SCD-signature workflow to clear copy. */
  const getMRFStatusBadgeText = (mrf: MRF | MRFRequest): string => {
    const wf = getWorkflowState(mrf as MRF);
    const raw = String((mrf as MRF).status ?? "").trim();
    const norm = (wf || raw).toLowerCase().replace(/[\s-]+/g, "_");
    if (norm === "awaiting_scd_signature") return "SCD signature pending";
    if (raw) return raw;
    if (wf) return wf;
    return "Pending";
  };

  const getMRFContractType = (mrf: MRF): string => {
    const ct = (mrf as any).contract_type || (mrf as any).contractType || "";
    return typeof ct === "string" ? ct : String(ct || "");
  };

  const isEmeraldContract = (mrf: MRF): boolean => {
    return getMRFContractType(mrf).toLowerCase().includes("emerald");
  };

  const confirmVendorSelectionSend = useCallback(async () => {
    const reason = vendorSelectionReason.trim();
    if (reason.length < 10) {
      toast({
        title: "Reason for selection required",
        description:
          "Enter at least 10 characters explaining why this vendor was chosen (stored with the price comparison).",
        variant: "destructive",
      });
      return;
    }
    const t = vendorSelectionTarget;
    if (!t) return;
    const { kind, request, rfq, quotation } = t;
    const qid = String(quotation.id ?? "");
    const vid =
      String(quotation.vendorId ?? "") ||
      String((quotation as { vendor_id?: string }).vendor_id ?? "");
    if (!qid || !vid) {
      toast({
        title: "Error",
        description: "Missing quotation or vendor id.",
        variant: "destructive",
      });
      return;
    }
    setVendorSelectionSubmitting(true);
    try {
      const selectResponse = await rfqApi.selectVendor(rfq.id, qid, reason);
      if (!selectResponse.success) {
        toast({
          title: "Error",
          description: selectResponse.error || "Failed to select quotation",
          variant: "destructive",
        });
        return;
      }
      const apiId =
        kind === "mrf"
          ? getMrfApiId(request as unknown as MRF)
          : getDisplayId(request as SRFRequest) ||
            String((request as SRFRequest).id);
      const sendResponse =
        kind === "mrf"
          ? await mrfApi.sendVendorForApproval(apiId, vid, qid, reason)
          : await srfApi.sendVendorForApproval(String(apiId), vid, qid, reason);
      if (sendResponse.success) {
        toast({
          title: "Quotation Selected",
          description:
            "Vendor quotation has been selected and sent to Supply Chain Director for approval.",
        });
        setVendorSelectionDialogOpen(false);
        setVendorSelectionTarget(null);
        setVendorSelectionReason("");
        await fetchMRFs();
        await fetchRFQs();
        await fetchQuotations();
        if (kind === "srf") await refreshSRFs();
        return;
      }
      let errorMessage =
        sendResponse.error || "Failed to send quotation for approval";
      if (kind === "mrf") {
        const isEmerald = isEmeraldContract(request as unknown as MRF);
        if (
          errorMessage.includes("workflow state") ||
          errorMessage.includes("not in")
        ) {
          errorMessage =
            "The MRF workflow state is not valid for sending vendor for approval. Please ensure the MRF is in the correct stage.";
        } else if (errorMessage.includes("executive approval")) {
          errorMessage = isEmerald
            ? "Executive approval is required before sending vendor for Supply Chain Director approval."
            : "Supply Chain Director first approval is required before sending vendor for final approval.";
        }
      } else {
        if (
          errorMessage.includes("workflow state") ||
          errorMessage.includes("not in")
        ) {
          errorMessage =
            "The SRF workflow state is not valid for sending vendor for approval. Please ensure the SRF is in the correct stage.";
        }
      }
      toast({
        title: "Approval Request Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to process quotation selection",
        variant: "destructive",
      });
    } finally {
      setVendorSelectionSubmitting(false);
    }
  }, [
    vendorSelectionReason,
    vendorSelectionTarget,
    toast,
    fetchMRFs,
    fetchRFQs,
    fetchQuotations,
    refreshSRFs,
  ]);

  // Helper to check if Supply Chain Director has approved (either initial MRF approval or vendor selection approval)
  const isSupplyChainApproved = (mrf: MRF): boolean => {
    const workflowState = getWorkflowState(mrf);
    const status = (mrf.status || "").toLowerCase();

    // CRITICAL FIX: Check for initial SCD approval first (this was missing!)
    // Backend sets workflow_state = "supply_chain_director_approved" after initial MRF approval
    if (workflowState === "supply_chain_director_approved") {
      return true;
    }

    // Check if direct SCD approval fields are populated (backend returns these after approval)
    const scdApprovedBy =
      (mrf as any).scd_approved_by || (mrf as any).scdApprovedBy;
    if (scdApprovedBy) {
      return true;
    }

    // Check if workflow state indicates vendor selection approval by SCD
    if (
      workflowState === "pending_po_upload" ||
      workflowState === "vendor_approved" ||
      workflowState === "invoice_approved"
    ) {
      return true;
    }

    // Check status for SCD approval indicators
    const statusLower = status.replace(/_/g, " "); // Convert underscores to spaces for comparison
    if (
      statusLower.includes("vendor approved") ||
      statusLower.includes("supply chain approved") ||
      statusLower.includes("pending po upload") ||
      status === "pending_po_upload"
    ) {
      // Also check exact match with underscores
      return true;
    }

    // Check approval history for Supply Chain Director approval
    const approvalHistory = mrf.approval_history || mrf.approvalHistory || [];
    const hasSCDApproval = approvalHistory.some(
      (entry: any) =>
        entry.action === "approved" &&
        (entry.role === "supply_chain" ||
          entry.approved_by_role === "supply_chain" ||
          entry.stage === "supply_chain" ||
          entry.role === "supply chain director" ||
          entry.approved_by_role === "supply chain director"),
    );

    return hasSCDApproval;
  };

  // Helper to check if MRF is Executive-approved
  const isExecutiveApproved = (mrf: MRF): boolean => {
    // Check explicit approval flag (set by backend after executive approval)
    if (mrf.executive_approved === true) {
      return true;
    }

    // Check status string
    const status = (mrf.status || "").toLowerCase();
    if (
      status.includes("approved by executive") ||
      status.includes("executive approved")
    ) {
      return true;
    }

    // Check approval history for executive approval
    const approvalHistory = mrf.approval_history || mrf.approvalHistory || [];
    const hasExecutiveApproval = approvalHistory.some(
      (entry: any) =>
        entry.action === "approved" &&
        (entry.role === "executive" ||
          entry.approved_by_role === "executive" ||
          entry.stage === "executive_review"),
    );

    if (hasExecutiveApproval) {
      return true;
    }

    // After executive approval (for items <= 1M), backend sets:
    // - status = 'procurement'
    // - current_stage = 'procurement'
    // - executive_approved = true
    // So if stage is "procurement" and status is "procurement" (not "pending"), it's executive-approved
    const stage = getMRFStage(mrf);
    const statusLower = (mrf.status || "").toLowerCase();

    if (
      (stage === "procurement" || stage === "procurement_review") &&
      statusLower === "procurement"
    ) {
      return true;
    }

    if (
      statusLower === "procurement" &&
      (stage === "procurement" || stage === "procurement_review")
    ) {
      return true;
    }

    return false;
  };

  // Non-Emerald contracts: Supply Chain Director gives the FIRST approval,
  // after which the request is routed to Procurement for RFQ/quote sourcing.
  const isSupplyChainDirectorInitialApproved = (mrf: MRF): boolean => {
    const stage = getMRFStage(mrf);
    const workflowState = getWorkflowState(mrf);

    // Check for explicit SCD initial approval field from backend
    const scdApprovedBy =
      (mrf as any).scd_approved_by || (mrf as any).scdApprovedBy;
    if (scdApprovedBy) {
      return true;
    }

    // Check if workflow state indicates SCD initial approval
    if (workflowState === "supply_chain_director_approved") {
      return true;
    }

    // At procurement/procurement_review stage, check approval history for SCD initial approval
    if (stage === "procurement" || stage === "procurement_review") {
      // Check if there's ANY SCD approval in history (initial approval)
      const approvalHistory = mrf.approval_history || mrf.approvalHistory || [];
      const hasSCDApproval = approvalHistory.some(
        (entry: any) =>
          entry.action === "approved" &&
          (entry.role === "supply_chain" ||
            entry.approved_by_role === "supply_chain" ||
            entry.stage === "supply_chain" ||
            entry.role === "supply chain director" ||
            entry.approved_by_role === "supply chain director"),
      );
      return hasSCDApproval;
    }

    return false;
  };

  const isInitialApprovalApproved = (mrf: MRF): boolean => {
    return isEmeraldContract(mrf)
      ? isExecutiveApproved(mrf)
      : isSupplyChainDirectorInitialApproved(mrf);
  };

  const getInitialApprovalApproverName = (mrf: MRF): string => {
    return isEmeraldContract(mrf) ? "Executive" : "Supply Chain Director";
  };

  // Procurement Manager can ONLY upload PO for Executive-approved MRFs
  const executiveApprovedMRFs = useMemo(() => {
    return mrfRequests.filter((mrf) => {
      const hasNoUnsignedPO = !getMRFPOUrl(mrf);
      return isInitialApprovalApproved(mrf as MRF) && hasNoUnsignedPO;
    });
  }, [mrfRequests]);

  // POs rejected by Supply Chain Director
  const rejectedPOs = useMemo(() => {
    return mrfRequests.filter((mrf) => {
      const stage = getMRFStage(mrf);
      const status = (mrf.status || "").toLowerCase();
      const rejectionReason = getMRFRejectionReason(mrf);
      const needsRevision = isPORevisionRequired(mrf);

      return (
        stage === "procurement" &&
        ((status.includes("rejected") && rejectionReason) || needsRevision)
      );
    });
  }, [mrfRequests]);

  // Filter MRFs that need GRN completion
  const grnRequestedMRFs = useMemo(() => {
    return mrfRequests.filter((mrf) => {
      const workflowState = getWorkflowState(mrf);
      const grnRequested = mrf.grn_requested || mrf.grnRequested;
      const grnCompleted = mrf.grn_completed || mrf.grnCompleted;
      return workflowState === "grn_requested" && grnRequested && !grnCompleted;
    });
  }, [mrfRequests]);

  const vendorFromState = (location.state as any)?.vendor as string | undefined;
  const vendorFromQuery = searchParams.get("vendor") || undefined;
  const vendorFilter = vendorFromState || vendorFromQuery || undefined;

  const srfDeepLinkHandled = useRef<string>("");
  const mrfDeepLinkHandled = useRef<string>("");

  const [tab, setTab] = useState<string>(vendorFilter ? "po" : "mrf");

  const tabFromQuery = searchParams.get("tab");
  useEffect(() => {
    const allowed = new Set([
      "mrn",
      "mrf",
      "all-mrfs",
      "rfq",
      "srf",
      "po",
    ]);
    if (tabFromQuery && allowed.has(tabFromQuery)) {
      setTab(tabFromQuery);
    }
  }, [tabFromQuery]);
  const [poDetailsDialogOpen, setPODetailsDialogOpen] = useState(false);
  const [selectedMRFForPODetails, setSelectedMRFForPODetails] =
    useState<MRFRequest | null>(null);

  useEffect(() => {
    if (vendorFromState && !vendorFromQuery) {
      setSearchParams(
        { vendor: vendorFromState } as any,
        { replace: true } as any,
      );
    }
  }, [vendorFromState]);

  useEffect(() => {
    if (vendorFilter) setTab("po");
  }, [vendorFilter]);

  // Deep links: /procurement?srf=SRF-... or ?mrf=MRF-...
  useEffect(() => {
    const srfQ = searchParams.get("srf");
    if (!srfQ || !srfRequests.length) {
      if (!srfQ) srfDeepLinkHandled.current = "";
      return;
    }
    if (srfDeepLinkHandled.current === srfQ) return;
    const found = srfRequests.find((r) => matchesSrfQueryParam(r, srfQ));
    if (!found) return;
    srfDeepLinkHandled.current = srfQ;
    setTab("srf");
    setSelectedSRFForDetails(found);
    setSRFDetailsDialogOpen(true);
  }, [searchParams, srfRequests]);

  useEffect(() => {
    const mrfQ = searchParams.get("mrf");
    if (!mrfQ || !mrfRequests.length) {
      if (!mrfQ) mrfDeepLinkHandled.current = "";
      return;
    }
    if (mrfDeepLinkHandled.current === mrfQ) return;
    const found = findMrfByAnyLinkId(mrfQ, mrfRequests) as MRF | null;
    if (!found) return;
    mrfDeepLinkHandled.current = mrfQ;
    setTab("mrf");
    let cancelled = false;
    (async () => {
      setSelectedMRFForDetails(found);
      setMrfDetailsDialogOpen(true);
      setLoadingFullDetails(true);
      try {
        const response = await mrfApi.getFullDetails(getMrfApiId(found));
        if (!cancelled && response.success && response.data) {
          setMrfFullDetails(response.data);
        }
      } catch {
        if (!cancelled) {
          toast({
            title: "Error",
            description: "Failed to load MRF details",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoadingFullDetails(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, mrfRequests, toast]);

  // Fetch vendor registrations directly so both procurement and procurement managers can review them
  useEffect(() => {
    const fetchVendorRegistrations = async () => {
      setVendorRegistrationsLoading(true);
      try {
        const response = await getPendingVendorRegistrations();
        if (response.success && response.data)
          setVendorRegistrations(response.data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load vendor registrations",
          variant: "destructive",
        });
      } finally {
        setVendorRegistrationsLoading(false);
      }
    };

    fetchVendorRegistrations();
  }, [toast]);

  // Stats
  const pendingMRNs = mrns.filter(
    (mrn) => mrn.status === "Pending" || mrn.status === "Under Review",
  );
  const pendingPOUpload = executiveApprovedMRFs.length;
  const rejectedPOCount = rejectedPOs.length;
  const inSupplyChain = mrfRequests.filter(
    (mrf) => mrf.currentStage === "supply_chain_director_review",
  ).length;
  const totalPOs = purchaseOrders.length;

  // Filtered data
  const filteredMRFs = useMemo(() => {
    let filtered = [...mrfRequests];

    if (searchQuery) {
      filtered = filtered.filter(
        (mrf) =>
          mrf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          mrf.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          getDisplayId(mrf).toLowerCase().includes(searchQuery.toLowerCase()) ||
          getMRFRequester(mrf)
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((mrf) => {
        const stage = getMRFStage(mrf);
        if (statusFilter === "pending") return stage === "procurement";
        if (statusFilter === "approved") return stage === "completed";
        if (statusFilter === "rejected") return stage === "rejected";
        if (statusFilter === "finance") return stage === "finance";
        if (statusFilter === "chairman")
          return stage === "chairman" || stage === "chairman_review";
        return true;
      });
    }

    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter((mrf) => {
        const mrfDate = new Date(getMRFDate(mrf));
        const daysDiff =
          (now.getTime() - mrfDate.getTime()) / (1000 * 60 * 60 * 24);

        if (dateFilter === "today") return daysDiff < 1;
        if (dateFilter === "week") return daysDiff < 7;
        if (dateFilter === "month") return daysDiff < 30;
        return true;
      });
    }

    filtered.sort((a, b) => {
      const dateA = getMRFDate(a);
      const dateB = getMRFDate(b);
      const costA = parseFloat(getMRFEstimatedCost(a));
      const costB = parseFloat(getMRFEstimatedCost(b));

      if (sortBy === "date-desc")
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      if (sortBy === "date-asc")
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      if (sortBy === "amount-desc") return costB - costA;
      if (sortBy === "amount-asc") return costA - costB;
      return 0;
    });

    return filtered;
  }, [mrfRequests, searchQuery, statusFilter, dateFilter, sortBy]);

  const filteredPOs = purchaseOrders.filter(
    (po) => !vendorFilter || po.vendor === vendorFilter,
  );

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

  // Determine the correct stage-start timestamp for the elapsed-time indicator.
  // Uses only fields present on the MRF type; falls back gracefully.
  const getStageStartTime = (mrf: MRF): string | null => {
    const stage = getMRFStage(mrf);
    const wf = getWorkflowState(mrf);

    if (
      wf === "supply_chain_director_approved" ||
      stage === "procurement" ||
      stage === "procurement_review"
    ) {
      return (
        mrf.procurement_review_started_at ||
        mrf.director_approved_at ||
        mrf.executive_approved_at ||
        mrf.created_at ||
        null
      );
    }

    if (stage === "supply_chain" || stage === "supply_chain_director_review") {
      return mrf.executive_approved_at || mrf.created_at || null;
    }

    // executive_review, submitted, and all others → time since creation
    return mrf.created_at || mrf.date || null;
  };

  const getApprovalTimerColor = (mrf: MRFRequest | MRF) => {
    const stage = getMRFStage(mrf as MRF);
    if (stage === "completed" || stage === "rejected") {
      return null;
    }

    const startTimeStr = getStageStartTime(mrf as MRF);
    if (!startTimeStr) return null;

    const startTime = new Date(startTimeStr);
    const now = new Date();
    const hoursElapsed =
      (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    if (hoursElapsed <= 48) return "text-emerald-600 dark:text-emerald-400";
    if (hoursElapsed <= 72) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  const getElapsedTimeText = (mrf: MRFRequest | MRF): string | null => {
    const stage = getMRFStage(mrf as MRF);
    if (stage === "completed" || stage === "rejected") return null;

    const startTimeStr = getStageStartTime(mrf as MRF);
    if (!startTimeStr) return null;

    const startTime = new Date(startTimeStr);
    const now = new Date();
    const totalMinutes = Math.floor(
      (now.getTime() - startTime.getTime()) / (1000 * 60),
    );

    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    if (hours < 24) {
      const mins = totalMinutes % 60;
      return `${hours}h ${mins}m`;
    }
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  };

  const handleMRFClick = (mrf: MRFRequest | MRF) => {
    // Procurement can only view MRFs, not approve them
    toast({
      title: "View Only",
      description:
        "Procurement can view MRFs but cannot approve. Only Executive has approval authority.",
      variant: "default",
    });
  };

  const [resubmittingPOId, setResubmittingPOId] = useState<string | null>(null);

  const handleResubmitPO = async (mrf: MRFRequest | MRF) => {
    const poId = (mrf as any).poId || (mrf as any).po_id || mrf.id;
    setResubmittingPOId(String(mrf.id));
    try {
      const res = await poApi.resubmit(String(poId));
      if (res.success) {
        toast({
          title: "Resubmitted for Approval",
          description: "PO has been sent back to the Supply Chain Director.",
        });
        window.dispatchEvent(new CustomEvent("app:refresh"));
      } else {
        toast({
          title: "Resubmission Failed",
          description: res.error || "Unable to resubmit PO. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to resubmit PO.",
        variant: "destructive",
      });
    } finally {
      setResubmittingPOId(null);
    }
  };

  const handleGeneratePO = async (mrf: MRFRequest | MRF) => {
    setRfqCreateSource("mrf");
    // Check if MRF is Executive approved first (this is the main requirement)
    const mrfData = resolveMrfInList(mrf, mrfRequests);
    const mrfToCheck = (mrfData || (mrf as MRF)) as MRF;
    const isApproved = isInitialApprovalApproved(mrfToCheck);
    const approverName = getInitialApprovalApproverName(mrfToCheck);

    if (!isApproved) {
      toast({
        title: "Request Not Ready",
        description: `This MRF must be approved by ${approverName} before sending request to vendors.`,
        variant: "destructive",
      });
      return;
    }

    // Check available actions from backend (for additional validation)
    try {
      const response = await mrfApi.getAvailableActions(
        getMrfApiId(mrfToCheck),
      );
      if (response.success && response.data) {
        // If backend says canGeneratePO is false but MRF is Executive approved, still allow
        // (backend permission might be checking for later stages, but we allow after Executive approval)
        if (!response.data.canGeneratePO && !isApproved) {
          toast({
            title: "Request Not Ready",
            description: `This MRF must be approved by ${approverName} before sending request to vendors.`,
            variant: "destructive",
          });
          return;
        }
        // Proceed with opening PO generation dialog
        setSelectedMRFForPO(convertToMRFRequest(mrf as MRF));
        setPODialogOpen(true);
      } else {
        // Fallback: If Executive approved, allow proceeding
        if (isApproved) {
          setSelectedMRFForPO(convertToMRFRequest(mrf as MRF));
          setPODialogOpen(true);
        } else {
          toast({
            title: "Error",
            description: "Could not verify permissions. Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      // Fallback: If Executive approved, allow proceeding
      if (isApproved) {
        setSelectedMRFForPO(convertToMRFRequest(mrf as MRF));
        setPODialogOpen(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to check permissions. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleGeneratePOForSrf = (srf: SRFRequest) => {
    const live =
      srfRequests.find((s) =>
        collectSrfIdAliases(s).some((a) => collectSrfIdAliases(srf).includes(a)),
      ) ?? srf;
    if (!isSrfPastSupplyChainDirectorForRfq(live)) {
      toast({
        title: "Request Not Ready",
        description:
          "Supply Chain Director must approve this service request before sending it to vendors.",
        variant: "destructive",
      });
      return;
    }
    setRfqCreateSource("srf");
    setSelectedMRFForPO(convertSrfToPseudoMrfRequest(live));
    setPODialogOpen(true);
  };

  // Procurement cannot approve/reject - only view
  const handleApprove = (remarks: string) => {
    toast({
      title: "Access Denied",
      description:
        "Only Executive can approve MRFs. You can view and generate POs.",
      variant: "destructive",
    });
  };

  const handleReject = (remarks: string) => {
    toast({
      title: "Access Denied",
      description:
        "Only Executive can reject MRFs. You can view and generate POs.",
      variant: "destructive",
    });
  };

  const handlePOGeneration = async (poData: {
    vendors: string[];
    items: string;
    amount: string;
    deliveryDate: string;
    paymentTerms: string;
    notes: string;
    poFile: File | null;
  }) => {
    if (!selectedMRFForPO) return;

    if (rfqCreateSource === "srf") {
      const linkId = selectedMRFForPO.id;
      const liveSrf =
        srfRequests.find((s) => collectSrfIdAliases(s).includes(String(linkId))) ??
        srfRequests.find(
          (s) => getDisplayId(s) === linkId || String(s.id) === linkId,
        );
      if (!liveSrf || !isSrfPastSupplyChainDirectorForRfq(liveSrf)) {
        toast({
          title: "Request Not Ready",
          description:
            "Supply Chain Director must approve this service request before sending it to vendors.",
          variant: "destructive",
        });
        setPODialogOpen(false);
        return;
      }
    } else {
      const mrfData =
        (findMrfByAnyLinkId(selectedMRFForPO.id, mrfRequests) as MRF | null) ??
        mrfRequests.find((m) => m.id === selectedMRFForPO.id);
      const mrfToCheck = (mrfData || (selectedMRFForPO as any)) as MRF;
      if (!mrfData || !isInitialApprovalApproved(mrfToCheck)) {
        toast({
          title: "Request Not Ready",
          description: `This MRF must be approved by ${getInitialApprovalApproverName(mrfToCheck)} before sending request to vendors.`,
          variant: "destructive",
        });
        setPODialogOpen(false);
        return;
      }
    }

    // Validate vendors selected
    if (poData.vendors.length === 0) {
      toast({
        title: "Validation Error",
        description:
          "Please select at least one vendor to send the request to.",
        variant: "destructive",
      });
      return;
    }

    // Validate delivery date for RFQ deadline
    if (!poData.deliveryDate) {
      toast({
        title: "Validation Error",
        description:
          "Please select an expected delivery date (this will be used as RFQ deadline).",
        variant: "destructive",
      });
      return;
    }

    setPoGenerating(true);

    try {
      const deliveryDateObj = new Date(poData.deliveryDate);
      const today = new Date();
      const daysUntilDelivery = Math.ceil(
        (deliveryDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      const deadlineDays = Math.max(7, Math.floor(daysUntilDelivery * 0.7));
      const deadlineDate = new Date(today);
      deadlineDate.setDate(deadlineDate.getDate() + deadlineDays);
      const deadline = deadlineDate.toISOString().split("T")[0];

      const resolvedSrfForRfq =
        rfqCreateSource === "srf"
          ? srfRequests.find((s) =>
              collectSrfIdAliases(s).includes(String(selectedMRFForPO.id)),
            ) ??
            srfRequests.find(
              (s) =>
                getDisplayId(s) === selectedMRFForPO.id ||
                String(s.id) === selectedMRFForPO.id,
            )
          : undefined;
      const srfIdForRfq =
        rfqCreateSource === "srf"
          ? String(
              (resolvedSrfForRfq &&
                (getDisplayId(resolvedSrfForRfq) || resolvedSrfForRfq.id)) ||
                selectedMRFForPO.id,
            )
          : "";

      const rfqResponse = await rfqApi.create(
        rfqCreateSource === "srf"
          ? {
              srfId: srfIdForRfq,
              title: selectedMRFForPO.title || "RFQ Request",
              category: selectedMRFForPO.category || "",
              description: poData.items || selectedMRFForPO.description || "",
              quantity: selectedMRFForPO.quantity || "1",
              estimatedCost:
                poData.amount || selectedMRFForPO.estimatedCost || "0",
              deadline,
              vendorIds: poData.vendors,
              paymentTerms: poData.paymentTerms || "",
              notes: poData.notes || "",
            }
          : {
              mrfId: selectedMRFForPO.id,
              title: selectedMRFForPO.title || "RFQ Request",
              category: selectedMRFForPO.category || "",
              description: poData.items || selectedMRFForPO.description || "",
              quantity: selectedMRFForPO.quantity || "1",
              estimatedCost:
                poData.amount || selectedMRFForPO.estimatedCost || "0",
              deadline,
              vendorIds: poData.vendors,
              paymentTerms: poData.paymentTerms || "",
              notes: poData.notes || "",
            },
      );

      if (rfqResponse.success) {
        toast({
          title: "Request Sent to Vendors",
          description: `RFQ sent to ${poData.vendors.length} vendor(s). They will see it in their portal and can submit quotations.`,
        });

        const wasSrf = rfqCreateSource === "srf";
        setPODialogOpen(false);
        setSelectedMRFForPO(null);
        setRfqCreateSource("mrf");

        await fetchMRFs();
        await fetchRFQs();
        if (wasSrf) await refreshSRFs();
        setTimeout(() => {
          fetchQuotations();
        }, 500);
      } else {
        console.error("RFQ Creation Error:", rfqResponse.error);
        toast({
          title: "Failed to Send Request",
          description:
            rfqResponse.error ||
            "Failed to send request to vendors. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("RFQ Creation Exception:", error);
      toast({
        title: "Network Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to connect to server. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setPoGenerating(false);
    }
  };

  const handleSavePO = async (poData: {
    vendors: string[];
    items: string;
    amount: string;
    deliveryDate: string;
    paymentTerms: string;
    notes: string;
    poFile: File | null;
  }) => {
    // Save RFQ draft without sending to vendors
    // This could save to localStorage or a backend draft endpoint
    toast({
      title: "RFQ Draft Saved",
      description:
        "Your RFQ draft has been saved. You can continue editing and send it to vendors later.",
    });
    setPODialogOpen(false);
    setSelectedMRFForPO(null);
    setRfqCreateSource("mrf");
  };

  const handlePOGenerationSuccess = () => {
    fetchMRFs();
  };

  const handleCompleteGRN = (mrf: MRF) => {
    setSelectedMRFForGRN(mrf);
    setGrnCompletionDialogOpen(true);
  };

  const handleGRNCompletionSuccess = () => {
    fetchMRFs();
  };

  const handleDownloadPO = async (mrf: MRF) => {
    // Check for signed PO first (preferred), then unsigned PO
    const signedPOUrl =
      mrf.signed_po_url ||
      mrf.signedPOUrl ||
      mrf.signed_po_share_url ||
      mrf.signedPOShareUrl;
    const unsignedPOUrl = getMRFPOShareUrl(mrf) || getMRFPOUrl(mrf);

    // If it's an external URL (OneDrive, etc.), open it directly
    if (signedPOUrl && signedPOUrl.startsWith("http")) {
      window.open(signedPOUrl, "_blank");
      return;
    }

    const hasGeneratedPo = Boolean(mrf.po_number || mrf.poNumber);
    if (!signedPOUrl && hasGeneratedPo) {
      const emerald = await openEmeraldPurchaseOrderForMrf(mrf);
      if (emerald.ok) {
        toast({
          title: "Opening PO",
          description: "Emerald layout PDF opened in a new tab.",
        });
        return;
      }
      toast({
        title: "Emerald PO layout unavailable",
        description: `${emerald.error ?? "Unknown error"} Trying the server copy if available.`,
        variant: "default",
      });
    }

    if (unsignedPOUrl && unsignedPOUrl.startsWith("http")) {
      window.open(unsignedPOUrl, "_blank");
      return;
    }

    // Try to download from backend API
    // Prefer signed PO if available, otherwise unsigned
    const poType = signedPOUrl ? "signed" : "unsigned";

    // Check if PO exists before attempting download
    if (!signedPOUrl && !unsignedPOUrl) {
      toast({
        title: "PO Not Available",
        description: "PO document is not available for download",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await mrfApi.downloadPO(getMrfApiId(mrf), poType);

      if (response.success) {
        toast({
          title: "Download Started",
          description: "Purchase Order download has started",
        });
      } else {
        // If API download fails, try direct URL approach as fallback
        const fallbackUrl = signedPOUrl || unsignedPOUrl;
        if (fallbackUrl) {
          const baseUrl =
            import.meta.env.VITE_API_BASE_URL ||
            "https://supply-chain-backend-hwh6.onrender.com/api";
          const fullUrl = fallbackUrl.startsWith("http")
            ? fallbackUrl
            : `${baseUrl.replace("/api", "")}/${fallbackUrl}`;
          window.open(fullUrl, "_blank");
          toast({
            title: "Opening PO",
            description: "Opening PO document in a new window",
          });
        } else {
          toast({
            title: "Download Failed",
            description: response.error || "Unable to download PO document",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error downloading PO:", error);
      // Fallback to direct URL if API fails
      const fallbackUrl = signedPOUrl || unsignedPOUrl;
      if (fallbackUrl) {
        const baseUrl =
          import.meta.env.VITE_API_BASE_URL ||
          "https://supply-chain-backend-hwh6.onrender.com/api";
        const fullUrl = fallbackUrl.startsWith("http")
          ? fallbackUrl
          : `${baseUrl.replace("/api", "")}/${fallbackUrl}`;
        window.open(fullUrl, "_blank");
        toast({
          title: "Opening PO",
          description: "Opening PO document in a new window",
        });
      } else {
        toast({
          title: "Download Failed",
          description:
            "Unable to download PO document. Please try again later.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeletePO = (mrf: MRF) => {
    setSelectedMRFForPODelete(mrf);
    setDeletePODialogOpen(true);
  };

  const confirmDeletePO = async () => {
    if (!selectedMRFForPODelete) return;

    setIsDeletingPO(true);
    try {
      const response = await mrfApi.deletePO(
        getMrfApiId(selectedMRFForPODelete as MRF),
      );
      if (response.success) {
        toast({
          title: "PO Deleted",
          description: "PO has been cleared. You can now regenerate it.",
        });
        await fetchMRFs();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to delete PO",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsDeletingPO(false);
      setDeletePODialogOpen(false);
      setSelectedMRFForPODelete(null);
    }
  };

  const handleDeleteMRF = (mrfId: string) => {
    setMrfToDelete(mrfId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteMRF = async () => {
    if (!mrfToDelete) return;

    setIsDeleting(true);
    try {
      const response = await mrfApi.delete(mrfToDelete);
      if (response.success) {
        toast({
          title: "MRF Deleted",
          description:
            "The Material Request Form has been deleted successfully",
        });
        await fetchMRFs();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to delete MRF",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setMrfToDelete(null);
    }
  };

  const handleConvertMRNToMRF = (mrnId: string) => {
    const mrn = mrns.find((m) => m.id === mrnId);
    if (!mrn) return;

    convertMRNToMRF(mrnId, user?.name || "Procurement Manager");

    toast({
      title: "MRN Converted to MRF",
      description: `${mrn.controlNumber} has been converted to an official MRF`,
    });
  };

  const handleRejectMRN = (mrnId: string, reason: string) => {
    updateMRN(mrnId, {
      status: "Rejected",
      reviewedBy: user?.name || "Procurement Manager",
      reviewDate: new Date().toISOString(),
      reviewNotes: reason,
    });

    toast({
      title: "MRN Rejected",
      description: "The requester has been notified",
      variant: "destructive",
    });
  };

  const statusOptions = [
    { label: "All Requests", value: "all" },
    { label: "Pending My Review", value: "pending" },
    { label: "With Finance", value: "finance" },
    { label: "With Chairman", value: "chairman" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];

  const activeFiltersCount =
    (statusFilter !== "all" ? 1 : 0) + (dateFilter !== "all" ? 1 : 0);

  return (
    <DashboardLayout>
      <PullToRefresh
        onRefresh={async () => {
          toast({
            title: "Refreshing data...",
            description: "Please wait",
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          toast({
            title: "Data refreshed",
            description: "All data is up to date",
          });
        }}
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                Procurement Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Manage material and service requests
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Pending PO Upload"
              value={pendingPOUpload}
              description="Initial approval completed, awaiting PO"
              icon={Clock}
              iconColor="text-warning"
              onClick={() => setTab("mrf")}
            />
            <StatCard
              title="Rejected POs"
              value={rejectedPOCount}
              description="Need revision & resubmission"
              icon={XCircle}
              iconColor="text-destructive"
              onClick={() => setTab("mrf")}
            />
            <StatCard
              title="Pending MRNs"
              value={pendingMRNs.length}
              description="Awaiting review"
              icon={FileText}
              iconColor="text-info"
              onClick={() => setTab("mrn")}
            />
            <StatCard
              title="In Supply Chain"
              value={inSupplyChain}
              description="With Supply Chain Director"
              icon={Package}
              iconColor="text-success"
            />
          </div>

          {platformKpis && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="POs Generated"
                value={platformKpis.totalPosGenerated}
                description="Platform total"
                icon={CheckCircle2}
                iconColor="text-primary"
              />
              <StatCard
                title="MRFs Approved"
                value={platformKpis.totalMrfsApproved}
                description="Platform total"
                icon={FileText}
                iconColor="text-success"
              />
              <StatCard
                title="SRFs Approved"
                value={platformKpis.totalSrfsApproved}
                description="Platform total"
                icon={ShoppingCart}
                iconColor="text-info"
              />
              <StatCard
                title="Price Comparisons"
                value={platformKpis.priceComparisonCount}
                description="MRFs compared"
                icon={Star}
                iconColor="text-warning"
              />
            </div>
          )}

          {/* Dashboard Alerts */}
          <DashboardAlerts
            userRole={user?.role || "procurement"}
            maxAlerts={5}
          />

          {/* Vendor Registrations Section */}
          <VendorRegistrationsList
            maxItems={3}
            showTabs={false}
            title="Pending Vendor Registrations"
            externalRegistrations={vendorRegistrations}
            externalLoading={vendorRegistrationsLoading}
          />

          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="flex w-full flex-wrap h-auto gap-1 justify-start">
              <TabsTrigger
                value="mrn"
                className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3 flex-col sm:flex-row gap-1"
              >
                <span className="hidden sm:inline">
                  Material Requests (MRN)
                </span>
                <span className="sm:hidden">MRN</span>
                {pendingMRNs.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-0 sm:ml-2 text-[8px] sm:text-xs h-4 sm:h-5 px-1"
                  >
                    {pendingMRNs.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="mrf"
                className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3"
              >
                <span className="hidden sm:inline">MRF (Official)</span>
                <span className="sm:hidden">MRF</span>
              </TabsTrigger>
              <TabsTrigger
                value="all-mrfs"
                className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3"
              >
                <span className="hidden sm:inline">All MRFs</span>
                <span className="sm:hidden">All</span>
              </TabsTrigger>
              <TabsTrigger
                value="rfq"
                className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3"
              >
                <span className="hidden sm:inline">RFQ Management</span>
                <span className="sm:hidden">RFQ</span>
                <Send className="h-3 w-3 ml-1 hidden sm:inline" />
              </TabsTrigger>
              <TabsTrigger
                value="srf"
                className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3"
              >
                <span className="hidden sm:inline">Service Requests</span>
                <span className="sm:hidden">SRF</span>
              </TabsTrigger>
              <TabsTrigger
                value="po"
                className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3"
              >
                <span className="hidden sm:inline">Purchase Orders</span>
                <span className="sm:hidden">PO</span>
              </TabsTrigger>
            </TabsList>

            {/* RFQ Management Tab */}
            <TabsContent value="rfq" className="space-y-4">
              <RFQManagement
                onVendorSelected={(vendorId, rfqId) => {
                  // Vendor selection is now handled in RFQManagement component
                  // It automatically sends vendor to Supply Chain Director for approval
                  // Refresh MRF list to see updated workflow state
                  fetchMRFs();
                  setTab("mrf");
                }}
              />
            </TabsContent>

            <TabsContent value="mrn" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Material Request Notes (MRN)</CardTitle>
                      <CardDescription>
                        Review department requests and convert to official MRFs
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mrns.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No material request notes submitted yet</p>
                      </div>
                    ) : (
                      mrns.map((mrn) => (
                        <Card key={mrn.id} className="overflow-hidden">
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-mono text-sm font-semibold">
                                    {mrn.controlNumber}
                                  </span>
                                  <Badge
                                    className={
                                      mrn.status === "Pending"
                                        ? "bg-yellow-500"
                                        : mrn.status === "Under Review"
                                          ? "bg-blue-500"
                                          : mrn.status === "Converted to MRF"
                                            ? "bg-green-500"
                                            : "bg-red-500"
                                    }
                                  >
                                    {mrn.status}
                                  </Badge>
                                  <Badge
                                    variant={
                                      mrn.urgency === "High"
                                        ? "destructive"
                                        : "secondary"
                                    }
                                  >
                                    {mrn.urgency}
                                  </Badge>
                                </div>
                                <h3 className="text-lg font-semibold">
                                  {mrn.title}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Requested by {mrn.requesterName} •{" "}
                                  {mrn.department} •{" "}
                                  {new Date(
                                    mrn.submittedDate,
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3 mb-4">
                              <div>
                                <strong className="text-sm">
                                  Justification:
                                </strong>
                                <p className="text-sm text-muted-foreground">
                                  {mrn.justification}
                                </p>
                              </div>

                              <div>
                                <strong className="text-sm">
                                  Items Requested ({mrn.items.length}):
                                </strong>
                                <div className="mt-2 space-y-2">
                                  {mrn.items.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-muted p-3 rounded-md"
                                    >
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <p className="font-medium">
                                            {item.name}
                                          </p>
                                          {item.description && (
                                            <p className="text-sm text-muted-foreground">
                                              {item.description}
                                            </p>
                                          )}
                                        </div>
                                        <div className="text-right ml-4">
                                          <p className="text-sm">
                                            Qty: {item.quantity}
                                          </p>
                                          <p className="text-sm font-semibold">
                                            ₦
                                            {parseFloat(
                                              item.estimatedUnitCost,
                                            ).toLocaleString()}
                                            /unit
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="bg-primary/5 p-3 rounded-md">
                                <strong className="text-sm">
                                  Total Estimated Cost:
                                </strong>
                                <p className="text-lg font-bold">
                                  ₦
                                  {mrn.items
                                    .reduce(
                                      (sum, item) =>
                                        sum +
                                        (parseFloat(item.quantity) || 0) *
                                          (parseFloat(item.estimatedUnitCost) ||
                                            0),
                                      0,
                                    )
                                    .toLocaleString()}
                                </p>
                              </div>

                              {mrn.reviewNotes && (
                                <div className="bg-muted p-3 rounded-md">
                                  <strong className="text-sm">
                                    Review Notes:
                                  </strong>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {mrn.reviewNotes}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Reviewed by {mrn.reviewedBy} on{" "}
                                    {mrn.reviewDate &&
                                      new Date(
                                        mrn.reviewDate,
                                      ).toLocaleDateString()}
                                  </p>
                                </div>
                              )}

                              {mrn.convertedMRFId && (
                                <div className="bg-green-500/10 p-3 rounded-md">
                                  <p className="text-sm text-green-700 dark:text-green-400">
                                    ✓ Converted to MRF:{" "}
                                    <span className="font-mono font-semibold">
                                      {mrn.convertedMRFId}
                                    </span>
                                  </p>
                                </div>
                              )}
                            </div>

                            {mrn.status === "Pending" ||
                            mrn.status === "Under Review" ? (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleConvertMRNToMRF(mrn.id)}
                                  className="flex-1"
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Convert to MRF
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    const reason = prompt(
                                      "Enter rejection reason:",
                                    );
                                    if (reason) handleRejectMRN(mrn.id, reason);
                                  }}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </Button>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mrf" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Material Request Forms</CardTitle>
                      <CardDescription>
                        Review and approve material requisitions
                      </CardDescription>
                    </div>
                    {/* Only employees can create MRF */}
                    {(user?.role === "employee" ||
                      user?.role === "general_employee") && (
                      <Button
                        onClick={() => navigate("/procurement/mrf/new")}
                        size="sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New MRF
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Rejected POs - Need Resubmission - Only visible to Procurement Managers */}
                  {rejectedPOs.length > 0 &&
                    (user?.role === "procurement" ||
                      user?.role === "procurement_manager") && (
                      <div className="mb-6 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-4">
                          <XCircle className="h-5 w-5 text-destructive" />
                          <h3 className="font-semibold text-lg">
                            POs Rejected by Supply Chain
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {rejectedPOs.length} PO(s) rejected and need revision
                        </p>
                        <div className="space-y-3">
                          {rejectedPOs.map((mrf) => (
                            <Card
                              key={mrf.id}
                              className="bg-card border-destructive/50"
                            >
                              <CardContent className="p-4">
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <h4 className="font-semibold">
                                          {mrf.title}
                                        </h4>
                                        {isPORevisionRequired(mrf) ? (
                                          <Badge className="bg-warning/15 text-warning border border-warning/30 hover:bg-warning/20">
                                            Returned for Revision
                                          </Badge>
                                        ) : (
                                          <Badge variant="destructive">
                                            Rejected
                                          </Badge>
                                        )}
                                        <Badge variant="outline">
                                          {mrf.poNumber}
                                        </Badge>
                                        {mrf.poVersion && (
                                          <Badge
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            v{mrf.poVersion}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-sm text-muted-foreground space-y-1">
                                        <p>
                                          MRF ID:{" "}
                                          <span className="font-medium">
                                            {getDisplayId(mrf)}
                                          </span>
                                        </p>
                                        <p>Requester: {mrf.requester}</p>
                                        <p>
                                          Amount:{" "}
                                          <span className="font-semibold">
                                            ₦
                                            {parseInt(
                                              mrf.estimatedCost,
                                            ).toLocaleString()}
                                          </span>
                                        </p>
                                      </div>
                                    </div>
                                    {/* Regenerate PO button - Only for Procurement Managers */}
                                    {(user?.role === "procurement" ||
                                      user?.role === "procurement_manager") && (
                                      <div className="flex flex-col sm:flex-row gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleGeneratePO(mrf)}
                                        >
                                          <FileText className="h-4 w-4 mr-2" />
                                          Edit / Regenerate PO
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => handleResubmitPO(mrf)}
                                          disabled={resubmittingPOId === String(mrf.id)}
                                        >
                                          {resubmittingPOId === String(mrf.id) ? (
                                            <>
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              Resubmitting...
                                            </>
                                          ) : (
                                            <>
                                              <RefreshCw className="h-4 w-4 mr-2" />
                                              Resubmit for Approval
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Rejection Details */}
                                  <div className="p-3 bg-destructive/10 rounded-md">
                                    <p className="text-xs font-semibold text-destructive mb-1">
                                      Rejection Reason:
                                    </p>
                                    <p className="text-sm text-foreground">
                                      {mrf.poRejectionReason}
                                    </p>
                                    {mrf.supplyChainComments && (
                                      <>
                                        <p className="text-xs font-semibold text-muted-foreground mt-2 mb-1">
                                          Additional Comments:
                                        </p>
                                        <p className="text-sm text-foreground">
                                          {mrf.supplyChainComments}
                                        </p>
                                      </>
                                    )}
                                  </div>

                                  {/* Invoice/PFI Access */}
                                  {getMRFPFIUrl(mrf as MRF) && (
                                    <div className="flex flex-col gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg mt-3">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                          Supporting Document Submitted by Staff
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            handleDownloadPFI(mrf as MRF)
                                          }
                                          className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
                                        >
                                          <Download className="h-4 w-4 mr-2" />
                                          View Invoice
                                        </Button>
                                        {(() => {
                                          const docUrl = getMRFPFIUrl(
                                            mrf as MRF,
                                          );
                                          const shareUrl =
                                            (mrf as any).invoice_onedrive_url ||
                                            (mrf as any).invoiceOneDriveUrl ||
                                            mrf.pfi_share_url ||
                                            mrf.pfiShareUrl;
                                          return (
                                            shareUrl && (
                                              <OneDriveLink
                                                webUrl={shareUrl}
                                                fileName="Supporting Document"
                                                variant="badge"
                                              />
                                            )
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  )}
                                  {((mrf as MRF).attachmentUrl || (mrf as MRF).attachment_url || (mrf as MRF).attachmentShareUrl || (mrf as MRF).attachment_share_url) && (
                                    <div className="mt-3">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Supporting Document</p>
                                      <a
                                        href={(mrf as MRF).attachmentShareUrl || (mrf as MRF).attachment_share_url || (mrf as MRF).attachmentUrl || (mrf as MRF).attachment_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                                      >
                                        <FileText className="h-4 w-4" />
                                        {(mrf as MRF).attachmentName || (mrf as MRF).attachment_name || 'Download Attachment'}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                  <div className="space-y-4">
                    <FilterBar
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      statusFilter={statusFilter}
                      onStatusFilterChange={setStatusFilter}
                      statusOptions={statusOptions}
                      placeholder="Search by title, ID, or requester..."
                      activeFiltersCount={activeFiltersCount}
                      onClearFilters={() => {
                        setStatusFilter("all");
                        setDateFilter("all");
                      }}
                      additionalFilters={
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              Date Range
                            </label>
                            <Select
                              value={dateFilter}
                              onValueChange={setDateFilter}
                            >
                              <SelectTrigger>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4" />
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="week">This Week</SelectItem>
                                <SelectItem value="month">
                                  This Month
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              Sort By
                            </label>
                            <Select value={sortBy} onValueChange={setSortBy}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="date-desc">
                                  Newest First
                                </SelectItem>
                                <SelectItem value="date-asc">
                                  Oldest First
                                </SelectItem>
                                <SelectItem value="amount-desc">
                                  Highest Amount
                                </SelectItem>
                                <SelectItem value="amount-asc">
                                  Lowest Amount
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      }
                    />

                    {/* Results */}
                    <div className="space-y-4 mt-4">
                      {filteredMRFs.map((request) => {
                        const timerColor = getApprovalTimerColor(request);
                        return (
                          <div
                            key={getMrfApiId(request as MRF) || request.id}
                            className="group flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 p-5 sm:p-6 border rounded-xl hover:shadow-lg hover:border-primary/30 transition-all duration-200 bg-card hover:bg-accent/30 cursor-pointer"
                            onClick={() => handleMRFClick(request)}
                          >
                            <div className="flex items-start gap-4 min-w-0 flex-1">
                              <div className="w-12 h-12 bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-primary/10 group-hover:ring-primary/30 transition-all">
                                <Package className="h-6 w-6 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2.5">
                                  <h3 className="font-semibold text-base sm:text-lg leading-tight mr-1">
                                    {request.title}
                                  </h3>
                                  {request.isResubmission && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Resubmission
                                    </Badge>
                                  )}
                                  {/* Executive Approval Indicator */}
                                  {(() => {
                                    const executiveApproved =
                                      (request as any).executiveApproved ||
                                      (request as any).executive_approved ||
                                      isExecutiveApproved(request as MRF);
                                    if (executiveApproved) {
                                      return (
                                        <Badge className="bg-green-500 text-white hover:bg-green-600">
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Executive Approved
                                        </Badge>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {/* SCD Approval Badge */}
                                  {(() => {
                                    const m = request as any;
                                    // Show SCD badge for:
                                    // 1. Explicit SCD approval fields from backend
                                    // 2. Last action was by supply_chain_director
                                    // 3. At procurement_review stage with any SCD approval (initial approval)
                                    // 4. At later stages that indicate SCD approval (final approval like invoice_approved)
                                    const stage = getMRFStage(request as MRF);
                                    const workflowState = getWorkflowState(
                                      request as MRF,
                                    );

                                    const scdApproved =
                                      m.scd_approved ||
                                      m.scdApproved ||
                                      m.director_approved ||
                                      m.directorApproved ||
                                      m.supply_chain_approved ||
                                      m.supplyChainApproved ||
                                      m.last_action_by_role ===
                                        "supply_chain_director" ||
                                      ((stage === "procurement" ||
                                        stage === "procurement_review") &&
                                        isSupplyChainDirectorInitialApproved(
                                          request as MRF,
                                        )) ||
                                      isSupplyChainApproved(request as MRF);

                                    if (scdApproved) {
                                      return (
                                        <Badge className="bg-purple-500 text-white hover:bg-purple-600">
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          SCD Approved
                                        </Badge>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {/* Overall workflow performance badge — Procurement view only */}
                                  {(() => {
                                    const m = request as MRF;
                                    const stage = getMRFStage(m);
                                    if (stage === "rejected") return null;
                                    const createdRaw = m.created_at || m.date;
                                    if (!createdRaw) return null;
                                    const createdMs = new Date(
                                      createdRaw,
                                    ).getTime();
                                    if (Number.isNaN(createdMs)) return null;
                                    const isCompleted = stage === "completed";
                                    const completionProxy =
                                      m.grn_completed_at ||
                                      m.payment_approved_at ||
                                      m.procurement_review_started_at;
                                    const endMs =
                                      isCompleted && completionProxy
                                        ? new Date(completionProxy).getTime()
                                        : Date.now();
                                    const totalElapsed = endMs - createdMs;
                                    const isDelayed =
                                      totalElapsed > 5 * 24 * 60 * 60 * 1000;
                                    return isDelayed ? (
                                      <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Delayed
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Efficient
                                      </Badge>
                                    );
                                  })()}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-2.5">
                                  <span className="font-medium">
                                    {getDisplayId(request)}
                                  </span>
                                  <span>•</span>
                                  <span>{request.requester}</span>
                                  <span>•</span>
                                  <span>
                                    {formatDateLagos(getMRFDate(request), {
                                      includeTime: false,
                                      format: "medium",
                                    })}
                                  </span>
                                  <span>•</span>
                                  <span className="font-semibold text-foreground ml-1">
                                    {parseFloat(request.estimatedCost || "0") >
                                    0
                                      ? `₦${parseInt(request.estimatedCost).toLocaleString()}`
                                      : "-"}
                                  </span>
                                </div>
                                {request.currentStage && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Stage:{" "}
                                    <span className="font-medium">
                                      {getWorkflowStageLabel(
                                        request.currentStage,
                                      )}
                                    </span>
                                  </p>
                                )}
                                {/* Invoice/PFI Access */}
                                {getMRFPFIUrl(request as MRF) && (
                                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadPFI(request as MRF);
                                      }}
                                    >
                                      <FileText className="h-3 w-3 mr-1" />
                                      View Invoice
                                    </Button>
                                    {(() => {
                                      const shareUrl =
                                        (request as any).invoice_onedrive_url ||
                                        (request as any).invoiceOneDriveUrl ||
                                        (request as MRF).pfi_share_url ||
                                        (request as MRF).pfiShareUrl;
                                      return (
                                        shareUrl && (
                                          <OneDriveLink
                                            webUrl={shareUrl}
                                            fileName="Supporting Document"
                                            variant="badge"
                                            size="sm"
                                          />
                                        )
                                      );
                                    })()}
                                  </div>
                                )}
                                {((request as MRF).attachmentUrl || (request as MRF).attachment_url || (request as MRF).attachmentShareUrl || (request as MRF).attachment_share_url) && (
                                  <div className="mt-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Supporting Document</p>
                                    <a
                                      href={(request as MRF).attachmentShareUrl || (request as MRF).attachment_share_url || (request as MRF).attachmentUrl || (request as MRF).attachment_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                                    >
                                      <FileText className="h-4 w-4" />
                                      {(request as MRF).attachmentName || (request as MRF).attachment_name || 'Download Attachment'}
                                    </a>
                                  </div>
                                )}
                                {/* Quotations Section - Show if RFQ exists and has quotations */}
                                {(() => {
                                  const mrfQuotations =
                                    getQuotationsForMRF(request);
                                  const rfq = getRFQForMRF(request);
                                  if (!rfq || mrfQuotations.length === 0)
                                    return null;

                                  return (
                                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                            Vendor Quotations (
                                            {mrfQuotations.length})
                                          </span>
                                        </div>
                                      </div>
                                      <div className="space-y-2.5">
                                        {mrfQuotations.map((quotation: any) => (
                                            <div
                                              key={quotation.id}
                                              className="flex flex-col gap-3 p-4 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <div className="min-w-0 space-y-2 pb-3 border-b border-blue-100 dark:border-blue-800/60">
                                               <p className="text-sm font-medium leading-snug break-words">
                                                {quotation.vendorName ||
                                                  quotation.vendor_name ||
                                                  "Vendor"}
                                              </p>
                                              {(() => {
                                                const quoteAmount = Number(
                                                  quotation.totalAmount ??
                                                    quotation.total_amount ??
                                                    quotation.total ??
                                                    quotation.price ??
                                                    0,
                                                );
                                                const budgetRaw =
                                                  rfq?.estimatedBudget ??
                                                  (rfq as any)?.estimated_budget ??
                                                  (rfq as any)?.estimatedCost ??
                                                  (rfq as any)?.estimated_cost ??
                                                  (request as MRF).estimatedCost ??
                                                  (request as MRF).estimated_cost ??
                                                  null;
                                                const budget = Number(budgetRaw) || 0;
                                                const currency =
                                                  quotation.currency ?? "NGN";

                                                let amountColor =
                                                  "text-muted-foreground";
                                                let badge: React.ReactNode = null;
                                                let bar: React.ReactNode = null;

                                                if (budget > 0) {
                                                  const diff = quoteAmount - budget;
                                                  const pct = Math.round(
                                                    (diff / budget) * 100,
                                                  );
                                                  const abs = Math.abs(pct);
                                                  let label = "";
                                                  let badgeCls = "";
                                                  if (abs <= 2) {
                                                    label = "At budget";
                                                    badgeCls =
                                                      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800";
                                                    amountColor =
                                                      "text-amber-700 dark:text-amber-300";
                                                  } else if (pct < 0) {
                                                    label = `Under budget by ${abs}%`;
                                                    badgeCls =
                                                      "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200 dark:border-green-800";
                                                    amountColor =
                                                      "text-green-700 dark:text-green-400";
                                                  } else {
                                                    label = `Over budget by ${pct}%`;
                                                    badgeCls =
                                                      "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800";
                                                    amountColor =
                                                      "text-red-700 dark:text-red-400";
                                                  }
                                                  badge = (
                                                    <Badge
                                                      variant="outline"
                                                      className={`text-[10px] ${badgeCls}`}
                                                    >
                                                      {label}
                                                    </Badge>
                                                  );
                                                  const fillPct = Math.min(
                                                    100,
                                                    (quoteAmount / budget) * 100,
                                                  );
                                                  const overPct =
                                                    quoteAmount > budget
                                                      ? Math.min(
                                                          100,
                                                          ((quoteAmount - budget) /
                                                            budget) *
                                                            100,
                                                        )
                                                      : 0;
                                                  bar = (
                                                    <div className="mt-2 h-1.5 w-full max-w-xs rounded bg-muted overflow-hidden flex">
                                                      <div
                                                        className="h-full bg-green-500"
                                                        style={{
                                                          width: `${fillPct}%`,
                                                        }}
                                                      />
                                                      {overPct > 0 && (
                                                        <div
                                                          className="h-full bg-red-500"
                                                          style={{
                                                            width: `${overPct}%`,
                                                          }}
                                                        />
                                                      )}
                                                    </div>
                                                  );
                                                }

                                                return (
                                                  <>
                                                     <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                                                      <span>
                                                        Price:{" "}
                                                        <span
                                                          className={`font-semibold ${amountColor}`}
                                                        >
                                                          {formatAmount(
                                                            quoteAmount,
                                                            currency,
                                                          )}
                                                        </span>
                                                      </span>
                                                      {badge}
                                                      {(quotation.deliveryDate ||
                                                        quotation.delivery_date) && (
                                                        <span>
                                                          • Delivery:{" "}
                                                          {new Date(
                                                            quotation.deliveryDate ||
                                                              quotation.delivery_date,
                                                          ).toLocaleDateString()}
                                                        </span>
                                                      )}
                                                    </p>
                                                    {bar}
                                                  </>
                                                );
                                              })()}
                                            </div>
                                            {(() => {
                                              // Gate "Generate PO" strictly on workflow state.
                                              // Initial SCD approval moves MRF to procurement_review (quotation selection).
                                              // Final SCD sign-off / vendor approval moves it to PO generation states.
                                              const wfState = getWorkflowState(
                                                request as MRF,
                                              );
                                              const showGeneratePO =
                                                wfState ===
                                                  "invoice_approved" ||
                                                wfState ===
                                                  "pending_po_upload" ||
                                                wfState === "vendor_approved";

                                              if (showGeneratePO) {
                                                // Show "Generate PO" button after SCD approval
                                                // Open the new two-section Create PO form
                                                const isDraft = Boolean(
                                                  (request as MRF & { is_po_draft?: boolean }).is_po_draft,
                                                );
                                                return (
                                                  <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="text-xs w-full"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const row = request as MRF;
                                                      const apiId = getMrfApiId(row);
                                                      if (!apiId) {
                                                        toast({
                                                          title: "Missing MRF identifier",
                                                          description:
                                                            "Could not resolve this row's id for PO generation (expected formatted id or mrf id). Try refreshing the list.",
                                                          variant: "destructive",
                                                        });
                                                        return;
                                                      }
                                                      setCreatePOFastTrack(false);
                                                      setCreatePOAllowMissingRfq(
                                                        false,
                                                      );
                                                      setCreatePOMrfId(apiId);
                                                      setCreatePOOpen(true);
                                                    }}
                                                  >
                                                    {isDraft ? "Continue PO Draft" : "Generate PO"}
                                                  </Button>
                                                );
                                              } else {
                                                // Show "Select & Send for Approval" button before SCD approval
                                                return wfState ===
                                                  "vendor_selected" ? (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-xs w-full text-green-600 border-green-600 cursor-not-allowed opacity-75"
                                                    disabled
                                                  >
                                                    ✓ Sent for Approval
                                                  </Button>
                                                ) : (
                                                  <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="text-xs w-full"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setVendorSelectionTarget({
                                                        kind: "mrf",
                                                        request: request as unknown as MRFRequest,
                                                        rfq,
                                                        quotation,
                                                      });
                                                      setVendorSelectionReason("");
                                                      setVendorSelectionDialogOpen(
                                                        true,
                                                      );
                                                    }}
                                                  >
                                                    Select & Send for Approval
                                                  </Button>
                                                );
                                              }
                                            })()}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                                {(() => {
                                  const mrfQuotations =
                                    getQuotationsForMRF(request);
                                  const rfq = getRFQForMRF(request);
                                  const wfState = getWorkflowState(
                                    request as MRF,
                                  );
                                  const showGeneratePO =
                                    wfState === "invoice_approved" ||
                                    wfState === "pending_po_upload" ||
                                    wfState === "vendor_approved";
                                  if (!showGeneratePO) return null;
                                  if (rfq && mrfQuotations.length > 0)
                                    return null;

                                  const row = request as MRF;
                                  const apiId = getMrfApiId(row);
                                  if (!apiId) return null;

                                  const isProcurement =
                                    user?.role === "procurement" ||
                                    user?.role === "procurement_manager";
                                  if (!isProcurement) return null;

                                  const isDraft = Boolean(
                                    (row as MRF & { is_po_draft?: boolean })
                                      .is_po_draft,
                                  );
                                  return (
                                    <div className="mt-4 rounded-lg border border-dashed border-primary/35 bg-muted/20 p-4">
                                      <p className="text-xs text-muted-foreground mb-2 leading-snug">
                                        No RFQ or quotations on file for this MRF. You can still create a PO using the
                                        fast-track form: enter suppliers and pricing in the price comparison sheet, then
                                        generate the PO for Supply Chain Director approval.
                                      </p>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCreatePOFastTrack(true);
                                          setCreatePOAllowMissingRfq(true);
                                          setCreatePOMrfId(apiId);
                                          setCreatePOOpen(true);
                                        }}
                                      >
                                        {isDraft
                                          ? "Continue PO (no RFQ)"
                                          : "Generate PO (no RFQ)"}
                                      </Button>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 self-stretch lg:self-center lg:justify-end lg:flex-nowrap pt-3 lg:pt-0 lg:pl-3 border-t lg:border-t-0 lg:border-l border-border/40">
                              <div className="flex items-center gap-2 flex-shrink-0 pr-1">
                                {timerColor && (
                                  <span className="flex items-center gap-1.5">
                                    <Clock
                                      className={`h-4 w-4 ${timerColor}`}
                                    />
                                    {getElapsedTimeText(request) && (
                                      <span
                                        className={`text-xs font-medium ${timerColor}`}
                                      >
                                        {getElapsedTimeText(request)}
                                      </span>
                                    )}
                                  </span>
                                )}
                                {getMRFStage(request as MRF) ===
                                  "completed" && (
                                  <CheckCircle2 className="h-5 w-5 text-success" />
                                )}
                                {getMRFStage(request as MRF) === "rejected" && (
                                  <XCircle className="h-5 w-5 text-destructive" />
                                )}
                                <Badge
                                  className={getStatusColor(request.status)}
                                >
                                  {getMRFStatusBadgeText(request as unknown as MRF)}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-2.5">
                                {/* View Details button - Shown for procurement after the FIRST required approval */}
                                {(() => {
                                  const workflowState = getWorkflowState(
                                    request as MRF,
                                  );
                                  const isProcurement =
                                    user?.role === "procurement" ||
                                    user?.role === "procurement_manager";
                                  const canViewDetails = isProcurement;

                                  if (canViewDetails) {
                                    return (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setSelectedMRFForDetails(
                                            request as MRF,
                                          );
                                          setMrfDetailsDialogOpen(true);
                                          setSearchParams(
                                            (prev) => {
                                              const p = new URLSearchParams(prev);
                                              p.delete("srf");
                                              p.set("mrf", getDisplayId(request as MRF));
                                              return p;
                                            },
                                            { replace: true },
                                          );

                                          // Fetch full details
                                          setLoadingFullDetails(true);
                                          try {
                                            const response =
                                              await mrfApi.getFullDetails(
                                                getMrfApiId(request as MRF),
                                              );
                                            if (
                                              response.success &&
                                              response.data
                                            ) {
                                              setMrfFullDetails(response.data);
                                            }
                                          } catch (error) {
                                            console.error(
                                              "Failed to fetch full details:",
                                              error,
                                            );
                                          } finally {
                                            setLoadingFullDetails(false);
                                          }
                                        }}
                                      >
                                        <FileText className="h-3 w-3 mr-1" />
                                        View Details
                                      </Button>
                                    );
                                  }
                                  return null;
                                })()}
                                {/* Upload PO button - Shown when status is pending_po_upload */}
                                {(() => {
                                  const workflowState = getWorkflowState(
                                    request as MRF,
                                  );
                                  const isProcurement =
                                    user?.role === "procurement" ||
                                    user?.role === "procurement_manager";
                                  const isPendingPOUpload =
                                    workflowState === "pending_po_upload";

                                  if (isProcurement && isPendingPOUpload) {
                                    return (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="text-xs bg-primary hover:bg-primary/90"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedMRFForPO(
                                            convertToMRFRequest(request as MRF),
                                          );
                                          setPODialogOpen(true);
                                        }}
                                      >
                                        <Upload className="h-3 w-3 mr-1" />
                                        Upload PO
                                      </Button>
                                    );
                                  }
                                  return null;
                                })()}
                                {/* Send Request to Vendors button - Shown after the FIRST required approval */}
                                {/* The handleGeneratePO function checks canGeneratePO before proceeding */}
                                {(() => {
                                  if (import.meta.env.DEV) {
                                  }
                                  const workflowState = getWorkflowState(
                                    request as MRF,
                                  );
                                  const isProcurement =
                                    user?.role === "procurement" ||
                                    user?.role === "procurement_manager";
                                  const isPendingPOUpload =
                                    workflowState === "pending_po_upload";
                                  const hasInitialApproval =
                                    isInitialApprovalApproved(request as MRF) ||
                                    isSupplyChainApproved(request as MRF);
                                  const canShowPOButton =
                                    isProcurement &&
                                    !isPendingPOUpload &&
                                    hasInitialApproval &&
                                    (workflowState === "procurement_review" ||
                                      workflowState ===
                                        "supply_chain_director_approved" ||
                                      workflowState === "vendor_selected" ||
                                      workflowState === "invoice_received" ||
                                      workflowState === "invoice_approved" ||
                                      (getMRFStage(request as MRF) ===
                                        "procurement" &&
                                        hasInitialApproval));

                                  if (import.meta.env.DEV) {
                                  }

                                  if (!canShowPOButton) return null;

                                  // Check if RFQ already exists for this MRF
                                  const existingRFQ = getRFQForMRF(request);
                                  const buttonText = existingRFQ
                                    ? "Send RFQ to Vendors Again"
                                    : "Send RFQ to Vendors";

                                  return (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleGeneratePO(request);
                                      }}
                                    >
                                      <ShoppingCart className="h-3 w-3 mr-1" />
                                      {buttonText}
                                    </Button>
                                  );
                                })()}
                                {/* Download PO if available */}
                                {getMRFPOUrl(request as MRF) && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadPO(request as MRF);
                                      }}
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Download PO
                                    </Button>
                                    {/* Delete PO button - only for procurement managers */}
                                    {(user?.role === "procurement_manager" ||
                                      user?.role === "procurement") && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePO(request as MRF);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Delete PO
                                      </Button>
                                    )}
                                  </>
                                )}
                                {/* Allow delete for procurement managers - MRFs without PO and in early stages */}
                                {(() => {
                                  const isProcurementManager =
                                    user?.role === "procurement_manager" ||
                                    user?.role === "procurement";
                                  if (!isProcurementManager) return null;

                                  const status = (
                                    request.status || ""
                                  ).toLowerCase();
                                  const currentStage = (
                                    request.currentStage || ""
                                  ).toLowerCase();
                                  const poNumber = getMRFPONumber(
                                    request as MRF,
                                  );
                                  const hasPO = poNumber && poNumber !== "N/A";
                                  const isEarlyStage =
                                    !hasPO &&
                                    (status === "pending" ||
                                      status.includes("rejected") ||
                                      status === "procurement" ||
                                      status === "executive_review" ||
                                      status === "chairman_review" ||
                                      currentStage === "pending" ||
                                      currentStage === "procurement");

                                  if (!isEarlyStage) return null;

                                  return (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-xs text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteMRF(
                                          getMrfApiId(request as MRF),
                                        );
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Delete
                                    </Button>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* All MRFs Tab - Read-only view of every MRF */}
            <TabsContent value="all-mrfs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>All Material Request Forms</CardTitle>
                  <CardDescription>
                    Complete list of all MRFs across all stages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mrfLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : mrfRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p>No MRFs found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mrfRequests.map((mrf) => {
                        const cost = parseFloat(getMRFEstimatedCost(mrf));
                        return (
                          <Card
                            key={mrf.id}
                            className="hover:shadow-md transition-shadow"
                          >
                            <CardContent className="p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold truncate">
                                      {mrf.title}
                                    </h3>
                                    {((mrf as any).executive_approved ||
                                      (mrf as any).executiveApproved) && (
                                      <Badge className="bg-green-500 text-white hover:bg-green-600">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Executive Approved
                                      </Badge>
                                    )}
                                    {(() => {
                                      const m = mrf as any;
                                      const scdApproved =
                                        m.scd_approved ||
                                        m.scdApproved ||
                                        m.director_approved ||
                                        m.directorApproved ||
                                        m.supply_chain_approved ||
                                        m.supplyChainApproved ||
                                        m.last_action_by_role ===
                                          "supply_chain_director" ||
                                        isSupplyChainApproved(mrf as MRF);
                                      if (scdApproved) {
                                        return (
                                          <Badge className="bg-purple-500 text-white hover:bg-purple-600">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            SCD Approved
                                          </Badge>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {getDisplayId(mrf)} • {getMRFRequester(mrf)} •{" "}
                                    {mrf.department || "N/A"}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-xs text-muted-foreground">
                                      {formatDateLagos(getMRFDate(mrf), {
                                        includeTime: false,
                                        format: "medium",
                                      })}
                                    </span>
                                    <span className="text-xs font-medium">
                                      {cost > 0
                                        ? `₦${cost.toLocaleString()}`
                                        : "-"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Contract:{" "}
                                      {getMRFContractType(mrf) || "N/A"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className={getStatusColor(mrf.status)}>
                                    {getMRFStatusBadgeText(mrf)}
                                  </Badge>
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

            <TabsContent value="srf" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Service Request Forms</CardTitle>
                      <CardDescription>
                        List of all service requisition requests
                      </CardDescription>
                    </div>
                    {/* Only employees can create SRF */}
                    {(user?.role === "employee" ||
                      user?.role === "general_employee") && (
                      <Button
                        onClick={() => navigate("/procurement/srf/new")}
                        size="sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New SRF
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {srfRequests.map((request) => {
                      const wf = getSrfWorkflowState(request);
                      const isProcurement =
                        user?.role === "procurement" ||
                        user?.role === "procurement_manager";
                      const isPendingPOUpload = wf === "pending_po_upload";
                      const hasScd = isSrfPastSupplyChainDirectorForRfq(request);
                      const canShowRfqButton =
                        isProcurement &&
                        !isPendingPOUpload &&
                        hasScd &&
                        (wf === "procurement_review" ||
                          wf === "supply_chain_director_approved" ||
                          wf === "vendor_selected" ||
                          wf === "invoice_received" ||
                          wf === "invoice_approved" ||
                          wf === "procurement");
                      const existingRFQ = getRFQForSRF(request);
                      const rfqButtonLabel = existingRFQ
                        ? "Send RFQ to Vendors Again"
                        : "Send RFQ to Vendors";
                      const srfQuotations = getQuotationsForSRF(request);
                      const rfq = existingRFQ;

                      return (
                        <div
                          key={collectSrfIdAliases(request).join("-") || request.id}
                          className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex min-w-0 flex-1 gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                                <FileText className="h-6 w-6 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="text-lg font-semibold leading-tight">
                                  {request.title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {getDisplayId(request)} •{" "}
                                  {getSrfRequesterDisplayName(request)} •{" "}
                                  {formatMRFDate(
                                    (request as { createdAt?: string }).createdAt ||
                                      (request as { created_at?: string }).created_at ||
                                      request.date,
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Stage:{" "}
                                  <span className="font-medium text-foreground">
                                    {getWorkflowStageLabel(
                                      request.currentStage || wf || "",
                                    )}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <Badge className={getStatusColor(request.status)}>
                                {request.status}
                              </Badge>
                              {canShowRfqButton && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="text-xs"
                                  onClick={() => handleGeneratePOForSrf(request)}
                                >
                                  <ShoppingCart className="h-3 w-3 mr-1" />
                                  {rfqButtonLabel}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedSRFForDetails(request);
                                  setSRFDetailsDialogOpen(true);
                                  setSearchParams(
                                    (prev) => {
                                      const p = new URLSearchParams(prev);
                                      p.delete("mrf");
                                      p.set("srf", getDisplayId(request));
                                      return p;
                                    },
                                    { replace: true },
                                  );
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                            </div>
                          </div>

                          {rfq && srfQuotations.length > 0 && (
                            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                              <div className="mb-3 flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                  Vendor quotations ({srfQuotations.length})
                                </span>
                              </div>
                              <div className="space-y-2.5">
                                {srfQuotations.map((quotation: any) => (
                                  <div
                                    key={String(quotation.id ?? quotation.quotation_id)}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded border border-blue-200 bg-white p-3 dark:border-blue-700 dark:bg-gray-900"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium">
                                        {quotation.vendorName ||
                                          quotation.vendor_name ||
                                          "Vendor"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatAmount(
                                          Number(
                                            quotation.totalAmount ??
                                              quotation.total_amount ??
                                              quotation.price ??
                                              0,
                                          ),
                                          quotation.currency ?? "NGN",
                                        )}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                      {(() => {
                                        if (wf === "vendor_selected") {
                                          return (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="cursor-not-allowed text-xs text-green-600 opacity-75"
                                              disabled
                                            >
                                              Sent for approval
                                            </Button>
                                          );
                                        }
                                        const showSelect =
                                          wf !== "invoice_approved" &&
                                          wf !== "pending_po_upload" &&
                                          wf !== "vendor_approved" &&
                                          wf !== "po_generated";
                                        if (!showSelect) return null;
                                        return (
                                          <Button
                                            size="sm"
                                            variant="default"
                                            className="text-xs"
                                            onClick={() => {
                                              setVendorSelectionTarget({
                                                kind: "srf",
                                                request,
                                                rfq,
                                                quotation,
                                              });
                                              setVendorSelectionReason("");
                                              setVendorSelectionDialogOpen(true);
                                            }}
                                          >
                                            Select & Send for approval
                                          </Button>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="po" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>Purchase Orders</CardTitle>
                    <CardDescription>List of all purchase orders</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setManualPOOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create PO
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mrfRequests
                      .filter((mrf) => {
                        // Show MRFs that have PO numbers (POs have been generated)
                        return getMRFPONumber(mrf as MRF);
                      })
                      .map((mrf) => {
                        const poNumber = getMRFPONumber(mrf as MRF);
                        const quotation = getQuotationsForMRF(mrf).find(
                          (q: any) =>
                            q.status === "Approved" ||
                            q.status === "approved" ||
                            q.status === "awarded",
                        );
                        const vendorName =
                          quotation?.vendorName ||
                          (mrf as any).selectedVendorName ||
                          (mrf as any).vendor_name ||
                          "N/A";
                        const amount = quotation
                          ? quotation.total_amount ||
                            quotation.totalAmount ||
                            quotation.price ||
                            "0"
                          : getMRFEstimatedCost(mrf as MRF);
                        const unsignedPOUrl =
                          getMRFPOUrl(mrf as MRF) ||
                          getMRFPOShareUrl(mrf as MRF) ||
                          (mrf as any).unsigned_po_url ||
                          (mrf as any).unsignedPOShareUrl ||
                          null;
                        const workflowState =
                          (mrf as any).workflow_state ||
                          mrf.status ||
                          "Pending";

                        return (
                          <div
                            key={mrf.id}
                            className="flex items-center justify-between p-5 border rounded-xl hover:shadow-md transition-smooth bg-card"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                                <ShoppingCart className="h-6 w-6 text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-lg">
                                  {mrf.title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  PO: {poNumber} • MRF: {getDisplayId(mrf)} • Vendor:{" "}
                                  {vendorName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Amount: ₦{parseFloat(amount).toLocaleString()}{" "}
                                  • Status:{" "}
                                  {getWorkflowStageLabel(workflowState)} • Date:{" "}
                                  {formatMRFDate(getMRFDate(mrf as MRF))}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(mrf.status)}>
                                {getWorkflowStageLabel(workflowState)}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedMRFForPODetails(
                                    mrf as unknown as MRFRequest,
                                  );
                                  setPODetailsDialogOpen(true);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                              {unsignedPOUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    handleDownloadPO(mrf as MRF);
                                  }}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download PO
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {mrfRequests.filter((mrf) => getMRFPONumber(mrf as MRF))
                      .length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No purchase orders generated yet</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </PullToRefresh>

      <POGenerationDialog
        open={poDialogOpen}
        onOpenChange={(open) => {
          setPODialogOpen(open);
          if (!open) {
            setRfqCreateSource("mrf");
            setSelectedMRFForPO(null);
          }
        }}
        mrf={selectedMRFForPO}
        onGenerate={handlePOGeneration}
        onSave={handleSavePO}
        isGenerating={poGenerating}
      />

      {/* New PO Generator (two-section form with price comparison sheet) */}
      <CreatePODialog
        open={createPOOpen}
        onOpenChange={(o) => {
          setCreatePOOpen(o);
          if (!o) {
            setCreatePOMrfId(null);
            setCreatePOFastTrack(false);
            setCreatePOAllowMissingRfq(false);
          }
        }}
      >
        <CreatePODialogContent className="flex w-[95vw] max-w-5xl max-h-[85vh] flex-col gap-4 overflow-hidden p-6">
          <CreatePODialogHeader className="flex-shrink-0 pr-8">
            <CreatePODialogTitle>
              {createPOFastTrack || createPOAllowMissingRfq
                ? 'Create Purchase Order (fast-track)'
                : 'Create Purchase Order'}
            </CreatePODialogTitle>
          </CreatePODialogHeader>
          {createPOMrfId && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CreatePOForm
                key={createPOMrfId}
                mrfId={createPOMrfId}
                fastTrack={createPOFastTrack}
                allowMissingRfq={createPOAllowMissingRfq}
                onFinalised={() => {
                  void fetchMRFs();
                }}
                onRequestClose={() => {
                  setCreatePOOpen(false);
                  setCreatePOMrfId(null);
                  setCreatePOFastTrack(false);
                  setCreatePOAllowMissingRfq(false);
                }}
              />
            </div>
          )}
        </CreatePODialogContent>
      </CreatePODialog>

      <Dialog
        open={vendorSelectionDialogOpen}
        onOpenChange={(open) => {
          setVendorSelectionDialogOpen(open);
          if (!open && !vendorSelectionSubmitting) {
            setVendorSelectionTarget(null);
            setVendorSelectionReason("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reason for vendor selection</DialogTitle>
            <DialogDescription>
              This justification is sent with your selection and recorded on the
              price comparison (selection reason). Minimum 10 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="vendor-selection-reason">
              Why this vendor / quotation?
            </Label>
            <Textarea
              id="vendor-selection-reason"
              rows={5}
              value={vendorSelectionReason}
              onChange={(e) => setVendorSelectionReason(e.target.value)}
              placeholder="e.g. Best total cost, shortest lead time, meets spec, prior performance…"
              disabled={vendorSelectionSubmitting}
              className="resize-y min-h-[120px]"
            />
            {vendorSelectionTarget && (
              <p className="text-xs text-muted-foreground">
                MRF:{" "}
                {getDisplayId(vendorSelectionTarget.request as unknown as MRF)}{" "}
                · RFQ: {getDisplayId(vendorSelectionTarget.rfq)}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!vendorSelectionSubmitting) {
                  setVendorSelectionDialogOpen(false);
                  setVendorSelectionTarget(null);
                  setVendorSelectionReason("");
                }
              }}
              disabled={vendorSelectionSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmVendorSelectionSend()}
              disabled={vendorSelectionSubmitting}
            >
              {vendorSelectionSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Select & send for approval"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual PO quick-start: creates a backing MRF, then opens CreatePOForm */}
      <ManualPOQuickStartDialog
        open={manualPOOpen}
        onOpenChange={setManualPOOpen}
        onMRFCreated={(newId) => {
          void fetchMRFs();
          setCreatePOFastTrack(true);
          setCreatePOAllowMissingRfq(true);
          setCreatePOMrfId(newId);
          setCreatePOOpen(true);
        }}
      />

      {/* GRN Completion Dialog */}
      {selectedMRFForGRN && (
        <GRNCompletionDialog
          open={grnCompletionDialogOpen}
          onOpenChange={setGrnCompletionDialogOpen}
          mrf={selectedMRFForGRN}
          onSuccess={handleGRNCompletionSuccess}
        />
      )}

      {/* PO Details Dialog */}
      {selectedMRFForPODetails && (
        <Dialog
          open={poDetailsDialogOpen}
          onOpenChange={setPODetailsDialogOpen}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Purchase Order Details</DialogTitle>
              <DialogDescription>
                PO Number:{" "}
                {getMRFPONumber(selectedMRFForPODetails as unknown as MRF)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* PO Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">PO Number</Label>
                  <p className="font-medium">
                    {getMRFPONumber(selectedMRFForPODetails as unknown as MRF)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">MRF ID</Label>
                  <p className="font-medium">{getDisplayId(selectedMRFForPODetails)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Title</Label>
                  <p className="font-medium">{selectedMRFForPODetails.title}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge
                    className={getStatusColor(selectedMRFForPODetails.status)}
                  >
                    {getMRFStatusBadgeText(selectedMRFForPODetails as unknown as MRF)}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created Date</Label>
                  <p className="font-medium">
                    {formatMRFDate(
                      getMRFDate(selectedMRFForPODetails as unknown as MRF),
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Requester</Label>
                  <p className="font-medium">
                    {getMRFRequester(selectedMRFForPODetails as unknown as MRF)}
                  </p>
                </div>
              </div>

              {/* Vendor Information */}
              {(() => {
                const quotation = getQuotationsForMRF(
                  selectedMRFForPODetails as unknown as MRF,
                ).find(
                  (q: any) =>
                    q.status === "Approved" ||
                    q.status === "approved" ||
                    q.status === "awarded",
                );
                if (!quotation) return null;

                return (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Vendor Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">
                          Vendor Name
                        </Label>
                        <p className="font-medium">
                          {quotation.vendorName || "N/A"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">
                          Total Amount
                        </Label>
                        <p className="font-medium">
                          {formatAmount(quotation.total, quotation.currency)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">
                          Delivery Days
                        </Label>
                        <p className="font-medium">
                          {formatDays(quotation.deliveryDays)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">
                          Payment Terms
                        </Label>
                        <p className="font-medium">
                          {displayString(
                            quotation.paymentTerms ?? quotation.payment_terms,
                          )}
                        </p>
                      </div>
                      {quotation.currency && (
                        <div>
                          <Label className="text-muted-foreground">
                            Currency
                          </Label>
                          <p className="font-medium">{quotation.currency}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* PO Items */}
              {(() => {
                const quotation = getQuotationsForMRF(
                  selectedMRFForPODetails as unknown as MRF,
                ).find(
                  (q: any) =>
                    q.status === "Approved" ||
                    q.status === "approved" ||
                    q.status === "awarded",
                );
                const items = quotation?.items || [];

                if (items.length === 0) {
                  // Fallback: show MRF description if no items
                  return (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-3">Description</h3>
                      <p className="text-muted-foreground">
                        {selectedMRFForPODetails.description ||
                          "No items specified"}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Items</h3>
                    <div className="space-y-2">
                      {items.map((item: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded-md">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              {item.item_name || item.name ? (
                                <p className="font-medium">
                                  {item.item_name || item.name}
                                </p>
                              ) : (
                                <p className="font-medium text-muted-foreground italic">
                                  Unnamed item
                                </p>
                              )}
                              {item.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {item.description}
                                </p>
                              )}
                              <div className="grid grid-cols-3 gap-4 mt-2 text-sm text-muted-foreground">
                                <span>Quantity: {item.quantity || "N/A"}</span>
                                <span>
                                  Unit Price: ₦
                                  {parseFloat(
                                    item.unit_price || item.unitPrice || "0",
                                  ).toLocaleString()}
                                </span>
                                <span>
                                  Total: ₦
                                  {parseFloat(
                                    item.total_price ||
                                      item.quantity *
                                        (item.unit_price ||
                                          item.unitPrice ||
                                          0) ||
                                      "0",
                                  ).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* PO Document */}
              {(() => {
                const unsignedPOUrl =
                  getMRFPOUrl(selectedMRFForPODetails as unknown as MRF) ||
                  getMRFPOShareUrl(selectedMRFForPODetails as unknown as MRF);

                if (!unsignedPOUrl) return null;

                return (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">PO Document</h3>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          handleDownloadPO(
                            selectedMRFForPODetails as unknown as MRF,
                          );
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Purchase Order
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          handleDeletePO(
                            selectedMRFForPODetails as unknown as MRF,
                          );
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete PO
                      </Button>
                    </div>
                  </div>
                );
              })()}
              {/* Phase 2 — procurement document registry */}
              <ProcurementDocumentsPanel
                mrfId={
                  getMrfApiId(selectedMRFForPODetails as unknown as MRF) ||
                  String((selectedMRFForPODetails as any).id ?? "")
                }
              />
              {/* Phase 3 — Finance AP workflow gates */}
              <WorkflowGatesPanel
                mrfId={
                  getMrfApiId(selectedMRFForPODetails as unknown as MRF) ||
                  String((selectedMRFForPODetails as any).id ?? "")
                }
              />
              {/* Phase 5 — Delivery confirmation checklist (PM) */}
              <DeliveryConfirmationPanel
                mrfId={
                  getMrfApiId(selectedMRFForPODetails as unknown as MRF) ||
                  String((selectedMRFForPODetails as any).id ?? "")
                }
              />
              {/* Phase 6/7 — Finance AP sync (visible per available-actions / routing) */}
              <MrfFinanceSyncSection
                mrfId={
                  getMrfApiId(selectedMRFForPODetails as unknown as MRF) ||
                  String((selectedMRFForPODetails as any).id ?? "")
                }
                mrf={selectedMRFForPODetails as unknown as MRF}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* GRN Requested Section */}
      {grnRequestedMRFs.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>GRN Requests</CardTitle>
            <CardDescription>
              Complete Goods Received Notes for processed payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {grnRequestedMRFs.map((mrf) => (
                <div
                  key={mrf.id}
                  className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 border rounded-xl bg-card hover:shadow-md transition-smooth"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{mrf.title}</h3>
                      <Badge variant="outline">{getDisplayId(mrf)}</Badge>
                      {getMRFPONumber(mrf) && (
                        <Badge variant="outline">
                          PO: {getMRFPONumber(mrf)}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Requester
                        </p>
                        <p className="font-medium">{getMRFRequester(mrf)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Amount</p>
                        <p className="font-bold text-lg">
                          ₦
                          {parseFloat(
                            getMRFEstimatedCost(mrf),
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Requested At
                        </p>
                        <p className="font-medium">
                          {mrf.grn_requested_at || mrf.grnRequestedAt
                            ? new Date(
                                mrf.grn_requested_at || mrf.grnRequestedAt,
                              ).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 self-start lg:self-center">
                    <Button
                      size="sm"
                      onClick={() => handleCompleteGRN(mrf)}
                      disabled={poGenerating}
                    >
                      {poGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-1" />
                          Complete GRN
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MRF Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this Material Request Form? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMRF}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete PO Confirmation Dialog */}
      <AlertDialog
        open={deletePODialogOpen}
        onOpenChange={setDeletePODialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the PO for MRF{" "}
              {selectedMRFForPODelete?.id}? This will clear the PO number and
              files, allowing you to regenerate a new PO. The MRF will be reset
              to the procurement stage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPO}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePO}
              disabled={isDeletingPO}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingPO ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete PO"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MRF Details Dialog */}
        <Dialog
          open={mrfDetailsDialogOpen}
          onOpenChange={(open) => {
            setMrfDetailsDialogOpen(open);
            if (!open) {
              setMrfFullDetails(null);
              setSelectedMRFForDetails(null);
              setSearchParams(
                (prev) => {
                  const p = new URLSearchParams(prev);
                  p.delete("mrf");
                  return p;
                },
                { replace: true },
              );
            }
          }}
        >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>MRF Full Details</DialogTitle>
            <DialogDescription>
              Complete information about this Material Request Form with all
              quotations and progress
            </DialogDescription>
          </DialogHeader>
          {loadingFullDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            selectedMRFForDetails && (
              <div className="space-y-6 mt-4">
                {/* Progress Tracker */}
                <MRFProgressTracker
                  mrfId={getMrfApiId(selectedMRFForDetails)}
                  showTitle={true}
                  contractType={
                    (selectedMRFForDetails as any).contract_type ||
                    (selectedMRFForDetails as any).contractType
                  }
                  stageTimestamps={selectedMRFForDetails as any}
                  paymentSchedule={
                    (selectedMRFForDetails as any).paymentSchedule ||
                    (selectedMRFForDetails as any).payment_schedule ||
                    null
                  }
                  documentsByType={
                    (selectedMRFForDetails as any).documentsByType ||
                    (selectedMRFForDetails as any).procurementDocuments?.documentsByType
                  }
                  activeByType={
                    (selectedMRFForDetails as any).activeByType ||
                    (selectedMRFForDetails as any).procurementDocuments?.activeByType
                  }
                />

                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">MRF ID</Label>
                    <p className="font-medium font-mono">
                      {getDisplayId(selectedMRFForDetails)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge
                      className={getStatusColor(selectedMRFForDetails.status)}
                    >
                      {selectedMRFForDetails.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="font-medium">{selectedMRFForDetails.title}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium">
                      {selectedMRFForDetails.category || "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Requester</Label>
                    <p className="font-medium">
                      {selectedMRFForDetails.requester || "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Department</Label>
                    <p className="font-medium">
                      {selectedMRFForDetails.department || "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Date Created
                    </Label>
                    <p className="font-medium">
                      {formatDateLagos(getMRFDate(selectedMRFForDetails), {
                        includeTime: false,
                        format: "medium",
                      })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Estimated Cost
                    </Label>
                    <p className="font-medium text-lg">
                      ₦
                      {parseInt(
                        selectedMRFForDetails.estimatedCost || "0",
                      ).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Quantity</Label>
                    <p className="font-medium">
                      {selectedMRFForDetails.quantity || "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Current Stage
                    </Label>
                    <p className="font-medium capitalize">
                      {getMRFStage(selectedMRFForDetails) || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {selectedMRFForDetails.description && (
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                      {selectedMRFForDetails.description}
                    </p>
                  </div>
                )}

                <LineItemPnLSection
                  type="mrf"
                  id={getMrfApiId(selectedMRFForDetails)}
                  initialPnL={
                    (mrfFullDetails as { profitAndLoss?: import("@/types").ProfitAndLoss })
                      ?.profitAndLoss ||
                    (selectedMRFForDetails as { profitAndLoss?: import("@/types").ProfitAndLoss })
                      ?.profitAndLoss
                  }
                />

                {/* Supporting Document */}
                {getMRFPFIUrl(selectedMRFForDetails) && (
                  <div>
                    <Label className="text-muted-foreground">
                      Supporting Document
                    </Label>
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadPFI(selectedMRFForDetails)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Document
                      </Button>
                      {(() => {
                        const shareUrl =
                          (selectedMRFForDetails as any).invoice_onedrive_url ||
                          (selectedMRFForDetails as any).invoiceOneDriveUrl ||
                          selectedMRFForDetails.pfi_share_url ||
                          selectedMRFForDetails.pfiShareUrl;
                        return (
                          shareUrl && (
                            <OneDriveLink
                              webUrl={shareUrl}
                              fileName="Supporting Document"
                              variant="button"
                              size="sm"
                            />
                          )
                        );
                      })()}
                    </div>
                  </div>
                )}

                {(selectedMRFForDetails.attachmentUrl || selectedMRFForDetails.attachment_url || selectedMRFForDetails.attachmentShareUrl || selectedMRFForDetails.attachment_share_url) && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Supporting Document</p>
                    <a
                      href={selectedMRFForDetails.attachmentShareUrl || selectedMRFForDetails.attachment_share_url || selectedMRFForDetails.attachmentUrl || selectedMRFForDetails.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      {selectedMRFForDetails.attachmentName || selectedMRFForDetails.attachment_name || 'Download Attachment'}
                    </a>
                  </div>
                )}

                {/* Executive Approval Section - Highlighted in Green */}
                {(() => {
                  const executiveApproved =
                    (selectedMRFForDetails as any).executiveApproved ||
                    (selectedMRFForDetails as any).executive_approved;
                  const executiveApprovedAt =
                    (selectedMRFForDetails as any).executiveApprovedAt ||
                    (selectedMRFForDetails as any).executive_approved_at;
                  const executiveApprovedBy =
                    (selectedMRFForDetails as any).executiveApprovedBy ||
                    (selectedMRFForDetails as any).executive_approved_by;
                  const executiveRemarks =
                    (selectedMRFForDetails as any).executiveRemarks ||
                    (selectedMRFForDetails as any).executive_remarks;

                  if (executiveApproved) {
                    return (
                      <div className="p-4 bg-green-50 dark:bg-green-950 border-2 border-green-500 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <Label className="text-green-900 dark:text-green-100 font-semibold">
                            Executive Approval
                          </Label>
                          <Badge className="bg-green-500 text-white">
                            Approved
                          </Badge>
                        </div>
                        {executiveApprovedAt && (
                          <p className="text-sm text-green-800 dark:text-green-200">
                            Approved on: {formatMRFDate(executiveApprovedAt)}
                          </p>
                        )}
                        {executiveApprovedBy && (
                          <p className="text-sm text-green-800 dark:text-green-200">
                            Approved by:{" "}
                            {typeof executiveApprovedBy === "object" &&
                            executiveApprovedBy !== null
                              ? executiveApprovedBy.name ||
                                executiveApprovedBy.email ||
                                "Unknown"
                              : executiveApprovedBy}
                            {typeof executiveApprovedBy === "object" &&
                              executiveApprovedBy !== null &&
                              executiveApprovedBy.email &&
                              ` (${executiveApprovedBy.email})`}
                          </p>
                        )}
                        {executiveRemarks && (
                          <p className="text-sm text-green-800 dark:text-green-200 mt-2">
                            <span className="font-semibold">Remarks:</span>{" "}
                            {executiveRemarks}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* SCD Approval Section - Highlighted in Purple */}
                {(() => {
                  const scdApprovedBy =
                    (selectedMRFForDetails as any).scd_approved_by ||
                    (selectedMRFForDetails as any).director_approved_by ||
                    (selectedMRFForDetails as any).supply_chain_approved_by;
                  const scdApprovedAt =
                    (selectedMRFForDetails as any).scd_approved_at ||
                    (selectedMRFForDetails as any).director_approved_at ||
                    (selectedMRFForDetails as any).supply_chain_approved_at;
                  const scdRemarks =
                    (selectedMRFForDetails as any).scd_remarks ||
                    (selectedMRFForDetails as any).director_remarks ||
                    (selectedMRFForDetails as any).supply_chain_remarks;

                  if (scdApprovedBy) {
                    return (
                      <div className="p-4 bg-purple-50 dark:bg-purple-950 border-2 border-purple-500 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          <Label className="text-purple-900 dark:text-purple-100 font-semibold">
                            Supply Chain Director Approval
                          </Label>
                          <Badge className="bg-purple-500 text-white">
                            Approved
                          </Badge>
                        </div>
                        {scdApprovedAt && (
                          <p className="text-sm text-purple-800 dark:text-purple-200">
                            Approved on: {formatMRFDate(scdApprovedAt)}
                          </p>
                        )}
                        <p className="text-sm text-purple-800 dark:text-purple-200">
                          Approved by:{" "}
                          {typeof scdApprovedBy === "object" &&
                          scdApprovedBy !== null
                            ? scdApprovedBy.name ||
                              scdApprovedBy.email ||
                              "Unknown"
                            : scdApprovedBy}
                        </p>
                        {scdRemarks && (
                          <p className="text-sm text-purple-800 dark:text-purple-200 mt-2">
                            <span className="font-semibold">Remarks:</span>{" "}
                            {scdRemarks}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Full Approval History */}
                {(() => {
                  const approvalHistory =
                    (selectedMRFForDetails as any).approval_history ||
                    (selectedMRFForDetails as any).approvalHistory ||
                    [];
                  if (approvalHistory.length > 0) {
                    return (
                      <div>
                        <Label className="text-muted-foreground">
                          Approval History
                        </Label>
                        <div className="mt-2 space-y-2">
                          {approvalHistory.map((entry: any, index: number) => (
                            <div key={index} className="p-2 border rounded-md">
                              <p className="text-sm font-medium capitalize">
                                {entry.stage || entry.action || "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {entry.timestamp
                                  ? formatMRFDate(entry.timestamp)
                                  : "N/A"}
                                {entry.remarks && ` • ${entry.remarks}`}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* RFQs and Quotations from Full Details API */}
                {mrfFullDetails ? (
                  <>
                    {/* RFQs Section */}
                    {mrfFullDetails.rfqs && mrfFullDetails.rfqs.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground mb-2 block">
                          Related RFQs ({mrfFullDetails.rfqs.length})
                        </Label>
                        <div className="space-y-3">
                          {mrfFullDetails.rfqs.map((rfq: any) => (
                            <div
                              key={rfq.id}
                              className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium">RFQ ID: {getDisplayId(rfq)}</p>
                                <Badge className={getStatusColor(rfq.status)}>
                                  {rfq.status}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium mb-1">
                                {rfq.title}
                              </p>
                              {rfq.deadline && (
                                <p className="text-xs text-muted-foreground">
                                  Deadline:{" "}
                                  {new Date(rfq.deadline).toLocaleDateString()}
                                </p>
                              )}
                              {rfq.vendors && rfq.vendors.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Sent to {rfq.vendors.length} vendor(s)
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Statistics */}
                    {mrfFullDetails.statistics && (
                      <div>
                        <Label className="text-muted-foreground mb-2 block">
                          Quotation Statistics
                        </Label>
                        <div className="grid grid-cols-4 gap-4">
                          <Card>
                            <CardContent className="pt-4">
                              <p className="text-sm text-muted-foreground">
                                Total Quotations
                              </p>
                              <p className="text-xl font-bold">
                                {mrfFullDetails.statistics.totalQuotations || 0}
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-4">
                              <p className="text-sm text-muted-foreground">
                                Lowest Bid
                              </p>
                              <p className="text-xl font-bold text-success">
                                ₦
                                {mrfFullDetails.statistics.lowestBid?.toLocaleString() ||
                                  "N/A"}
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-4">
                              <p className="text-sm text-muted-foreground">
                                Highest Bid
                              </p>
                              <p className="text-xl font-bold">
                                ₦
                                {mrfFullDetails.statistics.highestBid?.toLocaleString() ||
                                  "N/A"}
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-4">
                              <p className="text-sm text-muted-foreground">
                                Average Bid
                              </p>
                              <p className="text-xl font-bold text-primary">
                                ₦
                                {Math.round(
                                  mrfFullDetails.statistics.averageBid || 0,
                                ).toLocaleString()}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    )}

                    {/* All Quotations */}
                    {mrfFullDetails.quotations &&
                      mrfFullDetails.quotations.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground mb-2 block">
                            All Vendor Quotations (
                            {mrfFullDetails.quotations.length})
                          </Label>
                          <div className="space-y-3">
                            {mrfFullDetails.quotations.map((item: any) => {
                              const n = normalizeQuotation(item);
                              const quotation = item.quotation || item;
                              const vendor = item.vendor || {};
                              return (
                                <div
                                  key={quotation.id || item.id}
                                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <p className="font-semibold">
                                          {n.vendorName ||
                                            vendor.name ||
                                            vendor.company_name ||
                                            "Unknown Vendor"}
                                        </p>
                                        {vendor.rating && (
                                          <div className="flex items-center gap-1">
                                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                            <span className="text-xs">
                                              {vendor.rating}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground mb-2">
                                        Quotation ID: {quotation.id || item.id}{" "}
                                        • RFQ: {quotation.rfqId || item.rfqId}
                                      </p>
                                      {quotation.rfqTitle && (
                                        <p className="text-sm font-medium text-primary mb-2">
                                          {quotation.rfqTitle}
                                        </p>
                                      )}
                                    </div>
                                    <Badge
                                      className={getStatusColor(
                                        quotation.status || "Pending",
                                      )}
                                    >
                                      {quotation.status || "Pending"}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">
                                        Total Amount
                                      </p>
                                      <p className="font-semibold text-lg">
                                        {formatAmount(n.total, n.currency)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">
                                        Delivery Days
                                      </p>
                                      <p className="font-medium">
                                        {formatDays(n.deliveryDays)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">
                                        Payment Terms
                                      </p>
                                      <p className="font-medium">
                                        {displayString(n.paymentTerms)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">
                                        Validity
                                      </p>
                                      <p className="font-medium">
                                        {formatDays(n.validityDays)}
                                      </p>
                                    </div>
                                  </div>
                                  {quotation.notes && (
                                    <div className="mt-3 p-2 bg-muted rounded text-sm">
                                      <p className="font-medium mb-1">Notes:</p>
                                      <p className="text-muted-foreground">
                                        {quotation.notes}
                                      </p>
                                    </div>
                                  )}
                                  {(() => {
                                    const docs = normalizeAttachments(
                                      quotation.attachments,
                                    );
                                    if (docs.length === 0) return null;
                                    return (
                                      <div className="mt-3">
                                        <p className="text-xs font-medium mb-2">
                                          Supporting Documents ({docs.length})
                                        </p>
                                        <div className="space-y-2">
                                          {docs.map((doc, idx) => (
                                            <div
                                              key={idx}
                                              className="flex items-center justify-between gap-2 p-2 border rounded-md bg-background"
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                                <span className="text-xs truncate">
                                                  {doc.name}
                                                </span>
                                              </div>
                                              <a
                                                href={doc.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-primary hover:underline shrink-0"
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
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </>
                ) : (
                  <>
                    {/* Fallback to local data if full details not loaded */}
                    {/* RFQ Information */}
                    {(() => {
                      const rfq = getRFQForMRF(selectedMRFForDetails);
                      if (rfq) {
                        return (
                          <div>
                            <Label className="text-muted-foreground">
                              Related RFQ
                            </Label>
                            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                              <p className="font-medium">RFQ ID: {getDisplayId(rfq)}</p>
                              <p className="text-sm text-muted-foreground">
                                Status: {rfq.status}
                              </p>
                              {rfq.deadline && (
                                <p className="text-sm text-muted-foreground">
                                  Deadline:{" "}
                                  {new Date(rfq.deadline).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Quotations */}
                    {(() => {
                      const mrfQuotations = getQuotationsForMRF(
                        selectedMRFForDetails,
                      );
                      if (mrfQuotations.length > 0) {
                        return (
                          <div>
                            <Label className="text-muted-foreground">
                              Vendor Quotations ({mrfQuotations.length})
                            </Label>
                            <div className="mt-2 space-y-2">
                              {mrfQuotations.map((quotation: any) => (
                                <div
                                  key={quotation.id}
                                  className="p-3 border rounded-md"
                                >
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-medium">
                                        {quotation.vendorName ||
                                          quotation.vendor_name ||
                                          "Vendor"}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Price: ₦
                                        {parseFloat(
                                          quotation.price ||
                                            quotation.total_amount ||
                                            "0",
                                        ).toLocaleString()}
                                        {quotation.deliveryDate &&
                                          ` • Delivery: ${new Date(quotation.deliveryDate).toLocaleDateString()}`}
                                      </p>
                                      {quotation.notes && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {quotation.notes}
                                        </p>
                                      )}
                                    </div>
                                    <Badge
                                      className={getStatusColor(
                                        quotation.status || "Pending",
                                      )}
                                    >
                                      {quotation.status || "Pending"}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* SRF Details Dialog */}
      {selectedSRFForDetails && (
        <Dialog
          open={srfDetailsDialogOpen}
          onOpenChange={(open) => {
            setSRFDetailsDialogOpen(open);
            if (!open) {
              setSelectedSRFForDetails(null);
              setSearchParams(
                (prev) => {
                  const p = new URLSearchParams(prev);
                  p.delete("srf");
                  return p;
                },
                { replace: true },
              );
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Service Request Form Details</DialogTitle>
              <DialogDescription>
                {selectedSRFForDetails.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <SRFDetailPanel
                detail={selectedSRFForDetails as SRFRequest}
                trackerShowTitle
              />
              <LineItemPnLSection
                type="srf"
                id={String(selectedSRFForDetails.id)}
                initialPnL={
                  (selectedSRFForDetails as { profitAndLoss?: import("@/types").ProfitAndLoss })
                    .profitAndLoss
                }
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
};

export default Procurement;
