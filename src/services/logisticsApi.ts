// ============================================
// LOGISTICS API SERVICE
// SCM Logistics Module Upgrade Specification
// ============================================
// NOTE: This frontend service is designed to CONSUME backend endpoints.
// All actual backend implementation is the responsibility of the backend team.

import type {
  Trip,
  CreateTripData,
  BulkTripUploadResult,
  Journey,
  UpdateJourneyData,
  Material,
  BulkMaterialUploadResult,
  FleetVehicle,
  CreateVehicleData,
  VehicleDocument,
  MaintenanceRecord,
  MaintenanceSchedule,
  UpcomingMaintenanceItem,
  Driver,
  LogisticsReport,
  CreateReportData,
  PendingReport,
  LogisticsVendor,
  VendorInvite,
  LogisticsDashboardStats,
  FleetAlert,
  UploadTemplate,
  LogisticsNotification,
  VendorTripSubmission,
  VendorTripDocument,
  VendorTripDocType,
  VendorTripResponse,
  Accommodation,
  CreateAccommodationData,
  JCC,
  JCCLineItem,
  JCCPrefillSuggestion,
  MaterialMovementRecord,
  MaterialJCC,
  MaterialJCCLineItem,
  MaterialJCCPrefillItem,
  MaterialMovementSummary,
} from '@/types/logistics';
import type { ApiResponse } from '@/types';

// Use same API URL logic as main api.ts
const getApiBaseUrl = () => {
  let baseUrl: string;
  
  if (import.meta.env.VITE_API_BASE_URL) {
    baseUrl = import.meta.env.VITE_API_BASE_URL.trim();
    if (!baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.replace(/\/$/, '') + '/api';
    }
    return baseUrl;
  }
  
  const isLovablePreview = typeof window !== 'undefined' && window.location.origin.includes('lovable.app');
  const isProduction = typeof window !== 'undefined' && !window.location.origin.includes('localhost');
  
  if (isLovablePreview || isProduction) {
    return 'https://supply-chain-backend-hwh6.onrender.com/api';
  }
  
  return 'https://supply-chain-backend-hwh6.onrender.com/api';
};

const API_BASE_URL = getApiBaseUrl();

/** Build a readable error string from Laravel / generic JSON error bodies. */
function formatLogisticsApiError(data: unknown, status: number): string {
  if (!data || typeof data !== 'object') {
    return `Request failed with status ${status}`;
  }
  const d = data as Record<string, unknown>;
  const pickStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  const msg =
    pickStr(d.message) ||
    pickStr(d.error) ||
    pickStr(d.exception);
  if (msg) return msg;
  const errs = d.errors;
  if (errs && typeof errs === 'object' && !Array.isArray(errs)) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(errs as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        for (const x of v) parts.push(`${k}: ${String(x)}`);
      } else if (v != null) {
        parts.push(`${k}: ${String(v)}`);
      }
    }
    if (parts.length) return parts.join(' ');
  }
  return `Request failed with status ${status}`;
}

/** Vendor id as JSON: integer when numeric (common Laravel rule), else string. */
function vendorAssignmentPayload(vendorId: string): Record<string, string | number> {
  const vid = String(vendorId ?? '').trim();
  if (/^\d+$/.test(vid)) {
    const n = Number(vid);
    return { vendor_id: n, vendorId: n };
  }
  return { vendor_id: vid, vendorId: vid };
}

// Helper function for API calls
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  
  const headers: HeadersInit = {
    'Accept': 'application/json',
    ...options.headers,
  };

  // Don't set Content-Type for FormData (let browser set it with boundary)
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text.substring(0, 200));
      return { success: false, error: 'Server returned invalid response' };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: formatLogisticsApiError(data, response.status),
      };
    }

    // Deep extraction for Laravel's nested response structure:
    // Backend returns: { success: true, data: { trips: { data: [...], current_page, total, ... } } }
    // or: { success: true, data: { trip: { ... } } }
    // We need to unwrap to get the actual array or entity.
    let responseData = (data && typeof data === 'object' && 'data' in data) ? data.data : data;
    
    // If responseData is an object with a single key containing a Laravel pagination object or entity
    if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
      const keys = Object.keys(responseData);
      if (keys.length === 1) {
        const innerValue = responseData[keys[0]];
        if (innerValue && typeof innerValue === 'object') {
          // Laravel pagination object: { data: [...], current_page, total, ... }
          if (Array.isArray(innerValue.data) && ('current_page' in innerValue || 'total' in innerValue || 'per_page' in innerValue)) {
            responseData = innerValue.data;
          } else if (!Array.isArray(innerValue)) {
            // Single entity: { trip: { id, title, ... } }
            responseData = innerValue;
          }
        }
      }
      // Also handle case where responseData itself has pagination keys (e.g., unwrapped once already)
      else if ('current_page' in responseData && Array.isArray(responseData.data)) {
        responseData = responseData.data;
      }
    }
    
    return { success: true, data: responseData };
  } catch (error) {
    console.error('API request failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// ==========================================
// TRIPS API (Scheduling Layer)
// ==========================================
export const tripsApi = {
  // Get all trips with optional filters
  getAll: async (filters?: {
    status?: string;
    type?: string;
    vendorId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ApiResponse<Trip[]>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<Trip[]>(`/trips${query}`);
  },

  // Get single trip by ID
  getById: async (id: string): Promise<ApiResponse<Trip>> => {
    return apiRequest<Trip>(`/trips/${id}`);
  },

  // Create new trip
  create: async (data: CreateTripData): Promise<ApiResponse<Trip>> => {
    return apiRequest<Trip>('/trips', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update trip
  update: async (id: string, data: Partial<Trip>): Promise<ApiResponse<Trip>> => {
    return apiRequest<Trip>(`/trips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Assign vendor to trip
  // Backend expects vendor_id (often integer); duplicate vendorId for camelCase consumers.
  assignVendor: async (tripId: string, vendorId: string): Promise<ApiResponse<Trip>> => {
    const tid = String(tripId ?? '').trim();
    const payload = vendorAssignmentPayload(vendorId);

    // Item 6 — diagnostic for the 500 + "Failed to send vendor invitation" bug.
    // Capture the exact payload + endpoint so PM/Logistics can paste both PM and SCD
    // logs alongside the backend exception. Safe in prod — no PII beyond IDs.
    // TODO(@logistics-team, remove by 2026-06-22): once backend ships graceful
    // email-failure handling (returns 200 with { assigned: true, email_sent, email_error })
    // delete this debug AND the defensive branch below. Tracked in frontend_changes.md §Item 6.
    // eslint-disable-next-line no-console
    console.debug('[Item6/assignVendor]', {
      endpoint: `/trips/${tid}/assign-vendor`,
      payload,
    });

    const res = await apiRequest<Trip>(`/trips/${encodeURIComponent(tid)}/assign-vendor`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // Item 6 — defensive handling. If the backend has been patched to return
    // { assigned: true, email_sent: false, email_error: '...' } on email failure,
    // surface it as a success with a warning attached to the response (caller can read
    // `email_sent` / `email_error` off `res.data`). This block is the swap target for
    // the cleanup TODO above.
    if (res.success && res.data) {
      const d = res.data as unknown as Record<string, unknown>;
      if (d.assigned === true && d.email_sent === false) {
        // eslint-disable-next-line no-console
        console.warn('[Item6/assignVendor] vendor assigned but invitation email failed', {
          email_error: d.email_error,
        });
      }
    }

    return res;
  },

  // Bulk upload trips from Excel
  bulkUpload: async (file: File): Promise<ApiResponse<BulkTripUploadResult>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest<BulkTripUploadResult>('/trips/bulk-upload', {
      method: 'POST',
      body: formData,
    });
  },

  // Update trip status
  updateStatus: async (id: string, status: string, notes?: string): Promise<ApiResponse<Trip>> => {
    return apiRequest<Trip>(`/trips/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  },

  // Cancel trip
  cancel: async (id: string, reason: string): Promise<ApiResponse<Trip>> => {
    return apiRequest<Trip>(`/trips/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /** Assign vehicle and driver (internal user or external) to a trip */
  assignResources: async (
    tripId: string,
    data: import('@/types/logistics').TripResourceAssignmentData,
  ): Promise<ApiResponse<Trip>> => {
    return apiRequest<Trip>(`/trips/${encodeURIComponent(tripId)}/assign-resources`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getComments: async (tripId: string): Promise<ApiResponse<import('@/types/logistics').TripComment[]>> => {
    const res = await apiRequest<Record<string, unknown>>(`/trips/${encodeURIComponent(tripId)}/comments`);
    if (res.success && res.data) {
      const comments = (
        (res.data as Record<string, unknown>).comments ??
        (Array.isArray(res.data) ? res.data : [])
      ) as import('@/types/logistics').TripComment[];
      return { ...res, data: comments };
    }
    return res as unknown as ApiResponse<import('@/types/logistics').TripComment[]>;
  },

  addComment: async (tripId: string, body: string): Promise<ApiResponse<import('@/types/logistics').TripComment>> => {
    const res = await apiRequest<Record<string, unknown>>(`/trips/${encodeURIComponent(tripId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    if (res.success && res.data) {
      const comment =
        ((res.data as Record<string, unknown>).comment as import('@/types/logistics').TripComment) ??
        (res.data as unknown as import('@/types/logistics').TripComment);
      return { ...res, data: comment };
    }
    return res as unknown as ApiResponse<import('@/types/logistics').TripComment>;
  },
};

// ==========================================
// JOURNEYS API (Execution Layer)
// ==========================================
export const journeysApi = {
  /** List all active journeys (falls back to per-trip fetch when endpoint unavailable) */
  list: async (): Promise<ApiResponse<Journey[]>> => {
    const res = await apiRequest<Journey[] | Record<string, unknown>>('/journeys');
    if (res.success && res.data) {
      if (Array.isArray(res.data)) return { ...res, data: res.data };
      const wrapped = res.data as Record<string, unknown>;
      const journeys = (wrapped.journeys ?? wrapped.data) as Journey[] | undefined;
      if (Array.isArray(journeys)) return { ...res, data: journeys };
    }
    return { success: false, error: res.error || 'Journey list unavailable', data: [] };
  },

  // Get journey for a trip
  getByTripId: async (tripId: string): Promise<ApiResponse<Journey>> => {
    return apiRequest<Journey>(`/journeys/${tripId}`);
  },

  // Create journey for trip
  create: async (tripId: string): Promise<ApiResponse<Journey>> => {
    return apiRequest<Journey>('/journeys', {
      method: 'POST',
      body: JSON.stringify({ tripId }),
    });
  },

  // Update journey (used by vendors/drivers)
  update: async (id: string, data: UpdateJourneyData): Promise<ApiResponse<Journey>> => {
    return apiRequest<Journey>(`/journeys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Update journey status
  // Backend expects: status (uppercase: DEPARTED, EN_ROUTE, ARRIVED, COMPLETED, CANCELLED), timestamp, location
  // Triggers JourneyStatusUpdatedNotification to relevant parties
  updateStatus: async (id: string, status: string, location?: string, timestamp?: string): Promise<ApiResponse<Journey>> => {
    return apiRequest<Journey>(`/journeys/${id}/update-status`, {
      method: 'POST',
      body: JSON.stringify({ 
        status: status.toUpperCase(), 
        location,
        timestamp: timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
      }),
    });
  },

  // Add checkpoint
  addCheckpoint: async (id: string, checkpoint: {
    location: string;
    notes?: string;
    gpsCoordinates?: { latitude: number; longitude: number };
  }): Promise<ApiResponse<Journey>> => {
    return apiRequest<Journey>(`/journeys/${id}/checkpoints`, {
      method: 'POST',
      body: JSON.stringify(checkpoint),
    });
  },

  // Report incident
  reportIncident: async (id: string, incident: {
    type: string;
    description: string;
    location?: string;
    severity: string;
  }): Promise<ApiResponse<Journey>> => {
    return apiRequest<Journey>(`/journeys/${id}/incidents`, {
      method: 'POST',
      body: JSON.stringify(incident),
    });
  },
};

// ==========================================
// MATERIALS API
// ==========================================
export const materialsApi = {
  // Get all materials
  getAll: async (filters?: {
    status?: string;
    category?: string;
    location?: string;
  }): Promise<ApiResponse<Material[]>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<Material[]>(`/materials${query}`);
  },

  // Get single material
  getById: async (id: string): Promise<ApiResponse<Material>> => {
    return apiRequest<Material>(`/materials/${id}`);
  },

  // Get materials for a trip
  getByTripId: async (tripId: string): Promise<ApiResponse<Material[]>> => {
    return apiRequest<Material[]>(`/trips/${tripId}/materials`);
  },

  // Create material
  create: async (data: Partial<Material>): Promise<ApiResponse<Material>> => {
    // Convert camelCase to snake_case for Laravel backend
    const snakeData: Record<string, any> = {
      name: data.name,
      description: data.description,
      category: data.category,
      quantity: data.quantity,
      unit: data.unit,
      condition: data.condition,
      status: data.status,
      current_location: data.currentLocation,
      warehouse_id: data.warehouseId,
      weight: data.weight,
      dimensions: data.dimensions,
      value: data.value,
      notes: data.notes,
    };
    Object.keys(snakeData).forEach(k => snakeData[k] === undefined && delete snakeData[k]);
    return apiRequest<Material>('/materials', {
      method: 'POST',
      body: JSON.stringify(snakeData),
    });
  },

  // Update material
  update: async (id: string, data: Partial<Material>): Promise<ApiResponse<Material>> => {
    return apiRequest<Material>(`/materials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Bulk upload materials
  bulkUpload: async (file: File): Promise<ApiResponse<BulkMaterialUploadResult>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest<BulkMaterialUploadResult>('/materials/bulk-upload', {
      method: 'POST',
      body: formData,
    });
  },

  // Delete material
  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/materials/${id}`, { method: 'DELETE' });
  },
};

// ==========================================
// FLEET API
// ==========================================
export const fleetApi = {
  // Get all vehicles
  getAll: async (filters?: {
    status?: string;
    ownership?: string;
    vendorId?: string;
    approvalStatus?: string;
  }): Promise<ApiResponse<FleetVehicle[]>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<FleetVehicle[]>(`/fleet/vehicles${query}`);
  },

  // Get single vehicle
  getById: async (id: string): Promise<ApiResponse<FleetVehicle>> => {
    return apiRequest<FleetVehicle>(`/fleet/vehicles/${id}`);
  },

  // Create vehicle
  create: async (data: CreateVehicleData): Promise<ApiResponse<FleetVehicle>> => {
    // Convert camelCase to snake_case for Laravel backend
    const snakeData: Record<string, any> = {
      plate: data.plate,
      plate_number: data.plate,
      registration_number: data.plate,
      name: data.name,
      type: data.type,
      make: data.make,
      model: data.model,
      year: data.year,
      color: data.color,
      ownership: data.ownership,
      vendor_id: data.vendorId,
      passenger_capacity: data.passengerCapacity,
      cargo_capacity: data.cargoCapacity,
      fuel_type: data.fuelType,
    };
    // Remove undefined values
    Object.keys(snakeData).forEach(k => snakeData[k] === undefined && delete snakeData[k]);
    return apiRequest<FleetVehicle>('/fleet/vehicles', {
      method: 'POST',
      body: JSON.stringify(snakeData),
    });
  },

  // Update vehicle
  update: async (id: string, data: Partial<FleetVehicle>): Promise<ApiResponse<FleetVehicle>> => {
    // Mirror plate -> plate_number/registration_number so backend persists the user input.
    const payload: Record<string, any> = { ...data };
    if (data.plate) {
      payload.plate_number = data.plate;
      payload.registration_number = data.plate;
    }
    return apiRequest<FleetVehicle>(`/fleet/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // Approve vehicle
  approve: async (id: string, notes?: string): Promise<ApiResponse<FleetVehicle>> => {
    return apiRequest<FleetVehicle>(`/fleet/vehicles/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  // Reject vehicle
  reject: async (id: string, reason: string): Promise<ApiResponse<FleetVehicle>> => {
    return apiRequest<FleetVehicle>(`/fleet/vehicles/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Add maintenance record
  addMaintenance: async (vehicleId: string, data: Omit<MaintenanceRecord, 'id' | 'vehicleId'>): Promise<ApiResponse<MaintenanceRecord>> => {
    return apiRequest<MaintenanceRecord>(`/fleet/vehicles/${vehicleId}/maintenance`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Upload vehicle document
  uploadDocument: async (vehicleId: string, file: File, docType: string, expiresAt?: string): Promise<ApiResponse<VehicleDocument>> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', docType);
    if (expiresAt) formData.append('expiresAt', expiresAt);
    return apiRequest<VehicleDocument>(`/fleet/vehicles/${vehicleId}/documents`, {
      method: 'POST',
      body: formData,
    });
  },

  // Get fleet alerts (expiring documents, maintenance due)
  // Supports days_threshold query parameter (default: 30)
  // Returns alerts with severity: critical, warning, info
  getAlerts: async (daysThreshold: number = 30): Promise<ApiResponse<FleetAlert[]>> => {
    return apiRequest<FleetAlert[]>(`/fleet/alerts?days_threshold=${daysThreshold}`);
  },

  // Delete vehicle
  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/fleet/vehicles/${id}`, {
      method: 'DELETE',
    });
  },

  // Logistics officer initiates a Service Request Form for a vehicle
  initiateSRF: async (id: string): Promise<ApiResponse<{ srf_id?: string; srfId?: string }>> => {
    return apiRequest(`/fleet/vehicles/${encodeURIComponent(id)}/initiate-srf`, {
      method: 'POST',
    });
  },

  // -------- Module 4: Vehicle Documents --------
  listDocuments: async (vehicleId: string): Promise<ApiResponse<VehicleDocument[]>> => {
    return apiRequest<VehicleDocument[]>(`/fleet/vehicles/${vehicleId}/documents`);
  },
  uploadDocumentV2: async (
    vehicleId: string,
    file: File,
    documentType: string,
    expiryDate: string,
  ): Promise<ApiResponse<VehicleDocument>> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    formData.append('expiry_date', expiryDate);
    const res = await apiRequest<VehicleDocument>(`/fleet/vehicles/${vehicleId}/documents`, {
      method: 'POST',
      body: formData,
    });
    if (res.success) window.dispatchEvent(new CustomEvent('app:refresh'));
    return res;
  },
  deleteDocument: async (vehicleId: string, documentId: string): Promise<ApiResponse<void>> => {
    const res = await apiRequest<void>(`/fleet/vehicles/${vehicleId}/documents/${documentId}`, {
      method: 'DELETE',
    });
    if (res.success) window.dispatchEvent(new CustomEvent('app:refresh'));
    return res;
  },
  /** Optional: gated behind backend availability (pre-flight #2). */
  getDocumentAlerts: async (): Promise<ApiResponse<Array<{
    vehicle_id: string;
    plate?: string;
    document_type?: string;
    expiry_date?: string;
    alert_colour?: 'GREEN' | 'AMBER' | 'RED';
  }>>> => {
    return apiRequest(`/fleet/documents/alerts`);
  },

  // -------- Module 4: Maintenance Schedules --------
  listMaintenance: async (vehicleId: string): Promise<ApiResponse<MaintenanceSchedule[]>> => {
    return apiRequest<MaintenanceSchedule[]>(`/fleet/vehicles/${vehicleId}/maintenance`);
  },
  createMaintenance: async (
    vehicleId: string,
    body: { maintenance_type: string; interval_months: number; last_maintenance_date: string; notes?: string },
  ): Promise<ApiResponse<MaintenanceSchedule>> => {
    const res = await apiRequest<MaintenanceSchedule>(`/fleet/vehicles/${vehicleId}/maintenance`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.success) window.dispatchEvent(new CustomEvent('app:refresh'));
    return res;
  },
  updateMaintenance: async (
    vehicleId: string,
    scheduleId: string,
    body: Partial<{ maintenance_type: string; interval_months: number; last_maintenance_date: string; notes?: string; status?: string }>,
  ): Promise<ApiResponse<MaintenanceSchedule>> => {
    const res = await apiRequest<MaintenanceSchedule>(`/fleet/vehicles/${vehicleId}/maintenance/${scheduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res.success) window.dispatchEvent(new CustomEvent('app:refresh'));
    return res;
  },
  getUpcomingMaintenance: async (): Promise<ApiResponse<UpcomingMaintenanceItem[]>> => {
    return apiRequest<UpcomingMaintenanceItem[]>(`/fleet/maintenance/upcoming`);
  },

  // Delete a document attached to a maintenance record
  deleteMaintenanceDocument: async (
    vehicleId: string,
    recordId: string,
    documentId: string,
  ): Promise<ApiResponse<void>> => {
    const res = await apiRequest<void>(
      `/fleet/vehicles/${vehicleId}/maintenance/${recordId}/documents/${documentId}`,
      { method: 'DELETE' },
    );
    if (res.success) window.dispatchEvent(new CustomEvent('app:refresh'));
    return res;
  },

  // -------- Module 4: Status override --------
  updateStatus: async (
    vehicleId: string,
    body: { status: 'ACTIVE' | 'INACTIVE' | 'UNDER_MAINTENANCE'; reason: string; override_by?: string },
  ): Promise<ApiResponse<FleetVehicle>> => {
    const res = await apiRequest<FleetVehicle>(`/fleet/vehicles/${vehicleId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res.success) window.dispatchEvent(new CustomEvent('app:refresh'));
    return res;
  },
};

// ==========================================
// MODULE 4: DRIVERS API
// ==========================================
export const driversApi = {
  list: async (): Promise<ApiResponse<Driver[]>> => {
    return apiRequest<Driver[]>(`/fleet/drivers`);
  },
  create: async (body: { name: string; email?: string; phone_number: string; licence_number?: string }): Promise<ApiResponse<Driver>> => {
    const res = await apiRequest<Driver>(`/fleet/drivers`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.success) window.dispatchEvent(new CustomEvent('app:refresh'));
    return res;
  },
  update: async (driverId: string, body: Partial<{ name: string; email?: string; phone_number: string; licence_number?: string; status: string }>): Promise<ApiResponse<Driver>> => {
    const res = await apiRequest<Driver>(`/fleet/drivers/${driverId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res.success) window.dispatchEvent(new CustomEvent('app:refresh'));
    return res;
  },
  /** GET /fleet/drivers/{id}/documents — list driver documents (licence, training, etc.) */
  listDocuments: async (driverId: string): Promise<ApiResponse<any[]>> => {
    return apiRequest<any[]>(`/fleet/drivers/${driverId}/documents`);
  },
  /** POST /fleet/drivers/{id}/documents (multipart) — upload one driver document */
  uploadDocument: async (
    driverId: string,
    file: File,
    documentType: string,
    expiresAt?: string,
  ): Promise<ApiResponse<any>> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('document_type', documentType);
    if (expiresAt) fd.append('expires_at', expiresAt);
    const res = await apiRequest(`/fleet/drivers/${driverId}/documents`, {
      method: 'POST',
      body: fd,
    });
    if (res.success) window.dispatchEvent(new CustomEvent('app:refresh'));
    return res;
  },
  /** DELETE /fleet/drivers/{id}/documents/{doc_id} */
  deleteDocument: async (driverId: string, documentId: string): Promise<ApiResponse<void>> => {
    const res = await apiRequest<void>(`/fleet/drivers/${driverId}/documents/${documentId}`, {
      method: 'DELETE',
    });
    if (res.success) window.dispatchEvent(new CustomEvent('app:refresh'));
    return res;
  },
};

// ==========================================
// DOCUMENTS API
// ==========================================
export const documentsApi = {
  // Upload document
  upload: async (entityType: 'trip' | 'vehicle' | 'vendor', entityId: string, file: File, metadata?: {
    type?: string;
    expiresAt?: string;
  }): Promise<ApiResponse<{ id: string; url: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    if (metadata?.type) formData.append('type', metadata.type);
    if (metadata?.expiresAt) formData.append('expiresAt', metadata.expiresAt);
    return apiRequest('/documents', {
      method: 'POST',
      body: formData,
    });
  },

  // Get documents for entity
  getByEntity: async (entityType: string, entityId: string): Promise<ApiResponse<VehicleDocument[]>> => {
    return apiRequest<VehicleDocument[]>(`/documents/${entityType}/${entityId}`);
  },

  // Delete document
  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/documents/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==========================================
// REPORTS API
// ==========================================
export const reportsApi = {
  // Get all reports
  getAll: async (filters?: {
    type?: string;
    status?: string;
    submittedBy?: string;
  }): Promise<ApiResponse<LogisticsReport[]>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<LogisticsReport[]>(`/reports${query}`);
  },

  // Get pending reports
  getPending: async (): Promise<ApiResponse<PendingReport[]>> => {
    return apiRequest<PendingReport[]>('/reports/pending');
  },

  // Create report
  create: async (data: CreateReportData): Promise<ApiResponse<LogisticsReport>> => {
    return apiRequest<LogisticsReport>('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Upload report (with attachments)
  upload: async (data: FormData): Promise<ApiResponse<LogisticsReport>> => {
    return apiRequest<LogisticsReport>('/reports', {
      method: 'POST',
      body: data,
    });
  },

  // Update report
  update: async (id: string, data: Partial<LogisticsReport>): Promise<ApiResponse<LogisticsReport>> => {
    return apiRequest<LogisticsReport>(`/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Submit report
  submit: async (id: string): Promise<ApiResponse<LogisticsReport>> => {
    return apiRequest<LogisticsReport>(`/reports/${id}/submit`, {
      method: 'POST',
    });
  },

  // Review report (approve/reject)
  review: async (id: string, decision: 'approved' | 'rejected', notes?: string): Promise<ApiResponse<LogisticsReport>> => {
    return apiRequest<LogisticsReport>(`/reports/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes }),
    });
  },
};

// ==========================================
// LOGISTICS VENDORS API
// ==========================================
export const logisticsVendorsApi = {
  // Get all logistics vendors
  getAll: async (filters?: {
    type?: string;
    status?: string;
  }): Promise<ApiResponse<LogisticsVendor[]>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<LogisticsVendor[]>(`/logistics/vendors${query}`);
  },

  // Get single vendor
  getById: async (id: string): Promise<ApiResponse<LogisticsVendor>> => {
    return apiRequest<LogisticsVendor>(`/logistics/vendors/${id}`);
  },

  // Create vendor
  create: async (data: Partial<LogisticsVendor>): Promise<ApiResponse<LogisticsVendor>> => {
    return apiRequest<LogisticsVendor>('/logistics/vendors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update vendor
  update: async (id: string, data: Partial<LogisticsVendor>): Promise<ApiResponse<LogisticsVendor>> => {
    return apiRequest<LogisticsVendor>(`/logistics/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Invite vendor (for one-time access)
  invite: async (data: VendorInvite): Promise<ApiResponse<{ inviteUrl: string }>> => {
    return apiRequest<{ inviteUrl: string }>('/logistics/vendors/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Accept vendor invite (used by vendor)
  acceptInvite: async (token: string, vendorData: Partial<LogisticsVendor>): Promise<ApiResponse<LogisticsVendor>> => {
    return apiRequest<LogisticsVendor>('/auth/vendor-accept', {
      method: 'POST',
      body: JSON.stringify({ token, ...vendorData }),
    });
  },
};

// ==========================================
// NOTIFICATIONS API
// ==========================================
export const logisticsNotificationsApi = {
  // Get notifications
  getAll: async (unreadOnly?: boolean): Promise<ApiResponse<LogisticsNotification[]>> => {
    const query = unreadOnly ? '?unread=true' : '';
    return apiRequest<LogisticsNotification[]>(`/logistics/notifications${query}`);
  },

  // Mark as read
  markAsRead: async (id: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/logistics/notifications/${id}/read`, {
      method: 'POST',
    });
  },

  // Send notification (internal use)
  send: async (data: {
    type: string;
    recipientId: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  }): Promise<ApiResponse<LogisticsNotification>> => {
    return apiRequest<LogisticsNotification>('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ==========================================
// DASHBOARD & TEMPLATES API
// ==========================================
export const logisticsDashboardApi = {
  // Get dashboard statistics
  getStats: async (): Promise<ApiResponse<LogisticsDashboardStats>> => {
    return apiRequest<LogisticsDashboardStats>('/logistics/dashboard/stats');
  },

  // Get bulk upload templates
  getTemplates: async (): Promise<ApiResponse<UploadTemplate[]>> => {
    return apiRequest<UploadTemplate[]>('/uploads/templates');
  },

  // Download template - returns actual Excel files from public/templates
  downloadTemplate: async (type: 'trips' | 'materials' | 'journey-management' | 'personnel-trip'): Promise<Blob | null> => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    
    // Try backend first, then fall back to local templates
    try {
      const response = await fetch(`${API_BASE_URL}/uploads/templates/${type}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      if (response.ok) {
        return response.blob();
      }
    } catch (error) {
    }
    
    // Fallback to local templates in public folder
    const localTemplates: Record<string, string> = {
      'trips': '/templates/personnel_trip_template.xlsx',
      'personnel-trip': '/templates/personnel_trip_template.xlsx',
      'journey-management': '/templates/journey_management_template.xlsx',
      'materials': '/templates/personnel_trip_template.xlsx', // Use trip template as fallback
    };
    
    try {
      const templateUrl = localTemplates[type];
      if (templateUrl) {
        const response = await fetch(templateUrl);
        if (response.ok) {
          return response.blob();
        }
      }
    } catch (error) {
      console.error('Failed to download local template:', error);
    }
    
    return null;
  },
};

// ==========================================
// UNIFIED EXPORT
// ==========================================

// ==========================================
// 3.1 VENDOR TRIP SUBMISSION (Vendor Portal)
// ==========================================
const normalizeUploadDoc = (raw: any, fallbackType?: VendorTripDocType): VendorTripDocument => ({
  id: String(raw?.id ?? raw?.document_id ?? raw?.uuid ?? crypto.randomUUID()),
  fileUrl: raw?.fileUrl ?? raw?.file_url ?? raw?.url ?? raw?.s3_url ?? "",
  fileName: raw?.fileName ?? raw?.file_name ?? raw?.name ?? "document",
  docType: (raw?.docType ?? raw?.doc_type ?? raw?.document_type ?? fallbackType ?? "other") as VendorTripDocType,
});

export const vendorTripApi = {
  listAssigned: async (): Promise<ApiResponse<Trip[]>> => {
    return apiRequest<Trip[]>('/vendor-portal/trips');
  },
  submit: async (
    tripId: string,
    payload: Omit<VendorTripSubmission, 'id' | 'documents' | 'status' | 'submittedAt' | 'tripId'> & { documentIds?: string[] }
  ): Promise<ApiResponse<VendorTripSubmission>> => {
    return apiRequest<VendorTripSubmission>(
      `/vendor-portal/trips/${tripId}/submission`,
      {
        method: 'POST',
        body: JSON.stringify({
          vehicle_make: payload.vehicleMake,
          vehicle_model: payload.vehicleModel,
          plate_number: payload.plateNumber,
          driver_name: payload.driverName,
          driver_phone: payload.driverPhone,
          driver_licence_number: payload.driverLicenceNumber,
          security_information: payload.securityInformation,
          document_ids: payload.documentIds ?? [],
        }),
      }
    );
  },
  uploadDoc: async (
    tripId: string,
    file: File,
    docType: VendorTripDocType,
    onProgress?: (pct: number) => void
  ): Promise<ApiResponse<VendorTripDocument>> => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('doc_type', docType);

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/vendor-portal/trips/${tripId}/documents`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            const raw = data?.data?.document ?? data?.data ?? data;
            resolve({ success: true, data: normalizeUploadDoc(raw, docType) });
          } else {
            resolve({ success: false, error: data?.message ?? `Upload failed (${xhr.status})` });
          }
        } catch (err) {
          resolve({ success: false, error: 'Invalid upload response' });
        }
      };
      xhr.onerror = () => resolve({ success: false, error: 'Network error during upload' });
      xhr.send(fd);
    });
  },
  getSubmission: async (tripId: string): Promise<ApiResponse<VendorTripSubmission>> => {
    return apiRequest<VendorTripSubmission>(`/trips/${tripId}/submission`);
  },
};

// ==========================================
// 3.2 MULTI-VENDOR INVITE & RESPONSE
// ==========================================
export const tripVendorApi = {
  invite: async (tripId: string, vendorIds: string[]): Promise<ApiResponse<{ invited: number }>> => {
    return apiRequest(`/trips/${tripId}/invite-vendors`, {
      method: 'POST',
      body: JSON.stringify({ vendor_ids: vendorIds }),
    });
  },
  getResponses: async (tripId: string): Promise<ApiResponse<VendorTripResponse[]>> => {
    return apiRequest<VendorTripResponse[]>(`/trips/${tripId}/vendor-responses`);
  },
  selectVendor: async (tripId: string, vendorId: string): Promise<ApiResponse<Trip>> => {
    const tid = String(tripId ?? '').trim();
    return apiRequest<Trip>(`/trips/${encodeURIComponent(tid)}/select-vendor`, {
      method: 'POST',
      body: JSON.stringify(vendorAssignmentPayload(vendorId)),
    });
  },
  routeToProcurement: async (tripId: string): Promise<ApiResponse<{ routed: boolean }>> => {
    return apiRequest(`/trips/${tripId}/route-to-procurement`, { method: 'POST' });
  },
  notifyInvoice: async (tripId: string): Promise<ApiResponse<{ notified: boolean }>> => {
    return apiRequest(`/trips/${tripId}/notify-invoice`, { method: 'POST' });
  },
};

// ==========================================
// 3.3 ACCOMMODATION
// ==========================================
const toAccommodationPayload = (data: Partial<CreateAccommodationData>) => ({
  passenger_names: data.passengerNames,
  destination_state: data.destinationState,
  destination_city: data.destinationCity,
  number_of_nights: data.numberOfNights,
  hotel_name: data.hotelName,
  check_in_date: data.checkInDate,
  linked_trip_id: data.linkedTripId ?? null,
});

export const accommodationApi = {
  list: async (): Promise<ApiResponse<Accommodation[]>> => {
    return apiRequest<Accommodation[]>('/logistics/accommodations');
  },
  get: async (id: string): Promise<ApiResponse<Accommodation>> => {
    return apiRequest<Accommodation>(`/logistics/accommodations/${id}`);
  },
  create: async (data: CreateAccommodationData): Promise<ApiResponse<Accommodation>> => {
    return apiRequest<Accommodation>('/logistics/accommodations', {
      method: 'POST',
      body: JSON.stringify(toAccommodationPayload(data)),
    });
  },
  update: async (id: string, data: Partial<CreateAccommodationData>): Promise<ApiResponse<Accommodation>> => {
    return apiRequest<Accommodation>(`/logistics/accommodations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(toAccommodationPayload(data)),
    });
  },
  remove: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    return apiRequest(`/logistics/accommodations/${id}`, { method: 'DELETE' });
  },
  listForTrip: async (tripId: string): Promise<ApiResponse<Accommodation[]>> => {
    return apiRequest<Accommodation[]>(`/trips/${tripId}/accommodations`);
  },
};

// ==========================================
// 3.4 JOB COMPLETION CERTIFICATE
// ==========================================
const toJccPayload = (jcc: Partial<JCC>) => ({
  date_issued: jcc.dateIssued,
  certification_statement: jcc.certificationStatement,
  line_items: (jcc.lineItems ?? []).map((li) => ({
    description: li.description,
    trip: li.trip,
    duration_date: li.durationDate,
    remarks: li.remarks,
  })),
});

export const jccApi = {
  get: async (tripId: string): Promise<ApiResponse<JCC>> => {
    return apiRequest<JCC>(`/trips/${tripId}/jcc`);
  },
  getPrefill: async (tripId: string): Promise<ApiResponse<JCCPrefillSuggestion[]>> => {
    return apiRequest<JCCPrefillSuggestion[]>(`/trips/${tripId}/jcc/prefill`);
  },
  create: async (tripId: string, jcc: Partial<JCC>): Promise<ApiResponse<JCC>> => {
    return apiRequest<JCC>(`/trips/${tripId}/jcc`, {
      method: 'POST',
      body: JSON.stringify(toJccPayload(jcc)),
    });
  },
  update: async (tripId: string, jcc: Partial<JCC>): Promise<ApiResponse<JCC>> => {
    return apiRequest<JCC>(`/trips/${tripId}/jcc`, {
      method: 'PATCH',
      body: JSON.stringify(toJccPayload(jcc)),
    });
  },
  submit: async (tripId: string): Promise<ApiResponse<JCC>> => {
    return apiRequest<JCC>(`/trips/${tripId}/jcc/submit`, { method: 'POST' });
  },
  approve: async (tripId: string): Promise<ApiResponse<JCC>> => {
    return apiRequest<JCC>(`/trips/${tripId}/jcc/approve`, { method: 'POST' });
  },
  downloadPdf: async (tripId: string): Promise<Blob | null> => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE_URL}/trips/${tripId}/jcc/pdf`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  },
};

export const logisticsApi = {
  trips: tripsApi,
  journeys: journeysApi,
  materials: materialsApi,
  fleet: fleetApi,
  documents: documentsApi,
  reports: reportsApi,
  vendors: logisticsVendorsApi,
  notifications: logisticsNotificationsApi,
  dashboard: logisticsDashboardApi,
  vendorTrip: vendorTripApi,
  tripVendor: tripVendorApi,
  accommodation: accommodationApi,
  jcc: jccApi,
  drivers: driversApi,
  materialMovements: undefined as any, // assigned at module bottom
};

export default logisticsApi;

// ==========================================
// MATERIAL MOVEMENTS API (Module 5)
// ==========================================

const dispatchAppRefresh = () => {
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('app:refresh')); } catch { /* noop */ }
  }
};

const normalizeMovement = (raw: any): MaterialMovementRecord => ({
  id: String(raw.id ?? raw.uuid ?? ''),
  materialName: raw.material_name ?? raw.materialName ?? '',
  category: raw.category ?? '',
  quantity: raw.quantity != null ? Number(raw.quantity) : 0,
  pickupLocation: raw.pickup_location ?? raw.pickupLocation ?? '',
  destination: raw.destination ?? '',
  vendorId: raw.vendor_id ?? raw.vendorId ?? null,
  vendorName: raw.vendor_name ?? raw.vendorName ?? null,
  vendorAddress: raw.vendor_address ?? raw.vendorAddress ?? null,
  vendorPhone: raw.vendor_phone ?? raw.vendorPhone ?? '',
  vehiclePlate: raw.vehicle_plate ?? raw.vehiclePlate ?? '',
  driverName: raw.driver_name ?? raw.driverName ?? '',
  driverPhone: raw.driver_phone ?? raw.driverPhone ?? '',
  expectedPickupAt: raw.expected_pickup_at ?? raw.expectedPickupAt ?? '',
  expectedDeliveryAt: raw.expected_delivery_at ?? raw.expectedDeliveryAt ?? '',
  conditionOfGoods: (raw.condition_of_goods ?? raw.conditionOfGoods ?? 'NEW') as any,
  status: (raw.status ?? 'pending') as any,
  linkedPoNumber: raw.linked_po_number ?? raw.linkedPoNumber ?? null,
  jccId: raw.jcc_id ?? raw.jccId ?? null,
  jccStatus: raw.jcc_status ?? raw.jccStatus ?? null,
  createdAt: raw.created_at ?? raw.createdAt ?? '',
  updatedAt: raw.updated_at ?? raw.updatedAt,
});

const denormalizeMovement = (data: Partial<MaterialMovementRecord>): Record<string, any> => {
  const out: Record<string, any> = {
    material_name: data.materialName,
    category: data.category,
    quantity: data.quantity,
    pickup_location: data.pickupLocation,
    destination: data.destination,
    vendor_id: data.vendorId ?? null,
    vendor_name: data.vendorName ?? null,
    vendor_address: data.vendorAddress ?? null,
    vendor_phone: data.vendorPhone,
    vehicle_plate: data.vehiclePlate,
    driver_name: data.driverName,
    driver_phone: data.driverPhone,
    expected_pickup_at: data.expectedPickupAt,
    expected_delivery_at: data.expectedDeliveryAt,
    condition_of_goods: data.conditionOfGoods,
  };
  Object.keys(out).forEach(k => out[k] === undefined && delete out[k]);
  return out;
};

const normalizeJCCLineItem = (raw: any, idx: number): MaterialJCCLineItem => ({
  id: raw.id ? String(raw.id) : undefined,
  sn: raw.sn ?? idx + 1,
  materialName: raw.material_name ?? raw.materialName ?? '',
  quantity: raw.quantity ?? '',
  condition: raw.condition ?? '',
  remarks: raw.remarks ?? '',
});

const normalizeJCC = (raw: any): MaterialJCC => ({
  id: raw.id ? String(raw.id) : undefined,
  materialId: String(raw.material_id ?? raw.materialId ?? ''),
  referenceNumber: raw.reference_number ?? raw.referenceNumber,
  dateIssued: raw.date_issued ?? raw.dateIssued ?? new Date().toISOString().slice(0, 10),
  certificationStatement: raw.certification_statement ?? raw.certificationStatement ?? '',
  conditionOnArrival: (raw.condition_on_arrival ?? raw.conditionOnArrival ?? '') as any,
  lineItems: Array.isArray(raw.line_items ?? raw.lineItems)
    ? (raw.line_items ?? raw.lineItems).map(normalizeJCCLineItem)
    : [],
  status: (raw.status ?? 'draft') as any,
  signatoryName: raw.signatory_name ?? raw.signatoryName,
  signatoryTitle: raw.signatory_title ?? raw.signatoryTitle,
  signatureUrl: raw.signature_url ?? raw.signatureUrl,
  vendorName: raw.vendor_name ?? raw.vendorName,
  vendorAddress: raw.vendor_address ?? raw.vendorAddress,
  linkedPoNumber: raw.linked_po_number ?? raw.linkedPoNumber ?? null,
  createdAt: raw.created_at ?? raw.createdAt,
  updatedAt: raw.updated_at ?? raw.updatedAt,
});

const normalizePrefill = (raw: any): MaterialJCCPrefillItem[] => {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
        ? raw.data
        : [];
  return arr.map((r: any) => ({
    materialName: r.material_name ?? r.materialName ?? '',
    quantity: r.quantity ?? '',
    condition: r.condition ?? '',
    remarks: r.remarks ?? '',
  }));
};

export interface MaterialListResponse {
  items: MaterialMovementRecord[];
  summary?: MaterialMovementSummary | null;
}

const extractSummary = (raw: any): MaterialMovementSummary | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw.summary ?? raw;
  if (
    candidate &&
    typeof candidate === 'object' &&
    ['total', 'pending', 'in_transit', 'delivered'].some(k => typeof candidate[k] === 'number')
  ) {
    return {
      total: Number(candidate.total ?? 0),
      pending: Number(candidate.pending ?? 0),
      in_transit: Number(candidate.in_transit ?? candidate.inTransit ?? 0),
      delivered: Number(candidate.delivered ?? 0),
      cancelled: Number(candidate.cancelled ?? 0),
    };
  }
  return null;
};

export const materialsMovementsApi = {
  list: async (params?: {
    status?: string;
    category?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    destination?: string;
  }): Promise<ApiResponse<MaterialListResponse>> => {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v && v !== 'all') qs.append(k, String(v));
      });
    }
    const query = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<any>(`/materials${query}`);
    if (!res.success) return { success: false, error: res.error };
    const raw = res.data;
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.items)
          ? raw.items
          : [];
    return {
      success: true,
      data: {
        items: list.map(normalizeMovement),
        summary: extractSummary(raw),
      },
    };
  },

  getSummary: async (): Promise<ApiResponse<MaterialMovementSummary>> => {
    return apiRequest<MaterialMovementSummary>('/materials/summary');
  },

  get: async (id: string): Promise<ApiResponse<MaterialMovementRecord>> => {
    const res = await apiRequest<any>(`/materials/${id}`);
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: normalizeMovement(res.data?.data ?? res.data) };
  },

  create: async (body: Partial<MaterialMovementRecord>): Promise<ApiResponse<MaterialMovementRecord>> => {
    const res = await apiRequest<any>('/materials', {
      method: 'POST',
      body: JSON.stringify(denormalizeMovement(body)),
    });
    if (res.success) dispatchAppRefresh();
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: normalizeMovement(res.data?.data ?? res.data) };
  },

  update: async (id: string, body: Partial<MaterialMovementRecord>): Promise<ApiResponse<MaterialMovementRecord>> => {
    const res = await apiRequest<any>(`/materials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(denormalizeMovement(body)),
    });
    if (res.success) dispatchAppRefresh();
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: normalizeMovement(res.data?.data ?? res.data) };
  },

  cancel: async (id: string): Promise<ApiResponse<void>> => {
    const res = await apiRequest<void>(`/materials/${id}`, { method: 'DELETE' });
    if (res.success) dispatchAppRefresh();
    return res;
  },

  markInTransit: async (id: string): Promise<ApiResponse<MaterialMovementRecord>> => {
    const res = await apiRequest<any>(`/materials/${id}/mark-in-transit`, { method: 'POST' });
    if (res.success) dispatchAppRefresh();
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: normalizeMovement(res.data?.data ?? res.data) };
  },

  markDelivered: async (id: string): Promise<ApiResponse<MaterialMovementRecord>> => {
    const res = await apiRequest<any>(`/materials/${id}/mark-delivered`, { method: 'POST' });
    if (res.success) dispatchAppRefresh();
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: normalizeMovement(res.data?.data ?? res.data) };
  },

  // ---- JCC ----
  getJCC: async (materialId: string): Promise<ApiResponse<MaterialJCC | null>> => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE_URL}/materials/${materialId}/jcc`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.status === 404) return { success: true, data: null };
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      const json = await res.json();
      const raw = json?.data ?? json;
      return { success: true, data: raw ? normalizeJCC(raw) : null };
    } catch (e: any) {
      return { success: false, error: e?.message ?? 'Network error' };
    }
  },

  createJCC: async (materialId: string, body: Partial<MaterialJCC>): Promise<ApiResponse<MaterialJCC>> => {
    const payload = {
      date_issued: body.dateIssued,
      certification_statement: body.certificationStatement,
      condition_on_arrival: body.conditionOnArrival || undefined,
      line_items: (body.lineItems ?? []).map((li, i) => ({
        sn: i + 1,
        material_name: li.materialName,
        quantity: li.quantity,
        condition: li.condition,
        remarks: li.remarks,
      })),
    };
    const res = await apiRequest<any>(`/materials/${materialId}/jcc`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.success) dispatchAppRefresh();
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: normalizeJCC(res.data?.data ?? res.data) };
  },

  updateJCC: async (materialId: string, body: Partial<MaterialJCC>): Promise<ApiResponse<MaterialJCC>> => {
    const payload = {
      date_issued: body.dateIssued,
      certification_statement: body.certificationStatement,
      condition_on_arrival: body.conditionOnArrival || undefined,
      line_items: (body.lineItems ?? []).map((li, i) => ({
        sn: i + 1,
        material_name: li.materialName,
        quantity: li.quantity,
        condition: li.condition,
        remarks: li.remarks,
      })),
    };
    const res = await apiRequest<any>(`/materials/${materialId}/jcc`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (res.success) dispatchAppRefresh();
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: normalizeJCC(res.data?.data ?? res.data) };
  },

  getJCCPrefill: async (materialId: string): Promise<ApiResponse<MaterialJCCPrefillItem[]>> => {
    const res = await apiRequest<any>(`/materials/${materialId}/jcc/prefill`);
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: normalizePrefill(res.data?.data ?? res.data) };
  },

  submitJCC: async (materialId: string): Promise<ApiResponse<MaterialJCC>> => {
    const res = await apiRequest<any>(`/materials/${materialId}/jcc/submit`, { method: 'POST' });
    if (res.success) dispatchAppRefresh();
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: normalizeJCC(res.data?.data ?? res.data) };
  },

  approveJCC: async (materialId: string): Promise<ApiResponse<MaterialJCC>> => {
    const res = await apiRequest<any>(`/materials/${materialId}/jcc/approve`, { method: 'POST' });
    if (res.success) dispatchAppRefresh();
    if (!res.success) return { success: false, error: res.error };
    return { success: true, data: normalizeJCC(res.data?.data ?? res.data) };
  },

  downloadJCCPdf: async (materialId: string): Promise<Blob | null> => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE_URL}/materials/${materialId}/jcc/pdf`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  },
};

(logisticsApi as any).materialMovements = materialsMovementsApi;
