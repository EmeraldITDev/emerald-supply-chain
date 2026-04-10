# Backend Team Handoff — Required Migrations & Code Changes

All frontend changes are complete. The following backend (Laravel) work is required for full functionality.

---

## 1. Migration: Add `last_action_by_role` to `m_r_f_s`

```php
Schema::table('m_r_f_s', function (Blueprint $table) {
    $table->string('last_action_by_role')->nullable()->after('workflow_state');
});
```

Set this field in **every** MRF state transition method in `MRFController.php`:
```php
// Example in supplyChainDirectorApprove():
$mrf->last_action_by_role = 'supply_chain_director';
$mrf->save();

// Example in executiveApprove():
$mrf->last_action_by_role = 'executive';
$mrf->save();
```

**Frontend dependency:** Role-specific badges (purple "SCD Approved", red "Executive Rejected") only render when this field is present. No fallback inference exists.

---

## 2. Migration: Add Stage Timestamps to `m_r_f_s`

```php
Schema::table('m_r_f_s', function (Blueprint $table) {
    $table->timestamp('executive_approved_at')->nullable();
    $table->timestamp('director_approved_at')->nullable();
    $table->timestamp('procurement_review_started_at')->nullable();
});
```

Set each timestamp in the corresponding transition method:
```php
// In executiveApprove():
$mrf->executive_approved_at = now();

// In supplyChainDirectorApprove():
$mrf->director_approved_at = now();
```

Add to `$fillable` and `$casts` (as `datetime`) on the MRF model.

---

## 3. Role Standardization

Run this query first to see current roles:
```sql
SELECT DISTINCT role FROM users;
```

Then standardize:
```sql
UPDATE users SET role = 'employee' WHERE role IN ('general_employee', 'regular_staff', 'staff');
```

Update the check constraint on the `role` column to remove deprecated values.

---

## 4. Logistics Role Confirmation (BLOCKING)

Run:
```sql
SELECT DISTINCT role FROM users WHERE role LIKE 'logistic%';
```

Report result. The frontend currently uses `logistics` in the user creation dropdown. If the DB uses `logistics_manager`, the frontend dropdown value needs updating. **Do not change the frontend until this query is run.**

---

## 5. Vendor Documents — Fresh Signed URLs (Section 12/13)

**Do not cache signed S3 URLs.** The `GET /vendors/{id}` endpoint must generate a fresh signed URL for every document on every request.

```php
// In VendorResource or VendorController@show:
$vendor->load('documents');

foreach ($vendor->documents as $doc) {
    $doc->url = Storage::disk('s3')->temporaryUrl($doc->s3_key, now()->addHours(24));
    $doc->url_expires_at = now()->addHours(24)->toIso8601String();
}
```

Add `url_expires_at` column to `vendor_documents` if not present:
```php
Schema::table('vendor_documents', function (Blueprint $table) {
    $table->timestamp('url_expires_at')->nullable();
});
```

**Frontend dependency:** The "Regenerate URL" button re-calls `GET /vendors/{id}`. If signed URLs are cached, the button returns the same expired URL.

---

## 6. Notification Routes (Section 15, Step 1)

Verify these routes exist in `routes/api.php`:
```php
Route::get('/notifications', [NotificationController::class, 'index']);
Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
Route::put('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
```

Confirm with: `php artisan route:list | grep notification`

---

## 7. Notification::create() in Transition Methods (Section 15, Step 2)

In `MRFController.php`, add `Notification::create()` calls **after** every `$mrf->save()` that changes `workflow_state`:

```php
// Example: executiveApprove()
Notification::create([
    'user_id' => $mrf->created_by,
    'message' => "Your MRF {$mrf->mrf_number} has been approved by Executive.",
    'is_read' => false,
]);

$procurementManager = User::where('role', 'procurement_manager')->first();
if ($procurementManager) {
    Notification::create([
        'user_id' => $procurementManager->id,
        'message' => "MRF {$mrf->mrf_number} requires procurement review.",
        'is_read' => false,
    ]);
}
```

Repeat in: `supplyChainDirectorApprove`, `supplyChainDirectorReject`, `executiveReject`, `supplyChainFinalApprove`, `supplyChainFinalReject`, and any other transition method. Each must notify the MRF submitter + the next responsible role.

---

## 8. Ensure GET /mrfs Returns Rejected MRFs (Section 2)

The frontend "All Requests" tab calls `GET /mrfs` and expects to see all MRFs including rejected ones. If the endpoint filters them out, either:
- Remove the filter, or
- Add `?include_rejected=true` support

---

## 9. RFQ ID Format (Section 11)

Update RFQ ID generation to: `RFQ-[ITEM_ABBR]-[VENDOR_ABBR]-[YEAR]-[SEQ]`

Ensure `rfq_id` column is `VARCHAR(50)`.

---

## 10. SQL Check Constraint on `workflow_state` (Section 1)

Verify `executive_approved` is in the check constraint on `m_r_f_s.workflow_state`. If missing:
```sql
ALTER TABLE m_r_f_s DROP CONSTRAINT m_r_f_s_workflow_state_check;
ALTER TABLE m_r_f_s ADD CONSTRAINT m_r_f_s_workflow_state_check
CHECK (workflow_state IN ('draft', 'pending', 'director_approved', 'executive_approved', 'procurement_review', 'completed', 'rejected'));
```

---

## 11. MRF Policy Permissions (Section 1)

Ensure `MRFPolicy@view` permits: `employee`, `executive`, `procurement_manager`, `supply_chain_director`.

Verify with: `php artisan route:list | grep mrf`

---

## 12. Quotation Resource Fields (Section 9/10)

Confirm `QuotationResource` includes: `proposed_delivery_date`, `payment_terms`, `validity_period`, `quotation_terms`.

---

## 13. Email Notifications (Section 14)

Create Mailables for workflow events. Dispatch queued mail in each transition method. Configure Resend in `.env`.
