/** Staff trip request API types (Jun 2026). */

export type TripBookingScope = 'within_state' | 'out_of_state_local' | 'international';

export type InternationalTransportMode = 'flight' | 'road';

export type TripType = 'business' | 'client_visit' | 'training' | 'conference' | 'field_work' | 'other';

export interface TripAuditTrailEntry {
  id?: number | string;
  field_name?: string;
  fieldName?: string;
  original_value?: string | number | null;
  originalValue?: string | number | null;
  new_value?: string | number | null;
  newValue?: string | number | null;
  reason?: string | null;
  editor_name?: string;
  editorName?: string;
  editor_role?: string;
  editorRole?: string;
  created_at?: string;
  createdAt?: string;
}

export interface TripBookingScopeRule {
  value: TripBookingScope;
  label: string;
  minimumLeadDays: number;
  violationMessage: string;
}

export interface TripBookingRulesPayload {
  scopes: TripBookingScopeRule[];
  referenceDate: string;
}

export interface TripProgressSummary {
  currentStepKey?: string;
  currentStepLabel?: string;
  progressPercent?: number;
}

export interface TripProgressStep {
  key: string;
  label: string;
  status: 'completed' | 'pending' | 'in_progress' | 'not_started' | string;
  step?: number;
  completedAt?: string | null;
}

export interface TripProgressPayload {
  currentStepKey?: string;
  currentStep?: number;
  totalSteps?: number;
  progressPercent?: number;
  steps: TripProgressStep[];
}

export interface TripUiDeleteDraft {
  showButton?: boolean;
  label?: string;
  method?: string;
  path: string;
  confirmMessage?: string;
}

export interface TripRequestUi {
  deleteDraft?: TripUiDeleteDraft | null;
}

export interface TripRequestPassenger {
  id?: number | string;
  user_id?: number;
  userId?: number;
  name: string;
  email?: string;
  department?: string;
}

export interface TripRequestExternalPassenger {
  name: string;
  email: string;
  phone?: string;
}

export interface TripViewerContext {
  isInvolved?: boolean;
  canManage?: boolean;
  readOnly?: boolean;
  canRequesterEdit?: boolean;
  can_requester_edit?: boolean;
  requesterEditExpiresAt?: string;
  requester_edit_expires_at?: string;
}

export interface StaffTripRequest {
  id: number | string;
  tripCode?: string;
  trip_code?: string;
  destination: string;
  purpose?: string;
  origin?: string;
  bookingScope?: TripBookingScope;
  booking_scope?: TripBookingScope;
  bookingScopeLabel?: string;
  booking_scope_label?: string;
  international_transport_mode?: InternationalTransportMode | null;
  internationalTransportMode?: InternationalTransportMode | null;
  trip_type?: TripType | string | null;
  tripType?: TripType | string | null;
  accommodation_required?: boolean;
  accommodationRequired?: boolean;
  accommodation_name?: string | null;
  accommodationName?: string | null;
  accommodation_address?: string | null;
  accommodationAddress?: string | null;
  accommodation_contact?: string | null;
  accommodationContact?: string | null;
  accommodation_details?: string | null;
  accommodationDetails?: string | null;
  accommodation_estimated_cost?: number | null;
  accommodationEstimatedCost?: number | null;
  escort_required?: boolean;
  escortRequired?: boolean;
  escort_description?: string | null;
  escortDescription?: string | null;
  estimated_cost?: number | null;
  estimatedCost?: number | null;
  approval_status?: string | null;
  approvalStatus?: string | null;
  audit_trail?: TripAuditTrailEntry[];
  auditTrail?: TripAuditTrailEntry[];
  comments?: TripComment[];
  bookingRules?: TripBookingRulesPayload | null;
  booking_rules?: TripBookingRulesPayload | null;
  workflowStage?: string;
  workflow_stage?: string;
  availableActions?: string[];
  status: string;
  scheduled_departure_at?: string;
  scheduledDepartureAt?: string;
  scheduled_arrival_at?: string;
  scheduledArrivalAt?: string;
  progressSummary?: TripProgressSummary;
  progress?: { steps?: TripProgressStep[]; currentStepKey?: string };
  created_at?: string;
  createdAt?: string;
  canDelete?: boolean;
  isDraft?: boolean;
  ui?: TripRequestUi;
  /** Linked logistics trip id once approved/assigned */
  trip_id?: string | number;
  tripId?: string | number;
  logisticsTripId?: string | number;
  logistics_trip_id?: string | number;
  requester_name?: string;
  requesterName?: string;
  requester_department?: string;
  requesterDepartment?: string;
  requester_id?: number;
  requesterId?: number;
  passengers?: TripRequestPassenger[];
  passenger_user_ids?: number[];
  passengerUserIds?: number[];
  external_passengers?: TripRequestExternalPassenger[];
  externalPassengers?: TripRequestExternalPassenger[];
  vehicle_id?: string | number;
  vehicleId?: string | number;
  vehicle_plate?: string;
  vehiclePlate?: string;
  driver_user_id?: number;
  driverUserId?: number;
  driver_name?: string;
  driverName?: string;
  external_driver?: { name: string; phone?: string; email?: string };
  externalDriver?: { name: string; phone?: string; email?: string };
  viewer?: TripViewerContext;
  readOnly?: boolean;
  canManage?: boolean;
  canComment?: boolean;
  canRequesterEdit?: boolean;
  can_requester_edit?: boolean;
  requesterEditExpiresAt?: string;
  requester_edit_expires_at?: string;
}

export interface OrgTripListItem extends StaffTripRequest {}

export interface TripComment {
  id: string | number;
  body: string;
  author_name?: string;
  authorName?: string;
  author_role?: string;
  authorRole?: string;
  created_at?: string;
  createdAt?: string;
}

export interface TripConfirmAssignmentData {
  vehicle_id: number | string;
  driver_type: 'internal' | 'external';
  driver_user_id?: number;
  external_driver?: { name: string; phone: string; email?: string };
  notes?: string;
}

export interface TripConversionPayload {
  fulfillment_type: 'external_vendor' | 'internal_vehicle';
  passenger_user_ids?: number[];
  external_passengers?: TripRequestExternalPassenger[];
  notes?: string;
  vendor_id?: number;
  vehicle_type?: string;
  estimated_vendor_cost?: number;
  vehicle_id?: number;
  driver_type: 'internal' | 'external';
  driver_user_id?: number;
  external_driver?: { name: string; phone?: string; email?: string };
}

export interface TripRequestsListResponse {
  trips: StaffTripRequest[];
  pagination?: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

export interface CreateStaffTripRequestData {
  destination: string;
  purpose: string;
  origin: string;
  scheduled_departure_at: string;
  scheduled_arrival_at: string;
  passenger_user_ids: number[];
  bookingScope: TripBookingScope;
  external_passengers?: TripRequestExternalPassenger[];
  international_transport_mode?: InternationalTransportMode | null;
  trip_type?: TripType | string | null;
  accommodation_required?: boolean;
  accommodation_name?: string;
  accommodation_address?: string;
  accommodation_contact?: string;
  accommodation_details?: string;
  accommodation_estimated_cost?: number;
  escort_required?: boolean;
  escort_description?: string;
  save_as_draft?: boolean;
}

/** Partial body for PUT /api/trip-requests/{id} (requester edit within 48h). */
export type UpdateStaffTripRequestData = Partial<CreateStaffTripRequestData> & {
  booking_scope?: TripBookingScope;
  externalPassengers?: TripRequestExternalPassenger[];
};
