# TESTING GUIDE: Four Critical Areas

**Last Updated**: March 31, 2026  
**Environment**: Development/Staging  
**Prerequisites**: Backend running, test user accounts available

---

## TEST SCENARIO 1: User Management - Role Assignment

### Setup
```
Admin user logged in
User Management page accessible
```

### Test Case 1.1: Create Procurement Manager User

**Start**: User Management page > Click "Add User"

**Steps**:
1. Enter Name: `John Procurement Manager`
2. Enter Email: `john.procure@test.local`
3. Select Role: `procurement_manager`
4. Enter Department: `Procurement`
5. Enter Password: `TestPassword123!`
6. Click "Submit"

**Expected Result**: 
- Toast: "User created successfully with role: procurement_manager"
- Console logs (DevTools):
  - `Creating user with data: {name: 'John Procurement Manager', email: '...', role: 'procurement_manager', ...}`
  - No role mismatch warnings
- User appears in table with role: `procurement_manager`

**Verify in Database**:
```sql
SELECT id, email, role FROM users 
WHERE email = 'john.procure@test.local';
-- Expected: role = 'procurement_manager'
```

**Verify in Backend Logs**:
```
[OK] User created: john.procure@test.local with role procurement_manager
```

**If Fails**: 
- Check console for role mismatch warning
- Verify backend created user with correct role
- Check if role is a valid option in system

---

### Test Case 1.2: Login as Created User

**Start**: Logout current user, Auth page displayed

**Steps**:
1. Enter Email: `john.procure@test.local`
2. Enter Password: `TestPassword123!`
3. Click "Login"

**Expected Result**:
- Login succeeds
- Redirect to: Procurement Dashboard (or default dashboard)
- User menu (top-right) shows: `John Procurement Manager - procurement_manager`
- Console logs (DevTools):
  ```
  Token role: procurement_manager
  User role: procurement_manager
  AuthContext user: {id: X, role: 'procurement_manager', ...}
  ```

**If Fails**:
- Check login error message
- Verify correct password
- Check backend auth logs for JWT generation issues

---

### Test Case 1.3: Access Control - Procurement Features

**Start**: Logged in as Procurement Manager

**Access**: Click on `Procurement` in main navigation

**Expected Result**:
- Page loads successfully
- Can see: MRF list, RFQs, Quotations, vendors
- Cannot see: Finance-only pages (e.g., Accounts Payable)

**Test Prohibited Access**:
1. Try to navigate to: `Finance` > `Accounts Payable`
2. Expected: Access denied message or redirect

**If Fails**:
- Verify AuthContext has correct role
- Check permission check in Finance components
- Verify role string matches exactly (case-sensitive)

---

### Test Case 1.4: Create Multiple Users with Different Roles

**Steps**: Repeat Test 1.1-1.2 for each role:
- `finance` → Finance Manager
- `executive` → Executive User
- `chairman` → Chairman
- `supply_chain_director` → Supply Chain Director
- `logistics` → Logistics Manager

**Verify Each Can**:
- Login successfully
- Access role-specific pages
- View correct notification types
- Perform role-specific actions

**Success Criteria**: All 5+ roles created, assigned, and enforced correctly

---

## TEST SCENARIO 2: Vendor Document Download

### Setup
```
2 vendor registrations in system (one approved, one pending approval)
Test files uploaded: PDF, DOC, DOCX
Procurement user logged in
```

### Test Case 2.1: Upload Vendor Documents During Registration

**Start**: New Vendor Registration page

**Steps**:
1. Fill basic info:
   - Company: `Test Vendor Corp`
   - Email: `test@vendor.local`
   - Category: `Materials Supplier`
2. Click "Add Document"
3. Upload file: `certificate.pdf` (type: Certificate)
4. Upload file: `tax_registration.pdf` (type: Tax Document)
5. Click "Submit Registration"

**Expected Result**:
- Toast: "Registration submitted successfully"
- Documents visible in list
- Files uploaded to S3 (backend logs should confirm)

**Verify in S3**:
```bash
aws s3 ls s3://your-bucket/vendors/
# Should see: certificate.pdf, tax_registration.pdf
```

---

### Test Case 2.2: Download from Registration Review

**Start**: Vendor Registrations > Pending

**Steps**:
1. Find registration from Test 2.1
2. Click "View" or "Details"
3. Scroll to "Documents" section
4. Click "Download" on `certificate.pdf`

**Expected Result**:
- Browser initiates download
- File saved to Downloads folder: `certificate.pdf`
- File can be opened (is not corrupted)
- Toast (optional): "Download successful"

**If 404 Error**:
- Backend endpoint not yet implemented
- Check browser console for exact error
- Note: Frontend is ready, backend needs implementation

**If Download Works**:
- Backend endpoint successfully implemented ✅
- Test approval/rejection workflow

---

### Test Case 2.3: Download from Vendor Profile

**Start**: Vendors page > List view

**Steps**:
1. Find registered vendor from Test 2.1
2. Click vendor row or "View" button
3. Scroll to "Uploaded Documents"
4. Click "Download" on document

**Expected Result**:
- Same as Test 2.2
- File downloads successfully

---

### Test Case 2.4: Access Control - Non-Procurement Users

**Start**: Logged in as `Finance` user (not procurement)

**Steps**:
1. Try to access vendor registrations page
2. Try to view vendor documents
3. Click download on any document

**Expected Result**:
- Access denied message
- Cannot view registration details
- Cannot download documents

**If Succeeds**: Access control not properly enforced

---

## TEST SCENARIO 3: File Attachments (MRF Workflow)

### Setup
```
MRF created and approved (ready for PO generation)
Procurement Manager logged in
PDF file prepared (< 10MB)
```

### Test Case 3.1: Upload PO

**Start**: MRF Details page > "Generate PO" section

**Steps**:
1. Enter PO Number: `PO-2026-001`
2. Click "Select File" / "Upload PO"
3. Select: `sample_po.pdf`
4. Click "Generate PO"

**Expected Result**:
- Toast: "PO generated successfully" or similar
- PO appears in system
- File uploaded to S3 (backend confirmation)

**Test Invalid File**:
- Try uploading `.txt` file
- Expected: "Invalid file type" error
- Try uploading 15MB file
- Expected: "File too large" error

**Verify Upload**:
```bash
aws s3 ls s3://your-bucket/pos/
# Should see newly uploaded file with unique name
```

---

### Test Case 3.2: Download PO

**Start**: Same MRF Details page, after Test 3.1

**Steps**:
1. Click "Download PO" button
2. Select "Unsigned PO"

**Expected Result**:
- File downloads: `PO-2026-001.pdf` (or similar)
- File can be opened and verified

---

### Test Case 3.3: Upload Signed PO

**Start**: Same MRF, Supply Chain Director view

**Steps**:
1. Click "Upload Signed PO" 
2. Select: `sample_po_signed.pdf`
3. Click "Upload"

**Expected Result**:
- Toast: "Signed PO uploaded"
- PO status updates
- File in S3

---

### Test Case 3.4: Vendor Quotation with Attachments

**Start**: RFQ sent to vendors, vendor responding

**Steps**:
1. As Vendor: Navigate to RFQ
2. Fill quota information
3. Click "Add Attachment"
4. Upload: `quotation_support.pdf`
5. Click "Submit Quotation"

**Expected Result**:
- Toast: "Quotation submitted successfully"
- Attachment uploaded and visible
- Procurement can view attachment

---

## TEST SCENARIO 4: Vendor Registration Review Workflow

### Setup
```
Multiple vendor registrations in system:
- Status: Pending (3)
- Status: Approved (2)
- Status: Rejected (1)
Procurement/Admin user logged in
```

### Test Case 4.1: Review Pending Registration

**Start**: Vendor Registrations > Pending tab

**Steps**:
1. Click on a pending registration
2. Read all information
3. Check documents section
4. Try to download each document

**Expected Result**:
- All info displays correctly
- Documents listed with filenames
- Download button visible for each
- Document downloads successfully

---

### Test Case 4.2: Approve Registration

**Start**: Same pending registration view

**Steps**:
1. Scroll to "Action" section
2. (Optional) Add comment: "All documents verified"
3. Click "Approve" button

**Expected Result**:
- Toast: "Registration approved"
- Status changes to: "Approved"
- Vendor email sent (check backend logs)
- Temporary password sent to vendor

---

### Test Case 4.3: Reject Registration

**Start**: Different pending registration

**Steps**:
1. Add comment: "Missing tax certificate"
2. Click "Reject" button
3. Confirm rejection in dialog

**Expected Result**:
- Toast: "Registration rejected"
- Status changes to: "Rejected"
- Reflection reason stored
- Vendor notified (check email)

---

## TEST SCENARIO 5: Permission Enforcement

### Setup
```
5 users created with different roles:
- Employee (no special access)
- Procurement Manager
- Finance Officer  
- Executive
- Admin
```

### Test Case 5.1: Employee User Restrictions

**Start**: Logged in as Employee

**Steps**:
Try to access:
- [ ] Procurement page → Expected: Access denied or limited view
- [ ] Finance dashboard → Expected: Access denied
- [ ] Vendor approval → Expected: Access denied
- [ ] Dashboard alerts → Expected: Only emp-level alerts

---

### Test Case 5.2: Procurement Manager Permissions

**Start**: Logged in as Procurement Manager

**Steps**:
Verify access to:
- [ ] Procurement page → Expected: Full access
- [ ] MRF management → Expected: Can approve/reject
- [ ] RFQ management → Expected: Can create/send
- [ ] Vendor approval → Expected: Can approve vendors
- [ ] Finance page → Expected: Access denied

---

### Test Case 5.3: Finance Officer Permissions

**Start**: Logged in as Finance Officer

**Steps**:
Verify access to:
- [ ] Finance dashboard → Expected: Full access
- [ ] Accounts Payable → Expected: Full access
- [ ] Payment approval → Expected: Can approve
- [ ] Procurement page → Expected: Limited/read-only
- [ ] Vendor approval → Expected: Access denied

---

### Test Case 5.4: Executive Permissions

**Start**: Logged in as Executive

**Steps**:
Verify access to:
- [ ] Executive dashboard → Expected: Full access
- [ ] MRF approval (executive level) → Expected: Can approve/reject
- [ ] All reports → Expected: Read access
- [ ] Vendor management → Expected: Full access
- [ ] User management → Expected: Can view/create users

---

## ISSUE DETECTION & RESOLUTION

### Issue: Login fails after user creation

**Debug Steps**:
1. Verify user exists in database:
   ```sql
   SELECT * FROM users WHERE email = 'test@test.local';
   ```
2. If not found → User creation endpoint not working
3. If found → Check password hashing
4. Check backend login logs for error message
5. Check if 401/403 response from backend

---

### Issue: Role appears in database but not in JWT

**Check**:
1. Backend user creation code includes role
2. JWT generation includes role in claims
3. Example JWT structure:
   ```json
   {
     "user_id": 1,
     "email": "john@test.local",
     "role": "procurement_manager",
     "exp": 1234567890
   }
   ```
4. If missing → Backend dev: add role to JWT claims

---

### Issue: User can login but can't access procurement features

**Check**:
1. Verify JWT token includes role (DevTools > Storage > LocalStorage > authToken)
2. Decode token: `atob(token.split('.')[1])`
3. Check role value matches exactly (case-sensitive)
4. Verify permission check contains that role:
   ```typescript
   ['procurement_manager', 'executive', ...].includes(role)
   ```
5. Check console for permission errors

---

### Issue: Vendor document download returns 404

**Check**:
1. Is backend endpoint implemented?
   - URL: `/vendors/registrations/{id}/documents/{documentId}/download`
   - Method: GET
   - Auth: Bearer token required
   
2. If not implemented:
   - Use S3 direct URL (backend stores in document.file_url)
   - Frontend code tries S3 URL first, then API endpoint

3. If implemented:
   - Verify document exists in database
   - Verify file exists in S3
   - Verify authorization check passes

---

## QUICK TEST CHECKLIST

### User Management (✅ Can test now)
- [ ] Create procurement_manager user
- [ ] Login as user
- [ ] Access procurement features
- [ ] Verify role in JWT token
- [ ] Create finance user and verify restrictions

### Vendor Documents (⚠️ Needs backend endpoint)
- [ ] Upload vendor doc (works now)
- [ ] Try to download (may fail if endpoint missing)
- [ ] Check backend endpoint exists
- [ ] Once implemented, verify download works

### File Attachments (✅ Can test now)
- [ ] Upload PO file
- [ ] Upload quotation attachment
- [ ] Verify files in S3
- [ ] Download files back

### Permissions (✅ Can test now)
- [ ] Test each role can/cannot access pages
- [ ] Verify permission errors clear
- [ ] Check audit logs if available

---

## EXPECTED RESULTS SUMMARY

| Test | Passes | Partial | Fails | Notes |
|------|--------|---------|-------|-------|
| User creation with role | ✅ | - | - | Logging added |
| User login & role | ✅ | ⚠️ | ❌ | Check JWT includes role |
| Procurement access | ✅ | - | - | Permission checks working |
| Vendor doc upload | ✅ | - | - | FormData working |
| Vendor doc download | ⚠️ | - | ❌ | Backend endpoint needed |
| PO file upload | ✅ | - | ⚠️ | Check S3 config |
| PO file download | ✅ | - | ⚠️ | Check S3 config  |
| Permission enforcement | ✅ | - | - | Hardcoded checks |

---

## SIGN-OFF CRITERIA

All tests pass and following criteria met:
- [ ] User roles assigned correctly at creation
- [ ] Users can login with assigned role  
- [ ] Role-based access control enforced
- [ ] Vendor documents downloadable
- [ ] File attachments upload successfully
- [ ] File attachments download successfully
- [ ] Permissions enforced for all user types
- [ ] No console errors in any flow
- [ ] Performance acceptable (< 2s load times)

System ready for production deployment when all criteria met.

---

*Document Version: 1.0*  
*Test Environment: Staging / Local Dev*  
*Date: March 31, 2026*
