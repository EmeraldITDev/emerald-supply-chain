// ============================================
// LOGISTICS EXCEL TEMPLATE DEFINITIONS
// Based on actual Emerald CFZE operational templates
// ============================================

/**
 * Journey Management Schedule Template Columns
 * Used for detailed trip planning with security & vehicle details
 * Template: Journey_Management_Schedule.xlsx
 */
export interface JourneyManagementTemplateRow {
  // Serial Number
  sn: number;
  
  // Travelers' Information
  passengerName: string;
  role: string;
  idPassportNo?: string;
  contact: string;
  email: string;
  
  // Schedule
  arrivalDate: string; // e.g., "Monday, 1st December,2025"
  arrivalTime: string; // e.g., "10am"
  
  // Locations
  pickUpPoint: string;
  approvedDestination: string;
  stopOver?: string;
  finalDestination: string;
  eta?: string;
  
  // Vehicle Plan/Details
  transportVendor: string;
  tripSupervisedBy: string;
  driverName: string;
  driverContact: string;
  vehicleType: string; // e.g., "1SUV with Lead with 2 mopol, and 1CPO"
  vehiclePlateNumber?: string;
  
  // Security
  noOfPersonnel?: number;
  noOfEscortVehicle?: number;
  escortRepPhoneNumber?: string;
  
  // Approval
  tripApprovedBy: string;
  
  // Notes
  deviations?: string;
}

/**
 * Personnel Trip Schedule Template Columns  
 * Used for logistics plan and payment tracking
 * Template: Personnel_Trip_Schedule.xlsx
 */
export interface PersonnelTripTemplateRow {
  // Vendor Information
  vendor: string;
  leadAndChaseRequired: string; // "yes" | "No"
  onboardingStatus: string; // "Yes" | "Not Required"
  poNumber?: string;
  
  // Trip Details
  taskDescription: string;
  serviceDate: string;
  returnDate?: string;
  serviceCompletionStatus: string; // "Completed" | "pending" | "Trip postponed"
  
  // Payment Details
  amountCharged?: string; // e.g., "₦290,000.00"
  dateOfInvoiceSubmission?: string;
  expectedPaymentDate?: string;
  paymentStatus?: string; // "Paid" | "in-process"
}

/**
 * Template column definitions for validation
 */
export const journeyManagementColumns = [
  { key: 'sn', label: 'SN', required: false, type: 'number' as const },
  { key: 'passengerName', label: "Passenger's Name", required: true, type: 'string' as const },
  { key: 'role', label: 'Role', required: false, type: 'string' as const },
  { key: 'idPassportNo', label: 'ID/Passport No.', required: false, type: 'string' as const },
  { key: 'contact', label: 'Contact', required: false, type: 'string' as const },
  { key: 'email', label: 'Email', required: false, type: 'string' as const },
  { key: 'arrivalDate', label: 'Arrival Date', required: true, type: 'string' as const },
  { key: 'arrivalTime', label: 'Arrival time', required: false, type: 'string' as const },
  { key: 'pickUpPoint', label: 'Pick up Point', required: true, type: 'string' as const },
  { key: 'approvedDestination', label: 'Approved Destination', required: true, type: 'string' as const },
  { key: 'stopOver', label: 'Stop Over', required: false, type: 'string' as const },
  { key: 'finalDestination', label: 'Final Destination', required: true, type: 'string' as const },
  { key: 'eta', label: 'ETA', required: false, type: 'string' as const },
  { key: 'transportVendor', label: 'Transport Vendor', required: true, type: 'string' as const },
  { key: 'tripSupervisedBy', label: 'Trip Supervised by', required: false, type: 'string' as const },
  { key: 'driverName', label: 'Driver name', required: false, type: 'string' as const },
  { key: 'driverContact', label: 'Driver contact', required: false, type: 'string' as const },
  { key: 'vehicleType', label: 'Vehicle type', required: false, type: 'string' as const },
  { key: 'vehiclePlateNumber', label: 'Vehicle plate number', required: false, type: 'string' as const },
  { key: 'noOfPersonnel', label: 'No of Personnel', required: false, type: 'number' as const },
  { key: 'noOfEscortVehicle', label: 'No of Escort Vehicle', required: false, type: 'number' as const },
  { key: 'escortRepPhoneNumber', label: 'Escort Rep. phone number', required: false, type: 'string' as const },
  { key: 'tripApprovedBy', label: 'Trip Approved by', required: false, type: 'string' as const },
  { key: 'deviations', label: 'Deviations', required: false, type: 'string' as const },
];

export const personnelTripColumns = [
  { key: 'vendor', label: 'Vendor', required: true, type: 'string' as const },
  { key: 'leadAndChaseRequired', label: 'Lead and Chase Required (with escort)', required: false, type: 'string' as const },
  { key: 'onboardingStatus', label: 'Onboarding Status', required: false, type: 'string' as const },
  { key: 'poNumber', label: 'PO Number', required: false, type: 'string' as const },
  { key: 'taskDescription', label: 'Task Description', required: true, type: 'string' as const },
  { key: 'serviceDate', label: 'Service Date', required: true, type: 'string' as const },
  { key: 'returnDate', label: 'Return Date', required: false, type: 'string' as const },
  { key: 'serviceCompletionStatus', label: 'Service Completion Status', required: false, type: 'string' as const },
  { key: 'amountCharged', label: 'AMOUNT CHARGED', required: false, type: 'string' as const },
  { key: 'dateOfInvoiceSubmission', label: 'Date of Invoice Submission to finance', required: false, type: 'string' as const },
  { key: 'expectedPaymentDate', label: 'Expected payment Date', required: false, type: 'string' as const },
  { key: 'paymentStatus', label: 'Payment Status', required: false, type: 'string' as const },
];

/**
 * Service completion status options
 */
export const serviceCompletionStatuses = [
  'pending',
  'Completed',
  'Trip postponed',
  'cancelled',
] as const;

/**
 * Transport vendors from templates
 */
export const knownTransportVendors = [
  'Servizo',
  'Kobani',
  'Rofav',
  'None', // Internal/Emerald vehicles
  'EMERALD',
] as const;

/**
 * Parse template helper - converts Excel date to standard format
 */
export function parseExcelDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Try to parse common formats like "Monday, 1st December,2025" or "23/08/2025"
  try {
    // Remove ordinal suffixes (1st, 2nd, 3rd, etc.)
    const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // Try DD/MM/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const fullYear = year.length === 2 ? `20${year}` : year;
      const parsedDate = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
      }
    }
  } catch (e) {
    console.error('Failed to parse date:', dateStr);
  }
  
  return null;
}
