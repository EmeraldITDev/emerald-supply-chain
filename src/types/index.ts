// User & Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'employee' | 'procurement' | 'finance' | 'admin' | 'executive' | 'supply_chain_director' | 'chairman' | 'logistics';
  department?: string;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// MRF (Material Requisition Form) Types
export interface MRF {
  id: string;
  title: string;
  category: string;
  urgency: 'Low' | 'Medium' | 'High';
  description: string;
  quantity: string;
  estimatedCost: string;
  justification: string;
  requester: string;
  requesterId: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'In Progress' | 'Completed' | 'Awaiting Chairman' | 'Processing Payment' | 'Paid';
  currentStage?: 'procurement' | 'executive' | 'chairman' | 'supply_chain' | 'finance' | 'completed';
  approvalHistory?: ApprovalHistoryEntry[];
  rejectionReason?: string;
  isResubmission?: boolean;
  poNumber?: string;
  unsignedPOUrl?: string;
  signedPOUrl?: string;
  executiveComments?: string;
  chairmanComments?: string;
  supplyChainComments?: string;
  poRejectionReason?: string;
  poVersion?: number;
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
  mrfId: string;
  mrfTitle: string;
  description: string;
  quantity: string;
  estimatedCost: string;
  deadline: string;
  status: 'Open' | 'Closed' | 'Awarded';
  vendorIds: string[];
  createdAt: string;
}

export interface CreateRFQData {
  mrfId: string;
  description: string;
  quantity: string;
  estimatedCost: string;
  deadline: string;
  vendorIds: string[];
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
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedDate: string;
}

export interface CreateVendorRegistrationData {
  companyName: string;
  category: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  contactPerson: string;
}

// Approval History
export interface ApprovalHistoryEntry {
  stage: string;
  approver: string;
  date: string;
  decision: 'Approved' | 'Rejected';
  remarks?: string;
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
