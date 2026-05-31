// User & Authentication Types
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'employee' | 'procurement_manager' | 'procurement' | 'finance' | 'admin' | 'executive' | 'supply_chain_director' | 'chairman' | 'logistics_manager' | 'logistics' | 'finance_officer' | 'supply_chain';
  department?: string | null;
  phone?: string | null;
  employeeId?: number;
  is_admin?: boolean;
  can_manage_users?: boolean;
  createdAt: string;
  /** Public URL to a saved signature image (Supply Chain Director). */
  signature_url?: string | null;
  signatureUrl?: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt?: string;
  requiresPasswordChange?: boolean;
}

// MRF (Material Requisition Form) Types
export interface MRF {
  id: string;
  formatted_id?: string;
  formattedId?: string;
  legacy_id?: string;
  legacyId?: string;
  /** SCM transaction UUID — Finance AP correlation key (Phase 0). */
  scmTransactionId?: string;
  scm_transaction_id?: string;
  title: string;
  category: string;
  urgency: 'Low' | 'Medium' | 'High' | 'low' | 'medium' | 'high';
  description: string;
  quantity: string;
  estimatedCost: string;
  estimated_cost?: string; // Backend snake_case variant
  justification: string;
  requester: string;
  requester_name?: string; // Backend snake_case variant
  requesterId: string;
  requester_id?: string; // Backend snake_case variant
  date: string;
  created_at?: string; // Backend snake_case variant
  department?: string;
  status: string; // Flexible to match backend workflow statuses
  currentStage?: 'draft' | 'submitted' | 'executive_review' | 'director_review' | 'procurement_review' | 'rfq_sent' | 'quotes_received' | 'vendor_selected' | 'final_approval' | 'po_generated' | 'completed' | 'rejected' | (string & {});
  current_stage?: string; // Backend snake_case variant
  workflowState?: 'draft' | 'submitted' | 'executive_review' | 'director_review' | 'procurement_review' | 'rfq_sent' | 'quotes_received' | 'vendor_selected' | 'final_approval' | 'po_generated' | 'completed' | 'rejected' | (string & {});
  workflow_state?: string; // Backend snake_case variant
  // Contract type for routing (Emerald → Executive, others → SCD)
  contract_type?: string;
  contractType?: string;
  approvalHistory?: ApprovalHistoryEntry[];
  approval_history?: ApprovalHistoryEntry[]; // Backend snake_case variant
  rejectionReason?: string;
  rejection_reason?: string; // Backend snake_case variant
  isResubmission?: boolean;
  is_resubmission?: boolean; // Backend snake_case variant
  poNumber?: string;
  po_number?: string; // Backend snake_case variant
  unsignedPOUrl?: string;
  unsigned_po_url?: string; // Backend snake_case variant
  unsignedPOShareUrl?: string;
  unsigned_po_share_url?: string; // Backend snake_case variant - view-only sharing link
  signedPOUrl?: string;
  signed_po_url?: string; // Backend snake_case variant
  signedPOShareUrl?: string;
  signed_po_share_url?: string; // Backend snake_case variant - view-only sharing link
  executiveComments?: string;
  executive_remarks?: string; // Backend snake_case variant
  chairmanComments?: string;
  chairman_remarks?: string; // Backend snake_case variant
  supplyChainComments?: string;
  poRejectionReason?: string;
  po_rejection_reason?: string; // Backend snake_case variant
  poVersion?: number;
  po_version?: number; // Backend snake_case variant
  currency?: string;
  // Procurement manager approval timing
  procurementManagerApprovalTime?: string;
  // Executive approval fields from backend
  executive_approved?: boolean;
  executive_approved_by?: string;
  executive_approved_at?: string;
  // Chairman approval fields from backend
  chairman_approved?: boolean;
  chairman_approved_by?: string;
  chairman_approved_at?: string;
  // Payment fields from backend
  payment_status?: 'pending' | 'processing' | 'approved' | 'paid' | 'rejected';
  payment_approved_at?: string;
  payment_approved_by?: string;
  // PFI (Proforma Invoice) fields
  pfiUrl?: string;
  pfi_url?: string; // Backend snake_case variant
  pfiShareUrl?: string;
  pfi_share_url?: string; // Backend snake_case variant
  // GRN (Goods Received Note) fields
  grnRequested?: boolean;
  grn_requested?: boolean; // Backend snake_case variant
  grnRequestedAt?: string;
  grn_requested_at?: string; // Backend snake_case variant
  grnRequestedBy?: string;
  grn_requested_by?: string; // Backend snake_case variant
  grnCompleted?: boolean;
  grn_completed?: boolean; // Backend snake_case variant
  grnCompletedAt?: string;
  grn_completed_at?: string; // Backend snake_case variant
  grnCompletedBy?: string;
  grn_completed_by?: string; // Backend snake_case variant
  grnUrl?: string;
  grn_url?: string; // Backend snake_case variant
  grnShareUrl?: string;
  grn_share_url?: string; // Backend snake_case variant
  // Stage timestamps (from backend) — executive_approved_at already defined above
  director_approved_at?: string;
  procurement_review_started_at?: string;
  // Last action tracking (from backend)
  last_action_by_role?: string;
  // Supporting Document attachment fields
  attachmentUrl?: string;
  attachmentShareUrl?: string;
  attachment_url?: string;
  attachment_share_url?: string;
  attachmentName?: string;
  attachment_name?: string;
  onedriveLink?: string;
  onedrive_link?: string;
  // Line items with budget breakdown
  items?: LineItem[];
  profitAndLoss?: ProfitAndLoss;
  // Routing reason after contract type evaluation
  routedReason?: 'custom_contract_type' | 'standard_contract_type' | 'logistics_exception';
  // Payment schedule (Finance AP Phase 1) — present once configured on the MRF.
  paymentSchedule?: import('./payment-schedule').PaymentSchedule | null;
  payment_schedule?: import('./payment-schedule').PaymentSchedule | null;
}

// Line Item Types (for MRF/SRF budget breakdown)
export interface LineItem {
  id?: string;
  itemName: string;
  quantity: number;
  unit: string;
  budgetAmount: number;
  quotedTotal?: number;
  quotedAmount?: number;
}

export interface LineItemPnL {
  id: string;
  itemName: string;
  budgetAmount: number;
  quotedAmount: number;
  variance: number;
  varianceType: 'saving' | 'loss' | 'neutral';
}

export interface ProfitAndLoss {
  items: LineItemPnL[];
  summary: {
    totalBudget: number;
    totalQuoted: number;
    netVariance: number;
    totalSavings: number;
    totalLoss: number;
    lineCount: number;
  };
}

export interface ContractTypeResponse {
  success: boolean;
  standardTypes: Array<{ value: string; label: string }>;
  allowFreeText: boolean;
  routingNote: string;
}

export interface CreateMRFData {
  title: string;
  category: string;
  urgency: 'Low' | 'Medium' | 'High';
  description: string;
  quantity: string;
  estimatedCost: string;
  justification: string;
  /** Backend validation often expects snake_case. */
  contract_type?: string;
  contractType?: string;
  department?: string;
  items?: LineItem[];
}

// SRF (Service Requisition Form) Types
export interface SRF {
  id: string;
  formatted_id?: string;
  formattedId?: string;
  legacy_id?: string;
  legacyId?: string;
  department?: string;
  contract_type?: string;
  contractType?: string;
  title: string;
  serviceType?: string;
  service_type?: string;
  urgency: 'Low' | 'Medium' | 'High' | string;
  description: string;
  duration: string;
  estimatedCost: string;
  estimated_cost?: string;
  justification: string;
  /** API may send a string, nested `{ name }`, or use `requesterName` / `requester_name`. */
  requester?: string | { name?: string };
  requesterName?: string;
  requester_name?: string;
  requesterId?: string;
  requester_id?: string;
  date: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  current_stage?: string;
  currentStage?: string;
  workflow_state?: string;
  workflowState?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'In Progress' | 'Completed' | string;
  // Line items with budget breakdown
  items?: LineItem[];
  profitAndLoss?: ProfitAndLoss;
  routedReason?: 'custom_contract_type' | 'standard_contract_type' | 'logistics_exception';
}

export interface CreateSRFData {
  title: string;
  serviceType: string;
  urgency: 'Low' | 'Medium' | 'High';
  description: string;
  duration: string;
  estimatedCost: string;
  justification: string;
  items?: LineItem[];
}

// RFQ (Request for Quotation) Types
export interface RFQ {
  id: string;
  formatted_id?: string;
  formattedId?: string;
  legacy_id?: string;
  legacyId?: string;
  mrfId?: string;
  mrf_id?: string;
  srfId?: string;
  srf_id?: string;
  mrfTitle: string;
  mrf_title: string;
  description: string;
  quantity: string;
  estimatedCost: string;
  estimated_cost: string;
  deadline: string;
  status: 'Open' | 'Closed' | 'Awarded';
  vendorIds: string[];
  vendor_ids: string[];
  createdAt: string;
  created_at: string;
  paymentSchedule?: import('./payment-schedule').PaymentSchedule | null;
  payment_schedule?: import('./payment-schedule').PaymentSchedule | null;
}

export interface CreateRFQData {
  /** Set for material requisitions */
  mrfId?: string;
  /** Set for service requisitions */
  srfId?: string;
  description: string;
  quantity: string;
  estimatedCost: string;
  deadline: string;
  vendorIds: string[];
  title?: string;
  category?: string;
  paymentTerms?: string;
  notes?: string;
}

// Quotation Types
export interface Quotation {
  id: string;
  rfqId: string;
  vendorId: string;
  vendorName: string;
  price: string;
  deliveryDate: string;
  notes?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedDate: string;
  /** Read-only mirror of the MRF's payment schedule, when provided by backend. */
  paymentSchedule?: import('./payment-schedule').PaymentSchedule | null;
  payment_schedule?: import('./payment-schedule').PaymentSchedule | null;
}

export interface CreateQuotationData {
  rfqId: string;
  vendorId: string;
  vendorName: string;
  price: string;
  deliveryDate: string;
  notes?: string;
}

// Vendor Types
export interface Vendor {
  id: string;
  name: string;
  category: string;
  /** Free text when "Others" was selected at registration; pair with `category` for display. */
  categoryOther?: string | null;
  rating: number;
  totalOrders: number;
  status: 'Active' | 'Inactive' | 'Pending';
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  contactPerson?: string;
  annual_revenue?: string | null;
  number_of_employees?: string | null;
  year_established?: number | null;
  website?: string | null;
}

export interface VendorRegistration {
  id: string;
  companyName: string;
  category: string;
  categoryOther?: string | null;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  contactPerson: string;
  status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected';
  submittedDate: string;
  createdAt?: string;
  documents?: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileUrl: string;
    uploadedAt: string;
  }>;
}

/** Financial info for vendor registration (optional) */
export interface VendorRegistrationFinancialInfo {
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  currency?: string;
  countryCode?: string;
}

export interface CreateVendorRegistrationData {
  companyName: string;
  category: string;
  /** When category includes "Others", optional elaboration for the backend */
  categoryOther?: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  contactPerson: string;
  /** Optional financial / banking information */
  financialInfo?: VendorRegistrationFinancialInfo;
  website?: string;
  annualRevenue?: string | number;
  numberOfEmployees?: string | number;
  yearEstablished?: string | number;
}

// Approval History
export interface ApprovalHistoryEntry {
  stage: string;
  approver: string;
  date: string;
  decision: 'Approved' | 'Rejected';
  remarks?: string;
}

// Available Actions for MRF (based on role and state)
export interface AvailableActions {
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canSelectVendors: boolean;
  canViewInvoices: boolean;
  canApproveInvoice: boolean;
  canGeneratePO: boolean;
  canSignPO: boolean;
  canProcessPayment: boolean;
  canRequestGRN: boolean;
  canUploadGRN: boolean;
  canViewGRN: boolean;
  availableActions: string[]; // List of action keys: 'view', 'edit', 'approve', 'reject', etc.
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
  raw?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// MRN (Materials Request Note) Types - Pre-MRF Requests
export interface MRN {
  id: string;
  controlNumber: string;
  title: string;
  department: string;
  category: string;
  items: MRNItem[];
  urgency: 'Low' | 'Medium' | 'High';
  justification: string;
  requesterId: string;
  requesterName: string;
  submittedDate: string;
  status: 'Pending' | 'Under Review' | 'Converted to MRF' | 'Rejected';
  reviewedBy?: string;
  reviewDate?: string;
  reviewNotes?: string;
  convertedMRFId?: string;
}

export interface MRNItem {
  name: string;
  description: string;
  quantity: string;
  estimatedUnitCost: string;
}

export interface CreateMRNData {
  title: string;
  department: string;
  category: string;
  items: MRNItem[];
  urgency: 'Low' | 'Medium' | 'High';
  justification: string;
}

// Annual Procurement Planning Types
export interface AnnualProcurementPlan {
  id: string;
  year: number;
  department: string;
  submittedBy: string;
  submittedDate: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  totalEstimatedBudget: string;
  items: AnnualPlanItem[];
  reviewedBy?: string;
  reviewDate?: string;
  reviewNotes?: string;
}

export interface AnnualPlanItem {
  category: string;
  itemDescription: string;
  estimatedQuantity: string;
  estimatedCost: string;
  priority: 'High' | 'Medium' | 'Low';
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  justification: string;
}

export interface CreateAnnualPlanData {
  year: number;
  department: string;
  items: AnnualPlanItem[];
}

// Filter & Sort Types
export interface FilterOptions {
  status?: string;
  category?: string;
  urgency?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// ==========================================
// PROCUREMENT REPORTING TYPES
// ==========================================

export interface PriceComparisonSummary {
  mrfId: string;
  comparisonCount: number;
  lowestUnitPrice: number;
  highestUnitPrice: number;
}

export interface ProcurementReportData {
  period: {
    from: string;
    to: string;
  };
  totals: {
    totalSavings: number;
    totalLoss: number;
    netVariance: number;
    lineItemsWithBudget: number;
    posGenerated: number;
    mrfsApproved: number;
    srfsApproved: number;
    priceComparisonMrfs: number;
  };
  priceComparisonSummaries: PriceComparisonSummary[];
}

// ==========================================
// DASHBOARD KPI TYPES
// ==========================================

export interface DashboardKPIs {
  totalPosGenerated: number;
  totalMrfsApproved: number;
  totalSrfsApproved: number;
  priceComparisonCount: number;
}
