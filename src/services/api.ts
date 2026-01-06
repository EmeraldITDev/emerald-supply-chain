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
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://supply-chain-backend-hwh6.onrender.com/api';

// Helper function to get auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Helper function for API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

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

    return {
      success: true,
      data: data,
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

  create: async (data: CreateMRFData): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>('/mrfs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<MRF>): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  approve: async (id: string, remarks?: string): Promise<ApiResponse<MRF>> => {
    return apiRequest<MRF>(`/mrfs/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

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
};

// Quotation API
export const quotationApi = {
  getAll: async (): Promise<ApiResponse<Quotation[]>> => {
    return apiRequest<Quotation[]>('/quotations');
  },

  getByVendor: async (vendorId: string): Promise<ApiResponse<Quotation[]>> => {
    return apiRequest<Quotation[]>(`/quotations/vendor/${vendorId}`);
  },

  create: async (data: CreateQuotationData): Promise<ApiResponse<Quotation>> => {
    return apiRequest<Quotation>('/quotations', {
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

    const token = getAuthToken();
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
            errors: responseData.errors,
          };
        }
        return {
          success: false,
          error: responseData.error || responseData.message || 'Registration failed',
          errors: responseData.errors,
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
