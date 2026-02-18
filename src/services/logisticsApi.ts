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
  LogisticsReport,
  CreateReportData,
  PendingReport,
  LogisticsVendor,
  VendorInvite,
  LogisticsDashboardStats,
  FleetAlert,
  UploadTemplate,
  LogisticsNotification,
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
        error: data.message || data.error || `Request failed with status ${response.status}` 
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
  // Backend expects: vendor_id (snake_case) - sends notification to vendor
  assignVendor: async (tripId: string, vendorId: string): Promise<ApiResponse<Trip>> => {
    return apiRequest<Trip>(`/trips/${tripId}/assign-vendor`, {
      method: 'POST',
      body: JSON.stringify({ vendor_id: vendorId }),
    });
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
};

// ==========================================
// JOURNEYS API (Execution Layer)
// ==========================================
export const journeysApi = {
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
    return apiRequest<Material>('/materials', {
      method: 'POST',
      body: JSON.stringify(data),
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
    return apiRequest<FleetVehicle>('/fleet/vehicles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update vehicle
  update: async (id: string, data: Partial<FleetVehicle>): Promise<ApiResponse<FleetVehicle>> => {
    return apiRequest<FleetVehicle>(`/fleet/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
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
      console.log('Backend template not available, using local template');
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
};

export default logisticsApi;
