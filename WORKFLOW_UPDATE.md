# Updated MRF Workflow Specification

## Workflow Steps

### 1. Staff (Requester) - Create MRF
- **Role**: Staff/Employee
- **Actions**: 
  - Create MRF (Material Request Form)
  - Submit request
- **Cannot**: 
  - Edit after submission
  - Upload invoices at this stage
  - See procurement/finance actions
- **Workflow State**: `mrf_created`

### 2. Executive Review
- **Role**: Executive
- **Actions**:
  - View full MRF details
  - Approve MRF
  - Reject MRF with reason
- **Cannot**:
  - Edit MRF
  - See "Generate PO" button
  - See procurement actions
- **Workflow State After Approval**: `executive_approved` → Routes to Procurement

### 3. Procurement - Vendor Selection & RFQ
- **Role**: Procurement Manager
- **Actions**:
  - Review approved MRF
  - Select vendors
  - Create RFQ and send to vendors
  - View vendor responses (invoices)
- **Workflow State**: `procurement_review` → `vendor_selected` (after RFQ sent)

### 4. Vendors - Submit Invoices
- **Role**: Vendor (External)
- **Actions**:
  - Receive RFQ notification
  - Submit invoice/price quote
- **Workflow State**: `invoice_received` (when vendor submits)

### 5. Procurement - Select Preferred Vendor
- **Role**: Procurement Manager
- **Actions**:
  - Review all vendor invoices
  - Select preferred vendor/invoice
  - **Send selected vendor to Supply Chain Director for approval**
- **Workflow State**: `vendor_selected` → `vendor_selection_pending_approval` (sent to Supply Chain)

### 6. Supply Chain Director - Approve Vendor Selection
- **Role**: Supply Chain Director
- **Actions**:
  - Review Procurement's vendor selection
  - Approve selected vendor
  - Reject vendor selection (returns to Procurement)
- **Workflow State After Approval**: `invoice_approved` → Routes back to Procurement

### 7. Procurement - Generate PO
- **Role**: Procurement Manager
- **Actions**:
  - Generate Purchase Order (only after Supply Chain Director approval)
  - Attach signed PO document
- **Cannot**: Generate PO before Supply Chain Director approval
- **Workflow State**: `po_generated` → Routes to Supply Chain Director

### 8. Supply Chain Director - Review & Sign PO
- **Role**: Supply Chain Director
- **Actions**:
  - Download PO from Procurement
  - Review PO
  - Upload signed PO
- **Cannot**: Generate PO (only Procurement can)
- **Workflow State**: `po_signed` → Routes to Finance

### 9. Finance - Process Payment
- **Role**: Finance Officer
- **Actions**:
  - Review PO
  - Review vendor invoice
  - Process payment
  - Mark as "Processed"
- **Cannot**: 
  - Generate PO
  - See procurement actions
  - See executive actions
- **Workflow State**: `payment_processed` → Routes back to Finance (for GRN)

### 10. Finance - Request GRN
- **Role**: Finance Officer
- **Actions**:
  - Track delivery based on PO expected date
  - Request Goods Received Note (GRN) from Procurement
- **Workflow State**: `grn_requested` → Routes to Procurement

### 11. Procurement - Upload GRN
- **Role**: Procurement Manager
- **Actions**:
  - Upload GRN document after goods received
- **Workflow State**: `grn_completed` → Routes to Finance

### 12. Finance - Review GRN & Close
- **Role**: Finance Officer
- **Actions**:
  - Review GRN
  - Confirm goods received in good condition
  - Mark MRF as Closed
- **Workflow State**: `closed`

## Access Control Rules

### Role-Based Visibility

**Staff/Employee:**
- ✅ Can see: Create MRF, View own MRFs
- ❌ Cannot see: Generate PO, Approve/Reject, Process Payment, Any procurement/finance actions

**Executive:**
- ✅ Can see: Review MRFs, Approve/Reject buttons
- ❌ Cannot see: Generate PO, Vendor selection, Finance actions, Procurement actions (except viewing)

**Procurement Manager:**
- ✅ Can see: Vendor selection, RFQ creation, Invoice review, Generate PO (after approval), Upload GRN
- ❌ Cannot see: Executive approve/reject buttons, Finance process payment, Supply Chain sign PO

**Supply Chain Director:**
- ✅ Can see: Approve vendor selection, Download PO, Upload signed PO
- ❌ Cannot see: Generate PO button, Vendor selection interface, Finance actions

**Finance Officer:**
- ✅ Can see: Review PO, Review invoices, Process payment, Request GRN, Review GRN
- ❌ Cannot see: Generate PO, Approve/Reject MRF, Vendor selection

## Workflow States

```
mrf_created → executive_review → executive_approved → procurement_review → vendor_selected → 
invoice_received → vendor_selection_pending_approval → invoice_approved → po_generated → 
po_signed → payment_processed → grn_requested → grn_completed → closed
```

## Permission Checks

- All actions must be checked against backend `getAvailableActions` endpoint
- Frontend should hide buttons (not disable) when actions are unavailable
- Backend is the source of truth for all permissions
- Each role can only see actions they are authorized to perform
