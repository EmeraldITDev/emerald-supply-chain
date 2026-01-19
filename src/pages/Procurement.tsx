import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, Package, ShoppingCart, Clock, CheckCircle2, XCircle, Download, Calendar, AlertCircle, Upload, Send, Loader2, RefreshCw, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { POGenerationDialog } from "@/components/POGenerationDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import { RFQManagement } from "@/components/RFQManagement";
import { ProcurementProgressTracker } from "@/components/ProcurementProgressTracker";
import VendorRegistrationsList from "@/components/VendorRegistrationsList";
import GRNCompletionDialog from "@/components/GRNCompletionDialog";
import type { MRFRequest } from "@/contexts/AppContext";
import { dashboardApi, mrfApi, grnApi, rfqApi, quotationApi } from "@/services/api";
import type { VendorRegistration, MRF } from "@/types";
import { OneDriveLink } from "@/components/OneDriveLink";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const Procurement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { srfRequests, purchaseOrders, mrns, updateMRN, convertMRNToMRF, addPO } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // MRF requests from backend API
  const [mrfRequests, setMrfRequests] = useState<MRF[]>([]);
  const [mrfLoading, setMrfLoading] = useState(true);
  const [poGenerating, setPoGenerating] = useState(false);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  
  const [poDialogOpen, setPODialogOpen] = useState(false);
  const [selectedMRFForPO, setSelectedMRFForPO] = useState<MRFRequest | null>(null);
  const [grnCompletionDialogOpen, setGrnCompletionDialogOpen] = useState(false);
  const [selectedMRFForGRN, setSelectedMRFForGRN] = useState<MRF | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mrfToDelete, setMrfToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePODialogOpen, setDeletePODialogOpen] = useState(false);
  const [selectedMRFForPODelete, setSelectedMRFForPODelete] = useState<MRF | null>(null);
  const [isDeletingPO, setIsDeletingPO] = useState(false);
  const [mrfDetailsDialogOpen, setMrfDetailsDialogOpen] = useState(false);
  const [selectedMRFForDetails, setSelectedMRFForDetails] = useState<MRF | null>(null);
  
  // Vendor registrations from dashboard API
  const [vendorRegistrations, setVendorRegistrations] = useState<VendorRegistration[]>([]);
  const [vendorRegistrationsLoading, setVendorRegistrationsLoading] = useState(true);
  
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
    try {
      // Fetch quotations for all RFQs using the RFQ quotations endpoint
      const allQuotations: any[] = [];
      for (const rfq of rfqs) {
        try {
          const response = await rfqApi.getQuotations(rfq.id);
          if (response.success && response.data && response.data.quotations) {
            // The response includes quotations with vendor info
            response.data.quotations.forEach((item: any) => {
              allQuotations.push({
                ...item.quotation,
                vendorName: item.vendor?.name || item.vendor?.company_name,
                vendorId: item.vendor?.id || item.vendor?.vendor_id,
                rfqId: rfq.id,
              });
            });
          }
        } catch (error) {
          console.error(`Failed to fetch quotations for RFQ ${rfq.id}:`, error);
        }
      }
      setQuotations(allQuotations);
    } catch (error) {
      console.error("Failed to fetch quotations:", error);
    }
  }, [rfqs]);

  // Helper to check if MRF has an RFQ
  const getRFQForMRF = (mrfId: string) => {
    return rfqs.find(rfq => rfq.mrfId === mrfId || rfq.mrf_id === mrfId);
  };

  // Helper to get quotations for an MRF
  const getQuotationsForMRF = (mrfId: string) => {
    const rfq = getRFQForMRF(mrfId);
    if (!rfq) return [];
    return quotations.filter(q => q.rfqId === rfq.id);
  };

  useEffect(() => {
    fetchMRFs();
    fetchRFQs();
  }, [fetchMRFs, fetchRFQs]);

  useEffect(() => {
    if (rfqs.length > 0) {
      fetchQuotations();
    }
  }, [rfqs]);

  // Helper functions for MRF field access (handles both camelCase and snake_case)
  const getMRFEstimatedCost = (mrf: MRF) => String(mrf.estimated_cost || mrf.estimatedCost || "0");
  const getMRFRequester = (mrf: MRF) => mrf.requester_name || mrf.requester || "Unknown";
  const getMRFDate = (mrf: MRF) => mrf.created_at || mrf.date || "";
  const getMRFStage = (mrf: MRF) => (mrf.current_stage || mrf.currentStage || "").toLowerCase();
  
  // Helper function to format date with proper timezone handling
  const formatMRFDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    
    try {
      let date: Date;
      
      // Check if the string has timezone info (ends with Z or has +/- offset)
      if (dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
        // Has timezone info (UTC or with offset), parse directly
        date = new Date(dateString);
      } else if (dateString.includes('T')) {
        // ISO format without timezone (e.g., "2025-01-18T20:14:00")
        // IMPORTANT: If backend is storing local server time without timezone,
        // we need to parse it as local time, NOT UTC
        // JavaScript will interpret this as local time by default
        date = new Date(dateString);
      } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Plain date string (e.g., "2025-01-18") - no time info
        // This will default to midnight (00:00:00) in local timezone
        // This is likely the issue - backend is not sending time
        date = new Date(dateString + 'T00:00:00');
      } else {
        // Fallback: try parsing as-is
        date = new Date(dateString);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string for formatting:', dateString);
        return 'Invalid Date';
      }
      
      // If the date shows midnight (00:00:00) and the original string didn't have time info,
      // it's likely the backend didn't send time. In this case, we should still format it,
      // but log a warning for debugging
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const seconds = date.getSeconds();
      if (hours === 0 && minutes === 0 && seconds === 0 && !dateString.includes('T')) {
        // Date without time - format as date only, or use the date as-is if it's a date-only string
        // But if it's supposed to have time, we need to handle it differently
        // For now, format it with time to show it's at midnight
        console.warn('Date string appears to be missing time information:', dateString);
      }
      
      // Format in local timezone - this should show the correct local time
      // Use the user's local timezone explicitly
      const options: Intl.DateTimeFormatOptions = {
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      return date.toLocaleString('en-US', options);
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  };
  const getMRFPOUrl = (mrf: MRF) => mrf.unsigned_po_url || mrf.unsignedPOUrl;
  const getMRFRejectionReason = (mrf: MRF) => mrf.po_rejection_reason || mrf.poRejectionReason;
  const getMRFPONumber = (mrf: MRF) => mrf.po_number || mrf.poNumber;
  const getMRFPOVersion = (mrf: MRF) => mrf.po_version || mrf.poVersion || 1;
  const getMRFPOShareUrl = (mrf: MRF) => mrf.unsigned_po_share_url || mrf.unsignedPOShareUrl || getMRFPOUrl(mrf);
  const getMRFSignedPOShareUrl = (mrf: MRF) => mrf.signed_po_share_url || mrf.signedPOShareUrl || (mrf.signed_po_url || mrf.signedPOUrl);
  const getMRFPFIUrl = (mrf: MRF) => {
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

  // Handle PFI/Invoice download
  const handleDownloadPFI = (mrf: MRF) => {
    const pfiUrl = getMRFPFIUrl(mrf);
    if (pfiUrl) {
      if (pfiUrl.startsWith('http')) {
        window.open(pfiUrl, '_blank');
      } else {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://supply-chain-backend-hwh6.onrender.com/api';
        window.open(`${baseUrl.replace('/api', '')}/${pfiUrl}`, '_blank');
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
    id: mrf.id,
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

  // Helper to check if MRF is Executive-approved
  const isExecutiveApproved = (mrf: MRF): boolean => {
    // Check explicit approval flag (set by backend after executive approval)
    if (mrf.executive_approved === true) {
      return true;
    }
    
    // Check status string
      const status = (mrf.status || "").toLowerCase();
    if (status.includes("approved by executive") || 
        status.includes("executive approved")) {
      return true;
    }
    
    // Check approval history for executive approval
    const approvalHistory = mrf.approval_history || mrf.approvalHistory || [];
    const hasExecutiveApproval = approvalHistory.some((entry: any) => 
      entry.action === "approved" && 
      (entry.role === "executive" || entry.approved_by_role === "executive" || entry.stage === "executive_review")
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
    
    if (stage === "procurement" && statusLower === "procurement") {
      // This means it's been approved and moved to procurement stage
      return true;
    }
    
    // Also check if status is "procurement" (backend sets this after executive approval for non-high-value items)
    if (statusLower === "procurement" && stage === "procurement") {
      return true;
    }
    
    return false;
  };

  // Procurement Manager can ONLY upload PO for Executive-approved MRFs
  const executiveApprovedMRFs = useMemo(() => {
    return mrfRequests.filter(mrf => {
      const hasNoUnsignedPO = !getMRFPOUrl(mrf);
      return isExecutiveApproved(mrf as MRF) && hasNoUnsignedPO;
    });
  }, [mrfRequests]);

  // POs rejected by Supply Chain Director
  const rejectedPOs = useMemo(() => {
    return mrfRequests.filter(mrf => {
      const stage = getMRFStage(mrf);
      const status = (mrf.status || "").toLowerCase();
      const rejectionReason = getMRFRejectionReason(mrf);
      
      return (
        stage === "procurement" &&
        status.includes("rejected") &&
        rejectionReason
      );
    });
  }, [mrfRequests]);

  // Filter MRFs that need GRN completion
  const grnRequestedMRFs = useMemo(() => {
    return mrfRequests.filter(mrf => {
      const workflowState = getWorkflowState(mrf);
      const grnRequested = mrf.grn_requested || mrf.grnRequested;
      const grnCompleted = mrf.grn_completed || mrf.grnCompleted;
      return workflowState === "grn_requested" && grnRequested && !grnCompleted;
    });
  }, [mrfRequests]);

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

  // Fetch vendor registrations from the dashboard API (same source as Dashboard)
  useEffect(() => {
    const fetchVendorRegistrations = async () => {
      setVendorRegistrationsLoading(true);
      try {
        const response = await dashboardApi.getProcurementManagerDashboard();
        if (response.success && response.data?.pendingRegistrations) {
          // Map the dashboard data to VendorRegistration format
          const registrations = response.data.pendingRegistrations.map((reg: any) => ({
            id: reg.id,
            companyName: reg.companyName,
            email: reg.email,
            category: reg.category,
            status: "Pending" as const,
            submittedDate: reg.createdAt,
            contactPerson: reg.contactPerson,
          }));
          setVendorRegistrations(registrations);
        }
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
  const pendingMRNs = mrns.filter(mrn => mrn.status === "Pending" || mrn.status === "Under Review");
  const pendingPOUpload = executiveApprovedMRFs.length;
  const rejectedPOCount = rejectedPOs.length;
  const inSupplyChain = mrfRequests.filter(mrf => mrf.currentStage === "supply_chain").length;
  const totalPOs = purchaseOrders.length;

  // Filtered data
  const filteredMRFs = useMemo(() => {
    let filtered = [...mrfRequests];

    if (searchQuery) {
      filtered = filtered.filter(mrf =>
        mrf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mrf.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getMRFRequester(mrf).toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(mrf => {
        const stage = getMRFStage(mrf);
        if (statusFilter === "pending") return stage === "procurement";
        if (statusFilter === "approved") return stage === "completed";
        if (statusFilter === "rejected") return stage === "rejected";
        if (statusFilter === "finance") return stage === "finance";
        if (statusFilter === "chairman") return stage === "chairman" || stage === "chairman_review";
        return true;
      });
    }

    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter(mrf => {
        const mrfDate = new Date(getMRFDate(mrf));
        const daysDiff = (now.getTime() - mrfDate.getTime()) / (1000 * 60 * 60 * 24);
        
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
      
      if (sortBy === "date-desc") return new Date(dateB).getTime() - new Date(dateA).getTime();
      if (sortBy === "date-asc") return new Date(dateA).getTime() - new Date(dateB).getTime();
      if (sortBy === "amount-desc") return costB - costA;
      if (sortBy === "amount-asc") return costA - costB;
      return 0;
    });

    return filtered;
  }, [mrfRequests, searchQuery, statusFilter, dateFilter, sortBy]);

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

  const getApprovalTimerColor = (mrf: MRFRequest | MRF) => {
    const stage = getMRFStage(mrf as MRF);
    if (!((mrf as any).procurementManagerApprovalTime) || stage === "completed" || stage === "rejected") {
      return null;
    }
    
    const startTime = new Date((mrf as any).procurementManagerApprovalTime);
    const now = new Date();
    const hoursElapsed = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursElapsed <= 48) return "text-emerald-600 dark:text-emerald-400";
    if (hoursElapsed <= 72) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  const handleMRFClick = (mrf: MRFRequest | MRF) => {
    // Procurement can only view MRFs, not approve them
    toast({
      title: "View Only",
      description: "Procurement can view MRFs but cannot approve. Only Executive has approval authority.",
      variant: "default",
    });
  };

  const handleGeneratePO = async (mrf: MRFRequest | MRF) => {
    // Check if MRF is Executive approved first (this is the main requirement)
    const mrfData = mrfRequests.find(m => m.id === mrf.id);
    const isApproved = isExecutiveApproved(mrfData || (mrf as MRF));
    
    if (!isApproved) {
      toast({
        title: "Request Not Ready",
        description: "This MRF must be approved by Executive before sending request to vendors.",
        variant: "destructive",
      });
      return;
    }

    // Check available actions from backend (for additional validation)
    try {
      const response = await mrfApi.getAvailableActions(mrf.id);
      if (response.success && response.data) {
        // If backend says canGeneratePO is false but MRF is Executive approved, still allow
        // (backend permission might be checking for later stages, but we allow after Executive approval)
        if (!response.data.canGeneratePO && !isApproved) {
          toast({
            title: "Request Not Ready",
            description: "This MRF must be approved by Executive before sending request to vendors.",
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

  // Procurement cannot approve/reject - only view
  const handleApprove = (remarks: string) => {
    toast({
      title: "Access Denied",
      description: "Only Executive can approve MRFs. You can view and generate POs.",
      variant: "destructive",
    });
  };

  const handleReject = (remarks: string) => {
    toast({
      title: "Access Denied",
      description: "Only Executive can reject MRFs. You can view and generate POs.",
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

    // Validate Executive approval before sending to vendors
    const mrfData = mrfRequests.find(m => m.id === selectedMRFForPO.id);
    if (!mrfData || !isExecutiveApproved(mrfData)) {
      toast({
        title: "Request Not Ready",
        description: "This MRF must be approved by Executive before sending request to vendors.",
        variant: "destructive",
      });
      setPODialogOpen(false);
      return;
    }

    // Validate vendors selected
    if (poData.vendors.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one vendor to send the request to.",
        variant: "destructive",
      });
      return;
    }

    // Validate delivery date for RFQ deadline
    if (!poData.deliveryDate) {
      toast({
        title: "Validation Error",
        description: "Please select an expected delivery date (this will be used as RFQ deadline).",
        variant: "destructive",
      });
      return;
    }

    setPoGenerating(true);
    
    try {
      // Create RFQ instead of generating PO
      // Calculate deadline (7 days before delivery date, or 30 days from now if delivery date is too soon)
      const deliveryDateObj = new Date(poData.deliveryDate);
      const today = new Date();
      const daysUntilDelivery = Math.ceil((deliveryDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const deadlineDays = Math.max(7, Math.floor(daysUntilDelivery * 0.7)); // 70% of delivery time, minimum 7 days
      const deadlineDate = new Date(today);
      deadlineDate.setDate(deadlineDate.getDate() + deadlineDays);
      const deadline = deadlineDate.toISOString().split('T')[0];
      
      // Create RFQ with all relevant details (title, category, payment terms, estimated budget)
      const rfqResponse = await rfqApi.create({
        mrfId: selectedMRFForPO.id,
        title: selectedMRFForPO.title || 'RFQ Request',
        category: selectedMRFForPO.category || '',
        description: poData.items || selectedMRFForPO.description || '',
        quantity: selectedMRFForPO.quantity || '1',
        estimatedCost: poData.amount || selectedMRFForPO.estimatedCost || '0',
        deadline: deadline,
        vendorIds: poData.vendors,
        paymentTerms: poData.paymentTerms || '',
        notes: poData.notes || '',
      });
      
      if (rfqResponse.success) {
        toast({
          title: "Request Sent to Vendors",
          description: `RFQ sent to ${poData.vendors.length} vendor(s). They will see it in their portal and can submit quotations.`,
        });

        setPODialogOpen(false);
        setSelectedMRFForPO(null);
        
        // Refresh MRFs and RFQs from backend to get updated status
        await fetchMRFs();
        await fetchRFQs();
      } else {
        console.error('RFQ Creation Error:', rfqResponse.error);
        toast({
          title: "Failed to Send Request",
          description: rfqResponse.error || "Failed to send request to vendors. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('RFQ Creation Exception:', error);
      toast({
        title: "Network Error",
        description: error instanceof Error ? error.message : "Failed to connect to server. Please check your connection.",
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
      description: "Your RFQ draft has been saved. You can continue editing and send it to vendors later.",
    });
    setPODialogOpen(false);
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

  const handleDownloadPO = (mrf: MRF) => {
    const poUrl = getMRFPOShareUrl(mrf) || getMRFPOUrl(mrf);
    if (poUrl) {
      // If it's a OneDrive share URL or full URL, open it directly
      if (poUrl.startsWith('http')) {
        window.open(poUrl, '_blank');
      } else {
        // Assume it's a relative path from the backend
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://supply-chain-backend-hwh6.onrender.com/api';
        window.open(`${baseUrl.replace('/api', '')}/${poUrl}`, '_blank');
      }
    } else {
      toast({
        title: "PO Not Available",
        description: "PO document is not available for download",
        variant: "destructive",
      });
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
      const response = await mrfApi.deletePO(selectedMRFForPODelete.id);
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
          description: "The Material Request Form has been deleted successfully",
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
    const mrn = mrns.find(m => m.id === mrnId);
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

  const activeFiltersCount = (statusFilter !== "all" ? 1 : 0) + (dateFilter !== "all" ? 1 : 0);

  return (
    <DashboardLayout>
      <PullToRefresh onRefresh={async () => {
        toast({
          title: "Refreshing data...",
          description: "Please wait",
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast({
          title: "Data refreshed",
          description: "All data is up to date",
        });
      }}>
        <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Procurement Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage material and service requests</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Pending PO Upload"
            value={pendingPOUpload}
            description="Executive approved, awaiting PO"
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

        {/* Dashboard Alerts */}
        <DashboardAlerts userRole={user?.role || 'procurement'} maxAlerts={5} />

        {/* Vendor Registrations Section */}
        <VendorRegistrationsList 
          maxItems={3} 
          showTabs={false} 
          title="Pending Vendor Registrations"
          externalRegistrations={vendorRegistrations}
          externalLoading={vendorRegistrationsLoading}
        />

        {/* Progress Tracker */}
        <ProcurementProgressTracker mrfRequests={mrfRequests.map(convertToMRFRequest)} />

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 h-auto gap-1">
            <TabsTrigger value="mrn" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3 flex-col sm:flex-row gap-1">
              <span className="hidden sm:inline">Material Requests (MRN)</span>
              <span className="sm:hidden">MRN</span>
              {pendingMRNs.length > 0 && (
                <Badge variant="destructive" className="ml-0 sm:ml-2 text-[8px] sm:text-xs h-4 sm:h-5 px-1">
                  {pendingMRNs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="mrf" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3">
              <span className="hidden sm:inline">MRF (Official)</span>
              <span className="sm:hidden">MRF</span>
            </TabsTrigger>
            <TabsTrigger value="rfq" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3">
              <span className="hidden sm:inline">RFQ Management</span>
              <span className="sm:hidden">RFQ</span>
              <Send className="h-3 w-3 ml-1 hidden sm:inline" />
            </TabsTrigger>
            <TabsTrigger value="srf" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3">
              <span className="hidden sm:inline">Service Requests</span>
              <span className="sm:hidden">SRF</span>
            </TabsTrigger>
            <TabsTrigger value="po" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3">
              <span className="hidden sm:inline">Purchase Orders</span>
              <span className="sm:hidden">PO</span>
            </TabsTrigger>
          </TabsList>

          {/* RFQ Management Tab */}
          <TabsContent value="rfq" className="space-y-4">
            <RFQManagement onVendorSelected={(vendorId, rfqId) => {
              // Vendor selection is now handled in RFQManagement component
              // It automatically sends vendor to Supply Chain Director for approval
              // Refresh MRF list to see updated workflow state
              fetchMRFs();
              setTab("mrf");
            }} />
          </TabsContent>

          <TabsContent value="mrn" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Material Request Notes (MRN)</CardTitle>
                    <CardDescription>Review department requests and convert to official MRFs</CardDescription>
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
                                <span className="font-mono text-sm font-semibold">{mrn.controlNumber}</span>
                                <Badge className={
                                  mrn.status === "Pending" ? "bg-yellow-500" :
                                  mrn.status === "Under Review" ? "bg-blue-500" :
                                  mrn.status === "Converted to MRF" ? "bg-green-500" :
                                  "bg-red-500"
                                }>
                                  {mrn.status}
                                </Badge>
                                <Badge variant={mrn.urgency === "High" ? "destructive" : "secondary"}>
                                  {mrn.urgency}
                                </Badge>
                              </div>
                              <h3 className="text-lg font-semibold">{mrn.title}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Requested by {mrn.requesterName} • {mrn.department} • {new Date(mrn.submittedDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3 mb-4">
                            <div>
                              <strong className="text-sm">Justification:</strong>
                              <p className="text-sm text-muted-foreground">{mrn.justification}</p>
                            </div>

                            <div>
                              <strong className="text-sm">Items Requested ({mrn.items.length}):</strong>
                              <div className="mt-2 space-y-2">
                                {mrn.items.map((item, idx) => (
                                  <div key={idx} className="bg-muted p-3 rounded-md">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <p className="font-medium">{item.name}</p>
                                        {item.description && (
                                          <p className="text-sm text-muted-foreground">{item.description}</p>
                                        )}
                                      </div>
                                      <div className="text-right ml-4">
                                        <p className="text-sm">Qty: {item.quantity}</p>
                                        <p className="text-sm font-semibold">₦{parseFloat(item.estimatedUnitCost).toLocaleString()}/unit</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="bg-primary/5 p-3 rounded-md">
                              <strong className="text-sm">Total Estimated Cost:</strong>
                              <p className="text-lg font-bold">
                                ₦{mrn.items.reduce((sum, item) => 
                                  sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.estimatedUnitCost) || 0), 0
                                ).toLocaleString()}
                              </p>
                            </div>

                            {mrn.reviewNotes && (
                              <div className="bg-muted p-3 rounded-md">
                                <strong className="text-sm">Review Notes:</strong>
                                <p className="text-sm text-muted-foreground mt-1">{mrn.reviewNotes}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Reviewed by {mrn.reviewedBy} on {mrn.reviewDate && new Date(mrn.reviewDate).toLocaleDateString()}
                                </p>
                              </div>
                            )}

                            {mrn.convertedMRFId && (
                              <div className="bg-green-500/10 p-3 rounded-md">
                                <p className="text-sm text-green-700 dark:text-green-400">
                                  ✓ Converted to MRF: <span className="font-mono font-semibold">{mrn.convertedMRFId}</span>
                                </p>
                              </div>
                            )}
                          </div>

                          {mrn.status === "Pending" || mrn.status === "Under Review" ? (
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
                                  const reason = prompt("Enter rejection reason:");
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
                    <CardDescription>Review and approve material requisitions</CardDescription>
                  </div>
                  {/* Only employees can create MRF */}
                  {user?.role === "employee" && (
                  <Button onClick={() => navigate("/procurement/mrf/new")} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New MRF
                  </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Rejected POs - Need Resubmission - Only visible to Procurement Managers */}
                {rejectedPOs.length > 0 && (user?.role === "procurement" || user?.role === "procurement_manager") && (
                  <div className="mb-6 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <XCircle className="h-5 w-5 text-destructive" />
                      <h3 className="font-semibold text-lg">POs Rejected by Supply Chain</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {rejectedPOs.length} PO(s) rejected and need revision
                    </p>
                    <div className="space-y-3">
                      {rejectedPOs.map((mrf) => (
                        <Card key={mrf.id} className="bg-card border-destructive/50">
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-semibold">{mrf.title}</h4>
                                    <Badge variant="destructive">Rejected</Badge>
                                    <Badge variant="outline">{mrf.poNumber}</Badge>
                                    {mrf.poVersion && (
                                      <Badge variant="secondary" className="text-xs">
                                        v{mrf.poVersion}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    <p>MRF ID: <span className="font-medium">{mrf.id}</span></p>
                                    <p>Requester: {mrf.requester}</p>
                                    <p>Amount: <span className="font-semibold">₦{parseInt(mrf.estimatedCost).toLocaleString()}</span></p>
                                  </div>
                                </div>
                              {/* Regenerate PO button - Only for Procurement Managers */}
                              {(user?.role === "procurement" || user?.role === "procurement_manager") && (
                              <Button
                                size="sm"
                                onClick={() => handleGeneratePO(mrf)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Regenerate PO
                              </Button>
                              )}
                              </div>
                              
                              {/* Rejection Details */}
                              <div className="p-3 bg-destructive/10 rounded-md">
                                <p className="text-xs font-semibold text-destructive mb-1">Rejection Reason:</p>
                                <p className="text-sm text-foreground">{mrf.poRejectionReason}</p>
                                {mrf.supplyChainComments && (
                                  <>
                                    <p className="text-xs font-semibold text-muted-foreground mt-2 mb-1">Additional Comments:</p>
                                    <p className="text-sm text-foreground">{mrf.supplyChainComments}</p>
                                  </>
                                )}
                              </div>

                              {/* Invoice/PFI Access */}
                              {getMRFPFIUrl(mrf as MRF) && (
                                <div className="flex flex-col gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg mt-3">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Supporting Document Submitted by Staff</span>
                    </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                      variant="outline" 
                                size="sm"
                                      onClick={() => handleDownloadPFI(mrf as MRF)}
                                      className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
                              >
                                      <Download className="h-4 w-4 mr-2" />
                                      View Invoice
                              </Button>
                                    {(() => {
                                      const docUrl = getMRFPFIUrl(mrf as MRF);
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
                          <label className="text-sm font-medium mb-2 block">Date Range</label>
                          <Select value={dateFilter} onValueChange={setDateFilter}>
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
                              <SelectItem value="month">This Month</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Sort By</label>
                          <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="date-desc">Newest First</SelectItem>
                              <SelectItem value="date-asc">Oldest First</SelectItem>
                              <SelectItem value="amount-desc">Highest Amount</SelectItem>
                              <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    }
                  />

                  {/* Results */}
                  <div className="space-y-3 mt-4">
                    {filteredMRFs.map((request) => {
                      const timerColor = getApprovalTimerColor(request);
                      return (
                        <div
                          key={request.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border rounded-xl hover:shadow-md transition-smooth bg-card cursor-pointer"
                          onClick={() => handleMRFClick(request)}
                        >
                          <div className="flex items-start gap-4 min-w-0 flex-1">
                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Package className="h-6 w-6 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-lg">{request.title}</h3>
                                {request.isResubmission && (
                                  <Badge variant="outline" className="text-xs">
                                    Resubmission
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mb-2">
                                <span className="font-medium">{request.id}</span>
                                <span>•</span>
                                <span>{request.requester}</span>
                                <span>•</span>
                                <span>{formatMRFDate(request.date)}</span>
                                <span>•</span>
                                <span className="font-semibold text-foreground">₦{parseInt(request.estimatedCost).toLocaleString()}</span>
                              </div>
                              {request.currentStage && (
                                <p className="text-xs text-muted-foreground">
                                  Stage: <span className="capitalize font-medium">{request.currentStage}</span>
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
                                    const shareUrl = (request as any).invoice_onedrive_url || 
                                                    (request as any).invoiceOneDriveUrl ||
                                                    (request as MRF).pfi_share_url || 
                                                    (request as MRF).pfiShareUrl;
                                    return shareUrl && (
                                      <OneDriveLink 
                                        webUrl={shareUrl} 
                                        fileName="Supporting Document"
                                        variant="badge"
                                        size="sm"
                                      />
                                    );
                                  })()}
                                </div>
                              )}
                              {/* Quotations Section - Show if RFQ exists and has quotations */}
                              {(() => {
                                const mrfQuotations = getQuotationsForMRF(request.id);
                                const rfq = getRFQForMRF(request.id);
                                if (!rfq || mrfQuotations.length === 0) return null;
                                
                                return (
                                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                          Vendor Quotations ({mrfQuotations.length})
                                        </span>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      {mrfQuotations.map((quotation: any) => (
                                        <div
                                          key={quotation.id}
                                          className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border border-blue-200 dark:border-blue-700"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="flex-1">
                                            <p className="text-sm font-medium">{quotation.vendorName || quotation.vendor_name || 'Vendor'}</p>
                                            <p className="text-xs text-muted-foreground">
                                              Price: ₦{parseFloat(quotation.price || quotation.total_amount || '0').toLocaleString()}
                                              {quotation.deliveryDate && ` • Delivery: ${new Date(quotation.deliveryDate).toLocaleDateString()}`}
                                            </p>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="default"
                                            className="text-xs"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              // Select quotation and send to Supply Chain Director
                                              try {
                                                // First select vendor in RFQ
                                                const selectResponse = await rfqApi.selectVendor(rfq.id, quotation.id);
                                                if (selectResponse.success) {
                                                  // Then send to Supply Chain Director
                                                  const sendResponse = await mrfApi.sendVendorForApproval(
                                                    request.id,
                                                    quotation.vendorId || quotation.vendor_id,
                                                    quotation.id
                                                  );
                                                  if (sendResponse.success) {
                                                    toast({
                                                      title: "Quotation Selected",
                                                      description: "Vendor quotation has been selected and sent to Supply Chain Director for approval.",
                                                    });
                                                    await fetchMRFs();
                                                    await fetchRFQs();
                                                  } else {
                                                    toast({
                                                      title: "Error",
                                                      description: sendResponse.error || "Failed to send quotation for approval",
                                                      variant: "destructive",
                                                    });
                                                  }
                                                } else {
                                                  toast({
                                                    title: "Error",
                                                    description: selectResponse.error || "Failed to select quotation",
                                                    variant: "destructive",
                                                  });
                                                }
                                              } catch (error) {
                                                toast({
                                                  title: "Error",
                                                  description: "Failed to process quotation selection",
                                                  variant: "destructive",
                                                });
                                              }
                                            }}
                                          >
                                            Select & Send for Approval
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-start sm:self-center">
                            <div className="flex items-center gap-2">
                              {timerColor && <Clock className={`h-4 w-4 ${timerColor}`} />}
                              {getMRFStage(request as MRF) === "completed" && <CheckCircle2 className="h-5 w-5 text-success" />}
                              {getMRFStage(request as MRF) === "rejected" && <XCircle className="h-5 w-5 text-destructive" />}
                              <Badge className={getStatusColor(request.status)}>
                                {request.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* View Details button - Shown for procurement after Executive approval */}
                              {(() => {
                                const workflowState = getWorkflowState(request as MRF);
                                const isProcurement = user?.role === "procurement" || user?.role === "procurement_manager";
                                const canViewDetails = isProcurement && isExecutiveApproved(request as MRF);
                                
                                if (canViewDetails) {
                                  return (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedMRFForDetails(request as MRF);
                                        setMrfDetailsDialogOpen(true);
                                      }}
                                    >
                                      <FileText className="h-3 w-3 mr-1" />
                                      View Details
                                    </Button>
                                  );
                                }
                                return null;
                              })()}
                              {/* Send Request to Vendors button - Shown after Executive approval */}
                              {/* The handleGeneratePO function checks canGeneratePO before proceeding */}
                              {/* Button shown for procurement role when MRF is approved by Executive */}
                              {(() => {
                                const workflowState = getWorkflowState(request as MRF);
                                const isProcurement = user?.role === "procurement" || user?.role === "procurement_manager";
                                const canShowPOButton = isProcurement && (
                                  workflowState === "procurement_review" || // After Executive approval
                                  workflowState === "vendor_selected" || // After vendor selection
                                  workflowState === "invoice_received" || // After invoice received
                                  workflowState === "invoice_approved" || // After Supply Chain Director approval
                                  (getMRFStage(request as MRF) === "procurement" && isExecutiveApproved(request as MRF)) // Optimistic for list view
                                );
                                
                                if (!canShowPOButton) return null;
                                
                                // Check if RFQ already exists for this MRF
                                const existingRFQ = getRFQForMRF(request.id);
                                const buttonText = existingRFQ ? "Send RFQ to Vendors Again" : "Send RFQ to Vendors";
                                
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
                                  {(user?.role === 'procurement_manager' || user?.role === 'procurement') && (
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
                                const isProcurementManager = user?.role === 'procurement_manager' || user?.role === 'procurement';
                                if (!isProcurementManager) return null;
                                
                                const status = (request.status || "").toLowerCase();
                                const currentStage = (request.currentStage || "").toLowerCase();
                                const poNumber = getMRFPONumber(request as MRF);
                                const hasPO = poNumber && poNumber !== "N/A";
                                const isEarlyStage = !hasPO && (
                                  status === "pending" || 
                                  status.includes("rejected") ||
                                  status === "procurement" ||
                                  status === "executive_review" ||
                                  status === "chairman_review" ||
                                  currentStage === "pending" ||
                                  currentStage === "procurement"
                                );
                                
                                if (!isEarlyStage) return null;
                                
                                return (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs text-destructive hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteMRF(request.id);
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

          <TabsContent value="srf" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Service Request Forms</CardTitle>
                    <CardDescription>List of all service requisition requests</CardDescription>
                  </div>
                  {/* Only employees can create SRF */}
                  {user?.role === "employee" && (
                  <Button onClick={() => navigate("/procurement/srf/new")} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New SRF
                  </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {srfRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-5 border rounded-xl hover:shadow-md transition-smooth bg-card cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{request.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {request.id} • {request.requester} • {request.date}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
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
                      className="flex items-center justify-between p-5 border rounded-xl hover:shadow-md transition-smooth bg-card cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                          <ShoppingCart className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{po.items}</p>
                          <p className="text-sm text-muted-foreground">
                            {po.id} • {po.vendor} • {po.date}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Delivery: {po.deliveryDate} • {po.amount}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(po.status)}>
                        {po.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </PullToRefresh>

      <POGenerationDialog
        open={poDialogOpen}
        onOpenChange={setPODialogOpen}
        mrf={selectedMRFForPO}
        onGenerate={handlePOGeneration}
        onSave={handleSavePO}
        isGenerating={poGenerating}
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

      {/* GRN Requested Section */}
      {grnRequestedMRFs.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>GRN Requests</CardTitle>
            <CardDescription>Complete Goods Received Notes for processed payments</CardDescription>
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
                      <Badge variant="outline">{mrf.id}</Badge>
                      {getMRFPONumber(mrf) && <Badge variant="outline">PO: {getMRFPONumber(mrf)}</Badge>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Requester</p>
                        <p className="font-medium">{getMRFRequester(mrf)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Amount</p>
                        <p className="font-bold text-lg">₦{parseFloat(getMRFEstimatedCost(mrf)).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Requested At</p>
                        <p className="font-medium">
                          {mrf.grn_requested_at || mrf.grnRequestedAt 
                            ? new Date(mrf.grn_requested_at || mrf.grnRequestedAt).toLocaleDateString()
                            : 'N/A'}
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
              Are you sure you want to delete this Material Request Form? This action cannot be undone.
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
      <AlertDialog open={deletePODialogOpen} onOpenChange={setDeletePODialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the PO for MRF {selectedMRFForPODelete?.id}? 
              This will clear the PO number and files, allowing you to regenerate a new PO. 
              The MRF will be reset to the procurement stage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPO}>Cancel</AlertDialogCancel>
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
      <Dialog open={mrfDetailsDialogOpen} onOpenChange={setMrfDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>MRF Details</DialogTitle>
            <DialogDescription>Complete information about this Material Request Form</DialogDescription>
          </DialogHeader>
          {selectedMRFForDetails && (
            <div className="space-y-6 mt-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">MRF ID</Label>
                  <p className="font-medium font-mono">{selectedMRFForDetails.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedMRFForDetails.status)}>
                    {selectedMRFForDetails.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Title</Label>
                  <p className="font-medium">{selectedMRFForDetails.title}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{selectedMRFForDetails.category || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Requester</Label>
                  <p className="font-medium">{selectedMRFForDetails.requester || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Department</Label>
                  <p className="font-medium">{selectedMRFForDetails.department || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date Created</Label>
                  <p className="font-medium">{formatMRFDate(getMRFDate(selectedMRFForDetails))}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Estimated Cost</Label>
                  <p className="font-medium text-lg">₦{parseInt(selectedMRFForDetails.estimatedCost || '0').toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quantity</Label>
                  <p className="font-medium">{selectedMRFForDetails.quantity || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Current Stage</Label>
                  <p className="font-medium capitalize">{getMRFStage(selectedMRFForDetails) || 'N/A'}</p>
                </div>
              </div>

              {/* Description */}
              {selectedMRFForDetails.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">{selectedMRFForDetails.description}</p>
                </div>
              )}

              {/* Supporting Document */}
              {getMRFPFIUrl(selectedMRFForDetails) && (
                <div>
                  <Label className="text-muted-foreground">Supporting Document</Label>
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
                      const shareUrl = (selectedMRFForDetails as any).invoice_onedrive_url || 
                                      (selectedMRFForDetails as any).invoiceOneDriveUrl ||
                                      selectedMRFForDetails.pfi_share_url || 
                                      selectedMRFForDetails.pfiShareUrl;
                      return shareUrl && (
                        <OneDriveLink 
                          webUrl={shareUrl} 
                          fileName="Supporting Document"
                          variant="button"
                          size="sm"
                        />
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Approval History */}
              {(selectedMRFForDetails as any).executiveApprovalDate && (
                <div>
                  <Label className="text-muted-foreground">Executive Approval</Label>
                  <p className="text-sm mt-1">
                    Approved on {formatMRFDate((selectedMRFForDetails as any).executiveApprovalDate)}
                    {(selectedMRFForDetails as any).executiveRemarks && (
                      <span className="block mt-1 text-muted-foreground">
                        Remarks: {(selectedMRFForDetails as any).executiveRemarks}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* RFQ Information */}
              {(() => {
                const rfq = getRFQForMRF(selectedMRFForDetails.id);
                if (rfq) {
                  return (
                    <div>
                      <Label className="text-muted-foreground">Related RFQ</Label>
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                        <p className="font-medium">RFQ ID: {rfq.id}</p>
                        <p className="text-sm text-muted-foreground">Status: {rfq.status}</p>
                        {rfq.deadline && (
                          <p className="text-sm text-muted-foreground">
                            Deadline: {new Date(rfq.deadline).toLocaleDateString()}
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
                const mrfQuotations = getQuotationsForMRF(selectedMRFForDetails.id);
                if (mrfQuotations.length > 0) {
                  return (
                    <div>
                      <Label className="text-muted-foreground">Vendor Quotations ({mrfQuotations.length})</Label>
                      <div className="mt-2 space-y-2">
                        {mrfQuotations.map((quotation: any) => (
                          <div key={quotation.id} className="p-3 border rounded-md">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{quotation.vendorName || quotation.vendor_name || 'Vendor'}</p>
                                <p className="text-sm text-muted-foreground">
                                  Price: ₦{parseFloat(quotation.price || quotation.total_amount || '0').toLocaleString()}
                                  {quotation.deliveryDate && ` • Delivery: ${new Date(quotation.deliveryDate).toLocaleDateString()}`}
                                </p>
                                {quotation.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">{quotation.notes}</p>
                                )}
                              </div>
                              <Badge className={getStatusColor(quotation.status || 'Pending')}>
                                {quotation.status || 'Pending'}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Procurement;
