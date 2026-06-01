/** Staff trip request API types (Jun 2026). */

export type TripBookingScope = 'within_state' | 'outside_state';

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

export interface StaffTripRequest {
  id: number | string;
  tripCode?: string;
  destination: string;
  purpose?: string;
  origin?: string;
  bookingScope?: TripBookingScope;
  booking_scope?: TripBookingScope;
  bookingScopeLabel?: string;
  booking_scope_label?: string;
  workflowStage?: string;
  workflow_stage?: string;
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
}
