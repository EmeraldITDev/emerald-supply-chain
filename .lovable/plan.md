

# Revised Implementation Plan — Three Corrections Applied

All three flags have been incorporated. No other changes to the plan.

---

## Correction 1 — Remove badge fallback inference (Section 4/5 badge logic)

**Previous:** "Use `mrf.last_action_by_role` if available, otherwise check `mrf.status` string for 'rejected' + contract type being Emerald to infer executive rejection."

**Revised:** Remove the fallback entirely. The badge renders **only** when `mrf.last_action_by_role` is present in the API response. If the field is absent or null, no role-specific badge appears — just the standard status badge. This prevents wrong badges from shipping if the backend migration is delayed.

Affected files:
- `src/pages/SupplyChainDashboard.tsx` — purple "SCD Approved" badge: render only when `mrf.last_action_by_role === 'supply_chain_director'`
- `src/pages/ExecutiveDashboard.tsx` — executive rejection icon: render only when `mrf.last_action_by_role === 'executive'` and `mrf.workflow_state === 'rejected'`
- `src/pages/Procurement.tsx` — same logic

No conditional inference from contract type. No guessing. Field present = badge shown. Field absent = no badge.

---

## Correction 2 — Backend instruction: do not cache signed URLs (Section 12/13)

Add this sentence to the backend instructions for Section 12:

> **Do not cache signed S3 URLs.** The `GET /vendors/{id}` endpoint must generate a fresh signed URL for every document on every request. If signed URLs are cached (in Redis, model attributes, or database columns), the "Regenerate URL" button on the frontend will return the same expired URL. Generate URLs at response time using `Storage::disk('s3')->temporaryUrl($doc->s3_key, now()->addHours(24))` inside the controller or resource, never store the URL string permanently.

---

## Correction 3 — Split Section 15 backend notification steps

**Previous:** "Confirm notification routes exist. Create notification records in each state transition."

**Revised — two explicit steps:**

**Step 1 — Confirm notification routes exist.** Open `routes/api.php` and verify these four routes are registered:
```php
Route::get('/notifications', [NotificationController::class, 'index']);
Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
Route::put('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
```
If any are missing, add them. Run `php artisan route:list | grep notification` to confirm.

**Step 2 — Add `Notification::create()` calls inside every MRF state transition method.** Open `app/Http/Controllers/MRFController.php`. In every method that changes `workflow_state`, add a notification record **after** the state change and `save()`. Example for executive approval:
```php
// Inside executiveApprove() method, after $mrf->save():
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
Repeat this pattern in: `supplyChainDirectorApprove`, `supplyChainDirectorReject`, `executiveReject`, `supplyChainFinalApprove`, `supplyChainFinalReject`, and any other transition method. Each must create at least one notification for the MRF submitter and one for the next responsible role.

---

## Complete File List (13 files, unchanged from prior plan)

| # | File | Sections |
|---|------|----------|
| 1 | `src/pages/Procurement.tsx` | 1, 8, 9/10 |
| 2 | `src/pages/DepartmentDashboard.tsx` | 1 |
| 3 | `src/pages/ExecutiveDashboard.tsx` | 1, 4 |
| 4 | `src/pages/SupplyChainDashboard.tsx` | 2, 4 |
| 5 | `src/contexts/AuthContext.tsx` | 5 |
| 6 | `src/types/index.ts` | 5 |
| 7 | `src/pages/UserManagement.tsx` | 6, 7 |
| 8 | `src/pages/Dashboard.tsx` | 6 |
| 9 | `src/components/layout/AppSidebar.tsx` | 6 |
| 10 | `src/pages/Settings.tsx` | 7 |
| 11 | `src/pages/Vendors.tsx` | 12, 13 |
| 12 | `src/components/layout/DashboardLayout.tsx` | 16 |
| 13 | `src/components/RFQManagement.tsx` | 9/10 |

All other plan details (Sections 1-3, 5-10, 11-14, 16, backend instructions) remain exactly as stated in the previous revision. Only the three corrections above are changed.

