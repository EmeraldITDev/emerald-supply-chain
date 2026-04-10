# Backend Handoff — Laravel Action Items

All items below are backend-only changes required for the frontend to function correctly. The frontend code has already been updated to consume these fields/endpoints.

---

## 1. SQL Check Constraint — `workflow_state` Column

The `m_r_f_s` table has a check constraint on `workflow_state` that does not include `executive_approved`. Add it:

```sql
ALTER TABLE m_r_f_s DROP CONSTRAINT IF EXISTS m_r_f_s_workflow_state_check;
ALTER TABLE m_r_f_s ADD CONSTRAINT m_r_f_s_workflow_state_check CHECK (
  workflow_state IN (
    'draft','submitted','executive_review','director_review',
    'procurement_review','rfq_sent','quotes_received',
    'vendor_selected','final_approval','po_generated',
    'completed','rejected','executive_approved'
  )
);
```

---

## 2. Contract Type Schema Error

The `contract_type` column on `m_r_f_s` may be an enum that only allows a fixed set. Fix:

```sql
ALTER TABLE m_r_f_s ALTER COLUMN contract_type TYPE VARCHAR(255);
```

Also check the MRF model's `$fillable` array and any FormRequest validator for hardcoded allowed values — remove or expand them.

---

## 3. Missing Quotations Relationship

Add to `App\Models\MRF`:

```php
public function quotations()
{
    return $this->hasMany(Quotation::class);
}
```

Check `database/migrations/*_create_quotations_table.php` for the actual foreign key column name. If it's `m_r_f_id` instead of `mrf_id`, specify it:

```php
return $this->hasMany(Quotation::class, 'm_r_f_id');
```

---

## 4. `toIso8601String()` on String

Search `VendorRegistration` model and its Resource/Transformer for `->toIso8601String()` calls. Add the field to `$casts`:

```php
protected $casts = [
    'field_name' => 'datetime',
];
```

---

## 5. Stage Timestamp Columns

Add migration:

```php
Schema::table('m_r_f_s', function (Blueprint $table) {
    $table->timestamp('executive_approved_at')->nullable();
    $table->timestamp('director_approved_at')->nullable();
    $table->timestamp('procurement_review_started_at')->nullable();
});
```

Set these in each `MRFController` transition method. Add to `$fillable` and `$casts` as `'datetime'`.

---

## 6. `last_action_by_role` Column (REQUIRED)

The frontend badges depend on this field — there is no fallback inference.

```php
Schema::table('m_r_f_s', function (Blueprint $table) {
    $table->string('last_action_by_role')->nullable();
});
```

Set it in **every** state transition method in `MRFController`:

```php
$mrf->last_action_by_role = auth()->user()->role;
$mrf->save();
```

Include it in the MRF API response (add to `$fillable`).

---

## 7. Role Standardization

```sql
SELECT DISTINCT role FROM users;
UPDATE users SET role = 'employee' WHERE role IN ('general_employee', 'regular_staff', 'staff');
```

Update the check constraint on the `role` column to remove the old values.

---

## 8. Logistics Manager Role

Run this query and report the result to the frontend team:

```sql
SELECT DISTINCT role FROM users WHERE role LIKE 'logistic%';
```

The frontend currently uses `logistics` in the dropdown. If the DB uses `logistics_manager`, the frontend will be updated to match. Add whichever value is correct to validation rules and DB constraints.

---

## 9. `GET /mrfs` Must Include Rejected MRFs

The Supply Chain Dashboard "All Requests" tab calls `GET /mrfs` with no filters. This endpoint **must not** filter out rejected MRFs. If it currently does, either:
- Remove the filter, or
- Add `?include_rejected=true` support

---

## 10. RFQ ID Format

Update RFQ ID generation from `RFQ-XXXX` to:

```
RFQ-[ITEM_ABBR]-[VENDOR_ABBR]-[YEAR]-[SEQ]
```

Ensure `rfq_id` column is `VARCHAR(50)`.

---

## 11. Quotation Resource Fields

Confirm `QuotationResource` includes all of:
- `proposed_delivery_date`
- `payment_terms`
- `validity_period`
- `quotation_terms`

The frontend maps all four. If `quotation_terms` is missing, add it to the model and resource.

---

## 12. Vendor Documents — Eager Load with Signed URLs

In the vendor show method (`GET /vendors/{id}`), eagerly load documents:

```php
$vendor = Vendor::with('documents')->findOrFail($id);
```

For each document, generate a fresh signed S3 URL:

```php
foreach ($vendor->documents as $doc) {
    $doc->url = Storage::disk('s3')->temporaryUrl($doc->s3_key, now()->addHours(24));
    $doc->url_expires_at = now()->addHours(24)->toIso8601String();
}
```

**Do NOT cache signed S3 URLs.** Generate a fresh URL on every request. If signed URLs are cached (Redis, model attributes, or database), the frontend "Regenerate URL" button will return the same expired URL.

---

## 13. URL Expiry Column for Vendor Documents

```php
Schema::table('vendor_documents', function (Blueprint $table) {
    $table->timestamp('url_expires_at')->nullable();
});
```

This is set at response time (see Section 12), not stored permanently.

---

## 14. Email Notifications (Resend)

Create Mailables for each workflow event:
- MRF submitted
- Executive approved / rejected
- SCD approved / rejected
- Procurement review started
- Vendor selected
- Final approval granted / rejected
- PO generated

Dispatch queued mail in each `MRFController` transition method. Configure in `.env`:

```
MAIL_MAILER=resend
RESEND_API_KEY=your-api-key
```

---

## 15. In-App Notifications (Two Steps)

### Step 1 — Confirm notification routes exist

Open `routes/api.php` and verify:

```php
Route::get('/notifications', [NotificationController::class, 'index']);
Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
Route::put('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
```

Run `php artisan route:list | grep notification` to confirm.

### Step 2 — Add `Notification::create()` in every MRF state transition

Open `app/Http/Controllers/MRFController.php`. In every method that changes `workflow_state`, add a notification **after** the state change and `save()`:

```php
// Inside executiveApprove(), after $mrf->save():
Notification::create([
    'user_id' => $mrf->created_by,
    'message' => "Your MRF {$mrf->mrf_number} has been approved by Executive.",
    'is_read' => false,
]);

// Also notify the next approver:
$procurementManager = User::where('role', 'procurement_manager')->first();
if ($procurementManager) {
    Notification::create([
        'user_id' => $procurementManager->id,
        'message' => "MRF {$mrf->mrf_number} requires procurement review.",
        'is_read' => false,
    ]);
}
```

Repeat in: `supplyChainDirectorApprove`, `supplyChainDirectorReject`, `executiveReject`, `supplyChainFinalApprove`, `supplyChainFinalReject`, and any other transition. Each must create at least one notification for the MRF submitter and one for the next responsible role.

---

## 16. Procurement Access Policy

In `MRFPolicy`, ensure procurement actions are gated by `workflow_state === 'procurement_review'` — not by the `executive_approved` flag alone. Both Emerald (executive-approved) and non-Emerald (SCD-approved) MRFs arrive at `procurement_review`.
