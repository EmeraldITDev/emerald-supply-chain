# Frontend Changes — Multi-Feature Update (in progress)

## Pending cleanup (owners + deadlines)

- **2026-06-22** — `@logistics-team`: remove the `console.debug('[Item6/assignVendor]', …)` and the defensive `email_sent === false` branch in `src/services/logisticsApi.ts` `tripsApi.assignVendor` once the backend returns the new shape `{ assigned: true, email_sent: boolean, email_error?: string }` on email failure.
- **2026-06-22** — `@procurement-team`: remove the heuristic branches in `isPoGeneratedMrf()` (`src/utils/poHelpers.ts`) once backend always returns `source` and/or `is_po_linked` on every MRF list response. Keep only the authoritative-flag branch.
- **Ongoing** — `@procurement-team`: once backend ships `source` / `is_po_linked`, `ManualPOQuickStartDialog.tsx` payload can drop the `suppress_notifications: true` hint (backend will infer from `source === 'po_generated'`).

---

## Backend BLOCKING items (must ship before Batch 2)

- **[BLOCKING] Item 6 — Vendor trip assignment 500.** `POST /api/trips/{id}/assign-vendor` currently 500s when the invitation email throws. Wrap the email send in try/catch; never block the assignment on email failure. Response on success: `{ success: true, data: { ...trip, assigned: true, email_sent: boolean, email_error?: string } }`. On email failure, status is 200 (not 500) and `email_sent: false` is returned so the frontend can warn the Logistics Manager without rolling back the assignment.
- **[BLOCKING] Item 1d — Suppress MRF "created" email on manual PO.** `POST /api/mrfs` must skip the standard `mrf.created` notification when the request body carries `source: 'po_generated'` (or `suppress_notifications: true`).
- **[BLOCKING] Item 2 — MRF list filtering at source.** Until `source` / `is_po_linked` flags ship on MRF responses, the frontend uses a heuristic that can leak edge cases. Add the flag to every MRF list endpoint (`GET /api/mrfs`, dashboards, etc.) so the frontend filter is one-line.
- **[Item 5 high priority] PO closure server-side gate for advance-payment.** `POST /api/pos/{id}/close` must reject with HTTP 422 + `missing_documents: string[]` when the MRF payment structure is 100% advance, payment is complete, and any of vendor_invoice / GRN / JCC (where applicable) is absent. Frontend already reads `closureReadiness.blockers` from `/workflow-gates`; ensure the gate covers this exact case.

---

## Batch 0 — Pre-flight verification (user-run, before Batch 2 ships)

Run in **staging** (preview URL against live Render backend). Document outcomes by appending under "Batch 0 results" below.

### 0a. Procurement Manager role recognition
1. Confirm vendor registration works in staging (precondition for 0b).
2. Log in as a Procurement Manager user.
3. In DevTools console: `JSON.parse(localStorage.userData).role` — note the exact string returned.
4. Network tab: capture `GET /auth/me` response — note the `role` field.
5. Verify visibility of: vendor registration review action, RFQ send button, and (once Batch 2 ships) MRF delete button.
6. If the role string returned does not match what `role-permissions-and-aliasing-v4` expects, update the alias map and re-record.

### 0b. Vendor portal capability audit
1. Same staging environment, log in as a vendor user.
2. Click through end-to-end and record result for each (works | broken | missing):
   - Submit Final Invoice
   - Submit RFQ Response (incl. pricing, delivery period, supporting docs)
   - Quotation status tracking
   - Trip request inbox (if surfaced)
   - Supporting document upload against an MRF/RFQ
3. Anything "broken" gets reclassified into Batch 1 scope before Batch 2 begins.

### Batch 0 results
_(append here as each check completes; do not start Batch 2 until both 0a and 0b are filled in)_

---

## Batch 1 — Bugs (Shipped this loop)

### Item 1d — Manual PO must not trigger MRF "created" email
- `src/components/procurement/ManualPOQuickStartDialog.tsx` now sends `source: 'po_generated'`, `is_po_linked: true`, and `suppress_notifications: true` on the underlying `mrfApi.create()` call.
- The PO-finalisation step (`CreatePOForm.tsx` → `generate-po`) was not touched — it already creates the PO against the existing MRF id.
- **Backend ask (BLOCKING, repeated above):** `POST /api/mrfs` skips the `mrf.created` notification when any of these flags is present.

### Item 2 — Hide PO-generated MRFs from active list views
- New `isPoGeneratedMrf(mrf)` helper in `src/utils/poHelpers.ts` plus an `excludePoGeneratedMrfs(items)` filter. Heuristic order: authoritative flags (`source` / `is_po_linked`) → linked PO + manual-PO creation marker → justification-text fallback.
- **Frontend follow-up (Batch 1 finish):** apply `excludePoGeneratedMrfs` to the MRF list selectors in:
  - `src/pages/Procurement.tsx` (Active / Official / All MRFs tabs)
  - `src/pages/DepartmentDashboard.tsx`
  - `src/pages/SupplyChainDashboard.tsx`
  - `src/pages/ExecutiveDashboard.tsx`
  - `src/pages/ChairmanDashboard.tsx`
  - `src/pages/FinanceDashboard.tsx`
  These call sites are NOT modified in this commit (the helper is in place; wiring is the next small PR so the diff stays reviewable). Keep PO-generated MRFs visible inside Procurement History and inside the PO record itself.
- **Backend ask:** add `source: 'po_generated' | 'standard'` + `is_po_linked: boolean` to MRF list/detail responses so the heuristic can be retired.

### Item 4 — Progress tracker "Delivery Documents Uploaded" no longer falsely completes
- `src/utils/normalizeProgressTracker.ts`: new `enforceDeliveryDocsTruth(phases, activeByType)` post-processor applied to both `phasesFromApi` and `phasesFromFlatSteps` branches. If `activeByType` contains none of `grn` / `waybill` / `jcc` / `delivery_confirmation`, any step whose key matches `delivery-doc` or whose name reads "Delivery Documents Uploaded" is downgraded from `completed` to `pending` (with explanatory remarks), regardless of what status the backend sent.
- `buildLegacyProgressViewModel.ts` already gated this step on the doc registry (line 219), so the legacy path was already correct. This patch covers the API-driven path.
- **Backend ask:** the progress tracker endpoint should not mark `delivery-docs` complete based on stage timestamps alone — only when a delivery document exists.

### Item 5 — PO closure controls (advance-payment scenarios)
- `WorkflowGatesPanel.tsx` already (a) renders a spinner while the gates payload is loading (no false "Ready" flash), (b) reads `closureReadiness.canClose` / `blockers` straight from `/workflow-gates`, and (c) shows the missing-docs list in an inline Alert. No frontend changes were required here, but a closer audit of the actual "Close PO" button location (likely outside this panel) is on the Batch 1-finish list.
- **Backend ask (high priority, repeated above):** the `closureReadiness` calculation MUST require vendor_invoice + GRN + JCC (where applicable) for any MRF whose payment schedule is 100% advance, even when payment is already complete. `POST /api/pos/{id}/close` must mirror the gate server-side and return 422 + `missing_documents[]` on attempt.

### Item 6 — Vendor trip assignment 500 (defensive frontend + diagnostic)
- `src/services/logisticsApi.ts` `tripsApi.assignVendor`:
  - Added `console.debug('[Item6/assignVendor]', { endpoint, payload })` before the request so the exact body/URL can be cross-referenced with backend exception logs.
  - Defensive branch: if the (patched) backend returns `{ assigned: true, email_sent: false, email_error }`, the response is still treated as success and a `console.warn` carries the email error for the caller to surface as a non-blocking warning toast.
  - Both blocks are tagged with `TODO(@logistics-team, remove by 2026-06-22)` and listed in the Pending cleanup section above.
- **Backend ask (BLOCKING, repeated above):** wrap the invitation email send in try/catch; never let it propagate as a 500. Return the new response shape so the assignment is not rolled back on email failure.

### Batch 1 verification checklist (gate to Batch 2)

Manual smoke test in staging, run by the user after Batch 1 deploys. All five must pass before Batch 2 begins.

1. **Progress tracker** — open an MRF with no delivery documents in its registry. Confirm "Delivery Documents Uploaded" shows as pending/not-started (NOT completed).
2. **Manual PO email suppression** — create a manual PO via "Create PO without RFQ". Confirm no `mrf.created` email is dispatched (check email log or vendor inbox).
3. **PO-generated MRF hidden** — same flow as above. Once the list-surface wiring lands (Batch 1 finish PR), confirm the resulting MRF does NOT appear in Active / Official / All MRF tabs but DOES appear in Procurement History and inside the PO record.
4. **PO closure loading state** — open an advance-payment PO with payment complete and missing completion docs. Confirm the Workflow Gates panel shows the spinner while loading, then renders the inline "Cannot close yet" Alert listing the missing documents (vendor invoice / GRN / JCC).
5. **Vendor trip assignment** — assign a vendor to a trip. Either: (a) backend fix is live and the assignment succeeds without a 500, or (b) the defensive path returns the warning shape and the UI does NOT show a blocking error toast.

## Shipped this loop

### Item 3 — SRF status labels
- New `SRF_STATUS_LABELS` map + `getSrfStatusLabel()` helper in `src/utils/srfStatusBadge.ts`.
- `SRFCardList.tsx` and `SRFDetailDialog.tsx` now render `getSrfStatusLabel(status)` instead of raw status strings.
- SRFProgressTracker already used descriptive labels.

### Item 5 — Plate number (`TEMP-…`) bug
- `src/services/logisticsApi.ts` vehicle `create` now sends `plate`, `plate_number`, and `registration_number` (mirrored from user input).
- Vehicle `update` does the same when `plate` is present.
- **Backend ask:** verify `/fleet/vehicles` POST/PUT persists `plate_number` when provided and only auto-generates `TEMP-…` when truly empty.

### Item 7 — SRF line items persistence
- `src/pages/NewSRF.tsx` now sends `line_items: [{item_name, quantity, unit, budget_amount}]` (snake_case) on create instead of `items: lineItems`.
- **Backend ask:** `/srfs` POST/PUT must accept and persist `line_items` with these snake_case keys, return them in the detail response, and include a `line_items_count` (or full array) on the list response so cards do not show "No line items on file" for absent fields.

### Item 4 — Logistics dashboard clickable cards
- `src/pages/Logistics.tsx`: Active Trips → `trips` tab, Fleet Vehicles → `fleet` tab, Staff Drivers → `overview` tab (drivers list lives there). All three cards are keyboard-accessible (role=button, Enter/Space, focus ring).

### Item 8 — Vendor invoice gate-closed UX
- `src/components/vendor/VendorInvoicesPanel.tsx` now renders an informational `Alert` ("Your quote has been received. You will be notified when you can submit your final invoice.") when `canSubmit === false` instead of a silent locked badge.

## Shipped (this loop)

### Item 1 — Payment milestone builder
- New component `src/components/payments/PaymentMilestoneBuilder.tsx` with templates (100% Advance, 70/30, 50/50, 30/40/30, Custom), running total, +/- rows, and a `onValidityChange` callback that flips to `true` only when percentages sum to exactly 100%.
- Wired into `src/components/procurement/CreatePOForm.tsx` adjacent to the existing Payment Terms input. `custom_terms`, `remarks`, `invoice_submission_cc`, and `invoice_submission_email` were NOT touched. When the builder has valid milestones, `payment_milestones: [{label, percentage, trigger_condition}]` is added to the generate-PO payload (`POFormPayload.payment_milestones` extended in `src/types/procurement.ts`).
- Wired into `src/components/POGenerationDialog.tsx` adjacent to the Payment Terms select. The dialog's `onGenerate`/`onSave` callbacks now receive an optional `paymentMilestones` array, and the "Save and Send to Vendors" button is disabled while the builder is invalid.
- **Backend ask:**
  - `POST /api/mrfs/{id}/generate-po` (PO finalisation) accepts `payment_milestones: [{label: string, percentage: number, trigger_condition: string}]`. Request: include `payment_milestones` array. Response: echo the persisted array on the PO detail. Return HTTP **422** with `errors.payment_milestones: "must sum to 100"` when the percentages do not equal 100.
  - `POST /api/rfqs` and `PATCH /api/rfqs/{id}` accept `payment_milestones` — backend persists them on the **linked MRF's payment schedule** (not a separate RFQ column). RFQ create/update/detail responses expose `payment_milestones` read from that MRF schedule in the same shape the UI sends.
  - `POST /api/mrfs` and `POST /api/srfs` accept the same shape (so MRFs/SRFs can carry the requested payment schedule from creation). Detail responses must echo it. The legacy `payment_terms` string column should remain read-only for backward compatibility.

### Item 2 — SCD quotation detail (investigation hook)
- Added a diagnostic `console.debug('[Item2/getQuotations]', …)` in `src/services/api.ts` `rfqApi.getQuotations` that logs the caller's role (from `localStorage.user`), success flag, quotation count, and the top-level keys of the first quotation + its nested `quotation` object + items length.
- **How to use:** open the price-comparison view as Procurement Manager, copy the log; reopen as Supply Chain Director and copy again. After the backend deploy, both should show the **same** top-level keys including `payment_milestones`, `paymentSchedule`, and `items`. If anything still differs, paste both `console.debug` payloads here for the backend team.
- **Backend ask (confirmed):** `GET /api/rfqs/{rfqId}/quotations` returns identical field sets across PM, SCD, and Executive roles — no role-scoped stripping.

### Item 6 — External passengers on trips
- Extended `CreateTripRequestData` in `src/types/logistics.ts` with optional `external_passengers: Array<{name, email, phone?}>`.
- `src/components/logistics/TripRequestForm.tsx` now renders an "External passengers (non-staff)" section under the staff `EligiblePassengerPicker`. Each row captures name (required), email (required, validated), and phone (optional). Submit is enabled if there is at least one staff passenger OR at least one valid external passenger; invalid email blocks submit with a toast.
- `tripRequestApi.create` forwards `external_passengers` only when at least one valid row is present.
- **Backend ask:**
  - `POST /api/trip-requests` and `PUT /api/trip-requests/{id}` accept `external_passengers: [{name: string, email: string, phone?: string}]`. Persist alongside `passenger_user_ids` so the detail response returns both arrays.
  - External passenger emails fire on `POST /api/trip-requests/{id}/confirm` (Logistics Manager confirm action) — **not** on initial `POST /api/trip-requests`. Email body should include: trip date/time, origin → destination, purpose, and the requester's name as the in-company contact. Plain transactional copy (no marketing content).
