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
}

export interface CreateMRFData {
  title: string;
  category: string;
  urgency: 'Low' | 'Medium' | 'High';
  description: string;
  quantity: string;
  estimatedCost: string;
  justification: string;
}

// SRF (Service Requisition Form) Types
export interface SRF {
  id: string;
  title: string;
  serviceType: string;
  urgency: 'Low' | 'Medium' | 'High';
  description: string;
  duration: string;
  estimatedCost: string;
  justification: string;
  requester: string;
  requesterId: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'In Progress' | 'Completed';
}

export interface CreateSRFData {
  title: string;
  serviceType: string;
  urgency: 'Low' | 'Medium' | 'High';
  description: string;
  duration: string;
  estimatedCost: string;
  justification: string;
}

// RFQ (Request for Quotation) Types
export interface RFQ {
  id: string;
  mrfId: string;       // camelCase (if ever transformed)
  mrf_id: string;      // snake_case — what Laravel actually returns
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
}

export interface CreateRFQData {
  mrfId: string;
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
