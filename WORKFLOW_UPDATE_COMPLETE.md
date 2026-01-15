# Workflow Update Implementation Summary

## Overview

The workflow has been updated to match the new requirements where Supply Chain Director must approve vendor selections before Procurement can generate POs.

## Updated Workflow Flow

1. **Staff creates MRF** → `mrf_created`
2. **Executive approves** → `executive_approved` → Routes to Procurement
3. **Procurement selects vendors and sends RFQ** → `procurement_review` → `vendor_selected`
4. **Vendors submit invoices** → `invoice_received`
5. **Procurement selects preferred vendor** → Sets state to `vendor_selected` → **Sends to Supply Chain Director**
6. **Supply Chain Director approves vendor selection** → `invoice_approved` → Routes back to Procurement
7. **Procurement generates PO** (only after Supply Chain Director approval) → `po_generated`
8. **Supply Chain Director reviews and signs PO** → `po_signed` → Routes to Finance
9. **Finance processes payment** → `payment_processed`
10. **Finance requests GRN** → `grn_requested` → Routes to Procurement
11. **Procurement uploads GRN** → `grn_completed` → Routes to Finance
12. **Finance reviews GRN and closes** → `closed`

## Frontend Updates Completed

### 1. Supply Chain Dashboard ✅
- **Added**: Vendor Selections Pending Approval section
- **Shows**: MRFs with vendor selections awaiting Supply Chain Director approval
- **Actions**: Approve/Reject vendor selection buttons (only when `canApproveInvoice` is true)
- **PO Section**: Shows POs awaiting signature (only when `po_generated` state)

### 2. API Services ✅
- **Added**: `sendVendorForApproval()` - Procurement sends vendor to Supply Chain Director
- **Added**: `approveVendorSelection()` - Supply Chain Director approves vendor
- **Added**: `rejectVendorSelection()` - Supply Chain Director rejects vendor selection

### 3. Components ✅
- **Created**: `SupplyChainVendorApprovalButtons` - Component for approving vendor selections
- **Updated**: `SupplyChainActionButtons` - Handles PO signing actions

### 4. Permission Checks ✅
- **All actions check** `getAvailableActions()` before proceeding
- **Buttons are hidden** (not disabled) when actions are unavailable
- **Backend is source of truth** for all permissions

## Backend Requirements (To Be Implemented)

The backend `PermissionService.php` already has the correct logic:
- `canApproveInvoice` checks for `STATE_VENDOR_SELECTED` ✅
- `canGeneratePO` checks for `STATE_INVOICE_APPROVED` ✅

**Backend endpoints needed**:
1. `POST /api/mrfs/{id}/send-vendor-for-approval` - When Procurement selects vendor
2. `POST /api/mrfs/{id}/approve-vendor-selection` - When Supply Chain Director approves
3. `POST /api/mrfs/{id}/reject-vendor-selection` - When Supply Chain Director rejects

## Role-Based Access Control

### Staff/Employee
- ✅ Can: Create MRF, View own MRFs
- ❌ Cannot: See Generate PO, Approve/Reject, Process Payment, Any procurement/finance actions

### Executive
- ✅ Can: Review MRFs, Approve/Reject MRF
- ❌ Cannot: See Generate PO button, Vendor selection, Finance actions

### Procurement Manager
- ✅ Can: Select vendors, Send RFQ, Review invoices, Send vendor to Supply Chain Director, Generate PO (after approval), Upload GRN
- ❌ Cannot: See Executive approve buttons, Finance process payment

### Supply Chain Director
- ✅ Can: Approve vendor selections, Download PO, Upload signed PO, Reject PO/vendor selection
- ❌ Cannot: Generate PO button, Vendor selection interface, Finance actions

### Finance Officer
- ✅ Can: Review PO, Review invoices, Process payment, Request GRN, Review GRN
- ❌ Cannot: Generate PO, Approve/Reject MRF, Vendor selection

## Key Principles Applied

1. ✅ **Always fetch available actions** - Never hardcode permissions
2. ✅ **Hide, don't disable** - Remove buttons entirely if action unavailable
3. ✅ **Backend is source of truth** - Frontend only reflects backend permissions
4. ✅ **Strict role-based visibility** - Users never see actions they can't perform

## Testing Checklist

- [ ] Staff cannot see Generate PO button
- [ ] Executive cannot see Generate PO button
- [ ] Procurement can only generate PO after Supply Chain Director approval
- [ ] Supply Chain Director can approve vendor selections
- [ ] Supply Chain Director cannot see Generate PO button
- [ ] Finance cannot see Generate PO or Approve MRF buttons
- [ ] All buttons are hidden (not disabled) when unavailable

## Notes

- The backend workflow states already support this flow (`vendor_selected` → `invoice_approved` → `po_generated`)
- The frontend now correctly shows/hides actions based on available permissions
- When Procurement selects a vendor via RFQ, it should automatically set state to `vendor_selected` and notify Supply Chain Director
- Supply Chain Director's approval sets state to `invoice_approved`, allowing Procurement to generate PO
