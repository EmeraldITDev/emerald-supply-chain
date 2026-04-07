

# Revised Plan: MRF Workflow, Bug Fixes & Cleanup

Incorporates the three corrections from the user's feedback.

---

## Frontend Changes

### 1. Fix Build Error — `src/types/index.ts`
- Add `procurementManagerApprovalTime?: string` to the `MRF` interface (fixes TS2339 on `MRFApprovalDialog.tsx` line 62)
- Add `contract_type?: string` and `contractType?: string`
- Update `currentStage` union to: `'draft' | 'submitted' | 'executive_review' | 'director_review' | 'procurement_review' | 'rfq_sent' | 'quotes_received' | 'vendor_selected' | 'final_approval' | 'po_generated' | 'completed' | 'rejected'`
- Update `workflowState` union to match

### 2. Update `currentStage` in AppContext — `src/contexts/AppContext.tsx`
- Replace old union (`"submitted" | "procurement" | "executive" | "chairman" | "supply_chain" | "finance" | ...`) with the same set above. Removes `"finance"`.

### 3. Update MRF Progress Tracker — `src/components/MRFProgressTracker.tsx`
- 8 steps: MRF Created → Initial Approval (dynamic label: "Executive Approval" for Emerald, "SCD Approval" otherwise) → Procurement Review → RFQ Sent → Quotes Received → Final Approval → PO Generated → Completed

### 4. Re-enable Executive Approval for Emerald MRFs — `src/pages/ExecutiveDashboard.tsx`
- Show Approve/Reject buttons only when `isEmeraldContract(mrf) && status === 'executive_review'`
- Approve calls `mrfApi.executiveApprove(id, remarks)`; Reject calls new `mrfApi.executiveReject(id, reason)`
- Replace `vendorApi.getRegistrations()` with `getPendingVendorRegistrations()`

### 5. Add Final Approval to Supply Chain Dashboard — `src/pages/SupplyChainDashboard.tsx`
- Filter for `pendingFinalApprovals`: MRFs where `currentStage === "final_approval"` **only** — do NOT include `vendor_selected` (those haven't been escalated yet; `vendor_selected` and `final_approval` are distinct states per spec)
- Add Approve/Reject UI calling `mrfApi.supplyChainFinalApprove` / `supplyChainFinalReject`
- Replace `vendorApi.getRegistrations()` with `getPendingVendorRegistrations()`

### 6. Remove Delete from Department Dashboard — `src/pages/DepartmentDashboard.tsx`
- Remove all delete state, handlers, dialog, and button

### 7. Remove Finance from MRF Workflow — `src/pages/FinanceDashboard.tsx`
- Remove `handleMarkProcessed`, "Mark as Processed" button, `mrfApi.processPayment` call, GRN request logic, and `RecentActivities`
- Keep page for Accounts Payable/Receivable navigation only

### 8. Add API Methods — `src/services/api.ts`
- `executiveReject`: `POST /mrfs/${id}/executive-reject` with `{ reason }`
- `supplyChainFinalApprove`: `POST /mrfs/${id}/supply-chain-final-approve` with `{ remarks }`
- `supplyChainFinalReject`: `POST /mrfs/${id}/supply-chain-final-reject` with `{ reason }`

---

## Backend Bugs — For Laravel Team

**BUG 1 — Contract Type Schema Error**
1. Run `php artisan migrate:status` to confirm the migration adding `contract_type` was applied.
2. Check the column type: `SHOW COLUMNS FROM mrfs LIKE 'contract_type'`. If it is an `enum`, it likely only allows "Emerald" or a fixed set.
3. **Fix**: Write a new migration: `DB::statement("ALTER TABLE mrfs MODIFY contract_type VARCHAR(255) NULL");` then run `php artisan migrate`. This allows any string value.
4. Also check the MRF model's `$fillable` array and any FormRequest validator for hardcoded allowed values and remove or expand them.
5. Verify by submitting an MRF with `contract_type = "Oando"`.

**BUG 2 — Missing Quotations Relationship**
- Add `public function quotations() { return $this->hasMany(Quotation::class); }` to `App\Models\MRF`.
- To resolve the foreign key name: check the `quotations` table migration file (`database/migrations/*_create_quotations_table.php`) for the actual foreign key column name. Use that name in the relationship if it differs from the default: `$this->hasMany(Quotation::class, 'actual_column_name')`. Do not guess between `mrf_id` and `m_r_f_id` — read the migration.

**BUG 3 — `toIso8601String()` on String**
- Search the VendorRegistration model and its Resource/Transformer for `->toIso8601String()` calls. Identify the exact field.
- Add that field to `protected $casts` as `'datetime'` in the VendorRegistration model.
- If on first write the raw value is a string before Eloquent casts it, use a mutator: `public function setFieldNameAttribute($value) { $this->attributes['field_name'] = Carbon::parse($value); }`.

**BUG 4 — Vendor Registrations Not Appearing**
- Confirm the POST endpoint (registration form) and the GET endpoint (dashboard list) both read/write the same database table.
- The frontend workaround (using the procurement dashboard endpoint) does not fix this — both endpoints must be verified independently.

---

## Files to Edit
1. `src/types/index.ts`
2. `src/contexts/AppContext.tsx`
3. `src/components/MRFProgressTracker.tsx`
4. `src/pages/ExecutiveDashboard.tsx`
5. `src/pages/SupplyChainDashboard.tsx`
6. `src/pages/DepartmentDashboard.tsx`
7. `src/pages/FinanceDashboard.tsx`
8. `src/services/api.ts`

