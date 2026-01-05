// Mock data for development/testing
// This file provides sample data when backend is not connected
// Remove or disable when connecting to real backend

import type { User, MRF, SRF, RFQ, Quotation, Vendor, VendorRegistration } from '@/types';

export const mockUsers: User[] = [
  {
    id: 1,
    email: 'staff@emeraldcfze.com',
    name: 'John Doe',
    role: 'employee',
    department: 'Operations',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    email: 'procurement@emeraldcfze.com',
    name: 'Jane Smith',
    role: 'procurement',
    department: 'Procurement',
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    email: 'finance@emeraldcfze.com',
    name: 'Mike Johnson',
    role: 'finance',
    department: 'Finance',
    createdAt: new Date().toISOString(),
  },
];

export const mockMRFs: MRF[] = [
  {
    id: 'MRF-2025-001',
    title: 'Office Supplies - Q1 2025',
    category: 'Office Supplies',
    urgency: 'Medium',
    description: 'Printer cartridges, paper, and stationery for Q1',
    quantity: '100',
    estimatedCost: '50000',
    justification: 'Regular quarterly supplies replenishment',
    requester: 'John Doe',
    requesterId: 'user-1',
    date: '2025-01-15',
    status: 'Pending',
    currentStage: 'procurement',
  },
];

export const mockSRFs: SRF[] = [
  {
    id: 'SRF-2025-001',
    title: 'HVAC Maintenance',
    serviceType: 'Maintenance',
    urgency: 'High',
    description: 'Annual HVAC system maintenance and inspection',
    duration: '3 days',
    estimatedCost: '150000',
    justification: 'Scheduled maintenance to prevent system failures',
    requester: 'John Doe',
    requesterId: 'user-1',
    date: '2025-01-20',
    status: 'Pending',
  },
];

export const mockRFQs: RFQ[] = [];

export const mockQuotations: Quotation[] = [];

export const mockVendors: Vendor[] = [
  {
    id: 'V001',
    name: 'Steel Works Ltd',
    category: 'Raw Materials',
    rating: 4.8,
    totalOrders: 45,
    status: 'Active',
    email: 'contact@steelworks.com',
    phone: '+234-800-000-0001',
    address: 'Lagos, Nigeria',
    taxId: 'TIN-001',
    contactPerson: 'Ahmed Ali',
  },
];

export const mockVendorRegistrations: VendorRegistration[] = [];

// Flag to enable/disable mock data - DEPRECATED: Always use API
export const USE_MOCK_DATA = false;
