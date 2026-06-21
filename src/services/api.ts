import type { 
  User, 
  LoginCredentials, 
  AuthResponse,
  MRF,
  CreateMRFData,
  SRF,
  CreateSRFData,
  RFQ,
  CreateRFQData,
  Quotation,
  CreateQuotationData,
  Vendor,
  VendorLookupMatch,
  VendorRegistration,
  CreateVendorRegistrationData,
  ApiResponse,
  FilterOptions,
  SortOptions
} from '@/types';
import { RFQ_STANDARD_TERMS } from '@/data/rfqPoTermsTemplate';

/**
 * Recover from Vite "Failed to fetch dynamically imported module" errors.
 * After a redeploy, the browser may hold an index.html referencing stale chunk
 * hashes. Retry once, then force a one-time reload so the user gets the fresh
 * bundle instead of a broken feature.
 */
async function safeDynamicImport<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (err) {
    const msg = String((err as { message?: string })?.message ?? err);
    const isChunkError =
      /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i.test(
        msg,
      );
    if (!isChunkError) throw err;
    try {
      return await loader();
    } catch (err2) {
      if (typeof window !== 'undefined') {
        const KEY = '__lov_chunk_reload__';
        if (!sessionStorage.getItem(KEY)) {
          sessionStorage.setItem(KEY, '1');
          window.location.reload();
        }
      }
      throw err2;
    }
  }
}

// Configure your API base URL here
// For Lovable previews and production, always use the deployed backend
// Only use localhost if explicitly set in VITE_API_BASE_URL for local development
const getApiBaseUrl = () => {
  let baseUrl: string;
  
  // If explicitly set, use it (for local development or cPanel)
  if (import.meta.env.VITE_API_BASE_URL) {
    baseUrl = import.meta.env.VITE_API_BASE_URL.trim();
    // Ensure it ends with /api
    if (!baseUrl.endsWith('/api')) {
      // Remove trailing slash if present, then add /api
      baseUrl = baseUrl.replace(/\/$/, '') + '/api';
    }
    return baseUrl;
  }
  
  // Detect if running in Lovable preview or production
  const isLovablePreview = typeof window !== 'undefined' && window.location.origin.includes('lovable.app');
  const isProduction = typeof window !== 'undefined' && !window.location.origin.includes('localhost');
  
  // Always use deployed backend for Lovable previews and production
  if (isLovablePreview || isProduction) {
    return 'https://supply-chain-backend-hwh6.onrender.com/api';
  }
  
  // Default fallback to deployed backend (safer than localhost)
  return 'https://supply-chain-backend-hwh6.onrender.com/api';
};

const API_BASE_URL = getApiBaseUrl();
export { API_BASE_URL };
export type { ApiResponse } from '@/types';

// Log the API URL being used (helpful for debugging in Lovable)
if (typeof window !== 'undefined') {
}

// Classify a thrown fetch error into a user-friendly message.
// fetch() throws a TypeError for network failures, DNS errors, and CORS rejections.
// We translate that into something a vendor (and a developer) can actually act on.
function classifyFetchError(error: unknown, endpoint: string): string {
  const url = `${API_BASE_URL}${endpoint}`;
  if (error instanceof TypeError) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
      // Most common cause in this app: backend CORS rejection or backend asleep/unreachable.
      console.error(
        `[API] Network/CORS failure calling ${url}.\n` +
        `Likely causes: (1) backend is offline or cold-starting, ` +
        `(2) backend CORS does not allow origin ${typeof window !== 'undefined' ? window.location.origin : 'this client'}, ` +
        `(3) no internet connection.`,
        error,
      );
      return (
        "Could not reach the registration server. This is usually a temporary network or CORS issue. " +
        "Please check your internet connection and try again in a few seconds. If the problem persists, contact support."
      );
    }
  }
  if (error instanceof Error) {
    console.error(`[API] Request to ${url} failed:`, error);
    return error.message;
  }
  console.error(`[API] Request to ${url} failed with unknown error:`, error);
  return 'Network error - please check your connection and try again.';
}

// Helper function to check if token is expired
const isTokenExpired = (tokenExpiry: string | null): boolean => {
  if (!tokenExpiry) return false; // If no expiry info, assume valid
  try {
    const expiryDate = new Date(tokenExpiry);
    return expiryDate < new Date();
  } catch {
    return false; // If invalid date, assume valid
  }
};

// Helper function to get auth token (check localStorage first, then sessionStorage)
export const getAuthToken = (): { token: string | null; expired: boolean } => {
  let token = localStorage.getItem('authToken');
  let tokenExpiry = localStorage.getItem('tokenExpiry');
  let storage: Storage = localStorage;
  
  // If not in localStorage, check sessionStorage
  if (!token) {
    token = sessionStorage.getItem('authToken');
    tokenExpiry = sessionStorage.getItem('tokenExpiry');
    storage = sessionStorage;
  }
  
  // Check if token is expired
  const expired = token ? isTokenExpired(tokenExpiry) : false;
  
  // If expired, clear token
  if (expired && token) {
    console.warn('Token expired, clearing session');
    storage.removeItem('authToken');
    storage.removeItem('userData');
    storage.removeItem('tokenExpiry');
    storage.removeItem('isAuthenticated');
    // Don't redirect here - let the API handle 401 responses
    return { token: null, expired: true };
  }
  
  return { token, expired: false };
};

// Helper function to get vendor auth token
const getVendorAuthToken = (): { token: string | null; expired: boolean } => {
  let token = localStorage.getItem('vendorAuthToken');
  let tokenExpiry = localStorage.getItem('vendorTokenExpiry');
  let storage: Storage = localStorage;
  
  // If not in localStorage, check sessionStorage
  if (!token) {
    token = sessionStorage.getItem('vendorAuthToken');
    tokenExpiry = sessionStorage.getItem('vendorTokenExpiry');
    storage = sessionStorage;
  }
  
  // Check if token is expired
  const expired = token ? isTokenExpired(tokenExpiry) : false;
  
  // If expired, clear token
  if (expired && token) {
    console.warn('Vendor token expired, clearing session');
    storage.removeItem('vendorAuthToken');
    storage.removeItem('vendorData');
    storage.removeItem('vendorTokenExpiry');
    return { token: null, expired: true };
  }
  
  return { token, expired: false };
};

// Helper function for API requests
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  // Try regular auth token first, then vendor token as fallback
  let { token, expired } = getAuthToken();
  let isVendorToken = false;
  
  // If no regular token, check for vendor token (for vendor portal)
  if (!token) {
    const vendorTokenResult = getVendorAuthToken();
    if (vendorTokenResult.token) {
      token = vendorTokenResult.token;
      expired = vendorTokenResult.expired;
      isVendorToken = true;
    }
  }
  
  // If token is expired, return error immediately (unless this is a login/refresh request)
  const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh');
  if (expired && !isAuthEndpoint) {
    return {
      success: false,
      error: 'Authentication token has expired. Please log in again.',
    };
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  // Always include Authorization header with Bearer token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Check if response is HTML (API not configured or unreachable)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.error('API returned HTML instead of JSON. Check VITE_API_BASE_URL configuration.');
      return {
        success: false,
        error: 'API server unreachable. Please check your connection and ensure the backend is running.',
      };
    }

    const text = await response.text();
    
    // Handle empty responses
    if (!text) {
      if (response.ok) {
        return { success: true, data: undefined as T };
      }
      return { success: false, error: 'Empty response from server' };
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('Failed to parse API response as JSON:', text.substring(0, 100));
      return {
        success: false,
        error: 'Invalid response from server. Please ensure the API is properly configured.',
      };
    }

    // Handle 401 Unauthorized - token is invalid or expired
    if (response.status === 401) {
      // Clear invalid token (both regular and vendor tokens)
      if (isVendorToken) {
        localStorage.removeItem('vendorAuthToken');
        localStorage.removeItem('vendorData');
        localStorage.removeItem('vendorTokenExpiry');
        sessionStorage.removeItem('vendorAuthToken');
        sessionStorage.removeItem('vendorData');
        sessionStorage.removeItem('vendorTokenExpiry');
      } else {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        sessionStorage.removeItem('tokenExpiry');
        sessionStorage.removeItem('isAuthenticated');
      }
      
      // Redirect to login if we're in a browser context (only for non-auth endpoints)
      if (typeof window !== 'undefined' && !isAuthEndpoint) {
        if (window.location.pathname.includes('/vendor-portal')) {
          // Don't redirect vendors - let them see the error
        } else if (!window.location.pathname.includes('/auth')) {
          window.location.href = '/auth';
        }
      }
      
      return {
        success: false,
        error: 'Authentication failed. Please log in again.',
      };
    }

    if (!response.ok) {
      // Handle 404 Not Found - route not found
      if (response.status === 404) {
        const errorMsg = data.message || data.error || 'Route not found';
        // Provide helpful error message for route not found
        if (errorMsg.toLowerCase().includes('route') && errorMsg.toLowerCase().includes('not found')) {
          return {
            success: false,
            error: `API route not found. Please verify:\n1. Backend is deployed and running\n2. VITE_API_BASE_URL is set correctly (should end with /api)\n3. Routes are cached on backend (php artisan route:cache)\n\nCurrent API URL: ${API_BASE_URL}${endpoint}`,
            status: response.status,
            raw: data,
          };
        }
      return {
        success: false,
        error: errorMsg,
        code: data.code,
        status: response.status,
        raw: data,
      };
    }
      
      // Handle validation errors
      if (data.errors && typeof data.errors === 'object') {
        const firstError = Object.values(data.errors)[0];
        const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
        return {
          success: false,
          error: errorMessage || data.message || 'An error occurred',
          code: data.code,
          status: response.status,
          raw: data,
        };
      }
      
      return {
        success: false,
        error: data.message || data.error || 'An error occurred',
        code: data.code,
        status: response.status,
        raw: data,
      };
    }

    // Extract `data` when the backend wraps payloads (e.g. many MRF endpoints). Bare JSON resources
    // (e.g. SRF supply-chain-director-approve/reject returning presentSrf()) stay intact when no `data` key.
    const responseData = (data && typeof data === 'object' && 'data' in data) ? data.data : data;

    return {
      success: true,
      data: responseData,
    };
  } catch (error) {
    return {
      success: false,
      error: classifyFetchError(error, endpoint),
    };
  }
}

// Authentication API
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> => {
    return apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  logout: async (): Promise<ApiResponse<void>> => {
    return apiRequest<void>('/auth/logout', {
      method: 'POST',
    });
  },

  getCurrentUser: async (): Promise<ApiResponse<User>> => {
    return apiRequest<User>('/auth/me');
  },

  refreshToken: async (): Promise<ApiResponse<{ token: string; expiresAt: string }>> => {
    return apiRequest<{ token: string; expiresAt: string }>('/auth/refresh-token', {
      method: 'POST',
    });
  },

  updateProfile: async (data: { name?: string; department?: string; phone?: string }): Promise<ApiResponse<User>> => {
    return apiRequest<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword,
        newPassword_confirmation: newPassword,
      }),
    });
  },
};

// GRN API
export const grnApi = {
  requestGRN: async (mrfId: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${mrfId}/request-grn`, {
      method: 'POST',
    });
  },

  completeGRN: async (mrfId: string, grnFile: File): Promise<ApiResponse<MRF>> => {
    const { token, expired } = getAuthToken();
    
    if (expired || !token) {
      return {
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      };
    }
    
    const formData = new FormData();
    formData.append('grn', grnFile);
    
    try {
      const response = await fetch(`${API_BASE_URL}/mrfs/${mrfId}/complete-grn`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        sessionStorage.removeItem('tokenExpiry');
        sessionStorage.removeItem('isAuthenticated');
        
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
          window.location.href = '/auth';
        }
        
        return {
          success: false,
          error: 'Authentication failed. Please log in again.',
        };
      }

      const data = await response.json();
      return {
        success: response.ok,
        data: data.data || data,
        error: data.error || data.message,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error - please check your connection',
      };
    }
  },
};

// User Management API — SCM writes supply_chain_role only (never hris_role)
export const userApi = {
  getAll: async (filters?: { supply_chain_role?: string; role?: string; search?: string }): Promise<ApiResponse<User[]>> => {
    const params = new URLSearchParams();
    if (filters?.supply_chain_role) params.append('supply_chain_role', filters.supply_chain_role);
    else if (filters?.role) params.append('role', filters.role);
    if (filters?.search) params.append('search', filters.search);
    
    return apiRequest<User[]>(`/users?${params.toString()}`);
  },

  create: async (userData: {
    name: string;
    email: string;
    supply_chain_role: string;
    department?: string;
    password: string;
    is_admin?: boolean;
    can_manage_users?: boolean;
  }): Promise<ApiResponse<User>> => {
    return apiRequest<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  update: async (userId: number, userData: Partial<{
    name: string;
    email: string;
    supply_chain_role: string;
    department?: string;
    password?: string;
    is_admin?: boolean;
    can_manage_users?: boolean;
  }>): Promise<ApiResponse<User>> => {
    return apiRequest<User>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  delete: async (userId: number): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/users/${userId}`, {
      method: 'DELETE',
    });
  },
};

/** Vendor-selection justification — backend may read any key; also maps to price-comparison REASON. */
function selectionJustificationBody(text?: string | null): Record<string, string> {
  const t = (text ?? "").trim();
  if (!t) return {};
  return {
    selection_reason: t,
    selectionReason: t,
    remarks: t,
  };
}

// MRF API
export const mrfApi = {
  getAll: async (filters?: FilterOptions, sort?: SortOptions): Promise<ApiResponse<MRF[]>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (sort?.field) params.append('sortBy', sort.field);
    if (sort?.direction) params.append('sortOrder', sort.direction);
    
    return apiRequest<MRF[]>(`/mrfs?${params.toString()}`);
  },

  getById: async (id: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}`);
  },

  // Get full MRF details with all quotations
  getFullDetails: async (id: string): Promise<ApiResponse<{
    mrf: MRF;
    rfqs: Array<{
      id: string;
      title: string;
      status: string;
      vendors: any[];
    }>;
    quotations: Array<{
      id: string;
      rfqId: string;
      rfqTitle: string;
      vendor: any;
      totalAmount: number;
      status: string;
      attachments: any[];
    }>;
    statistics: {
      totalQuotations: number;
      totalRfqs: number;
      lowestBid: number;
      highestBid: number;
      averageBid: number;
    };
  }>> => {
    return apiRequest(`/mrfs/${id}/full-details`);
  },

  // Get MRF progress tracker (Phase 8 — phases, documents, schedule, routing)
  getProgressTracker: async (
    id: string,
    options?: {
      contractType?: string | null;
      mrf?: import('@/types').MRF;
      propPaymentSchedule?: import('@/types/payment-schedule').PaymentSchedule | null;
      propActiveByType?: import('@/types/procurement-documents').ProcurementDocumentsResponse['activeByType'];
      propStageTimestamps?: import('@/types/progress-tracker').ProgressTrackerStageTimestamps;
    },
  ): Promise<ApiResponse<import('@/types/progress-tracker').ProgressTrackerViewModel>> => {
    const res = await apiRequest<Record<string, unknown>>(
      `/mrfs/${encodeURIComponent(id)}/progress-tracker`,
    );
    if (res.success) {
      const { normalizeProgressTracker } = await safeDynamicImport(
        () => import('@/utils/normalizeProgressTracker'),
      );
      return {
        ...res,
        data: normalizeProgressTracker(res.data ?? {}, {
          contractType: options?.contractType,
          mrf: options?.mrf,
          propPaymentSchedule: options?.propPaymentSchedule,
          propActiveByType: options?.propActiveByType,
          propStageTimestamps: options?.propStageTimestamps,
        }),
      };
    }
    return res as unknown as ApiResponse<import('@/types/progress-tracker').ProgressTrackerViewModel>;
  },

  // Get available actions for current user on this MRF
  getAvailableActions: async (
    id: string,
    options?: { mrf?: import('@/types').MRF; userRole?: string | null },
  ): Promise<ApiResponse<import('@/types').AvailableActions>> => {
    const res = await apiRequest<import('@/types').AvailableActions>(
      `/mrfs/${id}/available-actions`,
    );
    if (res.success && res.data) {
      const { applyReadOnlyAvailableActions } = await import('@/utils/stripReadOnlyActions');
      let actions = res.data;
      if (options?.mrf) {
        const { enrichAvailableActions } = await import('@/utils/enrichFinanceRouting');
        actions = enrichAvailableActions(actions, options.mrf, options.userRole);
      }
      res.data = applyReadOnlyAvailableActions(actions);
    }
    return res;
  },

  create: async (data: CreateMRFData): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>('/mrfs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createWithPFI: async (formData: FormData): Promise<ApiResponse<MRF>> => {
    const { token, expired } = getAuthToken();
    
    if (expired || !token) {
      return {
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      };
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/mrfs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - browser will set it with boundary for FormData
        },
        body: formData,
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        sessionStorage.removeItem('tokenExpiry');
        sessionStorage.removeItem('isAuthenticated');
        
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
          window.location.href = '/auth';
        }
        
        return {
          success: false,
          error: 'Authentication failed. Please log in again.',
        };
      }

      const data = await response.json();
      return {
        success: response.ok,
        data: data.data || data,
        error: data.error || data.message,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error - please check your connection',
      };
    }
  },

  update: async (id: string, data: Partial<MRF>): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Legacy simple approve (deprecated - use workflow endpoints)
  approve: async (id: string, remarks?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // Legacy simple reject (deprecated - use workflow endpoints)
  reject: async (id: string, reason: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/mrfs/${id}`, {
      method: 'DELETE',
    });
  },

  // Resubmit a rejected MRF with updated data
  resubmit: async (id: string, data: {
    title?: string;
    description?: string;
    quantity?: number;
    estimated_cost?: number;
    justification?: string;
    category?: string;
  }): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/resubmit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ==========================================
  // Phase 2: Updated MRF Workflow Endpoints
  // ==========================================

  // Supply Chain Director approves MRF
  supplyChainDirectorApprove: async (id: string, remarks?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/supply-chain-director-approve`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', remarks }),
    });
  },

  // Supply Chain Director rejects MRF
  supplyChainDirectorReject: async (id: string, reason: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/supply-chain-director-reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Procurement Manager issues RFQ to vendors
  issueRFQ: async (id: string, vendorIds: string[], rfqData?: any): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/issue-rfq`, {
      method: 'POST',
      body: JSON.stringify({ vendor_ids: vendorIds, rfq_data: rfqData }),
    });
  },

  // Procurement Manager reviews vendor quotes and selects vendor
  selectVendor: async (
    id: string,
    vendorId: string,
    quotationId: string,
    selectionReason?: string,
  ): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/select-vendor`, {
      method: 'POST',
      body: JSON.stringify({
        vendor_id: vendorId,
        quotation_id: quotationId,
        ...selectionJustificationBody(selectionReason),
      }),
    });
  },

  // Procurement Manager deletes/clears PO
  deletePO: async (id: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/po`, {
      method: 'DELETE',
    });
  },

  // Procurement Manager discards an in-progress PO draft.
  // Backend ask: DELETE /api/mrfs/{id}/po-draft clears po_draft_saved_at,
  // is_po_draft, and any persisted draft payload without affecting the MRF
  // status or workflow_state. Returns the updated MRF row.
  discardPODraft: async (id: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/po-draft`, {
      method: 'DELETE',
    });
  },

  // Procurement Manager generates PO
  generatePO: async (id: string, poNumber: string, poFile?: File, items?: any[]): Promise<ApiResponse<MRF>> => {
    const { token, expired } = getAuthToken();
    
    if (expired || !token) {
      return {
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      };
    }
    
    if (poFile) {
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (poFile.size > maxSize) {
        return { 
          success: false, 
          error: `File size (${(poFile.size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of 10MB` 
        };
      }

      // Validate file type
      const allowedTypes = ['.pdf', '.doc', '.docx'];
      const fileExtension = '.' + poFile.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.includes(fileExtension)) {
        return { 
          success: false, 
          error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` 
        };
      }

      // If file is provided, use FormData
      const formData = new FormData();
      formData.append('po_number', poNumber);
      formData.append('unsigned_po', poFile);

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }


      try {
        const response = await fetch(`${API_BASE_URL}/mrfs/${id}/generate-po`, {
      method: 'POST',
          headers,
          body: formData,
        });

        // Handle 401 Unauthorized
        if (response.status === 401) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userData');
          localStorage.removeItem('tokenExpiry');
          localStorage.removeItem('isAuthenticated');
          sessionStorage.removeItem('authToken');
          sessionStorage.removeItem('userData');
          sessionStorage.removeItem('tokenExpiry');
          sessionStorage.removeItem('isAuthenticated');
          
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
            window.location.href = '/auth';
          }
          
          return {
            success: false,
            error: 'Authentication failed. Please log in again.',
          };
        }

        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
          return { 
            success: false, 
            error: `Server returned invalid response (Status: ${response.status})` 
          };
        }

        if (!response.ok) {
          console.error('PO generation failed:', {
            status: response.status,
            statusText: response.statusText,
            data,
          });

          // Handle validation errors
          if (data.errors) {
            const errorMessages = Object.entries(data.errors)
              .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
              .join('; ');
            return { success: false, error: errorMessages };
          }

          return { 
            success: false, 
            error: data.message || data.error || `Failed to generate PO (Status: ${response.status})` 
          };
        }

        return { success: true, data: data.data || data };
      } catch (error) {
        console.error('PO generation network error:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Network error - unable to reach server' 
        };
      }
    } else {
      // If no file, send JSON - backend will create PO record without document generation
      
      // Use fetch directly to have better control over error handling
      // Try JSON first, but backend might expect FormData even without file
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        // First try: Send as JSON (preferred)
        headers['Content-Type'] = 'application/json';
        const requestBody: any = { po_number: poNumber };
        
        // Include items if provided
        if (items && items.length > 0) {
          requestBody.items = items.map(item => ({
            item_name: item.item_name || item.name,
            description: item.description || '',
            quantity: item.quantity || 0,
            unit: item.unit || 'pcs',
            unit_price: item.unit_price || item.unitPrice || 0,
            total_price: item.total_price || item.totalPrice || (item.quantity || 0) * (item.unit_price || item.unitPrice || 0),
            ...(item.rfq_item_id && { rfq_item_id: item.rfq_item_id }),
            ...(item.specifications && { specifications: item.specifications }),
          }));
        }
        
        let response = await fetch(`${API_BASE_URL}/mrfs/${id}/generate-po`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });
        
        // If 400 error, try sending as FormData (some backends require FormData even without file)
        if (response.status === 400) {
          const formData = new FormData();
          formData.append('po_number', poNumber);
          
          // Include items if provided
          if (items && items.length > 0) {
            items.forEach((item, index) => {
              formData.append(`items[${index}][item_name]`, item.item_name || item.name || '');
              formData.append(`items[${index}][description]`, item.description || '');
              formData.append(`items[${index}][quantity]`, String(item.quantity || 0));
              formData.append(`items[${index}][unit]`, item.unit || 'pcs');
              formData.append(`items[${index}][unit_price]`, String(item.unit_price || item.unitPrice || 0));
              formData.append(`items[${index}][total_price]`, String(item.total_price || item.totalPrice || (item.quantity || 0) * (item.unit_price || item.unitPrice || 0)));
              if (item.rfq_item_id) {
                formData.append(`items[${index}][rfq_item_id]`, item.rfq_item_id);
              }
            });
          }
          
          // Remove Content-Type header to let browser set it with boundary for FormData
          delete headers['Content-Type'];
          
          response = await fetch(`${API_BASE_URL}/mrfs/${id}/generate-po`, {
            method: 'POST',
            headers,
            body: formData,
          });
        }

        // Handle 401 Unauthorized
        if (response.status === 401) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userData');
          localStorage.removeItem('tokenExpiry');
          localStorage.removeItem('isAuthenticated');
          sessionStorage.removeItem('authToken');
          sessionStorage.removeItem('userData');
          sessionStorage.removeItem('tokenExpiry');
          sessionStorage.removeItem('isAuthenticated');
          
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
            window.location.href = '/auth';
          }
          
          return {
            success: false,
            error: 'Authentication failed. Please log in again.',
          };
        }

        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
          return { 
            success: false, 
            error: `Server returned invalid response (Status: ${response.status})` 
          };
        }

        if (!response.ok) {
          console.error('PO creation failed:', {
            status: response.status,
            statusText: response.statusText,
            data,
            requestBody: { po_number: poNumber },
            mrfId: id,
          });

          // Handle validation errors
          if (data.errors) {
            const errorMessages = Object.entries(data.errors)
              .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
              .join('; ');
            return { success: false, error: errorMessages };
          }

          // Return detailed error message - include full response for debugging
          const errorMessage = data.message || data.error || `Failed to create PO (Status: ${response.status})`;
          console.error('Backend error details:', {
            errorMessage,
            fullResponse: data,
            status: response.status,
          });
          
          return { 
            success: false, 
            error: errorMessage
          };
        }

        return { success: true, data: data.data || data };
      } catch (error) {
        console.error('PO creation network error:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Network error - unable to reach server' 
        };
      }
    }
  },

  // Procurement sends selected vendor to Supply Chain Director for approval
  sendVendorForApproval: async (
    id: string,
    vendorId: string,
    quotationId?: string,
    selectionReason?: string,
  ): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/send-vendor-for-approval`, {
      method: 'POST',
      body: JSON.stringify({
        vendor_id: vendorId,
        ...(quotationId != null && quotationId !== ''
          ? { quotation_id: quotationId }
          : {}),
        ...selectionJustificationBody(selectionReason),
      }),
    });
  },

  // Supply Chain Director approves vendor selection
  approveVendorSelection: async (
    id: string,
    remarks?: string,
  ): Promise<ApiResponse<MRF & { vendorInvoiceGateOpen?: boolean }>> => {
    return apiRequest<MRF & { vendorInvoiceGateOpen?: boolean }>(`/mrfs/${id}/approve-vendor-selection`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // Supply Chain Director rejects vendor selection
  rejectVendorSelection: async (id: string, reason: string, comments?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/reject-vendor-selection`, {
      method: 'POST',
      body: JSON.stringify({ reason, comments }),
    });
  },

  // Supply Chain Director uploads signed PO
  uploadSignedPO: async (id: string, signedPOFile: File): Promise<ApiResponse<MRF>> => {
    const { token, expired } = getAuthToken();
    
    if (expired || !token) {
      return {
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      };
    }
    
    const formData = new FormData();
    formData.append('signed_po', signedPOFile);

    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/mrfs/${id}/upload-signed-po`, {
        method: 'POST',
        headers,
        body: formData,
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        sessionStorage.removeItem('tokenExpiry');
        sessionStorage.removeItem('isAuthenticated');
        
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
          window.location.href = '/auth';
        }
        
        return {
          success: false,
          error: 'Authentication failed. Please log in again.',
        };
      }

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to upload signed PO' };
      }
      return { success: true, data: data.data || data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // Supply Chain Director rejects PO (returns to procurement)
  rejectPO: async (id: string, reason: string, comments?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/reject-po`, {
      method: 'POST',
      body: JSON.stringify({ reason, comments }),
    });
  },

  // Finance processes payment
  processPayment: async (id: string): Promise<ApiResponse<MRF>> => {
    const res = await apiRequest<MRF>(`/mrfs/${id}/process-payment`, {
      method: 'POST',
    });
    if (!res.success && res.code === 'FINANCE_AP_ROUTED') {
      return { ...res, error: 'This MRF is routed to Finance AP — process the payment from the Finance AP system.' };
    }
    return res;
  },

  // Chairman approves final payment
  approvePayment: async (id: string): Promise<ApiResponse<MRF>> => {
    const res = await apiRequest<MRF>(`/mrfs/${id}/approve-payment`, {
      method: 'POST',
    });
    if (!res.success && res.code === 'FINANCE_AP_ROUTED') {
      return { ...res, error: 'This MRF is routed to Finance AP — chairman approval happens in the Finance AP system.' };
    }
    return res;
  },

  // Reject MRF at any workflow stage
  workflowReject: async (id: string, reason: string, comments?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/workflow-reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, comments }),
    });
  },

  // Download PO document
  downloadPO: async (id: string, poType: 'unsigned' | 'signed' = 'unsigned'): Promise<{ success: boolean; error?: string }> => {
    const { token, expired } = getAuthToken();
    
    if (expired || !token) {
      return {
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      };
    }

    try {
      const endpoint = poType === 'signed' 
        ? `/mrfs/${id}/download-signed-po`
        : `/mrfs/${id}/download-po`;
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        sessionStorage.removeItem('tokenExpiry');
        sessionStorage.removeItem('isAuthenticated');
        
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
          window.location.href = '/auth';
        }
        
        return {
          success: false,
          error: 'Authentication failed. Please log in again.',
        };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || errorData.error || `Failed to download PO (Status: ${response.status})`,
        };
      }

      // Get the filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `PO-${id}.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('PO download error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error - unable to download PO',
      };
    }
  },

  // Executive approves MRF
  executiveApprove: async (id: string, remarks?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/executive-approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // Executive rejects MRF
  executiveReject: async (id: string, reason: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/executive-reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Chairman approves MRF
  chairmanApprove: async (id: string, remarks?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/chairman-approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // Supply Chain Director final approval (quote/vendor selection approval before PO)
  supplyChainFinalApprove: async (id: string, remarks?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/supply-chain-final-approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // Supply Chain Director final rejection (quote/vendor selection rejection)
  supplyChainFinalReject: async (id: string, reason: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/supply-chain-final-reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Get contract types for MRF creation
  getContractTypes: async (): Promise<ApiResponse<import('@/types').ContractTypeResponse>> => {
    return apiRequest(`/mrfs/contract-types`);
  },

  // Get line item P&L for MRF
  getLineItemPnL: async (id: string): Promise<ApiResponse<import('@/types').ProfitAndLoss>> => {
    const res = await apiRequest<any>(`/mrfs/${id}/line-item-pnl`);
    if (res.success) {
      const { normalizeProfitAndLoss } = await import('@/utils/normalizeProfitAndLoss');
      const normalized = normalizeProfitAndLoss(res.data ?? res.raw);
      if (import.meta.env?.DEV && normalized.items.length === 0) {
        // eslint-disable-next-line no-console
        console.warn('[BugB/mrf.getLineItemPnL] empty after normalize', {
          id,
          rawKeys: res.data ? Object.keys(res.data) : [],
          raw: res.data,
        });
      }
      return { ...res, data: normalized };
    }
    return res as ApiResponse<import('@/types').ProfitAndLoss>;
  },
};

// SRF API
export const srfApi = {
  getAll: async (
    filters?: FilterOptions & import('@/types/srf-line-item').SrfListQuery,
  ): Promise<ApiResponse<SRF[]>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.limit != null) params.append('limit', String(filters.limit));
    if (filters?.per_page != null) params.append('per_page', String(filters.per_page));
    if (filters?.page != null) params.append('page', String(filters.page));
    const includeItems = filters?.include_line_items ?? filters?.includeLineItems;
    if (includeItems === false) params.append('include_line_items', 'false');
    else params.append('include_line_items', 'true');

    const res = await apiRequest<unknown>(`/srfs?${params.toString()}`);
    if (res.success) {
      const { normalizeSrfListPayload } = await import('@/utils/normalizeSrfApi');
      const list = normalizeSrfListPayload(res.data ?? res.raw);
      return { ...res, data: list as SRF[] };
    }
    return res as ApiResponse<SRF[]>;
  },

  fetchUi: async <T>(path: string, method: 'GET' | 'DELETE' = 'GET'): Promise<ApiResponse<T>> => {
    const { apiFetchUiPath } = await import('@/utils/apiUiPath');
    return apiFetchUiPath<T>(path, method);
  },

  getLineItem: async (
    srfId: string,
    itemId: string,
    options?: { path?: string },
  ): Promise<ApiResponse<import('@/types/srf-line-item').SrfLineItemDetailResponse>> => {
    const { normalizeLineItemDetail } = await import('@/utils/normalizeSrfApi');
    const res = options?.path
      ? await srfApi.fetchUi<unknown>(options.path, 'GET')
      : await apiRequest<unknown>(
          `/srfs/${encodeURIComponent(srfId)}/line-items/${encodeURIComponent(itemId)}`,
        );
    if (res.success) {
      return { ...res, data: normalizeLineItemDetail(res.data ?? res.raw) };
    }
    return res as ApiResponse<import('@/types/srf-line-item').SrfLineItemDetailResponse>;
  },

  getProgressTracker: async (
    srfId: string,
  ): Promise<ApiResponse<{ progress?: import('@/types/srf-line-item').SrfProgressStep[]; steps?: import('@/types/srf-line-item').SrfProgressStep[] }>> => {
    const res = await apiRequest<Record<string, unknown>>(
      `/srfs/${encodeURIComponent(srfId)}/progress-tracker`,
    );
    if (res.success && res.data) {
      const progress = (res.data.progress as unknown[]) ?? res.data.steps;
      const steps = (res.data.steps as unknown[]) ?? progress;
      return {
        ...res,
        data: {
          progress: progress as import('@/types/srf-line-item').SrfProgressStep[],
          steps: steps as import('@/types/srf-line-item').SrfProgressStep[],
        },
      };
    }
    return res as ApiResponse<{
      progress?: import('@/types/srf-line-item').SrfProgressStep[];
      steps?: import('@/types/srf-line-item').SrfProgressStep[];
    }>;
  },

  getById: async (
    id: string,
    options?: { path?: string },
  ): Promise<ApiResponse<import('@/types/srf-ui').SrfDetailPayload>> => {
    const { normalizeSrfDetail } = await import('@/utils/normalizeSrfApi');
    const res = options?.path
      ? await srfApi.fetchUi<unknown>(options.path, 'GET')
      : await apiRequest<unknown>(`/srfs/${encodeURIComponent(id)}`);
    if (res.success) {
      return { ...res, data: normalizeSrfDetail(res.data ?? res.raw) };
    }
    return res as ApiResponse<import('@/types/srf-ui').SrfDetailPayload>;
  },

  create: async (data: CreateSRFData): Promise<ApiResponse<SRF>> => {
    return apiRequest<SRF>('/srfs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  createWithInvoice: async (formData: FormData): Promise<ApiResponse<SRF>> => {
    const { token, expired } = getAuthToken();
    
    if (expired || !token) {
      return {
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      };
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/srfs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - browser will set it with boundary for FormData
        },
        body: formData,
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        sessionStorage.removeItem('tokenExpiry');
        sessionStorage.removeItem('isAuthenticated');
        
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
          window.location.href = '/auth';
        }
        
        return {
          success: false,
          error: 'Authentication failed. Please log in again.',
        };
      }

      const data = await response.json();
      return {
        success: response.ok,
        data: data.data || data,
        error: data.error || data.message,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error - please check your connection',
      };
    }
  },

  update: async (id: string, data: Partial<SRF>): Promise<ApiResponse<SRF>> => {
    return apiRequest<SRF>(`/srfs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/srfs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  /**
   * POST `/srfs/{id}/supply-chain-director-approve` (full URL: `{API_BASE}/srfs/...`, base usually ends with `/api`).
   * Body: optional `remarks` only; Laravel ignores `action` if present.
   * Success: HTTP 200 with bare `presentSrf()` JSON (no `{ success, data }` wrapper) — `apiRequest` treats that as `data` when the object has no `data` key.
   */
  supplyChainDirectorApprove: async (id: string, remarks?: string): Promise<ApiResponse<SRF>> => {
    const trimmed = remarks?.trim();
    const body: { remarks?: string } = {};
    if (trimmed) body.remarks = trimmed;
    return apiRequest<SRF>(
      `/srfs/${encodeURIComponent(id)}/supply-chain-director-approve`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  },

  /**
   * POST `/srfs/{id}/supply-chain-director-reject`. Body: `{ reason }` (required, min 5, max 2000 on server).
   * Success response shape same as approve (bare SRF JSON).
   */
  supplyChainDirectorReject: async (id: string, reason: string): Promise<ApiResponse<SRF>> => {
    return apiRequest<SRF>(`/srfs/${encodeURIComponent(id)}/supply-chain-director-reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /** Procurement: selected quotation sent for Supply Chain Director approval (parallel to MRF). */
  sendVendorForApproval: async (
    id: string,
    vendorId: string,
    quotationId?: string,
    selectionReason?: string,
  ): Promise<ApiResponse<SRF>> => {
    return apiRequest<SRF>(`/srfs/${encodeURIComponent(id)}/send-vendor-for-approval`, {
      method: 'POST',
      body: JSON.stringify({
        vendor_id: vendorId,
        ...(quotationId != null && quotationId !== ''
          ? { quotation_id: quotationId }
          : {}),
        ...selectionJustificationBody(selectionReason),
      }),
    });
  },

  // Get line item P&L for SRF
  getLineItemPnL: async (id: string): Promise<ApiResponse<import('@/types').ProfitAndLoss>> => {
    const res = await apiRequest<any>(`/srfs/${id}/line-item-pnl`);
    if (res.success) {
      const { normalizeProfitAndLoss } = await import('@/utils/normalizeProfitAndLoss');
      return { ...res, data: normalizeProfitAndLoss(res.data ?? res.raw) };
    }
    return res as ApiResponse<import('@/types').ProfitAndLoss>;
  },
};

// RFQ API
export const rfqApi = {
  getAll: async (filters?: FilterOptions): Promise<ApiResponse<RFQ[]>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    
    return apiRequest<RFQ[]>(`/rfqs?${params.toString()}`);
  },

  getById: async (id: string): Promise<ApiResponse<RFQ>> => {
    return apiRequest<RFQ>(`/rfqs/${id}`);
  },

  create: async (data: CreateRFQData): Promise<ApiResponse<RFQ>> => {
    const payload: Record<string, unknown> = {
      description: data.description,
      quantity: data.quantity,
      estimatedCost: data.estimatedCost,
      estimated_cost: data.estimatedCost,
      deadline: data.deadline,
      vendorIds: data.vendorIds,
      vendor_ids: data.vendorIds,
      title: data.title,
      category: data.category,
      paymentTerms: data.paymentTerms,
      payment_terms: data.paymentTerms,
      notes: data.notes,
      additional_notes: data.notes,
      terms_and_conditions: (data as any).termsAndConditions,
      termsAndConditions: (data as any).termsAndConditions,
      delivery_terms: (data as any).deliveryTerms,
      deliveryTerms: (data as any).deliveryTerms,
      technical_requirements: (data as any).technicalRequirements,
      technicalRequirements: (data as any).technicalRequirements,
    };
    if (data.mrfId) {
      payload.mrfId = data.mrfId;
      payload.mrf_id = data.mrfId;
    }
    if (data.srfId) {
      payload.srfId = data.srfId;
      payload.srf_id = data.srfId;
    }
    return apiRequest<RFQ>('/rfqs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update: async (id: string, data: Partial<RFQ>): Promise<ApiResponse<RFQ>> => {
    return apiRequest<RFQ>(`/rfqs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Upload supporting documents for an RFQ (multipart).
  // Backend contract: POST /api/rfqs/:id/attachments, field name `attachments[]`.
  // Called after a successful rfqApi.create when the user attached files in
  // the RFQ create dialog (Bug C — Supporting Documents).
  uploadAttachments: async (
    rfqId: string,
    files: File[],
  ): Promise<ApiResponse<{ attachments?: unknown[] }>> => {
    if (!files || files.length === 0) {
      return { success: true, data: { attachments: [] } };
    }
    const formData = new FormData();
    for (const file of files) {
      formData.append('attachments[]', file, file.name);
    }
    return apiRequest(`/rfqs/${rfqId}/attachments`, {
      method: 'POST',
      body: formData,
    });
  },

  // ==========================================
  // Phase 2: RFQ Workflow Endpoints
  // ==========================================

  // Get all quotations for comparison (Procurement Manager)
  getQuotations: async (rfqId: string): Promise<ApiResponse<{
    rfq: RFQ;
    quotations: Array<{
      quotation: Quotation;
      vendor: Vendor;
      items: Array<{
        item_name: string;
        quantity: number;
        unit_price: number;
        total_price: number;
      }>;
    }>;
    statistics: {
      total_quotations: number;
      lowest_bid: number;
      highest_bid: number;
      average_bid: number;
    };
  }>> => {
    let res = await apiRequest<any>(`/rfqs/${rfqId}/quotations`);
    // Bug E — RFQ vendor response invisible on PM, 500 regression.
    // Always log full error context so we can attach to the backend ticket.
    if (!res?.success) {
      try {
        const stored = localStorage.getItem('user');
        const role = stored ? (JSON.parse(stored)?.role ?? 'unknown') : 'unknown';
        // eslint-disable-next-line no-console
        console.error('[BugE/getQuotations] failed', {
          rfqId,
          role,
          error: res?.error,
          status: (res as any)?.status,
          raw: (res as any)?.raw,
        });
      } catch {
        /* diagnostic only */
      }
      // Bug E — fallback: when the wrapped endpoint 5xx's, rebuild the same
      // shape from the flat `/quotations/rfq/{rfqId}` listing so the PM can
      // still see vendor responses. Remove once the wrapped endpoint is fixed.
      const status = (res as any)?.status;
      if (status === 0 || status === undefined || status >= 500) {
        try {
          const [flatRes, rfqRes] = await Promise.all([
            apiRequest<any>(`/quotations/rfq/${rfqId}`),
            apiRequest<any>(`/rfqs/${rfqId}`),
          ]);
          const flat: any[] = Array.isArray(flatRes?.data)
            ? flatRes.data
            : Array.isArray((flatRes?.data as any)?.data)
              ? (flatRes.data as any).data
              : [];
          if (flatRes?.success && flat.length >= 0) {
            const wrapped = flat.map((q: any) => ({
              quotation: q,
              vendor:
                q?.vendor ||
                (q?.vendor_id || q?.vendorId
                  ? {
                      id: q.vendor_id ?? q.vendorId,
                      name: q.vendor_name ?? q.vendorName ?? 'Vendor',
                    }
                  : null),
              items: Array.isArray(q?.items)
                ? q.items
                : Array.isArray(q?.line_items)
                  ? q.line_items
                  : [],
            }));
            const prices = wrapped
              .map((w) => Number(w.quotation?.total_amount ?? w.quotation?.totalAmount ?? w.quotation?.price ?? 0))
              .filter((n) => Number.isFinite(n) && n > 0);
            const statistics = {
              total_quotations: wrapped.length,
              lowest_bid: prices.length ? Math.min(...prices) : 0,
              highest_bid: prices.length ? Math.max(...prices) : 0,
              average_bid: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
            };
            res = {
              success: true,
              data: {
                rfq: rfqRes?.data ?? null,
                quotations: wrapped,
                statistics,
                _fallback: true,
              } as any,
            } as any;
            // eslint-disable-next-line no-console
            console.warn('[BugE/getQuotations] using flat fallback', {
              rfqId,
              fallbackCount: wrapped.length,
            });
          }
        } catch (fallbackErr) {
          // eslint-disable-next-line no-console
          console.error('[BugE/getQuotations] fallback failed', fallbackErr);
        }
      }
    }
    // Bug E — backend may return quotations under several keys depending on serializer.
    // Normalize so downstream code can always read res.data.quotations.
    if (res?.success && res.data && !Array.isArray((res.data as any).quotations)) {
      const d: any = res.data;
      const list =
        d.data?.quotations ??
        d.results ??
        d.items ??
        (Array.isArray(d) ? d : null);
      if (Array.isArray(list)) {
        (res.data as any).quotations = list;
      }
    }
    // Item 2 — diagnostic: capture raw payload + caller role for PM vs SCD comparison.
    try {
      const stored = localStorage.getItem('user');
      const role = stored ? (JSON.parse(stored)?.role ?? 'unknown') : 'unknown';
      const sample = res?.data?.quotations?.[0];
      // eslint-disable-next-line no-console
      console.debug('[Item2/getQuotations]', {
        rfqId,
        role,
        success: res?.success,
        quotationCount: res?.data?.quotations?.length ?? 0,
        sampleKeys: sample ? Object.keys(sample) : [],
        sampleQuotationKeys: sample?.quotation ? Object.keys(sample.quotation) : [],
        sampleItemsLength: Array.isArray(sample?.items) ? sample.items.length : null,
      });
    } catch {
      /* diagnostic only */
    }
    return res;
  },

  // Select winning vendor (Procurement Manager)
  selectVendor: async (
    rfqId: string,
    quotationId: string,
    selectionReason?: string,
  ): Promise<ApiResponse<{
    rfq_id: string;
    status: string;
    selected_vendor: { id: string; name: string };
    selected_quotation: { id: string; total_amount: number };
  }>> => {
    return apiRequest(`/rfqs/${rfqId}/select-vendor`, {
      method: 'POST',
      body: JSON.stringify({
        quotation_id: quotationId,
        ...selectionJustificationBody(selectionReason),
      }),
    });
  },

  // Close RFQ without selection (Procurement Manager)
  close: async (rfqId: string, reason: string): Promise<ApiResponse<{ rfq_id: string; status: string }>> => {
    return apiRequest(`/rfqs/${rfqId}/close`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Mark RFQ as viewed by vendor (Vendor Portal)
  markViewed: async (rfqId: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiRequest(`/rfqs/${rfqId}/mark-viewed`, {
      method: 'POST',
    });
  },

  // Invite vendors to RFQ
  inviteVendors: async (rfqId: string, vendorIds: string[]): Promise<ApiResponse<RFQ>> => {
    return apiRequest<RFQ>(`/rfqs/${rfqId}/invite-vendors`, {
      method: 'POST',
      body: JSON.stringify({ vendor_ids: vendorIds }),
    });
  },
};

// Quotation API
export const quotationApi = {
  getAll: async (): Promise<ApiResponse<Quotation[]>> => {
    return apiRequest<Quotation[]>('/quotations');
  },

  getByVendor: async (vendorId: string): Promise<ApiResponse<Quotation[]>> => {
    return apiRequest<Quotation[]>(`/quotations/vendor/${vendorId}`);
  },

  getByRFQ: async (rfqId: string): Promise<ApiResponse<Quotation[]>> => {
    return apiRequest<Quotation[]>(`/quotations/rfq/${rfqId}`);
  },

  create: async (data: CreateQuotationData): Promise<ApiResponse<Quotation>> => {
    return apiRequest<Quotation>('/quotations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Submit quotation with line items (Vendor Portal)
  submit: async (rfqId: string, data: {
    quote_number?: string;
    total_amount: number;
    currency?: string;
    delivery_days?: number;
    delivery_date?: string;
    payment_terms?: string;
    validity_days?: number;
    warranty_period?: string;
    notes?: string;
    items: Array<{
      rfq_item_id?: string;
      item_name: string;
      quantity: number;
      unit: string;
      unit_price: number;
      specifications?: string;
    }>;
  }): Promise<ApiResponse<Quotation>> => {
    return apiRequest<Quotation>(`/rfqs/${rfqId}/submit-quotation`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  approve: async (id: string): Promise<ApiResponse<Quotation>> => {
    return apiRequest<Quotation>(`/quotations/${id}/approve`, {
      method: 'POST',
    });
  },

  reject: async (id: string, reason?: string, comments?: string): Promise<ApiResponse<Quotation>> => {
    return apiRequest<Quotation>(`/quotations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, comments }),
    });
  },

  // Close quotation (Procurement Manager)
  closeQuotation: async (id: string): Promise<ApiResponse<Quotation>> => {
    return apiRequest<Quotation>(`/quotations/${id}/close`, {
      method: 'POST',
    });
  },

  // Reopen quotation (Procurement Manager)
  reopenQuotation: async (id: string): Promise<ApiResponse<Quotation>> => {
    return apiRequest<Quotation>(`/quotations/${id}/reopen`, {
      method: 'POST',
    });
  },
};

/**
 * Item 7 — Per-submission evaluation surface.
 * Stores evaluator notes + numeric score against a vendor quotation so the
 * procurement comparison view shows the buyer's reasoning alongside metrics.
 * Backend ask: `PUT /api/quotations/{id}/evaluation` accepting
 * `{ evaluation_notes?: string, evaluation_score?: number }`, returning the
 * updated quotation row with `evaluation_notes`, `evaluation_score`, and
 * `evaluation_updated_at`.
 */
export const quotationEvaluationApi = {
  save: async (
    quotationId: string,
    body: { evaluation_notes?: string; evaluation_score?: number | null },
  ): Promise<ApiResponse<any>> => {
    return apiRequest(`/quotations/${quotationId}/evaluation`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
};

// Helper function for vendor API requests (uses vendorAuthToken)
async function vendorApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const { token, expired } = getVendorAuthToken();
  
  // If token is expired, return error immediately (unless this is a login request)
  const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh');
  if (expired && !isAuthEndpoint) {
    return {
      success: false,
      error: 'Authentication token has expired. Please log in again.',
    };
  }
  
  // Check if body is FormData - if so, don't set Content-Type (browser will set it with boundary)
  const isFormData = options.body instanceof FormData;
  
  const headers: HeadersInit = {
    'Accept': 'application/json',
    ...options.headers,
  };
  
  // Only set Content-Type for non-FormData requests
  if (!isFormData && !options.headers?.['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Always include Authorization header with Bearer token if available
  // Override any existing Authorization header to ensure we use the correct token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // If no token and not an auth endpoint, log a warning
    if (!isAuthEndpoint) {
      console.warn('No vendor authentication token available for request:', endpoint);
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Check if response is HTML (API not configured or unreachable)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.error('API returned HTML instead of JSON. Check VITE_API_BASE_URL configuration.');
      return {
        success: false,
        error: 'API server unreachable. Please check your connection and ensure the backend is running.',
      };
    }

    const text = await response.text();
    
    // Handle empty responses
    if (!text) {
      if (response.ok) {
        return { success: true, data: undefined as T };
      }
      return { success: false, error: 'Empty response from server' };
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('Failed to parse API response as JSON:', text.substring(0, 100));
      return {
        success: false,
        error: 'Invalid response from server. Please ensure the API is properly configured.',
      };
    }

    // Handle 401 Unauthorized - token is invalid or expired
    if (response.status === 401) {
      // Clear invalid vendor token
      localStorage.removeItem('vendorAuthToken');
      localStorage.removeItem('vendorData');
      localStorage.removeItem('vendorTokenExpiry');
      sessionStorage.removeItem('vendorAuthToken');
      sessionStorage.removeItem('vendorData');
      sessionStorage.removeItem('vendorTokenExpiry');
      
      // Don't reload the page - let the user see the error and handle it
      const errorMessage = data.error || data.message || 'Authentication failed. Please log in again.';
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Handle 422 Unprocessable Entity - validation errors
    if (response.status === 422) {
      // Extract validation errors from response
      let errorMessage = 'Validation failed. Please check your input.';
      
      // Log the full error response for debugging
      console.error('422 Validation Error Response:', {
        status: response.status,
        statusText: response.statusText,
        data: data,
        errors: data.errors,
        message: data.message,
        error: data.error,
      });
      
      if (data.errors && typeof data.errors === 'object') {
        // Laravel-style validation errors
        const errorMessages: string[] = [];
        Object.entries(data.errors).forEach(([field, messages]) => {
          if (Array.isArray(messages)) {
            errorMessages.push(...messages.map((msg: string) => `${field}: ${msg}`));
          } else if (typeof messages === 'string') {
            errorMessages.push(`${field}: ${messages}`);
          }
        });
        if (errorMessages.length > 0) {
          errorMessage = errorMessages.join(', ');
        }
      } else if (data.message) {
        errorMessage = data.message;
      } else if (data.error) {
        errorMessage = data.error;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: data.data !== undefined ? data.data : data,
    };
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error. Please check your connection.',
    };
  }
}

// Vendor Portal API (for vendors to access their RFQs)
export const vendorPortalApi = {
  // Get all RFQs assigned to the logged-in vendor
  getAssignedRFQs: async (): Promise<ApiResponse<Array<{
    id: string;
    title: string;
    description: string;
    deadline: string;
    status: string;
    estimated_cost?: string | number;
    estimatedCost?: string | number;
    budget?: string | number;
    payment_terms?: string;
    paymentTerms?: string;
    category?: string;
    items: Array<{
      id: string;
      item_name: string;
      quantity: number;
      unit: string;
      specifications: string;
    }>;
    sent_at: string;
    viewed_at: string | null;
    responded: boolean;
    has_submitted_quote: boolean;
  }>>> => {
    return vendorApiRequest('/vendors/rfqs');
  },

  // Get vendor's submitted quotations
  getMyQuotations: async (): Promise<ApiResponse<Quotation[]>> => {
    return vendorApiRequest<Quotation[]>('/vendors/quotations');
  },

  // Delete a quotation
  deleteQuotation: async (quotationId: string): Promise<ApiResponse<void>> => {
    return vendorApiRequest<void>(`/vendors/quotations/${quotationId}`, {
      method: 'DELETE',
    });
  },

  // ===== Phase 4: Finance AP vendor invoice portal =====
  // List MRFs where the authenticated vendor is the selected vendor.
  listFinanceApMrfs: async (): Promise<ApiResponse<{ mrfs: Array<{
    mrfId: string;
    title: string;
    workflowState: string;
    vendorInvoiceGate: { canSubmit: boolean; gateType?: string | null; reason?: string | null };
    invoiceSubmitted: boolean;
  }> }>> => {
    return vendorApiRequest('/vendor-portal/mrfs');
  },

  // Per-MRF invoice submission status.
  getInvoiceStatus: async (mrfId: string): Promise<ApiResponse<{
    canSubmit: boolean;
    submitted: boolean;
    gateType?: string | null;
    reason?: string | null;
    document?: {
      id: string | number;
      fileName: string;
      fileUrl: string;
      uploadedAt: string;
      version?: number;
    } | null;
  }>> => {
    return vendorApiRequest(`/vendor-portal/mrfs/${mrfId}/invoice`);
  },

  // Upload the final vendor invoice for the given MRF (multipart, field name `invoice`).
  uploadInvoice: async (mrfId: string, file: File): Promise<ApiResponse<{
    document: {
      id: string | number;
      fileName: string;
      fileUrl: string;
      uploadedAt: string;
      version?: number;
    };
  }>> => {
    const formData = new FormData();
    formData.append('invoice', file);
    return vendorApiRequest(`/vendor-portal/mrfs/${mrfId}/invoice`, {
      method: 'POST',
      body: formData,
    });
  },

  // Submit quotation as a vendor (with proper vendor authentication)
  // Backend endpoint: POST /api/rfqs/:id/submit-quotation
  // Backend expects: rfq_id, items (with rfq_item_id, item_name, quantity, unit_price), 
  //                  delivery_days, payment_terms, validity_days, warranty_period, notes
  submitQuotation: async (
    rfqId: string,
    quotationData: {
      total_amount: number;
      delivery_date?: string;
      delivery_days?: number;
      payment_terms: string;
      validity_days: number;
      warranty_period?: string;
      notes?: string;
      items: Array<{
        item_name: string;
        quantity: number;
        unit: string;
        unit_price: number;
        specifications?: string;
        rfq_item_id?: string; // Add rfq_item_id if available
      }>;
      // Bug D — vendor-proposed custom payment schedule (sum-to-100 enforced client-side).
      payment_milestones?: Array<{
        label: string;
        percentage: number;
        trigger_condition: string;
      }>;
    },
    attachments?: File[]
  ): Promise<ApiResponse<Quotation>> => {
    // Calculate delivery_days from delivery_date if provided
    let deliveryDays = quotationData.delivery_days;
    if (quotationData.delivery_date && !deliveryDays) {
      const deliveryDate = new Date(quotationData.delivery_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deliveryDate.setHours(0, 0, 0, 0);
      const diffTime = deliveryDate.getTime() - today.getTime();
      deliveryDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (deliveryDays < 0) deliveryDays = 0;
    }

    // Validate required fields
    if (!quotationData.total_amount || quotationData.total_amount <= 0) {
      return {
        success: false,
        error: 'Total amount is required and must be greater than zero.',
      };
    }
    
    if (!quotationData.delivery_date) {
      return {
        success: false,
        error: 'Delivery date is required.',
      };
    }
    
    if (!deliveryDays && deliveryDays !== 0) {
      return {
        success: false,
        error: 'Delivery days is required. Please provide a delivery date.',
      };
    }

    if (!quotationData.items || quotationData.items.length === 0) {
      return {
        success: false,
        error: 'At least one item is required.',
      };
    }

    // Prepare items array - backend expects rfq_item_id, item_name, quantity, unit_price
    // CRITICAL: Always normalize to an array — backend rejects with 422 if `items` is an object.
    let rawItems: any = quotationData.items;
    if (!Array.isArray(rawItems)) rawItems = rawItems ? [rawItems] : [];
    const items = rawItems.map((item: any) => ({
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      ...(item.rfq_item_id && { rfq_item_id: item.rfq_item_id }),
    }));

    // Normalize attachments to always be an array
    let normalizedAttachments: File[] = [];
    if (attachments) {
      normalizedAttachments = Array.isArray(attachments) ? attachments : [attachments as any];
    }

    // Prepare the payload according to backend spec
    // Backend expects: price (required), deliveryDate (required), delivery_days, payment_terms, validity_days (required), etc.
    // Ensure validity_days is always provided (default to 30 if not specified, null, undefined, 0, or NaN)
    let validityDays = quotationData.validity_days;
    if (validityDays === null || validityDays === undefined || validityDays === 0 || isNaN(Number(validityDays))) {
      validityDays = 30; // Default to 30 days
    } else {
      validityDays = Number(validityDays); // Ensure it's a number
    }
    
    const payload: any = {
      rfq_id: rfqId,
      price: quotationData.total_amount, // Backend requires 'price' field
      deliveryDate: quotationData.delivery_date, // Backend requires 'deliveryDate' field (camelCase)
      items: Array.isArray(items) ? items : [items],
      attachments: [] as string[], // Always send as array; populated below if URLs exist
      delivery_days: deliveryDays || 0,
      payment_terms: quotationData.payment_terms,
      validity_days: validityDays, // Required by database - always include with default of 30
      ...(quotationData.warranty_period && { warranty_period: quotationData.warranty_period }),
      ...(quotationData.notes && { notes: quotationData.notes }),
      ...(quotationData.payment_milestones && quotationData.payment_milestones.length > 0
        ? { payment_milestones: quotationData.payment_milestones }
        : {}),
    };

    // Log full payload before sending so the shape can be verified during testing

    // If there are attachments, use FormData
    if (normalizedAttachments.length > 0) {
      const formData = new FormData();
      
      // Append each field individually - backend expects specific field names
      formData.append('rfq_id', rfqId);
      formData.append('price', payload.price.toString()); // Required: 'price' field
      formData.append('deliveryDate', payload.deliveryDate); // Required: 'deliveryDate' field (camelCase)
      formData.append('delivery_days', payload.delivery_days.toString());
      formData.append('payment_terms', payload.payment_terms);
      formData.append('validity_days', payload.validity_days.toString()); // Required: always include (default 30)
      if (payload.warranty_period) {
        formData.append('warranty_period', payload.warranty_period);
      }
      if (payload.notes) {
        formData.append('notes', payload.notes);
      }
      if (payload.payment_milestones) {
        formData.append('payment_milestones', JSON.stringify(payload.payment_milestones));
      }
      // Items must be sent as a single JSON-stringified array (not items[] loop)
      const itemsArray = Array.isArray(payload.items) ? payload.items : [payload.items];
      formData.append('items', JSON.stringify(itemsArray));

      // Attachments: append each File as a raw binary FormData entry under `attachments[]`.
      // NEVER JSON.stringify File objects — that produces "[{}]" on the backend.
      const flatAttachments = (Array.isArray(normalizedAttachments)
        ? normalizedAttachments
        : [normalizedAttachments] as any[])
        .flat(Infinity)
        .filter(Boolean);

      flatAttachments.forEach((file: any) => {
        if (file instanceof File || file instanceof Blob) {
          formData.append('attachments[]', file);
        } else if (typeof file === 'string' && file) {
          // Pre-uploaded URL string — send under a separate field so backend can persist it
          formData.append('attachment_urls[]', file);
        }
      });

      // Log every FormData entry so the shape can be verified during testing
      for (const [key, value] of formData.entries()) {
      }

      // Use vendorApiRequest with FormData
      return vendorApiRequest<Quotation>(`/rfqs/${rfqId}/submit-quotation`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type - browser will set it with boundary for FormData
        headers: {},
      });
    } else {
      // No attachments, use JSON
      
      return vendorApiRequest<Quotation>(`/rfqs/${rfqId}/submit-quotation`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  },
};

// Vendor API
export const vendorApi = {
  /** Public vendor registration config: categories + complianceDocumentSlots (required flags). */
  getCategories: async (): Promise<ApiResponse<unknown>> => {
    return apiRequest<unknown>('/vendors/categories');
  },

  getAll: async (filters?: FilterOptions): Promise<ApiResponse<Vendor[]>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    
    return apiRequest<Vendor[]>(`/vendors?${params.toString()}`);
  },

  getById: async (id: string): Promise<ApiResponse<Vendor>> => {
    return apiRequest<Vendor>(`/vendors/${id}`);
  },

  /**
   * Authoritative vendor duplicate lookup (email wins over name, case-insensitive).
   * Used by manual PO price comparison on blur of supplier name/email.
   */
  lookup: async (params: {
    email?: string;
    name?: string;
  }): Promise<ApiResponse<{ match: VendorLookupMatch | null }>> => {
    const search = new URLSearchParams();
    if (params.email?.trim()) search.set('email', params.email.trim());
    if (params.name?.trim()) search.set('name', params.name.trim());
    if (!search.toString()) {
      return { success: true, data: { match: null } };
    }
    return apiRequest<{ match: VendorLookupMatch | null }>(
      `/vendors/lookup?${search.toString()}`,
    );
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/vendors/${id}`, {
      method: 'DELETE',
    });
  },

  // Enhanced vendor registration with documents (with auto-retry for cold-start 5xx)
  register: async (data: {
    companyName: string;
    categories: string[];
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
    documents: Array<{
      type: string;
      fileName: string;
      fileData: string;
      fileSize: number;
      expiryDate?: string;
    }>;
  }): Promise<ApiResponse<VendorRegistration>> => {
    const attempt = () => apiRequest<VendorRegistration>('/vendors/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await attempt();
    if (!result.success && (result.error?.includes('Server') || result.error?.includes('Network') || result.error?.includes('fetch'))) {
      // Auto-retry once after a short delay (handles cold-start 5xx)
      await new Promise(r => setTimeout(r, 1500));
      return attempt();
    }
    return result;
  },

  // Legacy register method for simple registrations
  registerSimple: async (data: CreateVendorRegistrationData & { documents?: Array<{ file: File; type: string; name: string }> | File[] }): Promise<ApiResponse<VendorRegistration>> => {
    const formData = new FormData();
    
    // Required fields - always append
    formData.append('companyName', data.companyName || '');
    formData.append('category', data.category || '');
    formData.append('email', data.email || '');
    
    // Optional fields - only append if they have a value
    if (data.phone && data.phone.trim()) {
      formData.append('phone', data.phone);
    }
    if (data.address && data.address.trim()) {
      formData.append('address', data.address);
    }
    if (data.taxId && data.taxId.trim()) {
      formData.append('taxId', data.taxId);
    }
    if (data.contactPerson && data.contactPerson.trim()) {
      formData.append('contactPerson', data.contactPerson);
    }
    if (data.website && String(data.website).trim()) {
      formData.append('website', String(data.website).trim());
    }
    if (data.annualRevenue != null && String(data.annualRevenue).trim()) {
      formData.append('annual_revenue', String(data.annualRevenue).trim());
    }
    if (data.numberOfEmployees != null && String(data.numberOfEmployees).trim()) {
      formData.append('number_of_employees', String(data.numberOfEmployees).trim());
    }
    if (data.yearEstablished != null && String(data.yearEstablished).trim()) {
      formData.append('year_established', String(data.yearEstablished).trim());
    }
    const co = data.categoryOther?.trim();
    if (co) {
      formData.append('category_other', co);
      formData.append('categoryOther', co);
    }

    // Optional financial information
    if (data.financialInfo && typeof data.financialInfo === 'object') {
      const fi = data.financialInfo;
      if (fi.bankName != null && String(fi.bankName).trim()) formData.append('bank_name', String(fi.bankName).trim());
      if (fi.accountNumber != null && String(fi.accountNumber).trim()) formData.append('account_number', String(fi.accountNumber).trim());
      if (fi.accountName != null && String(fi.accountName).trim()) formData.append('account_name', String(fi.accountName).trim());
      if (fi.currency != null && String(fi.currency).trim()) formData.append('currency', String(fi.currency).trim());
      if (fi.countryCode != null && String(fi.countryCode).trim()) formData.append('financial_country_code', String(fi.countryCode).trim());
    }
    
    // Documents - append each file with its document type
    if (data.documents && data.documents.length > 0) {
      data.documents.forEach((doc, index) => {
        // Handle both { file, type, name } objects and plain File objects
        if (doc instanceof File) {
          formData.append('documents[]', doc);
          // Try to infer type from filename if possible
          formData.append(`document_types[]`, 'OTHER');
          formData.append(`document_names[]`, doc.name);
        } else {
          formData.append('documents[]', doc.file);
          formData.append(`document_types[]`, doc.type || 'OTHER');
          formData.append(`document_names[]`, doc.name || doc.file.name);
        }
      });
    }
    
    // Debug: Log FormData contents
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
      } else {
      }
    }

    // Vendor registration doesn't require authentication (public endpoint)
    // But if admin is registering, include token
    const { token } = getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Don't set Content-Type for FormData - browser will set it automatically with boundary
    // Setting it manually will break the multipart/form-data encoding

    try {
      const response = await fetch(`${API_BASE_URL}/vendors/register`, {
        method: 'POST',
        headers,
        body: formData,
      });

      // Check Content-Type BEFORE attempting to parse as JSON
      const contentType = response.headers.get('content-type');
      
      if (!contentType?.includes('application/json')) {
        const textResponse = await response.text();
        console.error('Expected JSON but got:', contentType);
        console.error('Response preview:', textResponse.substring(0, 300));
        
        // Check for common HTML patterns (server error pages, auth redirects)
        if (textResponse.trim().startsWith('<!') || textResponse.includes('<html')) {
          // Backend might be sleeping/cold starting - provide helpful message
          if (response.status === 503 || response.status === 502) {
            return {
              success: false,
              error: 'Server is starting up. Please try again in a few seconds.',
            };
          }
          return {
            success: false,
            error: `Server returned an error page (Status: ${response.status}). The backend may be unavailable.`,
          };
        }
        
        return {
          success: false,
          error: `Unexpected response format from server. Status: ${response.status}`,
        };
      }

      const responseData = await response.json();

      if (!response.ok) {
        // Log full response for debugging 500 errors
        console.error('Registration failed with status:', response.status);
        console.error('Full response data:', JSON.stringify(responseData, null, 2));
        
        // Handle 500 Internal Server Error - likely S3 or backend config issue
        if (response.status === 500) {
          const serverMessage = responseData.message || responseData.error || '';
          const errorDetails = responseData.exception || responseData.trace?.[0]?.function || '';
          console.error('Server 500 Error:', serverMessage, errorDetails);
          
          // Check for common S3-related errors
          if (serverMessage.toLowerCase().includes('s3') || 
              serverMessage.toLowerCase().includes('aws') ||
              serverMessage.toLowerCase().includes('storage') ||
              serverMessage.toLowerCase().includes('disk')) {
            return {
              success: false,
              error: `S3 Storage Error: ${serverMessage}. Please check your AWS S3 configuration on the backend.`,
            };
          }
          
          return {
            success: false,
            error: `Server Error (500): ${serverMessage || 'Internal server error. Check backend logs for details.'}`,
          };
        }
        
        // Log validation errors for debugging
        if (responseData.errors) {
          console.error('Validation errors:', responseData.errors);
          const errorMessages = Object.entries(responseData.errors)
            .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
            .join('; ');
          return {
            success: false,
            error: errorMessages || responseData.error || responseData.message || 'Registration failed',
          };
        }
        return {
          success: false,
          error: responseData.error || responseData.message || 'Registration failed',
        };
      }

      return {
        success: true,
        data: responseData.registration || responseData,
      };
    } catch (error) {
      const firstAttemptMessage = classifyFetchError(error, '/vendors/register');
      console.warn('[Vendor Registration] First attempt failed, retrying once...');
      // Auto-retry once for network/cold-start errors
      try {
        await new Promise(r => setTimeout(r, 1500));
        const retryResponse = await fetch(`${API_BASE_URL}/vendors/register`, {
          method: 'POST',
          headers,
          body: formData,
        });
        const retryContentType = retryResponse.headers.get('content-type') || '';
        const retryData = retryContentType.includes('application/json')
          ? await retryResponse.json()
          : { message: `Server returned non-JSON response (status ${retryResponse.status}).` };
        if (retryResponse.ok) {
          return { success: true, data: retryData.registration || retryData };
        }
        return {
          success: false,
          error: retryData.error || retryData.message || `Registration failed after retry (status ${retryResponse.status}).`,
          status: retryResponse.status,
          raw: retryData,
        };
      } catch (retryError) {
        return {
          success: false,
          error: classifyFetchError(retryError, '/vendors/register') || firstAttemptMessage,
        };
      }
    }
  },

  getRegistrations: async (): Promise<ApiResponse<VendorRegistration[]>> => {
    const response = await apiRequest<any[]>('/vendors/registrations');
    if (response.success && response.data) {
      // Map snake_case backend fields to camelCase frontend interface
      response.data = response.data.map((reg: any) => ({
        id: reg.id,
        companyName: reg.companyName || reg.company_name || '',
        category: reg.category || '',
        email: reg.email || '',
        phone: reg.phone || '',
        address: reg.address || '',
        taxId: reg.taxId || reg.tax_id || '',
        contactPerson: reg.contactPerson || reg.contact_person || '',
        status: reg.status || 'Pending',
        submittedDate: reg.submittedDate || reg.submitted_date || reg.createdAt || reg.created_at || '',
        createdAt: reg.createdAt || reg.created_at || '',
        documents: reg.documents || [],
      })) as VendorRegistration[];
    }
    return response as ApiResponse<VendorRegistration[]>;
  },

  getRegistration: async (id: string): Promise<ApiResponse<VendorRegistration>> => {
    const response = await apiRequest<any>(`/vendors/registrations/${id}`);
    if (response.success && response.data) {
      const reg = response.data;
      // Normalize snake_case to camelCase
      response.data = {
        ...reg,
        companyName: reg.companyName || reg.company_name || '',
        category: reg.category || '',
        email: reg.email || '',
        phone: reg.phone || '',
        address: reg.address || '',
        taxId: reg.taxId || reg.tax_id || '',
        contactPerson: reg.contactPerson || reg.contact_person || '',
        contactPersonTitle: reg.contactPersonTitle || reg.contact_person_title || '',
        status: reg.status || 'Pending',
        submittedDate: reg.submittedDate || reg.submitted_date || reg.createdAt || reg.created_at || '',
        createdAt: reg.createdAt || reg.created_at || '',
        documents: (reg.documents || []).map((doc: any) => ({
          ...doc,
          id: doc.id || doc.document_id,
          type: doc.type || doc.document_type || 'OTHER',
          fileName: doc.fileName || doc.file_name || doc.original_name || doc.name || 'document',
          name: doc.name || doc.original_name || doc.fileName || doc.file_name || 'document',
          fileSize: doc.fileSize || doc.file_size || doc.size || 0,
          fileUrl: doc.fileUrl || doc.file_url || doc.url || '',
          expiryDate: doc.expiryDate || doc.expiry_date || null,
        })),
      } as VendorRegistration;
    }
    return response as ApiResponse<VendorRegistration>;
  },

  approveRegistration: async (id: string): Promise<ApiResponse<{ vendor: Vendor; temporaryPassword: string }>> => {
    return apiRequest<{ vendor: Vendor; temporaryPassword: string }>(`/vendors/registrations/${id}/approve`, {
      method: 'POST',
    });
  },

  rejectRegistration: async (id: string, rejectionReason: string): Promise<ApiResponse<VendorRegistration>> => {
    return apiRequest<VendorRegistration>(`/vendors/registrations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    });
  },

  // Update vendor credentials (for Procurement Manager/Supply Chain Director)
  updateCredentials: async (vendorId: string, data: { email?: string; resetPassword?: boolean }): Promise<ApiResponse<{ temporaryPassword?: string }>> => {
    return apiRequest<{ temporaryPassword?: string }>(`/vendors/${vendorId}/credentials`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Admin update for vendor profile fields missing on legacy registrations.
  // Backend whitelists exactly these four snake_case fields; others are ignored.
  // Admin update for vendor profile fields missing on legacy registrations.
  // This version maps camelCase frontend fields to the snake_case backend fields.
  updateAdmin: async (
    id: string | number, 
    data: { 
      annualRevenue?: string; 
      numberOfEmployees?: string; 
      yearEstablished?: number; 
      website?: string;
    }
  ): Promise<ApiResponse<Vendor>> => {
    return apiRequest<Vendor>(`/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        annual_revenue: data.annualRevenue,
        number_of_employees: data.numberOfEmployees,
        year_established: data.yearEstablished,
        website: data.website,
      }),
    });
  },

  // Get vendor profile (for logged-in vendor)
  getProfile: async (): Promise<ApiResponse<Vendor>> => {
    return apiRequest<Vendor>('/vendors/profile');
  },

  // Update vendor profile
  updateProfile: async (data: Partial<Vendor>): Promise<ApiResponse<Vendor>> => {
    return apiRequest<Vendor>('/vendors/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Update vendor rating (manual moderation)
  updateRating: async (vendorId: string, data: { rating: number; comment: string }): Promise<ApiResponse<{ rating: number; comments: Array<{ id: string; comment: string; rating: number; createdAt: string; createdBy: string }> }>> => {
    return apiRequest<{ rating: number; comments: Array<{ id: string; comment: string; rating: number; createdAt: string; createdBy: string }> }>(`/vendors/${vendorId}/rating`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get vendor comments/reviews
  getComments: async (vendorId: string): Promise<ApiResponse<Array<{ id: string; comment: string; rating: number; createdAt: string; createdBy: string }>>> => {
    return apiRequest<Array<{ id: string; comment: string; rating: number; createdAt: string; createdBy: string }>>(`/vendors/${vendorId}/comments`);
  },

  // Invite a potential vendor to register via email
  inviteVendor: async (data: {
    companyName: string;
    email: string;
    category: string;
    categoryOther?: string;
    category_other?: string;
  }): Promise<ApiResponse<{ success: boolean }>> => {
    const body: Record<string, string> = {
      companyName: data.companyName,
      email: data.email,
      category: data.category,
    };
    const other = (data.categoryOther ?? data.category_other)?.trim();
    if (other) {
      body.category_other = other;
      body.categoryOther = other;
    }
    return apiRequest<{ success: boolean }>('/vendors/invite', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Download vendor registration document
  downloadDocument: async (registrationId: string, documentId: string): Promise<{ success: boolean; error?: string }> => {
    const { token, expired } = getAuthToken();
    
    if (expired || !token) {
      return {
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      };
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/vendors/registrations/${registrationId}/documents/${documentId}/download`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      // Handle 401 Unauthorized
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        sessionStorage.removeItem('tokenExpiry');
        sessionStorage.removeItem('isAuthenticated');
        
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
          window.location.href = '/auth';
        }
        
        return {
          success: false,
          error: 'Authentication failed. Please log in again.',
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to download document (Status: ${response.status})`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Use default error message if JSON parsing fails
        }
        
        console.warn('Document download error:', { status: response.status, errorMessage });
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Get the filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `document-${documentId}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('Document download error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error - unable to download document',
      };
    }
  },
};

// Vendor Authentication API (separate from internal user auth)
export const vendorAuthApi = {
  login: async (email: string, password: string): Promise<ApiResponse<{ vendor: Vendor; token: string; requiresPasswordChange: boolean }>> => {
    return apiRequest<{ vendor: Vendor; token: string; requiresPasswordChange: boolean }>('/vendors/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  changePassword: async (
    currentPassword: string,
    newPassword: string,
    newPasswordConfirmation?: string
  ): Promise<ApiResponse<void>> => {
    return apiRequest<void>('/vendors/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword,
        ...(newPasswordConfirmation != null && newPasswordConfirmation !== ''
          ? { newPassword_confirmation: newPasswordConfirmation }
          : {}),
      }),
    });
  },

  logout: async (): Promise<ApiResponse<void>> => {
    return apiRequest<void>('/vendors/auth/logout', {
      method: 'POST',
    });
  },

  getProfile: async (): Promise<ApiResponse<Vendor>> => {
    return apiRequest<Vendor>('/vendors/auth/me');
  },

  updateProfile: async (data: {
    contact_person?: string;
    phone?: string;
    address?: string;
    // Profile-completion fields — used by vendors onboarded via manual PO to
    // finish their profile after first logging into the portal. Backend must
    // accept and persist these on PUT /vendors/auth/profile.
    category?: string;
    category_other?: string;
    website?: string;
    tax_id?: string;
    year_established?: number | string;
    number_of_employees?: string;
    annual_revenue?: string;
  }): Promise<ApiResponse<Vendor>> => {
    return apiRequest<Vendor>('/vendors/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  requestPasswordReset: async (): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    return apiRequest<{ success: boolean; message: string }>('/vendors/auth/request-password-reset', {
      method: 'POST',
    });
  },
};

// Dashboard API
export const dashboardApi = {
  getProcurementManagerDashboard: async (): Promise<
    ApiResponse<import('@/utils/normalizeProcurementDashboard').ProcurementManagerDashboardPayload>
  > => {
    const res = await apiRequest<Record<string, unknown>>('/dashboard/procurement-manager');
    if (res.success && res.data) {
      const { normalizeProcurementManagerDashboard } = await import(
        '@/utils/normalizeProcurementDashboard'
      );
      return { ...res, data: normalizeProcurementManagerDashboard(res.data) };
    }
    return res as unknown as ApiResponse<
      import('@/utils/normalizeProcurementDashboard').ProcurementManagerDashboardPayload
    >;
  },

  getSupplyChainDirectorDashboard: async (): Promise<ApiResponse<any>> => {
    return apiRequest<any>('/dashboard/supply-chain-director');
  },

  getVendorDashboard: async (): Promise<ApiResponse<any>> => {
    return apiRequest<any>('/dashboard/vendor');
  },

  getFinanceDashboard: async (): Promise<
    ApiResponse<import('@/types/finance-dashboard').FinanceDashboardData>
  > => {
    const res = await apiRequest<Record<string, unknown>>('/dashboard/finance');
    if (res.success && res.data) {
      const { normalizeFinanceDashboard } = await import('@/utils/enrichFinanceRouting');
      return { ...res, data: normalizeFinanceDashboard(res.data) };
    }
    if (res.success) {
      const { normalizeFinanceDashboard } = await import('@/utils/enrichFinanceRouting');
      return { ...res, data: normalizeFinanceDashboard(null) };
    }
    return res as unknown as ApiResponse<import('@/types/finance-dashboard').FinanceDashboardData>;
  },

  getRecentActivities: async (limit: number = 20): Promise<ApiResponse<Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    user?: string;
    entityId?: string;
    entityType?: string;
    status?: string;
  }>>> => {
    // The endpoint automatically determines activities based on authenticated user's role
    // No role parameter needed - backend handles filtering automatically
    return apiRequest(`/dashboard/recent-activities?limit=${limit}`);
  },
};

// Notification API
export const notificationApi = {
  getAll: async (params?: { unread_only?: boolean; limit?: number }): Promise<ApiResponse<{
    notifications: Array<{
      id: string;
      title: string;
      message: string;
      type: 'info' | 'success' | 'warning' | 'error';
      entity_type?: string;
      entity_id?: string;
      action_url?: string;
      read: boolean;
      read_at?: string;
      created_at: string;
    }>;
    unread_count: number;
  }>> => {
    const queryParams = new URLSearchParams();
    if (params?.unread_only) queryParams.append('unread_only', 'true');
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const query = queryParams.toString();
    const response = await apiRequest<any>(`/notifications${query ? `?${query}` : ''}`);
    // Backend returns { success: true, notifications: [...], unread_count: ... }
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          notifications: (response.data as any).notifications || [],
          unread_count: (response.data as any).unread_count || 0,
        },
      };
    }
    return response;
  },

  markAsRead: async (id: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  },

  markAllAsRead: async (): Promise<ApiResponse<void>> => {
    return apiRequest<void>('/notifications/read-all', {
      method: 'PUT',
    });
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/notifications/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============= GLOBAL SEARCH API =============
export interface GlobalSearchResult {
  id: string;
  formatted_id?: string;
  formattedId?: string;
  legacy_id?: string;
  title: string;
  type: 'mrf' | 'srf' | 'rfq' | 'po' | 'vendor' | 'item' | 'shipment' | string;
}

export const searchApi = {
  global: async (q: string): Promise<ApiResponse<GlobalSearchResult[]>> => {
    return apiRequest<GlobalSearchResult[]>(`/search?q=${encodeURIComponent(q)}`);
  },
};

// ============================================================
// PO Terms & Conditions templates
// ============================================================
export interface POTermsTemplate {
  type: string;
  /** Some backends return the body as `content`. */
  content?: string;
  standard_terms?: string;
  standardTerms?: string;
  updated_at?: string;
}

function pickStandardTermsBody(data?: POTermsTemplate): string {
  if (!data) return '';
  const raw = data.content ?? data.standard_terms ?? data.standardTerms ?? '';
  return typeof raw === 'string' ? raw.trim() : '';
}

export const poTermsApi = {
  /**
   * Fetch the standard T&C template for a given document type.
   * Backend route: GET /api/po-terms-templates/{type}
   *
   * For `rfq`, if the backend returns 404 or an empty template, the client
   * supplies `RFQ_STANDARD_TERMS` so procurement can proceed until the API is seeded.
   */
  getTemplate: async (
    type: 'rfq' | 'po' | string
  ): Promise<ApiResponse<POTermsTemplate>> => {
    const res = await apiRequest<POTermsTemplate>(
      `/po-terms-templates/${encodeURIComponent(type)}`
    );

    if (type !== 'rfq') {
      return res;
    }

    const mergedBody = pickStandardTermsBody(res.data);
    if (mergedBody) {
      return {
        ...res,
        success: true,
        data: {
          type: 'rfq',
          ...res.data,
          standard_terms: mergedBody,
        },
      };
    }

    if (res.success) {
      return {
        success: true,
        data: {
          type: 'rfq',
          standard_terms: RFQ_STANDARD_TERMS,
        },
      };
    }

    if (res.status === 404) {
      return {
        success: true,
        data: {
          type: 'rfq',
          standard_terms: RFQ_STANDARD_TERMS,
        },
      };
    }

    return res;
  },
};

// ============================================================
// Digital signature upload (multipart with base64 fallback)
// ============================================================
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const signatureApi = {
  /**
   * Upload a user's digital signature image.
   * Tries multipart first; falls back to base64 JSON if the backend
   * rejects the content type (415 / 400). Returns the signature URL.
   */
  upload: async (
    userId: string,
    file: File
  ): Promise<ApiResponse<{ signature_url?: string; signatureUrl?: string }>> => {
    const { token, expired } = getAuthToken();
    if (expired || !token) {
      return { success: false, error: 'Authentication token has expired. Please log in again.' };
    }

    // Attempt 1: multipart
    try {
      const fd = new FormData();
      fd.append('signature', file);
      const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}/signature`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.status !== 415 && res.status !== 400) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { success: false, error: data.message || data.error || `Upload failed (${res.status})` };
        }
        if (typeof window !== 'undefined' && import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.info('[signatureApi] multipart upload succeeded');
        }
        return { success: true, data: data.data || data };
      }
      // fall through to base64
    } catch {
      // network error — try base64 anyway
    }

    // Attempt 2: base64 JSON fallback
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}/signature`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signature: base64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.message || data.error || `Upload failed (${res.status})` };
      }
      if (typeof window !== 'undefined' && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.info('[signatureApi] base64 fallback upload succeeded');
      }
      return { success: true, data: data.data || data };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Network error' };
    }
  },

  /**
   * Remove the user's saved digital signature.
   * Backend: DELETE /api/users/{id}/signature
   */
  remove: async (userId: string): Promise<ApiResponse<void>> => {
    const { token, expired } = getAuthToken();
    if (expired || !token) {
      return { success: false, error: 'Authentication token has expired. Please log in again.' };
    }
    try {
      const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}/signature`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: data.message || data.error || `Remove failed (${res.status})`,
        };
      }
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Network error' };
    }
  },
};

// ============================================================
// PO sign / resubmit / initiate-SRF / designated creator endpoints
// ============================================================
export const poApi = {
  /** SCD signs the PO. Backend: POST /api/purchase-orders/{id}/sign */
  sign: async (poId: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/purchase-orders/${encodeURIComponent(poId)}/sign`, {
      method: 'POST',
    });
  },

  /** Procurement Manager resubmits a returned PO for SCD approval. */
  resubmit: async (poId: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/purchase-orders/${encodeURIComponent(poId)}/resubmit`, {
      method: 'POST',
    });
  },
};

export const fleetApi = {
  /** Logistics officer initiates an SRF for a vehicle. */
  initiateSRF: async (vehicleId: string): Promise<ApiResponse<{ srf_id?: string; srfId?: string }>> => {
    return apiRequest(`/fleet/vehicles/${encodeURIComponent(vehicleId)}/initiate-srf`, {
      method: 'POST',
    });
  },
};

export const departmentApi = {
  /**
   * Set the designated requisition creator for a department.
   * Backend: PUT /api/departments/{id}/requisition-creator { user_id }
   */
  setRequisitionCreator: async (
    departmentId: string,
    userId: string
  ): Promise<ApiResponse<{ designated_creator?: { id: string; name: string } }>> => {
    return apiRequest(`/departments/${encodeURIComponent(departmentId)}/requisition-creator`, {
      method: 'PUT',
      body: JSON.stringify({ user_id: userId }),
    });
  },
};

// ==========================================
// PROCUREMENT REPORTING API
// ==========================================

export const procurementReportsApi = {
  // Get procurement report with date range
  getReport: async (from?: string, to?: string): Promise<ApiResponse<import('@/types').ProcurementReportData>> => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return apiRequest(`/reports/procurement?${params.toString()}`);
  },

  // Export procurement report as CSV
  exportCSV: async (from?: string, to?: string): Promise<ApiResponse<Blob>> => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const { token, expired } = getAuthToken();
    
    if (expired || !token) {
      return {
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/reports/procurement/export?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to export CSV (status: ${response.status})`,
        };
      }

      const blob = await response.blob();
      return {
        success: true,
        data: blob,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export CSV',
      };
    }
  },
};

// ==========================================
// DASHBOARD KPI API
// ==========================================

export const dashboardKpiApi = {
  // Get dashboard KPIs
  getKpis: async (): Promise<ApiResponse<{ kpis: import('@/types').DashboardKPIs }>> => {
    return apiRequest(`/dashboard/kpis`);
  },
};

// ==========================================
// TRIP REQUEST API (Feature 5)
// ==========================================

export const tripRequestApi = {
  getBookingRules: async (): Promise<
    ApiResponse<import('@/types/trip-request').TripBookingRulesPayload>
  > => {
    const res = await apiRequest<Record<string, unknown>>('/trip-requests/booking-rules');
    if (res.success && res.data) {
      const raw = res.data as Record<string, unknown>;
      const rules =
        (raw.bookingRules as Record<string, unknown>) ??
        (raw.booking_rules as Record<string, unknown>) ??
        raw;
      const scopes = (rules.scopes as import('@/types/trip-request').TripBookingScopeRule[]) ?? [];
      const referenceDate = String(
        rules.referenceDate ?? rules.reference_date ?? new Date().toISOString().slice(0, 10),
      );
      return { ...res, data: { scopes, referenceDate } };
    }
    return res as unknown as ApiResponse<import('@/types/trip-request').TripBookingRulesPayload>;
  },

  list: async (params?: {
    status?: string;
    limit?: number;
    per_page?: number;
  }): Promise<ApiResponse<import('@/types/trip-request').TripRequestsListResponse>> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    const limit = params?.limit ?? params?.per_page ?? 50;
    qs.set('limit', String(Math.min(100, Math.max(1, limit))));
    const res = await apiRequest<Record<string, unknown>>(`/trip-requests?${qs.toString()}`);
    if (res.success) {
      const data = (res.data ?? {}) as Record<string, unknown>;
      const trips = (
        (data.trips as import('@/types/trip-request').StaffTripRequest[]) ??
        (Array.isArray(res.data) ? res.data : []) ??
        []
      ) as import('@/types/trip-request').StaffTripRequest[];
      return {
        ...res,
        data: {
          trips,
          pagination: data.pagination as import('@/types/trip-request').TripRequestsListResponse['pagination'],
        },
      };
    }
    return res as unknown as ApiResponse<import('@/types/trip-request').TripRequestsListResponse>;
  },

  delete: async (
    idOrPath: string,
  ): Promise<ApiResponse<{ message?: string; deletedId?: number | string }>> => {
    const { uiPathToEndpoint } = await import('@/utils/apiUiPath');
    const endpoint = idOrPath.includes('/trip-requests')
      ? uiPathToEndpoint(idOrPath)
      : `/trip-requests/${encodeURIComponent(idOrPath)}`;
    const res = await apiRequest<{ message?: string; deletedId?: number | string }>(endpoint, {
      method: 'DELETE',
    });
    if (!res.success && res.code === 'INVALID_STATE') {
      return {
        ...res,
        error: res.error || 'This trip request can no longer be deleted.',
      };
    }
    return res;
  },

  getById: async (
    id: string,
  ): Promise<
    ApiResponse<{
      trip: import('@/types/trip-request').StaffTripRequest;
      viewer?: import('@/types/trip-request').TripViewerContext;
      readOnly?: boolean;
      canManage?: boolean;
      canComment?: boolean;
    }>
  > => {
    const res = await apiRequest<Record<string, unknown>>(
      `/trip-requests/${encodeURIComponent(id)}`,
    );
    if (res.success && res.data) {
      const raw = res.data as Record<string, unknown>;
      const trip =
        (raw.trip as import('@/types/trip-request').StaffTripRequest) ??
        (raw as unknown as import('@/types/trip-request').StaffTripRequest);
      const viewer = raw.viewer as import('@/types/trip-request').TripViewerContext | undefined;
      return {
        ...res,
        data: {
          trip: {
            ...trip,
            viewer: viewer ?? trip.viewer,
            readOnly: Boolean(raw.readOnly ?? viewer?.readOnly ?? trip.readOnly),
            canManage: Boolean(raw.canManage ?? viewer?.canManage ?? trip.canManage),
            canComment:
              raw.canComment !== undefined
                ? Boolean(raw.canComment)
                : trip.canComment,
          },
          viewer,
          readOnly: Boolean(raw.readOnly ?? viewer?.readOnly),
          canManage: Boolean(raw.canManage ?? viewer?.canManage),
          canComment: raw.canComment !== undefined ? Boolean(raw.canComment) : undefined,
        },
      };
    }
    return res as unknown as ApiResponse<{
      trip: import('@/types/trip-request').StaffTripRequest;
      viewer?: import('@/types/trip-request').TripViewerContext;
      readOnly?: boolean;
      canManage?: boolean;
      canComment?: boolean;
    }>;
  },

  getProgressTracker: async (
    id: string,
  ): Promise<ApiResponse<import('@/types/trip-request').TripProgressPayload>> => {
    const res = await apiRequest<Record<string, unknown>>(
      `/trip-requests/${encodeURIComponent(id)}/progress-tracker`,
    );
    if (res.success && res.data) {
      const progress =
        (res.data.progress as import('@/types/trip-request').TripProgressPayload) ?? res.data;
      return { ...res, data: progress as import('@/types/trip-request').TripProgressPayload };
    }
    return res as unknown as ApiResponse<import('@/types/trip-request').TripProgressPayload>;
  },

  create: async (
    data: import('@/types/logistics').CreateTripRequestData,
  ): Promise<ApiResponse<{ trip: import('@/types/logistics').TripRequest }>> => {
    const res = await apiRequest<Record<string, unknown>>(`/trip-requests`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.success && res.data) {
      const trip =
        (res.data.trip as import('@/types/logistics').TripRequest) ??
        (res.data as unknown as import('@/types/logistics').TripRequest);
      return { ...res, data: { trip } };
    }
    if (!res.success && res.code === 'BOOKING_LEAD_TIME_VIOLATION') {
      const raw = res.raw ?? {};
      const errors = raw.errors ?? {};
      const minDates = errors.minimum_trip_date ?? errors.minimumTripDate;
      const msg =
        (Array.isArray(errors.bookingScope) ? errors.bookingScope[0] : null) ??
        (Array.isArray(errors.scheduled_departure_at) ? errors.scheduled_departure_at[0] : null) ??
        res.error;
      return { ...res, error: msg || 'Trip date does not meet the minimum advance booking period.' } as unknown as ApiResponse<{ trip: import('@/types/logistics').TripRequest }>;
    }
    return res as unknown as ApiResponse<{ trip: import('@/types/logistics').TripRequest }>;
  },

  // Convert trip request to logistics request
  convertToLogisticsRequest: async (
    tripId: string,
    data: import('@/types/logistics').TripConversionData
  ): Promise<ApiResponse<any>> => {
    return apiRequest(`/trips/${tripId}/convert-to-logistics-request`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Procurement approve quote
  procurementApproveQuote: async (tripId: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/trips/${tripId}/procurement-approve-quote`, {
      method: 'POST',
    });
  },

  // Supply Chain Director approve
  scdApprove: async (tripId: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/trips/${tripId}/scd-approve`, {
      method: 'POST',
    });
  },

  // Generate trip PO
  generatePO: async (tripId: string, data: import('@/types/logistics').TripPOData): Promise<ApiResponse<any>> => {
    return apiRequest(`/trips/${tripId}/generate-trip-po`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Upload signed trip PO
  uploadSignedPO: async (tripId: string, data: import('@/types/logistics').TripSignedPOData): Promise<ApiResponse<any>> => {
    return apiRequest(`/trips/${tripId}/upload-signed-trip-po`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Organization-wide trip browse list (all authenticated staff, read-only) */
  listAll: async (params?: {
    status?: string;
    q?: string;
    limit?: number;
    per_page?: number;
  }): Promise<ApiResponse<import('@/types/trip-request').TripRequestsListResponse>> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.q) qs.set('q', params.q);
    const limit = params?.limit ?? params?.per_page ?? 50;
    qs.set('limit', String(Math.min(100, Math.max(1, limit))));
    const res = await apiRequest<Record<string, unknown>>(`/trip-requests/all?${qs.toString()}`);
    if (res.success) {
      const data = (res.data ?? {}) as Record<string, unknown>;
      const trips = (
        (data.trips as import('@/types/trip-request').StaffTripRequest[]) ??
        (Array.isArray(res.data) ? res.data : []) ??
        []
      ) as import('@/types/trip-request').StaffTripRequest[];
      return {
        ...res,
        data: {
          trips,
          pagination: data.pagination as import('@/types/trip-request').TripRequestsListResponse['pagination'],
        },
      };
    }
    return res as unknown as ApiResponse<import('@/types/trip-request').TripRequestsListResponse>;
  },

  /** List trip requests awaiting Logistics Manager action */
  listPendingForLogistics: async (): Promise<
    ApiResponse<import('@/types/trip-request').TripRequestsListResponse>
  > => {
    const fetchList = async (status?: string) => {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      qs.set('limit', '100');
      const res = await apiRequest<Record<string, unknown>>(`/trip-requests?${qs.toString()}`);
      if (res.success) {
        const data = (res.data ?? {}) as Record<string, unknown>;
        const trips = (
          (data.trips as import('@/types/trip-request').StaffTripRequest[]) ??
          (Array.isArray(res.data) ? res.data : []) ??
          []
        ) as import('@/types/trip-request').StaffTripRequest[];
        return { ...res, data: { trips, pagination: data.pagination as import('@/types/trip-request').TripRequestsListResponse['pagination'] } };
      }
      return res as unknown as ApiResponse<import('@/types/trip-request').TripRequestsListResponse>;
    };

    const res = await fetchList('submitted');
    if (res.success && res.data?.trips?.length) return res;

    const fallback = await fetchList();
    if (fallback.success && fallback.data?.trips) {
      const pending = fallback.data.trips.filter((t) => {
        const stage = t.workflowStage ?? t.workflow_stage ?? '';
        const status = (t.status ?? '').toLowerCase();
        return (
          ['trip_request', 'logistics_review', 'submitted', 'pending'].includes(stage) ||
          ['submitted', 'pending', 'pending_logistics_review'].includes(status)
        );
      });
      return { ...fallback, data: { ...fallback.data, trips: pending } };
    }
    return res.success ? res : fallback;
  },

  /** Logistics Manager approves and assigns vehicle + driver */
  confirm: async (
    id: string,
    data: import('@/types/trip-request').TripConfirmAssignmentData,
  ): Promise<ApiResponse<{ trip: import('@/types/trip-request').StaffTripRequest; logistics_trip_id?: string | number }>> => {
    const res = await apiRequest<Record<string, unknown>>(
      `/trip-requests/${encodeURIComponent(id)}/confirm`,
      { method: 'POST', body: JSON.stringify(data) },
    );
    if (res.success && res.data) {
      const trip =
        (res.data.trip as import('@/types/trip-request').StaffTripRequest) ??
        (res.data as unknown as import('@/types/trip-request').StaffTripRequest);
      const logisticsTripId = res.data.logistics_trip_id ?? res.data.logisticsTripId ?? res.data.trip_id ?? res.data.tripId;
      return { ...res, data: { trip, logistics_trip_id: logisticsTripId as string | number | undefined } };
    }
    return res as unknown as ApiResponse<{ trip: import('@/types/trip-request').StaffTripRequest; logistics_trip_id?: string | number }>;
  },

  reject: async (id: string, reason?: string): Promise<ApiResponse<{ message?: string }>> => {
    return apiRequest(`/trip-requests/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? '' }),
    });
  },

  getComments: async (
    id: string,
  ): Promise<
    ApiResponse<{
      comments: import('@/types/trip-request').TripComment[];
      canComment?: boolean;
    }>
  > => {
    const res = await apiRequest<Record<string, unknown>>(
      `/trip-requests/${encodeURIComponent(id)}/comments`,
    );
    if (res.success && res.data) {
      const raw = res.data as Record<string, unknown>;
      const comments = (
        (raw.comments as import('@/types/trip-request').TripComment[]) ??
        (Array.isArray(res.data) ? res.data : [])
      ) as import('@/types/trip-request').TripComment[];
      return {
        ...res,
        data: {
          comments,
          canComment: raw.canComment !== undefined ? Boolean(raw.canComment) : undefined,
        },
      };
    }
    return res as unknown as ApiResponse<{
      comments: import('@/types/trip-request').TripComment[];
      canComment?: boolean;
    }>;
  },

  addComment: async (
    id: string,
    body: string,
  ): Promise<ApiResponse<{ comment: import('@/types/trip-request').TripComment }>> => {
    const res = await apiRequest<Record<string, unknown>>(
      `/trip-requests/${encodeURIComponent(id)}/comments`,
      { method: 'POST', body: JSON.stringify({ body }) },
    );
    if (res.success && res.data) {
      const comment =
        (res.data.comment as import('@/types/trip-request').TripComment) ??
        (res.data as unknown as import('@/types/trip-request').TripComment);
      return { ...res, data: { comment } };
    }
    return res as unknown as ApiResponse<{ comment: import('@/types/trip-request').TripComment }>;
  },
};

// ==========================================
// PASSENGER & DRIVER APIs
// ==========================================

export const passengerApi = {
  // Get eligible passengers for trip selection
  getEligible: async (q?: string, page?: number): Promise<ApiResponse<import('@/types/logistics').EligiblePassengersResponse>> => {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (page) params.append('page', String(page));
    return apiRequest(`/users/eligible-passengers?${params.toString()}`);
  },
};

export const driverApi = {
  // Delete driver
  delete: async (driverId: string): Promise<ApiResponse<void>> => {
    return apiRequest(`/fleet/drivers/${driverId}`, {
      method: 'DELETE',
    });
  },

  // Assign driver to vehicle
  assign: async (driverId: string, data: import('@/types/logistics').DriverAssignmentData): Promise<ApiResponse<any>> => {
    return apiRequest(`/fleet/drivers/${driverId}/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
