// Enhanced RFQ Types for full workflow

export interface EnhancedRFQ {
  id: string;
  mrfId: string;
  mrfTitle: string;
  description: string;
  specifications?: string;
  quantity: string;
  unit?: string;
  estimatedCost: string;
  deadline: string;
  status: 'Draft' | 'Open' | 'Closed' | 'Evaluating' | 'Awarded' | 'Cancelled';
  createdDate: string;
  createdBy: string;
  vendorIds: string[]; // Invited vendors
  vendorSelectionMethod: 'all_category' | 'manual' | 'preferred';
  category?: string;
  deliveryLocation?: string;
  deliveryTerms?: string;
  paymentTerms?: string;
  technicalRequirements?: string;
  quotationsReceived: number;
  awardedVendorId?: string;
  awardedQuotationId?: string;
  awardDate?: string;
  notes?: string;
}

export interface EnhancedQuotation {
  id: string;
  rfqId: string;
  vendorId: string;
  vendorName: string;
  vendorRating: number;
  vendorReliability: number; // % of on-time deliveries
  vendorTotalOrders: number;
  price: string;
  unitPrice?: string;
  deliveryDate: string;
  deliveryDays: number;
  validUntil: string;
  notes?: string;
  attachments?: string[];
  status: 'Pending' | 'Under Review' | 'Shortlisted' | 'Approved' | 'Rejected';
  submittedDate: string;
  // Comparison metrics
  priceScore?: number;
  deliveryScore?: number;
  vendorScore?: number;
  overallScore?: number;
  isRecommended?: boolean;
}

export interface VendorPerformanceMetrics {
  vendorId: string;
  totalOrders: number;
  completedOrders: number;
  onTimeDeliveries: number;
  qualityRating: number;
  priceCompetitiveness: number;
  responseTime: number; // Average hours to respond
  overallScore: number;
  reliabilityPercentage: number;
  isPreferred: boolean;
  lastOrderDate?: string;
}

export interface QuotationComparison {
  rfqId: string;
  quotations: EnhancedQuotation[];
  lowestPrice: string;
  fastestDelivery: string;
  highestRatedVendor: string;
  recommendedVendorId?: string;
  recommendationReason?: string;
}

export interface RFQDispatchOptions {
  method: 'all_category' | 'manual' | 'preferred';
  category?: string;
  selectedVendorIds?: string[];
  minRating?: number;
  minOrders?: number;
}
