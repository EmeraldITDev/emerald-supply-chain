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
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

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

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'An error occurred',
      };
    }

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
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

  register: async (data: CreateVendorRegistrationData): Promise<ApiResponse<VendorRegistration>> => {
    return apiRequest<VendorRegistration>('/vendors/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getRegistrations: async (): Promise<ApiResponse<VendorRegistration[]>> => {
    return apiRequest<VendorRegistration[]>('/vendors/registrations');
  },

  approveRegistration: async (id: string): Promise<ApiResponse<Vendor>> => {
    return apiRequest<Vendor>(`/vendors/registrations/${id}/approve`, {
      method: 'POST',
    });
  },
};
