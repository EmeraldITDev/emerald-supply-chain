// Enhanced Vendor Registration Types

export interface VendorDocument {
  id: string;
  name: string;
  type: VendorDocumentType;
  fileData: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
  expiryDate?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Expired';
  rejectionReason?: string;
  isRequired: boolean;
}

export type VendorDocumentType = 
  | 'CAC'
  | 'TIN'
  | 'HSE_CERTIFICATE'
  | 'LETTER_OF_INTRODUCTION'
  | 'COMPANY_PROFILE'
  | 'CAC_FORM_7'
  | 'CAC_FORM_5'
  | 'OEM_CERTIFICATE'
  | 'OEM_AUTHORIZATION'
  | 'BANK_REFERENCE'
  | 'OTHER';

export interface VendorDocumentRequirement {
  type: VendorDocumentType;
  label: string;
  description: string;
  isRequired: boolean;
  expiresAnnually: boolean;
  isOEMOnly: boolean;
}

export const VENDOR_DOCUMENT_REQUIREMENTS: VendorDocumentRequirement[] = [
  { type: 'CAC', label: 'CAC Certificate', description: 'Corporate Affairs Commission registration certificate', isRequired: true, expiresAnnually: false, isOEMOnly: false },
  { type: 'TIN', label: 'Tax Identification Number (TIN)', description: 'Valid Tax Identification Number', isRequired: true, expiresAnnually: false, isOEMOnly: false },
  { type: 'HSE_CERTIFICATE', label: 'HSE Documents', description: 'Health, Safety & Environment certificates', isRequired: true, expiresAnnually: true, isOEMOnly: false },
  { type: 'LETTER_OF_INTRODUCTION', label: 'Letter of Introduction', description: 'Company introduction letter on letterhead', isRequired: true, expiresAnnually: false, isOEMOnly: false },
  { type: 'COMPANY_PROFILE', label: 'Company Profile', description: 'Detailed company profile with capabilities', isRequired: true, expiresAnnually: false, isOEMOnly: false },
  { type: 'CAC_FORM_7', label: 'CAC Form 7', description: 'Particulars of Directors', isRequired: true, expiresAnnually: false, isOEMOnly: false },
  { type: 'CAC_FORM_5', label: 'CAC Form 5', description: 'Notice of Registered Address', isRequired: true, expiresAnnually: false, isOEMOnly: false },
  { type: 'OEM_CERTIFICATE', label: 'OEM Certificate', description: 'Original Equipment Manufacturer certification', isRequired: false, expiresAnnually: true, isOEMOnly: true },
  { type: 'OEM_AUTHORIZATION', label: 'OEM Authorization Letter', description: 'Authorization from OEM to represent/distribute', isRequired: false, expiresAnnually: true, isOEMOnly: true },
  { type: 'BANK_REFERENCE', label: 'Bank Reference Letter', description: 'Reference letter from your bank', isRequired: false, expiresAnnually: false, isOEMOnly: true },
];

export interface VendorRegistrationCycle {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  status: 'Open' | 'Closed';
  description?: string;
}

export interface EnhancedVendorRegistration {
  id: string;
  companyName: string;
  categories: string[]; // Multiple categories
  isOEMRepresentative: boolean;
  email: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  taxId: string;
  contactPerson: string;
  contactPersonTitle?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  website?: string;
  yearEstablished?: number;
  numberOfEmployees?: string;
  annualRevenue?: string;
  documents: VendorDocument[];
  status: 'Draft' | 'Pending' | 'Under Review' | 'Documents Incomplete' | 'Approved' | 'Rejected';
  submittedDate?: string;
  registrationCycleId?: string;
  reviewedDate?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  missingDocuments?: VendorDocumentType[];
  lastReminderDate?: string;
  vehicles?: VendorVehicleRegistration[];
}

export interface VendorVehicleRegistration {
  id: string;
  name: string;
  type: string;
  plate: string;
  year?: number;
  capacity?: string;
  documents: VendorDocument[];
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalDate?: string;
  approvalNotes?: string;
}

export const VENDOR_CATEGORIES = [
  'Raw Materials',
  'Equipment',
  'Office Supplies',
  'Construction',
  'Safety Equipment',
  'Automobile',
  'Transportation',
  'IT Services',
  'Logistics',
  'Catering',
  'Maintenance',
  'Consulting',
  'Manufacturing',
  'Chemicals',
  'Medical Supplies',
] as const;
