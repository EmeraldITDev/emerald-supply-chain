// ============================================
// LOGISTICS MODULE TYPES
// SCM Logistics Module Upgrade Specification
// ============================================

// ==========================================
// 1. VENDOR TYPES (Logistics-specific)
// ==========================================

export type LogisticsVendorType = 'internal' | 'external' | 'one-time';

export interface LogisticsVendor {
  id: string;
  name: string;
  type: LogisticsVendorType;
  email: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  status: 'active' | 'inactive' | 'pending' | 'invited';
  // For one-time vendors
  accessToken?: string;
  accessExpiresAt?: string;
  // Compliance
  documentsValid?: boolean;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface VendorInvite {
  email: string;
  vendorType: LogisticsVendorType;
  tripId?: string;
  expiresAt: string;
}

// ==========================================
// 2. TRIP TYPES (Scheduling Layer)
// ==========================================

export type TripStatus = 
  | 'draft'
  | 'scheduled'
  | 'vendor_assigned'
  | 'in_progress'
  | 'completed'
  | 'closed'
  | 'cancelled';

export type TripType = 'personnel' | 'material' | 'mixed';

export interface TripPassenger {
  id: string;
  staffId: string;
  name: string;
  email: string;
  department: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  notifiedAt?: string;
}

export interface TripMaterial {
  id: string;
  materialId: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  condition: 'new' | 'used' | 'damaged';
  notes?: string;
}

export interface Trip {
  id: string;
  tripNumber: string; // e.g., TRP-2025-001
  type: TripType;
  status: TripStatus;
  
  // Route Information
  origin: string;
  destination: string;
  route?: string; // Full route description
  distance?: number; // in km
  estimatedDuration?: string; // e.g., "4h 30m"
  
  // Scheduling
  scheduledDepartureAt: string;
  scheduledArrivalAt?: string;
  actualDepartureAt?: string;
  actualArrivalAt?: string;
  
  // Vendor & Driver
  vendorId?: string;
  vendorName?: string;
  vendorType?: LogisticsVendorType;
  vehicleId?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  
  // Passengers & Materials
  passengers?: TripPassenger[];
  materials?: TripMaterial[];
  cargo?: string; // General cargo description
  
  // Metadata
  purpose?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
  scheduledBy: string;
  scheduledByName?: string;
  
  // Tracking
  createdAt: string;
  updatedAt?: string;
}

export interface CreateTripData {
  type: TripType;
  origin: string;
  destination: string;
  route?: string;
  scheduledDepartureAt: string;
  scheduledArrivalAt?: string;
  vendorId?: string;
  vehicleId?: string;
  driverId?: string;
  passengers?: Omit<TripPassenger, 'id' | 'notifiedAt'>[];
  materials?: Omit<TripMaterial, 'id'>[];
  cargo?: string;
  purpose?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
}

export interface BulkTripUploadResult {
  success: boolean;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  createdTrips: string[]; // IDs of created trips
}

// ==========================================
// 3. JOURNEY TYPES (Execution Layer)
// ==========================================

export type JourneyStatus = 
  | 'not_started'
  | 'departed'
  | 'en_route'
  | 'at_checkpoint'
  | 'arrived'
  | 'closed';

export interface JourneyCheckpoint {
  id: string;
  location: string;
  arrivedAt: string;
  departedAt?: string;
  notes?: string;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
  recordedBy?: string;
}

export interface Journey {
  id: string;
  tripId: string;
  tripNumber: string;
  status: JourneyStatus;
  
  // Actual tracking
  departedAt?: string;
  departedFrom?: string;
  arrivedAt?: string;
  arrivedTo?: string;
  
  // Checkpoints
  checkpoints: JourneyCheckpoint[];
  
  // Driver/Vendor submitted data
  currentLocation?: string;
  lastUpdatedAt?: string;
  updatedBy?: string;
  
  // Metrics
  totalDistance?: number;
  totalDuration?: string;
  delayMinutes?: number;
  
  // Issues/Incidents
  incidents?: JourneyIncident[];
  
  createdAt: string;
}

export interface JourneyIncident {
  id: string;
  type: 'delay' | 'breakdown' | 'accident' | 'weather' | 'other';
  description: string;
  location?: string;
  reportedAt: string;
  resolvedAt?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface UpdateJourneyData {
  status?: JourneyStatus;
  currentLocation?: string;
  checkpoint?: Omit<JourneyCheckpoint, 'id'>;
  incident?: Omit<JourneyIncident, 'id'>;
  notes?: string;
}

// ==========================================
// 4. MATERIAL TYPES
// ==========================================

export type MaterialStatus = 'available' | 'in_transit' | 'delivered' | 'damaged' | 'lost';

export interface Material {
  id: string;
  materialNumber: string; // e.g., MAT-2025-001
  name: string;
  description?: string;
  category: string;
  
  // Quantity & Condition
  quantity: number;
  unit: string;
  condition: 'new' | 'used' | 'damaged';
  status: MaterialStatus;
  
  // Current Location
  currentLocation: string;
  warehouseId?: string;
  
  // Movement History
  lastMovedAt?: string;
  lastTripId?: string;
  movementCount: number;
  
  // Metadata
  weight?: number; // in kg
  dimensions?: string;
  value?: number;
  notes?: string;
  
  createdAt: string;
  updatedAt?: string;
}

export interface MaterialMovement {
  id: string;
  materialId: string;
  tripId: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  conditionBefore: string;
  conditionAfter?: string;
  movedAt: string;
  receivedAt?: string;
  receivedBy?: string;
  notes?: string;
}

export interface BulkMaterialUploadResult {
  success: boolean;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  createdMaterials: string[];
}

// ==========================================
// 5. FLEET MANAGEMENT TYPES
// ==========================================

export type VehicleStatus = 'available' | 'in_use' | 'maintenance' | 'out_of_service';
export type VehicleOwnership = 'owned' | 'leased' | 'vendor' | 'rental';

export interface FleetVehicle {
  id: string;
  vehicleNumber: string; // e.g., VEH-001
  plate: string;
  name: string;
  type: string; // e.g., 'Sedan', 'Truck', 'Bus'
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  
  // Ownership
  ownership: VehicleOwnership;
  vendorId?: string;
  vendorName?: string;
  
  // Status
  status: VehicleStatus;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  
  // Capacity
  passengerCapacity?: number;
  cargoCapacity?: number; // in kg
  fuelType?: string;
  fuelCapacity?: number; // in liters
  
  // Documents
  documents: VehicleDocument[];
  
  // Maintenance
  lastMaintenanceAt?: string;
  nextMaintenanceAt?: string;
  maintenanceHistory: MaintenanceRecord[];
  
  // Operational
  currentDriverId?: string;
  currentDriverName?: string;
  currentTripId?: string;
  totalTrips: number;
  totalDistance: number; // in km
  
  // GPS Integration (Placeholder)
  gpsEnabled?: boolean;
  gpsDeviceId?: string;
  lastKnownLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: string;
  };
  
  createdAt: string;
  updatedAt?: string;
}

export interface VehicleDocument {
  id: string;
  vehicleId: string;
  type: 'registration' | 'insurance' | 'roadworthiness' | 'license' | 'permit' | 'other';
  name: string;
  fileUrl?: string;
  fileData?: string; // base64 for local handling
  uploadedAt: string;
  expiresAt?: string;
  isExpired?: boolean;
  isExpiringSoon?: boolean; // within 30 days
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: 'scheduled' | 'unscheduled' | 'repair' | 'inspection';
  description: string;
  performedAt: string;
  performedBy: string;
  cost?: number;
  odometer?: number;
  notes?: string;
  nextScheduledAt?: string;
  documents?: string[]; // URLs to receipts/invoices
}

export interface CreateVehicleData {
  plate: string;
  name: string;
  type: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  ownership: VehicleOwnership;
  vendorId?: string;
  passengerCapacity?: number;
  cargoCapacity?: number;
  fuelType?: string;
  documents?: Omit<VehicleDocument, 'id' | 'vehicleId' | 'uploadedAt' | 'isExpired' | 'isExpiringSoon'>[];
}

// ==========================================
// 6. REPORTING & COMPLIANCE TYPES
// ==========================================

export type ReportType = 'trip' | 'daily' | 'weekly' | 'monthly' | 'incident' | 'compliance' | 'custom';
export type ReportStatus = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected';

export interface LogisticsReport {
  id: string;
  reportNumber: string; // e.g., RPT-2025-001
  type: ReportType;
  title: string;
  description?: string;
  status: ReportStatus;
  
  // Period
  periodStart?: string;
  periodEnd?: string;
  tripId?: string;
  
  // Content
  content?: string;
  attachments?: ReportAttachment[];
  
  // Submission
  submittedBy: string;
  submittedByName?: string;
  submittedAt?: string;
  dueAt?: string;
  isOverdue?: boolean;
  
  // Review
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  
  createdAt: string;
  updatedAt?: string;
}

export interface ReportAttachment {
  id: string;
  name: string;
  fileUrl?: string;
  fileData?: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface PendingReport {
  id: string;
  type: ReportType;
  title: string;
  dueAt: string;
  assignedTo: string;
  assignedToName?: string;
  tripId?: string;
  tripNumber?: string;
  daysOverdue?: number;
}

export interface CreateReportData {
  type: ReportType;
  title: string;
  description?: string;
  periodStart?: string;
  periodEnd?: string;
  tripId?: string;
  content?: string;
  attachments?: Omit<ReportAttachment, 'id' | 'uploadedAt'>[];
  dueAt?: string;
}

// ==========================================
// 7. NOTIFICATION TYPES
// ==========================================

export type LogisticsNotificationType = 
  | 'trip_assigned'
  | 'trip_started'
  | 'trip_completed'
  | 'journey_update'
  | 'document_expiring'
  | 'document_expired'
  | 'maintenance_due'
  | 'report_overdue'
  | 'vendor_assigned'
  | 'passenger_notification';

export interface LogisticsNotification {
  id: string;
  type: LogisticsNotificationType;
  title: string;
  message: string;
  recipientId: string;
  recipientEmail?: string;
  entityType?: 'trip' | 'journey' | 'vehicle' | 'report';
  entityId?: string;
  isRead: boolean;
  sentAt: string;
  readAt?: string;
  actionUrl?: string;
}

// ==========================================
// 8. DASHBOARD & STATISTICS TYPES
// ==========================================

export interface LogisticsDashboardStats {
  // Trips
  totalTrips: number;
  activeTrips: number;
  scheduledTrips: number;
  completedTripsToday: number;
  completedTripsThisMonth: number;
  
  // Fleet
  totalVehicles: number;
  availableVehicles: number;
  vehiclesInUse: number;
  vehiclesInMaintenance: number;
  documentsExpiringSoon: number;
  documentsExpired: number;
  
  // Drivers
  totalDrivers: number;
  availableDrivers: number;
  driversOnTrip: number;
  
  // Materials
  totalMaterials: number;
  materialsInTransit: number;
  
  // Compliance
  pendingReports: number;
  overdueReports: number;
  
  // Performance
  onTimeRate: number; // percentage
  averageTripDuration: string;
}

export interface FleetAlert {
  id: string;
  type: 'document_expiring' | 'document_expired' | 'maintenance_due' | 'maintenance_overdue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  vehicleId: string;
  vehiclePlate: string;
  vehicleName: string;
  message: string;
  dueAt?: string;
  daysRemaining?: number;
  createdAt: string;
}

// ==========================================
// 9. BULK UPLOAD TEMPLATES
// ==========================================

export interface UploadTemplate {
  id: string;
  name: string;
  type: 'trips' | 'materials';
  description: string;
  downloadUrl: string;
  columns: TemplateColumn[];
}

export interface TemplateColumn {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'enum';
  enumValues?: string[];
  description: string;
  example: string;
}
