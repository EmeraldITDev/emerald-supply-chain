# Workflow Implementation Plan

## Current Backend State (Already Supports the Flow!)

The backend already has the correct workflow states:
- `vendor_selected` - After Procurement selects vendor and sends to Supply Chain Director
- `invoice_approved` - After Supply Chain Director approves vendor selection
- `po_generated` - After Procurement generates PO

## Required Updates

### Backend (Minor Clarifications)

1. **PermissionService.php** - Already correct:
   - `canApproveInvoice` (Supply Chain Director) checks for `STATE_VENDOR_SELECTED` ✅
   - `canGeneratePO` (Procurement) checks for `STATE_INVOICE_APPROVED` ✅

2. **Add Endpoint** - `POST /api/mrfs/{id}/send-vendor-for-approval`
   - Called by Procurement when selecting preferred vendor
   - Sets state to `vendor_selected`
   - Sends notification to Supply Chain Director

3. **Update Endpoint** - `POST /api/mrfs/{id}/approve-vendor-selection`
   - Called by Supply Chain Director to approve vendor
   - Sets state to `invoice_approved`
   - Returns to Procurement

### Frontend Updates

1. **Procurement Page**:
   - When vendor/invoice is selected, show "Send to Supply Chain Director" button
   - Hide "Generate PO" button until Supply Chain Director approval
   - Only show "Generate PO" when `canGeneratePO` is true (after approval)

2. **Supply Chain Dashboard**:
   - Show pending vendor selections awaiting approval
   - Show "Approve Vendor Selection" button when `canApproveInvoice` is true
   - After approval, MRF returns to Procurement for PO generation

3. **Executive Dashboard**:
   - Remove any PO generation buttons (should never see them)
   - Only show Approve/Reject buttons

4. **Department Dashboard (Staff)**:
   - Remove any procurement/finance actions
   - Only show own MRFs, view status

5. **Finance Dashboard**:
   - Remove any PO generation buttons
   - Remove any executive approval buttons
   - Only show payment processing and GRN actions

## Action Visibility Matrix

| Action | Staff | Executive | Procurement | Supply Chain Director | Finance |
|--------|-------|-----------|-------------|----------------------|---------|
| Create MRF | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve/Reject MRF | ❌ | ✅ | ❌ | ❌ | ❌ |
| Select Vendors | ❌ | ❌ | ✅ | ❌ | ❌ |
| Send Vendor to Supply Chain | ❌ | ❌ | ✅ | ❌ | ❌ |
| Approve Vendor Selection | ❌ | ❌ | ❌ | ✅ | ❌ |
| Generate PO | ❌ | ❌ | ✅ (after approval) | ❌ | ❌ |
| Sign PO | ❌ | ❌ | ❌ | ✅ | ❌ |
| Process Payment | ❌ | ❌ | ❌ | ❌ | ✅ |
| Request GRN | ❌ | ❌ | ❌ | ❌ | ✅ |
| Upload GRN | ❌ | ❌ | ✅ | ❌ | ❌ |

## Implementation Steps

1. ✅ Create workflow documentation
2. ⏳ Add backend endpoint for sending vendor to Supply Chain Director
3. ⏳ Update frontend Procurement page to send vendor for approval
4. ⏳ Update Supply Chain Dashboard to approve vendor selections
5. ⏳ Ensure all dashboards hide unauthorized actions
6. ⏳ Test complete workflow end-to-end
