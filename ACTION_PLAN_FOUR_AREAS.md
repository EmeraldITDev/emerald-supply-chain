# ACTION PLAN: Four Critical System Areas

**Last Updated**: March 31, 2026  
**Status**: Implementation Phase

---

## AREA 1: LOGISTICS MODULE — CSV Import & Report Generation

### 1.1 CSV Import - Add Preview Screen ❌

**Current State**:
- CSV bulk upload endpoints exist: `POST /trips/bulk-upload` and `POST /materials/bulk-upload`
- Frontend has `CSVImportPreview` component imported but not fully implemented
- Currently uploads directly without user verification

**Required Implementation**:
1. Parse CSV file on client-side before uploading
2. Display preview of parsed records with sample data
3. Show validation errors/warnings for problematic records
4. Allow user to review and confirm before sending to backend

**Files to Modify**:
- `src/components/logistics/TripScheduling.tsx` - Wire up CSVImportPreview
- `src/components/logistics/MaterialsTracking.tsx` - Add materials CSV preview
- `src/components/logistics/CSVImportPreview.tsx` - Ensure all validations work

**Implementation Steps**:
```typescript
// Flow: User selects file → Parse CSV → Show preview → Confirm → Upload
// Handle:
// - CSV parsing (XLSX library already included)
// - Column matching (Trip headers: origin, destination, departure, etc.)
// - Validation errors per row
// - Success/error/warning indicators
// - Confirmation dialog before final upload
```

---

### 1.2 Report Generation - Implement 5 Categories ❌

**Current State**:
- Report endpoint exists: `POST /reports`
- Basic structure with attachments field (JSONB storage)
- Export functionality defined but not fully implemented

**Required Categories**:
1. **Trips Report** - Trip summary with statistics (count, distance, cost, status breakdown)
2. **Journeys Report** - Journey tracking detail (routes, times, incidents)
3. **Fleet Report** - Vehicle utilization (availability, maintenance, costs)
4. **Materials Report** - Material tracking and consumption
5. **Holistic/Summary Report** - Combined KPIs and trends

**Files to Modify**:
- `src/components/logistics/ReportingCompliance.tsx` - Add report generation UI
- `src/services/logisticsApi.ts` - Add report generation methods
- `src/utils/exportData.ts` - Add logistics-specific export formats

**Implementation Steps**:
1. Add category selection UI
2. For each category:
   - Query relevant data from backend
   - Format data into report structure
   - Calculate summary statistics
   - Generate export (PDF/Excel)
3. Store report with attachments field
4. Implement export as PDF/Excel with proper formatting

**Data Requirements**:
```
Trips Report:
  - Total trips, completed, pending
  - Total distance, average duration
  - Breakdown by vehicle type, status
  - Top routes

Journeys Report:
  - Journey count, state breakdown
  - Incidents reported
  - Checkpoint data
  
Fleet Report:
  - Vehicle count by type
  - Utilization percentage
  - Maintenance schedule
  
Materials Report:
  - Material types tracked
  - Consumption by period
  - Stock levels
```

---

## AREA 2: FILE ATTACHMENTS — AWS Storage & Visibility

### 2.1 Verify File Upload/Download for MRF, SRF, PO ⚠️

**Current State**:
- Frontend uses FormData for all uploads (direct to backend)
- Backend handles S3 storage (frontend has no direct S3 integration)
- Endpoints implemented:
  - `POST /mrfs/{id}/generate-po` - PO upload
  - `POST /mrfs/{id}/upload-signed-po` - Signed PO
  - `POST /mrfs/{id}/complete-grn` - GRN upload
  - `POST /rfqs/{id}/submit-quotation` - Quotation attachments

**Issues to Investigate**:
1. ✓ Check if backend S3 configuration is correct
2. ✓ Identify file access errors (403, 500 responses)
3. ✓ Verify CORS settings for file downloads
4. ✓ Ensure proper error messages returned to frontend

**Files Involved**:
- `src/services/api.ts` - All file upload methods
- `src/components/POGenerationDialog.tsx` - PO upload UI
- `src/pages/Procurement.tsx` - PO workflow

**Frontend Validation Already in Place**:
```typescript
✓ PO: Max 10MB, PDF/DOC/DOCX only
✓ Vendor docs: Multi-file with type tracking
✓ Quotations: Multiple attachment support
✓ S3 error detection with user feedback
```

**Action Required**:
- Backend team: Verify AWS S3 configuration and IAM roles
- Backend team: Confirm CORS settings allow download from frontend domain
- Frontend: Add retry logic for failed downloads
- Frontend: Implement better S3 error messages

---

### 2.2 Vendor Files - AWS Storage & Access ⚠️

**Current State**:
- Vendor quotes: Stored via `POST /rfqs/{id}/submit-quotation`
- Vendor registration docs: Stored via `POST /vendors/register`
- Vendor files sent during registration stored in AWS

**Issues to Fix**:
1. **Vendor files cannot be opened** - Download endpoint missing
2. Need consistent access across user roles
3. Need proper error handling

**Files to Modify**:
- `src/pages/VendorRegistrationReview.tsx` - Document download (line 238)
- `src/pages/Vendors.tsx` - Vendor profile document viewing
- `src/services/api.ts` - Add vendor document download method

**Implementation**:
1. Create backend endpoint: `GET /vendors/registrations/{id}/documents/{documentId}/download`
2. Frontend already has code for this, just needs backend support:
   ```typescript
   const downloadEndpoint = `${apiBase}/vendors/registrations/${id}/documents/${documentId}/download`;
   ```

---

## AREA 3: VENDOR PROFILE — Document Visibility & Download

### 3.1 Fix Vendor Document Download ❌

**Current State** - [src/pages/VendorRegistrationReview.tsx](src/pages/VendorRegistrationReview.tsx#L238):
- Component tries to fetch documents via download endpoint
- Endpoint missing on backend: `GET /vendors/registrations/{id}/documents/{documentId}/download`
- Alternative: Check for direct S3 URLs in document objects

**Root Causes Identified**:
1. Backend endpoint not implemented
2. No S3 URL stored in vendor document object
3. No fallback mechanism for document access

**Fix Strategy**:
**Option A (Preferred)**: Backend implements download endpoint
- Endpoint: `GET /vendors/registrations/{id}/documents/{documentId}/download`
- Returns: File blob with proper Content-Disposition header

**Option B (Fallback)**: Store S3 URLs directly
- When storing vendor documents, store full S3 URL
- Frontend checks for `fileUrl` or `file_url` property
- Direct download via S3 URL (requires CORS)

**Files to Modify**:
- `src/pages/VendorRegistrationReview.tsx` - Implement Option A retry with Option B fallback
- `src/services/api.ts` - Add vendor document download method

**Implementation Code**:
```typescript
// Add to vendorApi in src/services/api.ts
vendorApi.downloadDocument = async (registrationId: string, documentId: string) => {
  const response = await fetch(
    `${API_BASE_URL}/vendors/registrations/${registrationId}/documents/${documentId}/download`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  if (response.ok) {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getFileNameFromHeader(response);
    link.click();
    URL.revokeObjectURL(url);
  }
}
```

---

### 3.2 Ensure Vendor Documents Visible to All Relevant Roles ✓

**Current State**:
- Vendor profile viewable via `GET /vendors/{id}`
- Documents data included in response
- Access control: Procurement, Executive, Vendor themselves

**Files Involved**:
- `src/pages/Vendors.tsx` - Vendor profile display
- `src/pages/VendorPortal.tsx` - Vendor self-view
- `src/pages/VendorRegistrationReview.tsx` - Approve/reject view

**Current Access**:
- Procurement staff: Can view all vendors
- Executive: Can view vendors
- Supply Chain: Can view vendors
- Vendor: Can view own profile

**Action Required**:
- Frontend: Once download endpoint works, documents will be visible
- Backend: Verify role-based access in `GET /vendors/{id}`

---

## AREA 4: USER MANAGEMENT — Role Permissions Not Applied

### 4.1 Debug Role Assignment Not Working ❌

**Current State** - [src/pages/UserManagement.tsx](src/pages/UserManagement.tsx):
- User creation sends role in request:
  ```typescript
  {
    name, email, role, department, password,
    is_admin: true, // Set for management roles
    can_manage_users: true
  }
  ```
- Frontend receives success response
- But backend may not be storing role correctly

**Identified Issue**:
- Endpoint: `POST /users` via `userApi.create()`
- Request includes `role` field
- **Backend may not be mapping role to user correctly**
- User stored in DB but role assignment fails silently

**Investigation Steps**:

1. **Check user creation response** from backend:
   - Response should include created user with role
   - Example: `{ id: 1, name: "John", role: "procurement_manager", ... }`

2. **Verify role storage** in database:
   - User table should have `role` column
   - Role should match one of: ["employee", "procurement_manager", "finance", "executive", "supply_chain_director", "chairman", "logistics", "admin"]

3. **Check JWT token** issued after login:
   - JWT should include: `{ user_id, role, permissions, ... }`
   - Token claims used for authorization

4. **Verify AuthContext** uses role:
   ```typescript
   // src/contexts/AuthContext.tsx
   const user = {
     id: decoded.user_id,
     role: decoded.role,  // ← This must come from JWT
     // ...
   }
   ```

**Files to Modify**:
- Add logging to `src/services/api.ts` - userApi.create()
- Debug `src/contexts/AuthContext.tsx` - Token parsing
- Check backend logs for user creation errors

---

### 4.2 Verify Permission Checking System ✓

**Current State**:
- Frontend checks hardcoded in components (10+ locations)
- Pattern: `['role1', 'role2'].includes(userRole)`
- Centralized available actions via `GET /mrfs/{id}/available-actions`

**Permission Checks Located In**:
- `src/components/DashboardAlerts.tsx` - Alert visibility
- `src/components/GRNModule.tsx` - GRN actions
- `src/components/MRFApprovalDialog.tsx` - MRF approval
- `src/pages/Procurement.tsx` - Procurement access
- `src/pages/UserManagement.tsx` - User management
- And 5+ other components

**Action Required**:
1. **Verify AuthContext loads user role correctly**:
   - After login, decode JWT and extract role
   - Store role in auth state
   - All components can access via `useAuth().user.role`

2. **Test role-based access**:
   - Create user with "procurement_manager" role
   - Login as that user
   - Verify procurement pages are accessible
   - Verify role restrictions work

3. **Debug permission check failures**:
   - Add console logs to confirm userRole value
   - Check if role matches exactly (case-sensitive)
   - Verify backend returns correct role in JWT

**Test Scenario**:
```typescript
// Test user creation
POST /users with role: "procurement_manager"

// Test login
POST /auth/login → JWT with role: "procurement_manager"

// Test access
GET /mrfs/1/available-actions → Should include RFQ send, PO generate, etc.
```

---

### 4.3 Fix Permission Application Flow 🔧

**Required Flow**:
```
1. Admin creates user with role "procurement_manager"
   └─> POST /users { name, email, role: "procurement_manager", password }

2. Backend stores user with role in database
   └─> Users table: id=15, name="John", role="procurement_manager"

3. User logs in
   └─> POST /auth/login { email, password }

4. Backend returns JWT with role
   └─> JWT payload: { user_id: 15, role: "procurement_manager", ... }

5. Frontend decodes JWT and extracts role
   └─> AuthContext.user = { id: 15, role: "procurement_manager", ... }

6. Components check role for permission
   └─> if (['procurement_manager', 'executive'].includes(userRole)) { ... }

7. API calls include necessary headers
   └─> Authorization: Bearer {JWT}

8. Backend checks role for API endpoint access
   └─> Only users with "procurement_manager" role can call /rfqs/{id}/send-quotations
```

**Files to Verify**:
- `src/contexts/AuthContext.tsx` - Role extraction from JWT
- `src/services/api.ts` - Token included in requests
- `src/pages/UserManagement.tsx` - User creation (lines 170-195)
- Backend: User role validation on endpoints

---

## Testing & Validation Strategy

### For Each Area:

**AREA 1 - Logistics**:
- [ ] Upload CSV with 5 trips, see preview modal
- [ ] Reject preview, file not uploaded
- [ ] Accept preview, trips created in system
- [ ] Generate Trips Report, verify data accuracy
- [ ] Generate Holistic Report, verify all categories included

**AREA 2 - File Attachments**:
- [ ] Upload PO, verify in AWS S3
- [ ] Download PO from system, matches original
- [ ] Upload vendor documents during registration
- [ ] Vendor documents downloadable from registration review
- [ ] Vendor files accessible by all relevant roles

**AREA 3 - Vendor Profile**:
- [ ] View vendor profile, documents listed
- [ ] Click "Download" on vendor document
- [ ] Document downloads successfully
- [ ] Multiple user roles can access documents

**AREA 4 - User Management**:
- [ ] Create user with "procurement_manager" role
- [ ] User created successfully in system
- [ ] User logs in with created credentials
- [ ] User role appears as "procurement_manager"
- [ ] User can perform procurement actions (view MRFs, send RFQ, etc.)
- [ ] User cannot access finance-only pages
- [ ] User can submit quotations (vendor role)

---

## Summary of Changes Required

| Area | Component | Change Type | Effort |
|------|-----------|------------|--------|
| Logistics | TripScheduling | Add preview UI | Medium |
| Logistics | MaterialsTracking | Add preview UI | Medium |
| Logistics | ReportingCompliance | Report generation | High |
| Files | VendorRegistrationReview | Fix download | Low |
| Files | API service | Add download method | Low |
| Vendor | VendorProfile | Visibility (already done) | None |
| User Mgmt | AuthContext | Debug role loading | Medium |
| User Mgmt | UserManagement | Verify creation | Low |

---

## Next Steps

1. **Start with Area 4** (shortest critical path):
   - Add debug logging to user creation
   - Verify JWT contains role
   - Test with Procurement Manager role

2. **Then Area 3**:
   - Implement backend download endpoint
   - Test vendor document access

3. **Then Area 2**:
   - Verify S3 uploads/downloads working
   - Test with multiple file types

4. **Finally Area 1**:
   - Implement CSV preview modals
   - Implement report generation
   - Test all report categories

---

*Document Version: 1.0*  
*Prepared for: Development Team*  
*Target Resolution: Sprint 5*
