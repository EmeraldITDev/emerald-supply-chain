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
  VendorRegistration,
  CreateVendorRegistrationData,
  ApiResponse,
  FilterOptions,
  SortOptions
} from '@/types';

// Configure your API base URL here
// For Lovable previews and production, always use the deployed backend
// Only use localhost if explicitly set in VITE_API_BASE_URL for local development
const getApiBaseUrl = () => {
  // If explicitly set, use it (for local development)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
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

// Log the API URL being used (helpful for debugging in Lovable)
if (typeof window !== 'undefined') {
  console.log('API Base URL:', API_BASE_URL);
  console.log('Current Origin:', window.location.origin);
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
const getAuthToken = (): { token: string | null; expired: boolean } => {
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
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const { token, expired } = getAuthToken();
  
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
      // Clear invalid token
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      localStorage.removeItem('tokenExpiry');
      localStorage.removeItem('isAuthenticated');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userData');
      sessionStorage.removeItem('tokenExpiry');
      sessionStorage.removeItem('isAuthenticated');
      
      // Redirect to login if we're in a browser context (only for non-auth endpoints)
      if (typeof window !== 'undefined' && !isAuthEndpoint && !window.location.pathname.includes('/auth') && !window.location.pathname.includes('/vendor-portal')) {
        window.location.href = '/auth';
      }
      
      return {
        success: false,
        error: 'Authentication failed. Please log in again.',
      };
    }

    if (!response.ok) {
      // Handle validation errors
      if (data.errors && typeof data.errors === 'object') {
        const firstError = Object.values(data.errors)[0];
        const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
        return {
          success: false,
          error: errorMessage || data.message || 'An error occurred',
        };
      }
      
      return {
        success: false,
        error: data.message || data.error || 'An error occurred',
      };
    }

    // Extract data property if backend response has it, otherwise use the response as-is
    // Backend returns {success: true, data: {...}}, so we extract the inner data
    const responseData = (data && typeof data === 'object' && 'data' in data) ? data.data : data;

    return {
      success: true,
      data: responseData,
    };
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error - please check your connection',
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

// User Management API
export const userApi = {
  getAll: async (filters?: { role?: string; search?: string }): Promise<ApiResponse<User[]>> => {
    const params = new URLSearchParams();
    if (filters?.role) params.append('role', filters.role);
    if (filters?.search) params.append('search', filters.search);
    
    return apiRequest<User[]>(`/users?${params.toString()}`);
  },

  create: async (userData: {
    name: string;
    email: string;
    role: string;
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
    role: string;
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

  // Get available actions for current user on this MRF
  getAvailableActions: async (id: string): Promise<ApiResponse<import('@/types').AvailableActions>> => {
    return apiRequest<import('@/types').AvailableActions>(`/mrfs/${id}/available-actions`);
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

  // ==========================================
  // Phase 1: MRF Multi-Stage Workflow Endpoints
  // ==========================================

  // Executive approves MRF (routes to chairman if >1M, else to procurement)
  executiveApprove: async (id: string, remarks?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/executive-approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // Chairman approves high-value MRF (>1M)
  chairmanApprove: async (id: string, remarks?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/chairman-approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // Procurement Manager deletes/clears PO
  deletePO: async (id: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/po`, {
      method: 'DELETE',
    });
  },

  // Procurement Manager generates PO
  generatePO: async (id: string, poNumber: string, poFile?: File): Promise<ApiResponse<MRF>> => {
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

      console.log('Sending PO generation request:', {
        mrfId: id,
        poNumber,
        fileName: poFile.name,
        fileSize: poFile.size,
        fileType: poFile.type,
      });

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

        console.log('PO generated successfully:', data);
        return { success: true, data: data.data || data };
      } catch (error) {
        console.error('PO generation network error:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Network error - unable to reach server' 
        };
      }
    } else {
      // If no file, use JSON
    return apiRequest<MRF>(`/mrfs/${id}/generate-po`, {
      method: 'POST',
      body: JSON.stringify({ po_number: poNumber }),
    });
    }
  },

  // Procurement sends selected vendor to Supply Chain Director for approval
  sendVendorForApproval: async (id: string, vendorId: string, quotationId?: string, remarks?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/send-vendor-for-approval`, {
      method: 'POST',
      body: JSON.stringify({ vendor_id: vendorId, quotation_id: quotationId, remarks }),
    });
  },

  // Supply Chain Director approves vendor selection
  approveVendorSelection: async (id: string, remarks?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/approve-vendor-selection`, {
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
    return apiRequest<MRF>(`/mrfs/${id}/process-payment`, {
      method: 'POST',
    });
  },

  // Chairman approves final payment
  approvePayment: async (id: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/approve-payment`, {
      method: 'POST',
    });
  },

  // Reject MRF at any workflow stage
  workflowReject: async (id: string, reason: string, comments?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/workflow-reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, comments }),
    });
  },
};

// SRF API
export const srfApi = {
  getAll: async (filters?: FilterOptions): Promise<ApiResponse<SRF[]>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    
    return apiRequest<SRF[]>(`/srfs?${params.toString()}`);
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
    return apiRequest<RFQ>('/rfqs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<RFQ>): Promise<ApiResponse<RFQ>> => {
    return apiRequest<RFQ>(`/rfqs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
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
    return apiRequest(`/rfqs/${rfqId}/quotations`);
  },

  // Select winning vendor (Procurement Manager)
  selectVendor: async (rfqId: string, quotationId: string): Promise<ApiResponse<{
    rfq_id: string;
    status: string;
    selected_vendor: { id: string; name: string };
    selected_quotation: { id: string; total_amount: number };
  }>> => {
    return apiRequest(`/rfqs/${rfqId}/select-vendor`, {
      method: 'POST',
      body: JSON.stringify({ quotation_id: quotationId }),
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

  reject: async (id: string): Promise<ApiResponse<Quotation>> => {
    return apiRequest<Quotation>(`/quotations/${id}/reject`, {
      method: 'POST',
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
      // Clear invalid vendor token
      localStorage.removeItem('vendorAuthToken');
      localStorage.removeItem('vendorData');
      localStorage.removeItem('vendorTokenExpiry');
      sessionStorage.removeItem('vendorAuthToken');
      sessionStorage.removeItem('vendorData');
      sessionStorage.removeItem('vendorTokenExpiry');
      
      // Redirect to vendor portal login if we're in a browser context
      if (typeof window !== 'undefined' && !isAuthEndpoint && window.location.pathname.includes('/vendor-portal')) {
        // Clear login state but stay on vendor portal page
        window.location.reload();
      }
      
      return {
        success: false,
        error: 'Authentication failed. Please log in again.',
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
};

// Vendor API
export const vendorApi = {
  getAll: async (filters?: FilterOptions): Promise<ApiResponse<Vendor[]>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    
    return apiRequest<Vendor[]>(`/vendors?${params.toString()}`);
  },

  getById: async (id: string): Promise<ApiResponse<Vendor>> => {
    return apiRequest<Vendor>(`/vendors/${id}`);
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/vendors/${id}`, {
      method: 'DELETE',
    });
  },

  // Enhanced vendor registration with documents
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
    return apiRequest<VendorRegistration>('/vendors/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Legacy register method for simple registrations
  registerSimple: async (data: CreateVendorRegistrationData & { documents?: File[] }): Promise<ApiResponse<VendorRegistration>> => {
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
    
    // Documents - append each file
    if (data.documents && data.documents.length > 0) {
      data.documents.forEach((file) => {
        formData.append('documents[]', file);
      });
    }
    
    // Debug: Log FormData contents
    console.log('FormData contents:');
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}: File(${value.name}, ${value.size} bytes)`);
      } else {
        console.log(`${key}: ${value}`);
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

      const responseData = await response.json();

      if (!response.ok) {
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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  getRegistrations: async (): Promise<ApiResponse<VendorRegistration[]>> => {
    return apiRequest<VendorRegistration[]>('/vendors/registrations');
  },

  getRegistration: async (id: string): Promise<ApiResponse<VendorRegistration>> => {
    return apiRequest<VendorRegistration>(`/vendors/registrations/${id}`);
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
  inviteVendor: async (data: { companyName: string; email: string; category: string }): Promise<ApiResponse<{ success: boolean }>> => {
    return apiRequest<{ success: boolean }>('/vendors/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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

  changePassword: async (currentPassword: string, newPassword: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>('/vendors/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
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

  updateProfile: async (data: { contact_person?: string; phone?: string; address?: string }): Promise<ApiResponse<Vendor>> => {
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
  getProcurementManagerDashboard: async (): Promise<ApiResponse<any>> => {
    return apiRequest<any>('/dashboard/procurement-manager');
  },

  getSupplyChainDirectorDashboard: async (): Promise<ApiResponse<any>> => {
    return apiRequest<any>('/dashboard/supply-chain-director');
  },

  getVendorDashboard: async (): Promise<ApiResponse<any>> => {
    return apiRequest<any>('/dashboard/vendor');
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
