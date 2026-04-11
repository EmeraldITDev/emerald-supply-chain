# Backend Requirements — Supply Chain UI Fixes

This document lists backend changes required by the frontend UI fixes implemented in this task. Each section maps to a specific frontend change. Items are marked **Blocking** (frontend feature will not work without this) or **Non-blocking** (frontend handles gracefully but backend should be updated for consistency).

---

## Section 2 — SCD Approval Badge & Details Box

**What the frontend needs:** SCD (Supply Chain Director) approval data fields in MRF API response when SCD has approved an MRF.

**Required fields in `GET /mrfs` and `GET /mrfs/{id}` response:**
- `scd_approved_by` (string — approver name)
- `scd_approved_at` (ISO 8601 timestamp)
- `scd_remarks` (string — approval remarks)

**Frontend defensive handling:** The frontend checks for multiple possible field names:
- Name: `scd_approved_by || director_approved_by || supply_chain_approved_by`
- Timestamp: `scd_approved_at || director_approved_at || supply_chain_approved_at`
- Remarks: `scd_remarks || director_remarks || supply_chain_remarks`

The SCD approval box in the View Details dialog renders **only if** at least one name field resolves to a truthy value. Timestamp and remarks display "N/A" if absent but name is present.

**Priority:** **Blocking** — SCD approval box in View Details will not render without these fields. The purple "SCD Approved" badge on MRF cards works independently via `last_action_by_role === 'supply_chain_director'`.

---

## Section 3 — Rejected MRF Edit & Resubmit

**What the frontend needs:** `POST /mrfs/{id}/resubmit` endpoint

**Required backend change:** Create a controller method that:
1. Accepts updated MRF fields (request body below)
2. Resets `workflow_state` to `"submitted"`
3. Clears `rejection_reason`, `rejection_remarks`
4. Sets `is_resubmission = true`
5. Re-routes the MRF based on `contract_type` (Emerald → Executive review, Non-Emerald → SCD review)

**Request body fields:**
- `title` (string, optional)
- `description` (string, optional)
- `quantity` (integer, optional)
- `estimated_cost` (decimal, optional)
- `justification` (string, optional)
- `category` (string, optional)

All fields are optional — only changed fields need to be sent. The endpoint must also reset workflow state and clear rejection data as described above.

**Priority:** **Blocking** — The Edit & Resubmit dialog is built and rendered on the frontend, but the submit button calls `POST /mrfs/{id}/resubmit` which does not exist yet. The frontend shows a graceful error toast when the endpoint returns an error.

---

## Section 4 — Quotation Fields Showing N/A

**What the frontend needs:** The following fields included in quotation API responses (`GET /rfqs/{id}/quotations` and within `GET /mrfs/{id}/full-details`):
- `delivery_days` (integer)
- `payment_terms` (string)
- `total_order_value` (decimal)

**Frontend defensive handling:** The frontend already checks multiple field name variants:
- Total: `totalAmount || total_amount || price || total_order_value || totalOrderValue`
- Delivery: `delivery_days || deliveryDays`, with fallback calculation from `delivery_date`
- Payment: `payment_terms || paymentTerms || payment_terms_text`

**Required backend change:** Confirm that `QuotationResource` (Laravel) includes these fields. If any are missing, add them to the resource transformation.

**Priority:** **Blocking if fields are absent from API response** — The frontend fallback chain is comprehensive but cannot display data the API does not return.

---

## Section 6 — Role Standardization

**What the backend needs:**
```sql
UPDATE users SET role = 'employee' WHERE role IN ('general_employee', 'regular_staff', 'staff');
```

Also update the role check constraint to only allow the canonical role name `'employee'` instead of the variants.

**Frontend handling:** The frontend `isEmployeeRole()` function now accepts all four variants (`employee`, `general_employee`, `regular_staff`, `staff`), so this change is backwards-compatible.

**Priority:** **Non-blocking** — Frontend handles all variants gracefully, but the database should be standardized to prevent drift.
