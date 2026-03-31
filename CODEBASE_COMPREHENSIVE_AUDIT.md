# Comprehensive Codebase Audit: Logistics, Files, Vendors, and Users

## 1. LOGISTICS MODULE

### Location
- **Main Component**: [src/pages/Logistics.tsx](src/pages/Logistics.tsx)
- **API Service**: [src/services/logisticsApi.ts](src/services/logisticsApi.ts)
- **Sub-Components**: 
  - [src/components/logistics/TripScheduling.tsx](src/components/logistics/TripScheduling.tsx)
  - [src/components/logistics/JourneyManagement.tsx](src/components/logistics/JourneyManagement.tsx)
  - [src/components/logistics/FleetManagement.tsx](src/components/logistics/FleetManagement.tsx)
  - [src/components/logistics/MaterialsTracking.tsx](src/components/logistics/MaterialsTracking.tsx)
  - [src/components/logistics/ReportingCompliance.tsx](src/components/logistics/ReportingCompliance.tsx)

### CSV Import & Bulk Upload Implementation
**Endpoints Implemented**:
- `POST /trips/bulk-upload` - Upload trips from Excel file via FormData
- `POST /materials/bulk-upload` - Upload materials from file via FormData
- `POST /warehouse/materials-consumption/bulk-upload` - Warehouse consumption tracking

**Implementation Details**:
```typescript
// logisticsApi.ts - Trips bulk upload
bulkUpload: async (file: File): Promise<ApiResponse<BulkTripUploadResult>> => {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<BulkTripUploadResult>('/trips/bulk-upload', {
    method: 'POST',
    body: formData,
  });
}

// Materials bulk upload
bulkUpload: async (file: File): Promise<ApiResponse<BulkMaterialUploadResult>> => {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<BulkMaterialUploadResult>('/materials/bulk-upload', {
    method: 'POST',
    body: formData,
  });
}
```

**Frontend Integration**:
- [src/components/logistics/TripScheduling.tsx](src/components/logistics/TripScheduling.tsx) line 385 - Downloads CSV templates
- [src/components/warehouse/DailyMaterialsConsumption.tsx](src/components/warehouse/DailyMaterialsConsumption.tsx) line 110 - Bulk upload handler

**Template Download Feature**:
- Endpoint: `logisticsDashboardApi.downloadTemplate(templateType)` 
- Types supported: `'personnel-trip' | 'journey-management'`
- Returns Blob for CSV download

### Report Generation
**Endpoints Implemented**:
- `POST /reports` - Create logistics report
- `GET /reports/{id}` - Fetch report by ID
- `POST /reports/{id}/export` - Export report

**Report Functionality**:
- Contains attachments field: `attachments?: ReportAttachment[]`
- ReportAttachment interface: `{ id, fileName, uploadedAt, downloadUrl }`
- Supports multiple export formats

**Current Implementation Status**:
- Basic report creation working
- Export functionality defined but backend implementation pending
- Attachments stored as JSONB in database

### Workflow & Navigation
**Trip States**: `CREATED | SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED`
**Journey States**: `DEPARTED | EN_ROUTE | ARRIVED | COMPLETED | CANCELLED`

**Available Actions**:
- Trip assignment to vendor: `assignVendor(tripId, vendorId)`
- Journey status updates: `updateStatus(id, status, location, timestamp)`
- Journey checkpoints: `addCheckpoint(id, { location, notes, gpsCoordinates })`
- Incident reporting: `reportIncident(id, { type, description, location, severity })`

---

## 2. FILE ATTACHMENTS & UPLOAD HANDLING

### Current Implementation Approach

**Architecture**: Direct FormData file uploads to backend (no S3 integration in frontend code)

### File Upload Patterns Used

#### 1. **Purchase Order Upload**
**Location**: [src/services/api.ts](src/services/api.ts) line ~1265
- **Endpoint**: `POST /mrfs/{id}/generate-po`
- **Method**: FormData with file validation
- **Validation**:
  - Max file size: 10MB
  - Allowed types: `.pdf, .doc, .docx`
- **Implementation**:
```typescript
generatePO: async (id: string, poNumber: string, poFile?: File): Promise<ApiResponse<MRF>> => {
  const formData = new FormData();
  formData.append('po_number', poNumber);
  formData.append('unsigned_po', poFile);
  
  try {
    const response = await fetch(`${API_BASE_URL}/mrfs/${id}/generate-po`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    // ... error handling
  }
}
```

#### 2. **Signed PO Upload**
**Location**: [src/services/api.ts](src/services/api.ts) line ~1598
- **Endpoint**: `POST /mrfs/{id}/upload-signed-po`
- **Method**: FormData
- **Field**: `signed_po` (File)
- **Used by**: Supply Chain Director

#### 3. **GRN (Goods Receipt Note) Upload**
**Location**: [src/services/api.ts](src/services/api.ts) line ~407
- **Endpoint**: `POST /mrfs/{id}/complete-grn`
- **Method**: FormData
- **Field**: `grn` (File)
- **Validation**: No explicit validation (backend handles it)

#### 4. **Vendor Registration Documents**
**Location**: [src/services/api.ts](src/services/api.ts) line ~1756
- **Endpoint**: `POST /vendors/register`
- **Method**: FormData with dynamic field names
- **Fields**:
  - `documents[]` - Multiple files
  - `document_types[]` - Type for each document
  - `document_names[]` - Name for each document
- **Implementation**:
```typescript
registerSimple: async (data): Promise<ApiResponse<VendorRegistration>> => {
  const formData = new FormData();
  formData.append('companyName', data.companyName);
  formData.append('category', data.category);
  // ... other fields
  
  if (data.documents && data.documents.length > 0) {
    data.documents.forEach((doc) => {
      formData.append('documents[]', doc.file);
      formData.append('document_types[]', doc.type || 'OTHER');
      formData.append('document_names[]', doc.name || doc.file.name);
    });
  }
}
```

#### 5. **Quotation Attachments**
**Location**: [src/services/api.ts](src/services/api.ts) line ~2150
- **Endpoint**: `POST /rfqs/{id}/submit-quotation`
- **Method**: FormData
- **Fields**:
  - `attachments[]` - Multiple files
  - `items` - JSON stringified array
- **Implementation**:
```typescript
submitQuotation: async (rfqId: string, quotationData, attachments?: File[]) => {
  if (attachments && attachments.length > 0) {
    const formData = new FormData();
    formData.append('rfq_id', rfqId);
    formData.append('price', quotationData.total_amount);
    // ... other fields
    attachments.forEach((file) => {
      formData.append('attachments[]', file);
    });
    
    return vendorApiRequest<Quotation>(`/rfqs/${rfqId}/submit-quotation`, {
      method: 'POST',
      body: formData,
    });
  }
}
```

#### 6. **MRF with PFI (Project Finance Information)**
**Location**: [src/services/api.ts](src/services/api.ts) line ~470
- **Endpoint**: `POST /mrfs`
- **Method**: FormData
- **Used for**: Creating MRF with attached documents

### File Download Patterns

#### 1. **PO Download**
**Location**: [src/services/api.ts](src/services/api.ts) line ~1623
- **Endpoints**: 
  - `GET /mrfs/{id}/download-po` - Unsigned PO
  - `GET /mrfs/{id}/download-signed-po` - Signed PO
- **Implementation**:
```typescript
downloadPO: async (id: string, poType: 'unsigned' | 'signed' = 'unsigned') => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}
```

#### 2. **Template Download**
**Location**: [src/components/logistics/TripScheduling.tsx](src/components/logistics/TripScheduling.tsx) line 385
- **Method**: Via `logisticsDashboardApi.downloadTemplate(type)`
- **Template Types**: `'personnel-trip' | 'journey-management'`

### AWS S3 Integration Status
**Current Status**: NO S3 integration detected in frontend code
- Files are uploaded directly to backend via FormData
- Backend is responsible for S3/storage handling
- Frontend only handles file validation and upload orchestration

**Error Handling for S3 Issues**:
```typescript
// Vendor registration error handling detects S3 failures
if (response.status === 500) {
  if (serverMessage.toLowerCase().includes('s3') || 
      serverMessage.toLowerCase().includes('aws') ||
      serverMessage.toLowerCase().includes('storage')) {
    return {
      success: false,
      error: `S3 Storage Error: ${serverMessage}. Check AWS configuration.`,
    };
  }
}
```

---

## 3. VENDOR PROFILE MODULE

### Location & Components
- **Main Page**: [src/pages/Vendors.tsx](src/pages/Vendors.tsx)
- **Vendor Portal**: [src/pages/VendorPortal.tsx](src/pages/VendorPortal.tsx)
- **Registration Component**: [src/components/EnhancedVendorRegistration.tsx](src/components/EnhancedVendorRegistration.tsx)
- **Types**: [src/types/vendor-registration.ts](src/types/vendor-registration.ts)

### Vendor Profile Display & Viewing
**Implementation**:
```typescript
// src/pages/Vendors.tsx line 154
handleViewVendorProfile: async (vendor: any) => {
  const [profileResponse, commentsResponse] = await Promise.all([
    vendorApi.getById(vendor.id),
    vendorApi.getComments(vendor.id)
  ]);
  
  // Merge API data with local data
  const fullVendor = {
    ...vendor,
    ...apiData,
    name: apiData.name || apiData.company_name || vendor.name,
  };
  setSelectedVendor(fullVendor);
}
```

**Backend Endpoints Used**:
- `GET /vendors/{id}` - Get vendor details
- `GET /vendors/{id}/comments` - Get vendor comments/ratings
- `GET /vendors/profile` - Get logged-in vendor profile (vendor auth)
- `PUT /vendors/profile` - Update logged-in vendor profile

### Document Viewing & Display
**Vendor Document Types**:
```typescript
// src/types/vendor-registration.ts
export type VendorDocumentType = 
  | 'CERTIFICATE_OF_INCORPORATION'
  | 'TAX_REGISTRATION'
  | 'BUSINESS_LICENSE'
  | 'INSURANCE_CERTIFICATE'
  | 'QUALITY_CERTIFICATION'
  | 'BANK_DETAILS'
  | 'OTHER';
```

**Document Management in Vendor Portal**:
- **Location**: [src/pages/VendorPortal.tsx](src/pages/VendorPortal.tsx) line 130
- **Current Implementation**:
```typescript
const getExpiringDocuments = () => {
  if (!currentVendor?.documents) return [];
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  return currentVendor.documents.filter((doc: any) => {
    const expiryDate = new Date(doc.expiry_date || doc.expiryDate);
    return expiryDate <= thirtyDaysFromNow && expiryDate >= new Date();
  });
};
```

**Document Upload in Registration**:
- **File Property Validation**: Checks for expiry dates
- **Multiple Documents Support**: Yes
- **Constraints**: Document types must match VENDOR_DOCUMENT_REQUIREMENTS

### Vendor Ratings & Comments
**Endpoints**:
- `POST /vendors/{id}/rating` - Submit/update rating with comment
- `GET /vendors/{id}/comments` - Get all comments

**Implementation**:
```typescript
// src/pages/Vendors.tsx
handleSubmitRating: async () => {
  const response = await vendorApi.updateRating(selectedVendor.id, {
    rating: newRating,
    comment: newComment,
  });
  
  // Updates local state with new rating and comments
  setVendorComments(response.data.comments);
}
```

### Vendor API Methods
```typescript
// src/services/api.ts
vendorApi = {
  getById(id): Vendor - Get vendor profile
  delete(id): void - Delete vendor
  register(data): VendorRegistration - Register vendor
  registerSimple(data): VendorRegistration - Simple registration with documents
  getRegistrations(): VendorRegistration[] - Get all registrations
  getRegistration(id): VendorRegistration - Get specific registration
  approveRegistration(id): { vendor, temporaryPassword } - Approve registration
  rejectRegistration(id, reason): VendorRegistration - Reject registration
  updateCredentials(id, { email, resetPassword }): void - Reset vendor password
  getProfile(): Vendor - Get vendor's own profile
  updateProfile(data): Vendor - Update vendor profile
  updateRating(id, { rating, comment }): void - Rate vendor
  getComments(id): [] - Get vendor comments
  inviteVendor(data): { success } - Invite vendor
}
```

### Vendor Document Download
**Location**: [src/pages/VendorRegistrationReview.tsx](src/pages/VendorRegistrationReview.tsx) line 238
- **Method**: `handleDownloadDocument(document: VendorDocument)`
- **Backend Endpoint**: Requires implementation (currently just marks as viewed)
- **Current Status**: Download logic needs backend support

---

## 4. USER MANAGEMENT & PERMISSIONS

### Location
- **Component**: [src/pages/UserManagement.tsx](src/pages/UserManagement.tsx)
- **API Service**: [src/services/api.ts](src/services/api.ts) - userApi object

### User Roles
```typescript
// src/contexts/AuthContext.tsx
type UserRole = 
  "employee" | 
  "general_employee" | 
  "procurement_manager" | 
  "finance" | 
  "executive" | 
  "supply_chain_director" | 
  "supply_chain" | 
  "chairman" | 
  "logistics_manager" | 
  "procurement" | 
  "logistics";
```

### User Management Implementation
```typescript
// src/pages/UserManagement.tsx line 39
const UserManagement = () => {
  // Permission check
  const canManageUsers = ['procurement', 'procurement_manager', 'executive', 
    'supply_chain_director', 'supply_chain', 'chairman', 'admin']
    .includes(user?.role || '');
  
  if (!canManageUsers) {
    return <p>You do not have permission to manage users.</p>;
  }
}
```

### API Endpoints

#### User CRUD Operations
```typescript
// src/services/api.ts
userApi = {
  getAll(filters?: { role?, search? }): User[] - Fetch users with filters
  create(userData): User - Create new user
  update(userId, userData): User - Update user
  delete(userId): void - Delete user
}
```

#### User Creation Data Structure
```typescript
{
  name: string (required)
  email: string (required)
  role: string (required)
  department?: string
  password: string (required for creation)
  is_admin?: boolean
  can_manage_users?: boolean
}
```

#### Role-Based Permission Checks
**Examples in codebase**:

1. **Dashboard Alerts** - [src/components/DashboardAlerts.tsx](src/components/DashboardAlerts.tsx)
```typescript
if (['procurement', 'admin', 'supply_chain_director'].includes(userRole)) {
  // Show procurement-related alerts
}
if (['executive', 'chairman', 'admin'].includes(userRole)) {
  // Show executive alerts
}
```

2. **GRN Module** - [src/components/GRNModule.tsx](src/components/GRNModule.tsx) line 420
```typescript
const canViewFinanceActions = ['finance', 'admin', 'chairman'].includes(userRole);
const canViewWarehouseActions = ['logistics', 'warehouse', 'admin', 'supply_chain_director', 'procurement'].includes(userRole);
```

3. **MRF Approval Dialog** - [src/components/MRFApprovalDialog.tsx](src/components/MRFApprovalDialog.tsx)
```typescript
currentUserRole: "executive" | "finance" | "chairman"
const canApprove = mrf.currentStage === currentUserRole;
```

### Permission Checking Pattern
```typescript
// General pattern used throughout codebase
const canPerformAction = ['role1', 'role2', 'role3'].includes(userRole);

if (!canPerformAction) {
  toast({
    title: "Access Denied",
    description: "You do not have permission to perform this action.",
    variant: "destructive",
  });
  return;
}
```

### Available Actions Endpoint
**Location**: [src/services/api.ts](src/services/api.ts) line 465
- **Endpoint**: `GET /mrfs/{id}/available-actions`
- **Response**: Returns AvailableActions interface with action permissions
- **Usage**: Dynamically determines what actions user can perform on MRF

---

## TODO / FIXME Comments & Known Issues

### 1. File Upload Issues
- **File Download for Vendor Documents** - [src/pages/VendorRegistrationReview.tsx](src/pages/VendorRegistrationReview.tsx) line 238
  - Status: Endpoint handler missing backend support
  - Action: Implement backend download endpoint

### 2. Vendor Portal RFQ Endpoint
- **Location**: [src/pages/VendorPortal.tsx](src/pages/VendorPortal.tsx) line 216
  - Issue: `/api/vendors/quotations` endpoint may not exist on backend yet
  - Fallback: Uses context quotations if 404 occurs

### 3. S3 Storage Configuration
- **Location**: [src/services/api.ts](src/services/api.ts) - Vendor registration error handling
  - Status: Frontend can detect S3 errors but no control over configuration
  - Action: Backend team to verify AWS S3 setup and IAM roles

### 4. Logistics Dashboard Stats
- **Location**: [src/pages/Logistics.tsx](src/pages/Logistics.tsx) line 67
  - Issue: Falls back to manual calculation if API stats unavailable
  - Data source: Multiple API calls to trips, vehicles, staff

### 5. MRF Workflow Permission Verification
- **Location**: [src/pages/Procurement.tsx](src/pages/Procurement.tsx) line 569
  - Comment: "backend permission might be checking for later stages"
  - Action: Verify backend workflow state transitions match frontend expectations

---

## Backend API Base URL Configuration

**Location**: [src/services/api.ts](src/services/api.ts) line 16
```typescript
const getApiBaseUrl = () => {
  // Uses VITE_API_BASE_URL environment variable if set
  if (import.meta.env.VITE_API_BASE_URL) {
    return processedUrl;
  }
  
  // Defaults to deployed backend
  return 'https://supply-chain-backend-hwh6.onrender.com/api';
}
```

**Environment Setup**: Create `.env` file with:
```
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## Export Functionality

**Location**: [src/utils/exportData.ts](src/utils/exportData.ts)

**Supported Formats**:
- CSV export
- Excel (XLS) export with BOM for UTF-8 compatibility
- JSON export

**Exported Reports**:
- MRFs Report
- SRFs Report
- RFQs Report
- Quotations Report
- Vendors Report

**Implementation Example**:
```typescript
export function exportToCSV<T extends Record<string, any>>(data: T[], filename: string) {
  const csvContent = [[...Object.keys(data[0])], ...data.map(Object.values)];
  downloadFile(csvContent.join('\n'), `${filename}.csv`, 'text/csv');
}
```

---

## Key Files Summary

| Feature | Primary File | Secondary Files |
|---------|-------------|-----------------|
| **Logistics Module** | [src/pages/Logistics.tsx](src/pages/Logistics.tsx) | logisticsApi.ts, components/logistics/* |
| **File Uploads** | [src/services/api.ts](src/services/api.ts) | Various components |
| **Vendor Management** | [src/pages/Vendors.tsx](src/pages/Vendors.tsx) | [src/services/api.ts](src/services/api.ts), components/EnhancedVendorRegistration.tsx |
| **User Management** | [src/pages/UserManagement.tsx](src/pages/UserManagement.tsx) | [src/services/api.ts](src/services/api.ts), contexts/AuthContext.tsx |
| **Vendor Portal** | [src/pages/VendorPortal.tsx](src/pages/VendorPortal.tsx) | [src/services/api.ts](src/services/api.ts) |
| **Data Export** | [src/utils/exportData.ts](src/utils/exportData.ts) | Various pages |

---

## Implementation Status Summary

✅ **Implemented & Working**:
- Logistics module basic functionality (trips, journeys, materials)
- File upload for: PO, GRN, Quotations, Vendor Registration
- File download for: PO (unsigned & signed), Templates
- Vendor profile viewing and rating
- User management CRUD operations
- Role-based permission checks (frontend)
- Data export (CSV, Excel, JSON)

⚠️ **Partially Implemented**:
- Vendor document viewing (component exists, backend missing)
- Logistics reporting (structure defined, export pending)
- CSV bulk import (API defined, template system needs verification)

❌ **Not Implemented**:
- AWS S3 direct integration in frontend (backend responsibility)
- Advanced logistics KPI calculations
- Some vendor portal endpoints (quota endpoint)

