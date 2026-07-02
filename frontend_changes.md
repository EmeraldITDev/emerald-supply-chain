# Frontend Changes — Multi-Feature Update (in progress)

## Bug E — RFQ quotations PM 500 fallback (Sub-batch 1.6)

- `src/services/api.ts` `rfqApi.getQuotations()` — when `GET /api/rfqs/{id}/quotations` returns status 0 / undefined / ≥500, falls back to `GET /api/quotations/rfq/{rfqId}` plus `GET /api/rfqs/{rfqId}` and rebuilds the wrapped `{ rfq, quotations:[{quotation,vendor,items}], statistics }` shape (price stats computed client-side, `_fallback: true` flag set for telemetry). PM comparison view stays usable while backend is broken.
- Pre-existing `[BugE/getQuotations]` diagnostic log still fires on every failure with `{ rfqId, role, error, status, raw }`.
- **Backend ask (BLOCKING):** repair the wrapped endpoint — most likely cause is a serializer crash when a quotation row has a null `vendor` join or `items` stored as object `{}` instead of array `[]`. Acceptance: 200 with documented shape for every RFQ with ≥1 quotation, including FormData submissions with `attachments[]`. Frontend fallback to be removed once green.

## Discard saved PO draft (Sub-batch 1.5b)

- `src/pages/Procurement.tsx` — added a destructive **Discard Draft** button next to **Continue Draft** on every draft row in the Purchase Orders tab. Click opens an `AlertDialog` confirmation. On confirm, calls `mrfApi.discardPODraft(apiId)` then `fetchMRFs()` to refresh the list. New state: `discardDraftDialogOpen`, `selectedMRFForDraftDiscard`, `isDiscardingDraft`.
- `src/services/api.ts` — new `mrfApi.discardPODraft(id)` helper that issues `DELETE /api/mrfs/{id}/po-draft` and returns the updated MRF.
- **Blocking backend ask:** implement `DELETE /api/mrfs/{id}/po-draft` (procurement role). Clear `po_draft_saved_at`, `is_po_draft`, persisted draft payload, and the reserved `po_number` without touching `status` / `workflow_state` and without firing Finance or SCD notifications. Record a `discarded_po_draft` audit event and return the row via `scmTransactionApiFields()`.

## Pending cleanup (owners + deadlines)

- **2026-06-22** — `@logistics-team`: remove the `console.debug('[Item6/assignVendor]', …)` and the defensive `email_sent === false` branch in `src/services/logisticsApi.ts` `tripsApi.assignVendor` once the backend returns the new shape `{ assigned: true, email_sent: boolean, email_error?: string }` on email failure.
- **2026-06-22** — `@procurement-team`: remove the heuristic branches in `isPoGeneratedMrf()` (`src/utils/poHelpers.ts`) once backend always returns `source` and/or `is_po_linked` on every MRF list response. Keep only the authoritative-flag branch.
- **Ongoing** — `@procurement-team`: once backend ships `source` / `is_po_linked`, `ManualPOQuickStartDialog.tsx` payload can drop the `suppress_notifications: true` hint (backend will infer from `source === 'po_generated'`).

---

## Backend BLOCKING items (must ship before Batch 2)

- **[BLOCKING] Bug E — RFQ vendor response invisible on PM, 500 error (regression).** `GET /api/rfqs/{rfqId}/quotations` (or the per-quotation detail endpoint) currently 500s for Procurement Manager users after a vendor submits a response via `POST /api/rfqs/{rfqId}/quotations`. Restore previous behaviour: PM must see vendor-submitted quotations with all fields (pricing, delivery period, payment terms/milestones, supporting docs). Investigate role-scoped query, missing join, or null-field deref introduced by the regression. Frontend diagnostic already in place — `console.debug('[Item2/getQuotations]', …)` in `src/services/api.ts`.
- **[BLOCKING] Bug C — RFQ payload to vendor is incomplete.** When PM creates an RFQ with Payment Milestones, Additional Notes, Terms & Conditions, and Supporting Documents, those fields must be persisted on the RFQ record AND included in the response served to vendor portal (`GET /api/rfqs/{id}` and the vendor distribution email). Currently dropped between PM create and vendor render. Confirm `POST /api/rfqs` accepts and round-trips: `payment_milestones[]`, `additional_notes`, `terms_and_conditions`, `supporting_documents[]` (S3 keys + signed URLs).
- **[Bug A] Final Invoice upload echo on MRF detail.** `GET /api/mrfs/{id}` must include the linked vendor invoice (file URL, filename, uploaded_at, vendor_id, amount) so the frontend can render and offer download from the MRF detail page. Currently the upload succeeds but the MRF detail response does not surface it.
- **[Bug B] Line-item P&L (Budget vs Actuals) persistence.** If editable actuals are intended, expose `PATCH /api/mrfs/{id}/line-items/{lineId}/pnl` (or equivalent) accepting `{ actual_amount, notes }` and echo on `GET /api/mrfs/{id}/line-item-pnl`. Confirm with backend whether actuals are user-entered or computed from approved quotations — frontend behaviour depends on this answer.

- **[BLOCKING] Item 6 — Vendor trip assignment 500.** `POST /api/trips/{id}/assign-vendor` currently 500s when the invitation email throws. Wrap the email send in try/catch; never block the assignment on email failure. Response on success: `{ success: true, data: { ...trip, assigned: true, email_sent: boolean, email_error?: string } }`. On email failure, status is 200 (not 500) and `email_sent: false` is returned so the frontend can warn the Logistics Manager without rolling back the assignment.
- **[BLOCKING] Item 1d — Suppress MRF "created" email on manual PO.** `POST /api/mrfs` must skip the standard `mrf.created` notification when the request body carries `source: 'po_generated'` (or `suppress_notifications: true`).
- **[BLOCKING] Item 2 — MRF list filtering at source.** Until `source` / `is_po_linked` flags ship on MRF responses, the frontend uses a heuristic that can leak edge cases. Add the flag to every MRF list endpoint (`GET /api/mrfs`, dashboards, etc.) so the frontend filter is one-line.
- **[Item 5 high priority] PO closure server-side gate for advance-payment.** `POST /api/pos/{id}/close` must reject with HTTP 422 + `missing_documents: string[]` when the MRF payment structure is 100% advance, payment is complete, and any of vendor_invoice / GRN / JCC (where applicable) is absent. Frontend already reads `closureReadiness.blockers` from `/workflow-gates`; ensure the gate covers this exact case.
- **[Sub-batch 1.5 — Draft PO persistence] MRF list responses must include `is_po_draft` and `po_draft_saved_at` on every row** so the Purchase Orders list can render the Draft badge + Continue action without an extra fetch. Already returned by `POST /api/mrfs/{id}/generate-po` with `save_as_draft: true` — extend to `GET /api/mrfs` and dashboard list endpoints. Also confirm `PATCH`/re-`POST` of `generate-po?save_as_draft=true` against an MRF that already has a draft updates in place (does NOT create a duplicate PO row) and does NOT trigger approval routing or SCD signature notifications until the form is finalised without the `save_as_draft` flag.

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

### Reclassified from Batch 0b

#### Bug B — Budget vs Actuals "No line items available" (fetch/display mapping fix)
- Added `src/utils/normalizeProfitAndLoss.ts`. Accepts any of: `{ items }`, `{ line_items }`, `{ lineItems }`, `{ rows }`, bare array, or wrapped `{ data: { items|line_items } }`. Per-row: resolves `item_name`/`itemName`/`name`/`description`, `budget_amount`/`budgetAmount`/`budget`/`estimated_amount`, `quoted_amount`/`actual_amount`/`total_price`, and derives `varianceType` from sign when backend omits it. Summary falls back to computed totals across the rows.
- `mrfApi.getLineItemPnL` and `srfApi.getLineItemPnL` now route every response through the normalizer.
- `LineItemPnLSection` also normalizes the `initialPnL` baked into the MRF/SRF detail payload (mixed casing was leaking through and rendering as empty).
- Dev-only `console.warn('[BugB/mrf.getLineItemPnL] empty after normalize', …)` fires when the normalized result is empty — surfaces backend-side missing-data cases without spamming production.
- If the warning fires consistently for MRFs that DO have line items, the residual issue is backend (response truly empty) — bumped a backend ask under "Backend BLOCKING items" §Bug B.

#### Item 2 — `isPoGeneratedMrf` fallback hardening
- All heuristic branches in `src/utils/poHelpers.ts` now fire independently. Previously the justification-text branch was gated behind `hasLinkedPo`, so half-finished manual POs (no PO row yet) leaked into list views.
- Added `suppress_notifications` flag as an additional authoritative signal (matches the payload `ManualPOQuickStartDialog` sends).
- Added a second justification-text needle (`"vendor and pricing captured directly on the purchase order"`) for resilience against backend trimming.
- Unit tests deferred — no test runner currently configured in the project; manual coverage via the Batch 1 verification checklist (items 3 + 9) instead. If a test runner is added later, the four cases to cover are: (a) plain MRF → false, (b) MRF with `source: 'po_generated'` → true, (c) MRF with only justification text → true, (d) MRF with linked PO id → true.

#### Item 1d — Manual PO must not trigger MRF email (frontend audit)
- Audit complete: `ManualPOQuickStartDialog.tsx`, `POGenerationDialog.tsx`, and `CreatePOForm.tsx` contain **no client-side notify side-effect** for manual-PO MRFs. The only signal the frontend can send is the `suppress_notifications: true` (and `source: 'po_generated'`) payload hint, which is already wired in `ManualPOQuickStartDialog`.
- Remaining work is fully backend (see BLOCKING §Item 1d).

#### Bug C — RFQ payload to vendors (frontend completeness)
- `src/components/RFQManagement.tsx` create-RFQ dialog now exposes **Delivery Terms**, **Technical Requirements**, **Additional Notes**, **Terms & Conditions**, and a **Supporting Documents** file picker. All previously-declared local state (`paymentTerms`, `deliveryTerms`, `technicalReqs`) was unwired — that is fixed.
- All five free-text fields are now forwarded on `rfqApi.create()`. Payload mirrors both camelCase and snake_case (`payment_terms`, `additional_notes`, `terms_and_conditions`, `delivery_terms`, `technical_requirements`) so the backend can pick either.
- Form reset on dialog close clears the new fields too.
- **Supporting Documents** are now uploaded via `rfqApi.uploadAttachments()` immediately after `rfqApi.create()` returns success. Endpoint: `POST /api/rfqs/{id}/attachments`, multipart field name `attachments[]`. Upload failures surface a non-fatal toast — the RFQ is already dispatched.
- `CreateRFQData` (`src/types/index.ts`) extended with `termsAndConditions?`, `deliveryTerms?`, `technicalRequirements?`.
- **Backend ask (BLOCKING, repeated above):** `POST /api/rfqs` must accept and persist these fields, and `GET /api/rfqs/{id}` (the vendor-facing read) must echo them so the vendor portal can render them. `POST /api/rfqs/{id}/attachments` (multipart, field `attachments[]`) must accept the files and return `{ id, filename, url }[]`; the frontend call is already wired and will start succeeding the moment the route ships.

#### Bug D — Custom payment-terms split (vendor portal)
- `src/components/VendorQuoteSubmission.tsx` Payment Terms select gained a **"Custom Split (e.g. 70/30, 60/40)"** option. Selecting it reveals a single advance-% input (1–99, integer); the balance auto-completes so the two always sum to 100.
- On submit the encoded value is `custom-{advance}-{balance}` (e.g. `custom-70-30`). All other preset values (`advance`, `50-50`, `delivery`, `net-30`, `net-60`, `lc`) are unchanged.
- Validation: blocks submit with an inline error if the advance value is out of range.
- **Backend ask:** `POST /api/rfqs/{id}/submit-quotation` should accept and round-trip the `custom-{advance}-{balance}` string in `payment_terms`. Persist as-is; PM and SCD comparison views already render whatever string the backend returns.

#### Bug E — RFQ vendor response invisible on PM, 500 (regression)
- `src/services/api.ts` `rfqApi.getQuotations` now `console.error`s the full failure context (rfqId, role, error message, status) before the existing `[Item2/getQuotations]` success-path debug. This gives the backend team the exact role + RFQ id to reproduce.
- No frontend behaviour change: the UI already surfaces a toast on `success === false`. The bug is server-side — see BLOCKING entry above.

#### Bug A — Final Invoice display on MRF (deferred to backend ack)
- Frontend has the existing `VendorInvoicesPanel` pattern ready to extend into the MRF detail page. The block is the MRF detail response: it does not include the linked vendor invoice (URL, filename, vendor, amount, uploaded_at). Listed in the BLOCKING table above. Once the field lands, the UI surface is a ~30-line addition to `src/pages/Procurement.tsx` MRF detail dialog mirroring the existing "Supporting Document" download block.

#### Bug B — Budget vs Actuals not saving (needs backend clarification)
- Audit result: `LineItemPnLSection` + `ProfitAndLossTable` are purely read-only. There is no editable field that the user can type into and "save". The values are computed by the backend from MRF line-item budgets vs the winning quotation.
- Either (a) the user expects an actuals-entry surface that has never existed and needs to be specced + built, or (b) the GET endpoint is returning stale/empty data after approval and this is a server-side bug.
- **Action required:** confirm intent with the requester before building a save surface. Listed under the BLOCKING table so it does not silently fall off.

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

## Batch 1 — Sub-batch 1.2 (Bug E)

### Bug E — RFQ vendor responses invisible on PM (500 regression)
- `src/services/api.ts` `rfqApi.getQuotations`:
  - Diagnostic log now includes the full `raw` backend body alongside status/role for the backend ticket.
  - Response shape is normalized so downstream code can always read `data.quotations`, even if the backend serializes the list under `data.data.quotations`, `results`, `items`, or returns a bare array.
- `src/components/RFQManagement.tsx` `fetchEnhancedQuotations` now surfaces a destructive toast with the real backend error message when `getQuotations` fails, instead of silently returning `null` (which left the PM staring at an empty comparison view).
- **Backend ask (BLOCKING):** `GET /api/rfqs/{rfqId}/quotations` 500 needs root-cause + fix on the backend. The new diagnostic + raw-body log on the frontend gives the trace; once a failing call is captured, attach the `[BugE/getQuotations]` console payload to the backend ticket.

## Batch 1 — Sub-batch 1.3 (Bugs C + D)

### Bug C — RFQ buyer-context dropped before vendor sees it
- `src/pages/VendorPortal.tsx`: extended `vendorRfqs` state shape with optional `payment_milestones` / `paymentMilestones`, `additional_notes` / `additionalNotes` / `notes`, `terms_conditions` / `termsConditions`, and `attachments` / `supportingDocuments`. Mapping that builds the `rfqs` prop for `VendorQuoteSubmission` now forwards every one of those.
- `src/components/VendorQuoteSubmission.tsx`: extended props to accept the optional fields and added a "Buyer's requested terms" block in the Selected RFQ panel rendering proposed payment terms, a milestones list (label + trigger + %), additional notes, terms & conditions, and a list of supporting-document links (uses `normalizeAttachments`).
- **Backend ask:** `GET /vendors/rfqs` and `GET /vendors/rfqs/{id}` must return `payment_milestones`, `additional_notes`, `terms_conditions`, and `attachments` for each RFQ row. If any of those are stored on the linked MRF instead of the RFQ, surface them on the vendor-facing response anyway.

### Bug D — Custom payment-terms split in vendor portal
- `src/components/VendorQuoteSubmission.tsx`: removed the bespoke advance/balance numeric inputs and dropped in `PaymentMilestoneBuilder` (templates + custom rows, sum-to-100 validation). State trackers: `customMilestones`, `customMilestonesValid`. Form reset clears both.
- On submit, when `paymentTerms === 'custom-split'`:
  - `payment_terms` is serialized to a human label like `"Custom: 30% / 40% / 30%"`.
  - A structured `paymentMilestones: PaymentMilestoneInput[]` is forwarded through the `onSubmit` prop.
- `src/pages/VendorPortal.tsx`: vendor-side submit handler maps `paymentMilestones` → `payment_milestones: [{label, percentage, trigger_condition}]` on the `quotationData` sent to `vendorPortalApi.submitQuotation`.
- `src/services/api.ts` `vendorPortalApi.submitQuotation`: type now includes optional `payment_milestones`; field is forwarded in both the JSON payload and the FormData payload (JSON-stringified under `payment_milestones`).
- **Backend ask:** `POST /api/rfqs/{id}/submit-quotation` must accept and persist `payment_milestones: [{label, percentage, trigger_condition}]`. Echo the persisted array on the quotation detail response so PM-side comparison and downstream PO generation can read it directly.

## Sub-batch 1.4 — PO form refactor (1a/1b/1c)

### 1a — Multiple line items per supplier
- `src/components/procurement/PriceComparisonTable.tsx`: added a `+ Line item` (Copy icon) button per row. Clicking it inserts a new row directly below, pre-filled with the same `vendor_id` (directory mode) or a clone of `manual_vendor` (manual mode), with item/qty/price fields empty. Backend payload remains a flat `rows[]` keyed by supplier; no schema change required — multiple rows can already share the same `vendor_id` / `manual_vendor.name`.

### 1b — Remove min-2-supplier guard
- `validatePriceComparison` no longer pushes `"Add at least two supplier rows."` — replaced with a length ≥ 1 check.
- `CreatePOForm` initial state now seeds **one** row (was two). Remove button disabled only at `length <= 1`.
- Supporting copy in `PriceComparisonTable` updated to "Add one or more supplier quotes" and explains the new `+ Line item` affordance.

### 1c — Required-field audit (inline + top-summary errors)
- `PriceComparisonTable`: per-row field error map (`computeRowFieldErrors`) drives red borders + inline `<p className="text-destructive">` messages on the supplier, item description, unit price, and qty cells. `aria-invalid` is set so screen readers pick it up.
- `CreatePOForm`: new `section1Errors` memo lists each missing/invalid PO-detail field; `blockingErrors` concatenates Section 1 + Section 2 errors and renders a destructive summary card directly above the footer when present. Generate & Route tooltip now points at the summary count instead of the previous generic copy.

### Files Edited
- `src/components/procurement/PriceComparisonTable.tsx`
- `src/components/procurement/CreatePOForm.tsx`
- `.lovable/plan.md`

## Sub-batch 1.4 (revision) — Multi line-items-per-supplier, end-to-end

Earlier 1a added a per-row "+ Line item" button, but the PO PDF model only ever rendered the single selected row, so extra rows were lost on the generated PO and on the Review PO screen. That button was removed, and the feature is now re-implemented correctly with end-to-end rendering.

### Frontend behaviour
- `src/components/procurement/PriceComparisonTable.tsx`:
  - New header action **"+ Add line item for {supplier}"** (disabled until a supplier row is marked as selected). Clicking it appends a new row that clones the selected row's supplier identity (`vendor_id` for directory mode, or a copy of `manual_vendor` for manual mode) with empty `item_description` / `quantity` / `unit_price` and `is_selected: false`.
  - "+ Add Supplier" still adds a fresh empty row for a competing quote.
  - The `is_selected` radio remains supplier-level — only one row carries the radio. All rows sharing that supplier identity are treated as line items on the PO.
- `src/utils/emeraldPoDocumentModel.ts` `buildEmeraldPoDisplayModel`:
  - New `supplierKey()` derives a stable identity from `vendor_id` or trimmed/lowercased manual vendor name.
  - `lineItems` is now built from **every row whose `supplierKey` matches the selected row's `supplierKey`**, not just the selected row.
  - `subtotal` = sum of `qty * unit_price` across all supplier line items; `taxAmount` and `total` recompute from the new subtotal. `EmeraldPurchaseOrderPreview` and `emeraldPOPdf` already iterate `model.lineItems`, so both the review screen and the generated PDF now correctly show one row per line item with one grand total.

### Backend contract (no schema change required, but please confirm)
- `POST /api/mrfs/{id}/price-comparison` already accepts `rows: PriceComparisonEntry[]` — the frontend continues to send the **full** array (competing quotes + extra line items for the selected supplier). No new fields.
- The selected supplier on a PO is identified by the row with `is_selected: true`. All rows sharing the same `vendor_id` (or, for manual entries, the same trimmed/case-insensitive `manual_vendor.name`) as the selected row are the line items of the generated PO.
- When generating/finalising the PO (`POST /api/mrfs/{id}/generate-po`), the backend should:
  1. Resolve the selected supplier from the saved price comparison (`is_selected === true`).
  2. Collect **all** rows matching that supplier's identity as PO line items (preserve order).
  3. Use `SUM(qty * unit_price)` over those rows as the PO subtotal (apply `tax_rate` as before).
  4. Persist each line item on the PO so downstream views (`unsigned_po_url`, `signed_po_url`, payments, GRN) reflect the multi-line PO.
- Non-selected rows for OTHER suppliers remain competing quotes only — they must not appear on the PO.
- No new endpoints, no new fields, no migration. If the backend currently picks "the selected row" as the single PO line, please widen that to "all rows matching the selected supplier's identity" using the rule above.

### Files Edited
- `src/components/procurement/PriceComparisonTable.tsx`
- `src/utils/emeraldPoDocumentModel.ts`
- `frontend_changes.md`

## Batch 2 — Item 3: PM MRF delete at any stage

### Frontend behaviour
- `src/pages/Procurement.tsx`:
  - Removed the `isEarlyStage` / `hasPO` gate on the Active MRF list's Delete button. Procurement Managers (`role === "procurement_manager"` or `"procurement"`) now see Delete on every MRF regardless of status, current stage, or whether a PO already exists.
  - Added the same Delete button on the **All MRFs** tab (previously read-only), gated by the same role check, so PMs can purge MRFs from the comprehensive list view too.
  - Delete `AlertDialog` copy rewritten to explicitly warn that deletion is permanent and cascades to: linked RFQs, vendor quotations, draft and generated POs, approvals, and audit history. Also notes that vendors who already received an RFQ may still hold a copy.
  - Action wiring unchanged: `handleDeleteMRF(getMrfApiId(mrf))` → `confirmDeleteMRF()` → `mrfApi.delete(uuid)` → `fetchMRFs()`.

### Backend contract
- `DELETE /api/mrfs/{id}` must accept deletions from `procurement_manager` / `procurement` roles at any workflow stage — including MRFs that already have a generated/signed PO, payment milestones, or completed GRN. No new fields, no new endpoint.
- Cascade behaviour expected on the backend (please confirm):
  1. Soft- or hard-delete the MRF row.
  2. Cascade: linked RFQs, vendor quotations, price comparison rows, draft and generated PO rows (including S3 PO PDFs), approvals, line-item P&L, payment milestones, and audit-trail entries.
  3. Suppress vendor-facing notifications on cascade (vendors do not need to be told the MRF was deleted).
  4. Emit a single `mrf.deleted` audit event capturing the actor (`user_id`, role) and the prior stage.
- Response shape unchanged: `{ success: true }` or `{ success: false, error: string }`.

### Files Edited
- `src/pages/Procurement.tsx`
- `mem://access-control/mrf-deletion-permissions`
- `.lovable/plan.md`

## Batch 2 — Item 8: Trip scheduling (8a / 8d / 8e)

### 8a — External drivers (DONE)
- `src/components/logistics/TripScheduling.tsx` Create + Edit Trip dialogs: new **"Use external driver"** `Switch` block under the passenger picker. When ON, the internal driver select is hidden (via `EligiblePassengerPicker` `showDriver={false}`) and three inputs appear: **Name *** , **Phone *** , **License #** (optional).
- Validation: when the switch is ON, both `name` and `phone` are required; otherwise the form blocks with a destructive toast.
- Payload: `driver_user_id` is sent only for internal drivers. When external is selected, payload includes `external_driver: { name, phone, license_number? }` and omits `driver_user_id`.
- Edit dialog round-trips: if a trip carries an `external_driver` block (or has a `driverName` / `driverPhone` without `driver_id`), the switch starts ON and the inputs are prefilled.

### 8d — Accommodation cross-link (DONE)
- `AccommodationBookings.tsx` (already in place) now listens for a new `accommodation:prefill` `CustomEvent` and opens its create dialog with the trip's passenger names, destination, and check-in date prefilled, with `linkedTripId` set to the originating trip.
- `TripScheduling`'s row dropdown gained a **Book Accommodation** action that fires two events: `logistics:set-tab` → `"accommodation"` (handled by `Logistics.tsx`'s new `useEffect` listener that drives `setActiveTab`) and `accommodation:prefill` with the trip payload.
- Net effect: from any trip row, one click switches to the Accommodation tab and opens the create dialog already linked to that trip — no data re-entry.

### 8e — Edit passenger list (DONE)
- New **Edit Passengers** dropdown action on each trip row (visible for `personnel` and `mixed` trip types) opens a focused dialog that hosts only the `EligiblePassengerPicker` (no driver, no other trip fields).
- Saves via `tripsApi.update(tripId, { passenger_user_ids: number[] })`, then re-fetches trips. The full Edit Trip dialog still works for everything else; this is the lightweight "add/remove a passenger" path.

### 8b — Notifications (backend-only, not in this batch)
- No frontend changes. Backend should continue to fire passenger / driver notifications on trip create, passenger-list change, and reassignment per existing email service spec.

### Backend contract (asks)
- `POST /api/trips` and `PUT /api/trips/{id}` must accept `external_driver: { name: string; phone: string; license_number?: string }` and persist it on the trip row alongside (or instead of) `driver_user_id`. The two fields are mutually exclusive per trip; if both are sent, prefer `driver_user_id` and ignore `external_driver` (or 422 with a clear field error).
- `PUT /api/trips/{id}` must accept a partial body containing only `{ passenger_user_ids: number[] }` for the lightweight Edit Passengers flow. Backend should compute additions vs removals and trigger the appropriate passenger notifications (8b).
- `GET /api/trips/{id}` should return the persisted `external_driver` block when present, so the Edit Trip dialog can round-trip the values. Either snake_case or nested camelCase is fine — the normalizer already accepts both.
- No new endpoints, no migration beyond an `external_driver` JSON column (or three columns) on the `trips` table.

### Files Edited
- `src/components/logistics/TripScheduling.tsx`
- `src/components/logistics/AccommodationBookings.tsx`
- `src/pages/Logistics.tsx`
- `.lovable/plan.md`

---

## Batch 2 — Item 9: Fleet / Driver / Maintenance

### Scope reconciliation
- **Driver phone + licence + email-optional** — already shipped in `DriverManagement.tsx` (phone required with 10-digit validation, email optional with helper text, licence-number field present, phone column in driver table). No further changes.
- **Vehicle edit form** — already shipped in `FleetManagement.tsx` (`openEditVehicle` + `handleUpdateVehicle`, edit dialog reuses the Add Vehicle form with all fields: name, plate, type, ownership, make/model/year, capacities, fuel, colour). No further changes.
- **Maintenance module** — already shipped (`VehicleMaintenanceTab.tsx`, `UpcomingMaintenanceWidget.tsx`, add/edit/mark-complete, schedule + inline history merge, auto-calculated next-due date, document attachments). No further changes.
- **Gap addressed in this item: driver-level documents** — `DriverManagement` previously only stored a licence-number string. There was no surface to upload or view the actual licence file, LASDRI card, training certs, etc. This is required by the same expiry-tracking pattern used for vehicles.

### What shipped (frontend)
- `src/services/logisticsApi.ts` — extended `driversApi` with three methods:
  - `listDocuments(driverId)` → `GET /api/fleet/drivers/{id}/documents`
  - `uploadDocument(driverId, file, document_type, expires_at?)` → `POST /api/fleet/drivers/{id}/documents` (multipart: `file`, `document_type`, optional `expires_at`)
  - `deleteDocument(driverId, documentId)` → `DELETE /api/fleet/drivers/{id}/documents/{doc_id}`
- `src/components/logistics/DriverDocumentsDialog.tsx` (new) — modal with two regions:
  - **Upload region**: document-type dropdown (Driver's Licence, LASDRI Card, Training Certificate, Medical Certificate, ID Card, Other), expiry date, file input (`.pdf,.png,.jpg,.jpeg,.webp`), Upload button.
  - **Documents table**: Type, File (link to `file_url`/`url`/`s3_url`), Uploaded date, Expiry, colour-coded Status badge (Valid / Expiring Soon / Critical / Expired — same 6-week / 42-day / 7-day tiers as `VehicleDocumentsTab`), Delete action.
- `src/components/logistics/DriverManagement.tsx` — added a `FileText` row action ("Manage documents", role-gated to `logistics_manager`/`admin`) that opens `DriverDocumentsDialog` for the selected driver.

### Backend asks (BLOCKING)
- `GET /api/fleet/drivers/{id}/documents` — return an array (or `{ documents: [] }`) of `{ id, document_type, name|file_name, file_url|url|s3_url, uploaded_at|created_at, expires_at }`.
- `POST /api/fleet/drivers/{id}/documents` — accept multipart `file`, `document_type`, optional `expires_at`. Persist to S3 (same bucket/pattern as vehicle documents) and return the created row.
- `DELETE /api/fleet/drivers/{id}/documents/{doc_id}` — remove the row and the S3 object.
- Reuse the existing document-expiry notification job: drivers with documents in the Critical (≤7d) or Expired tier should generate the same in-app + email alerts that vehicle documents do; route them to logistics managers and the driver's supervisor.
- No schema change requested beyond the standard `documents` table picking up an `owner_type='driver'` / `owner_id` pair, mirroring vehicles.

### Files Edited
- `src/services/logisticsApi.ts`
- `src/components/logistics/DriverManagement.tsx`
- `src/components/logistics/DriverDocumentsDialog.tsx` (new)
- `.lovable/plan.md`

---

## Batch 2 — Item 7: Vendor portal + PM RFQ visibility

### Scope reconciliation
- **Vendor portal** — Bug C (RFQ completeness: payment milestones, additional notes, T&Cs, attachments) was already shipped in Batch 1 (see `VendorPortal` / `VendorQuoteSubmission` "Buyer's requested terms" block). 0b audit surfaced no further broken capabilities, so the portal needs no additional frontend work in this item.
- **PM RFQ visibility** — this is where Item 7 lands. Procurement Managers needed per-submission commercial terms, the RFQ deadline, a compact comparison view, and a place to capture their internal evaluation reasoning. All four are now on the **Compare Quotations** dialog in `RFQManagement.tsx`.

### What shipped (frontend)
- `src/services/api.ts` — added `quotationEvaluationApi.save(quotationId, { evaluation_notes?, evaluation_score? })` → `PUT /api/quotations/{id}/evaluation`.
- `src/components/RFQManagement.tsx`
  - **Deadline display**: dialog description now shows `Submission deadline: <date>` (Clock icon) for the selected RFQ.
  - **View toggle**: `Cards` (existing layout enriched) vs `Side-by-side` table.
  - **Per-submission terms inline (Cards view)**: new muted panel below the 4-metric grid showing **Payment Terms**, **Validity**, **Warranty** — sourced from `quote.paymentTerms`, `quote.validityDays`, `quote.warrantyPeriod` via `displayString` / `formatDays`. No more round-trip to the detail dialog to read commercial terms.
  - **Evaluation block (Cards view)**: per-card `Textarea` for internal notes + `Input[type=number, 0-10, step 0.5]` for a manual score + `Save evaluation` button. Drafts kept in `evalDrafts` state, seeded from `evaluation_notes` / `evaluation_score` on the fetched quotation payload so reloads preserve prior decisions. Validation: score must be `0 ≤ x ≤ 10` or empty.
  - **Side-by-side table view**: columns Vendor, Price, Delivery, Valid Until, Payment Terms, Validity, Warranty, Score, Evaluation snippet, Action (View / Award). Recommended row gets a soft success background. All Award actions reuse the existing `awardReasonOpen` confirmation flow.

### Backend asks (BLOCKING)
1. `PUT /api/quotations/{id}/evaluation` — accept `{ evaluation_notes?: string, evaluation_score?: number|null }` from procurement role. Persist on the quotations row. Return the updated quotation.
   - `evaluation_score` is a decimal 0–10 (allow 0.5 step). Treat `null` as "clear".
   - Reject from non-procurement roles with 403.
2. **Include evaluation fields on every quotation read**:
   - `GET /api/rfqs/{id}/quotations` (wrapped + flat fallback)
   - `GET /api/quotations/rfq/{rfqId}`
   - `GET /api/quotations/{id}`
   - Each quotation row must carry `evaluation_notes`, `evaluation_score`, and `evaluation_updated_at` (ISO8601). Snake_case is canonical; camelCase aliases are accepted by the frontend normalizer.
3. **Audit trail**: log an `quotation.evaluation_saved` event per save with `actor_id`, `quotation_id`, `score`, and a truncated `notes` preview (first 120 chars). Surface in the existing MRF activity feed.
4. No new tables required — add the three columns to the existing `quotations` table; default `evaluation_score` to NULL and `evaluation_notes` to NULL.

### Files Edited
- `src/services/api.ts`
- `src/components/RFQManagement.tsx`
- `.lovable/plan.md`

---

## Batch 3 — SMS / Termii (documentation only)

**No frontend code in this batch.** Termii is the chosen SMS gateway. This entry locks the contract so backend can implement and the frontend can wire surfaces in a later batch without re-litigating shape.

### Provider
- **Termii** (https://termii.com) — Nigerian carriers, alphanumeric sender ID support, delivery receipts via webhook.
- Account: shared Oando ops Termii workspace. API key issued per environment (staging / production).

### Endpoint contract (backend, to implement)

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/notifications/sms/send` | Internal: enqueue a single SMS. Body: `{ to: E.164, message: string ≤459, trigger: enum, entity_type?: string, entity_id?: string }`. Returns `{ queued: true, log_id }`. |
| `POST` | `/api/webhooks/termii/dlr` | Termii delivery-receipt webhook. Updates the log row's `status` + `delivered_at`. Signature verified via `TERMII_DLR_SECRET`. |
| `GET`  | `/api/notifications/sms/logs` | Admin-only. Paginated log feed for the future UI surface. Filters: `trigger`, `status`, `to`, `date_from`, `date_to`. |

Roles: send endpoint is internal (called from job dispatchers, never the browser). Log feed is gated to `admin` + `supply_chain_director` for audit.

### Environment variables (backend)
- `TERMII_API_KEY` — per-environment.
- `TERMII_SENDER_ID` — alphanumeric, max 11 chars (e.g. `OANDO`). Must be pre-registered with Termii.
- `TERMII_BASE_URL` — default `https://api.ng.termii.com/api`.
- `TERMII_DLR_SECRET` — shared secret for the DLR webhook signature header.
- `SMS_ENABLED` — feature flag; when `false` the job logs the payload and short-circuits without calling Termii.

None of these are needed in the SPA. Do NOT add them to `.env` / `.env.example` on the frontend.

### Queue
- All SMS sends go through the existing Laravel queue (`queue:work`), connection `redis`, queue name `sms`.
- Job class: `App\Jobs\SendTermiiSms`. Retries: 3 with exponential backoff (10s / 30s / 90s). Failed jobs land in `failed_jobs` with the original payload.

### Log table
- `sms_logs` (new):
  - `id` (uuid)
  - `to` (string, E.164)
  - `message` (text)
  - `trigger` (enum, see triggers below)
  - `entity_type` / `entity_id` (nullable polymorphic ref, e.g. `mrf` / `<uuid>`)
  - `status` (enum: `queued` | `sent` | `delivered` | `failed` | `expired`)
  - `termii_message_id` (nullable)
  - `error` (nullable, text)
  - `cost` (nullable, decimal — Termii reports per-message cost in DLR)
  - `queued_at`, `sent_at`, `delivered_at`, `failed_at` (timestamps)
- Indexes on `(trigger, status)`, `(entity_type, entity_id)`, `(to, created_at)`.

### Triggers (initial set)
SMS is sent **in addition to** existing email + in-app notifications, never instead of. Each trigger is gated by the recipient's `NotificationPreferences.sms_enabled` flag (default OFF until the user opts in on the future Settings surface).

| Trigger key | When it fires | Recipient | Sample body (≤160 chars) |
| --- | --- | --- | --- |
| `mrf.approval_required` | MRF reaches an approver's queue | Approver | `Oando ERP: MRF {{mrf_id}} needs your approval. Open the portal to review.` |
| `mrf.rejected` | MRF rejected at any stage | Requester | `Oando ERP: MRF {{mrf_id}} was rejected. Reason: {{reason}}.` |
| `po.signed` | SCD signs a PO | Requester + Vendor primary contact | `Oando ERP: PO {{po_number}} has been signed and dispatched.` |
| `rfq.invitation` | RFQ sent to a vendor | Vendor primary contact | `Oando ERP: New RFQ {{rfq_id}} — submit your quote by {{deadline}}.` |
| `trip.assigned` | Trip assignment lands on a driver / passenger | Driver + each passenger | `Oando trip {{trip_id}}: {{origin}} → {{destination}} on {{date}} {{time}}.` |
| `document.expiring` | Vehicle or driver document tips into "Critical" (≤7 days) | Logistics manager + driver | `Oando ERP: {{doc_type}} for {{subject}} expires in {{days}} days.` |

Bodies are rendered from Blade templates under `resources/views/sms/`. Variables resolve against the same notification payload the email + in-app channels use.

### Recipient resolution
- Internal users: phone from `users.phone` (Nigerian format normalised to E.164 on save).
- Vendors: phone from `vendors.primary_contact_phone` (already collected during registration).
- External trip drivers: phone from `logistics_trips.external_driver.phone` (added in Batch 2 Item 8).
- If a recipient has no valid E.164 phone, the job logs `status: 'failed', error: 'no_phone'` and does not call Termii.

### Future UI surfaces (NOT in this batch)
Documented here so they don't surprise a future agent:
1. **Settings → Notification Preferences**: add an "SMS" column next to Email / In-app for each trigger. Wire to `NotificationPreferences.sms_enabled` per trigger key.
2. **Admin → SMS Logs**: paginated table backed by `GET /api/notifications/sms/logs` with the filters listed above. Columns: timestamp, to, trigger, entity link, status, cost, error. Resend action for `failed` rows (admin only).
3. **User profile**: phone field becomes mandatory once `sms_enabled` is toggled on for any trigger; surface validator error if missing.

### Out of scope for Batch 3
- No frontend code, no env additions, no UI components. Strictly contract + ops documentation so backend can ship the integration independently.
- Bulk / marketing SMS, OTP, two-way replies — not in scope. Termii supports them but no current trigger needs them.

### Files Edited
- `.lovable/plan.md` (Batch 3 marked DONE)
- `frontend_changes.md` (this entry)

---

## PO Form — Supplier-Card Restructure + Edit / Regenerate (Batch 4)

### Problem
The Create / Manual PO form previously treated each line item as its own
supplier row in a flat table. Adding multiple items for the same vendor created
visually duplicated supplier entries, the Review section counted each line as
a distinct supplier, and there was no way to edit a PO after generating it.

### Form restructure (CreatePOForm + PriceComparisonTable)
- `PriceComparisonTable` rewritten from a flat table to **supplier cards**.
  Each card shows supplier identity (Directory or Manual toggle + selector,
  contact fields, notes) **once at the top**, and a nested line-items table
  beneath it (description, unit price, qty, total, remove).
- Top-of-card radio selects that supplier as the winning vendor for the PO.
- **Add Supplier** creates a new supplier card with one empty line item.
- **Add line item** (inside a card) appends a row to that card only — it
  never spawns a new supplier.
- **Remove supplier** removes the entire card plus all its line items.
- Subtotal per supplier is rendered in the card footer.
- Supplier identity edits (vendor pick, manual name, contact fields) are
  propagated to every line item in that card via `updateGroup`, so all rows
  remain consistent with one supplier.

### Data model
- `PriceComparisonRow` gains an optional `group_key: string` — a local-only,
  stable identifier shared by every row belonging to the same supplier card.
  `makeEmptyRow` always generates one for new rows. Hydration from the backend
  reuses `vendor_id` / manual name to derive a stable group key so existing
  multi-row payloads snap into one card automatically.
- `group_key` is stripped by `serializeRow` before hitting the backend; no
  contract change is required for `PUT /api/mrfs/{id}/price-comparisons`.

### Review section (Section 3)
- Comparison counter now reads **"Comparison (N suppliers)"** where N is the
  number of distinct supplier groups, not the number of line items.
- Each supplier is rendered as a sub-card listing its line items with qty,
  unit price, and line total. The supplier subtotal sums every line for that
  supplier. The selected supplier is highlighted.
- The Emerald PO preview was already supplier-grouped (selects all rows
  belonging to the winning supplier) — no change needed there.

### Edit / Regenerate after submission
- Finalised banner now shows an **Edit PO** button. Clicking it sets
  `editingFinalised = true`, which:
  - re-enables every input on the form (PO details, T&C, milestones, supplier
    cards, line items),
  - swaps the primary action button to **"Regenerate & replace SCD queue"**,
  - renders a warning banner explaining the consequence.
- On regenerate, the form calls `procurementApi.finalisePO()` with a new
  `regenerate: true` flag on the existing `POST /api/mrfs/{id}/generate-po`
  endpoint and shows a success toast confirming the SCD queue replacement.
- Cancelling edit returns the form to read-only finalised state without
  touching the server.

### Backend asks (BLOCKING for regenerate)
- `POST /api/mrfs/{id}/generate-po` must accept an optional
  `regenerate: boolean` field (alongside the existing `fast_track`,
  `allow_missing_rfq`, `save_as_draft` flags).
- When `regenerate: true`:
  1. Validate the MRF already has a finalised PO and that the caller is the
     PM/SCM role that owns it.
  2. Bump a `po_version` integer (1, 2, 3, …) on the MRF.
  3. Move the existing active PO PDF + price comparison snapshot into a
     `po_revisions` history table (audit trail) keyed by `mrf_id + version`.
  4. Generate the new PDF, write it as the active `unsigned_po_url`, and set
     `po_status = awaiting_scd_signature` (or the equivalent state for the
     SCD approval queue) — replacing any existing pending entry for the same
     `mrf_id`. The SCD must never see two pending versions of the same PO.
  5. Log a `po.regenerated` event on the MRF activity feed with metadata:
     `actor_id`, `previous_version`, `new_version`, `regenerated_at`.
- `GET /api/mrfs/{id}` should include `po_version` and a `po_history[]` array
  (each with `version`, `regenerated_at`, `regenerated_by`,
  `archived_pdf_url`) so the procurement UI can later render the history
  panel.
- The SCD's pending-POs list endpoint (whatever currently powers the SCD
  signature queue) must filter to the latest version per MRF — no UI change
  needed once backend enforces this.

### Type changes
- `POFormPayload` gains optional `regenerate?: boolean`.
- `PriceComparisonRow` gains optional local-only `group_key?: string`.

### Files Edited
- `src/types/procurement.ts`
- `src/components/procurement/PriceComparisonTable.tsx`
- `src/components/procurement/CreatePOForm.tsx`
- `.lovable/plan.md`
- `frontend_changes.md` (this entry)

---

## Logistics Module — Trip Request Flow, Notifications, Access, GRN Layout (Jun 2026)

### Principle
Every backend action or state change must have a corresponding visible UI surface for the relevant user. This batch wires (or documents) the frontend surfaces for trip requests, journey tracking, delivery confirmations, and role access that were previously backend-only or disconnected.

---

### 1. Trip request flow — end-to-end (frontend)

#### New UI surfaces
| Surface | Path | Purpose |
| --- | --- | --- |
| **Pending Trip Requests** (Overview compact + dedicated tab) | `/logistics` → Overview panel + **Requests** tab | Logistics Manager lists incoming staff trip requests and acts on them |
| **Approve & assign dialog** | `TripRequestApprovalDialog` | LM approves request, picks vehicle + driver (system user or external) |
| **Trip comments** | `TripCommentsPanel` | Staff/passengers/LM leave comments visible throughout trip lifecycle |
| **Trip detail page** | `/trips/:id` | Full trip record: passengers, vehicle, driver, comments, embedded journey tracker |
| **Journey tab** | `/logistics` → Journeys | Lists trackable trips and pulls journey data from the same trip id created at approval |

#### New / extended components
- `src/components/logistics/PendingTripRequestsPanel.tsx` — table of pending requests with View + Approve actions
- `src/components/logistics/TripRequestApprovalDialog.tsx` — confirm + assign vehicle/driver UI
- `src/components/logistics/TripCommentsPanel.tsx` — fetch/post comments on trip-request or logistics-trip id
- `src/components/logistics/DeliveryConfirmationDetailSheet.tsx` — full MRF/SRF/trip context before GRN/JCC

#### Modified components
- `src/pages/Logistics.tsx` — added **Requests** tab; Overview shows compact pending-requests panel; removed **My Requests** tab; supports `?tab=trip-requests` deep link (notification action URL)
- `src/components/logistics/JourneyManagement.tsx` — fetches `GET /journeys` when available, else hydrates from `GET /trips` + per-trip `GET /journeys/{tripId}`; shows linked trip passengers, driver, vehicle; links to `/trips/:id`
- `src/pages/details/TripDetailPage.tsx` — passengers, comments, embedded `JourneyManagement`
- `src/components/logistics/TripRequestDetailDialog.tsx` — comments panel on staff request detail
- `src/components/logistics/LogisticsDeliveryConfirmations.tsx` — click row or eye icon → detail sheet with line items, vendor, PO ref before GRN/JCC

#### API client additions (`src/services/api.ts` — `tripRequestApi`)
| Method | Endpoint | Purpose |
| --- | --- | --- |
| `listPendingForLogistics()` | `GET /trip-requests?status=submitted` (+ client filter fallback) | Pending inbox for LM |
| `confirm(id, data)` | `POST /trip-requests/{id}/confirm` | Approve + assign vehicle/driver; creates linked logistics trip |
| `reject(id, reason?)` | `POST /trip-requests/{id}/reject` | Reject request |
| `getComments(id)` | `GET /trip-requests/{id}/comments` | List comments |
| `addComment(id, body)` | `POST /trip-requests/{id}/comments` | Post comment |

`confirm` payload shape (`TripConfirmAssignmentData`):
```json
{
  "vehicle_id": 12,
  "driver_type": "internal" | "external",
  "driver_user_id": 45,
  "external_driver": { "name": "...", "phone": "...", "email": "..." },
  "notes": "optional pickup instructions"
}
```

#### API client additions (`src/services/logisticsApi.ts`)
| Method | Endpoint | Purpose |
| --- | --- | --- |
| `journeysApi.list()` | `GET /journeys` | List all active journeys |
| `tripsApi.assignResources(id, data)` | `POST /trips/{id}/assign-resources` | Re-assign vehicle/driver on logistics trip |
| `tripsApi.getComments` / `addComment` | `GET/POST /trips/{id}/comments` | Comments on logistics trip record |

#### Type extensions
- `src/types/trip-request.ts` — `TripRequestPassenger`, `TripComment`, `TripConfirmAssignmentData`, extended `StaffTripRequest` fields (`trip_id`, passengers, driver, vehicle)
- `src/types/logistics.ts` — `TripResourceAssignmentData`, `ExternalDriverInfo`, `TripComment`

---

### 2. Notifications (trip request submitted)

#### Frontend
- `src/services/notificationService.ts` — new event `trip_request_submitted` targeting `logistics_manager`, `logistics`, `logistics_officer`; action URL `/logistics?tab=trip-requests`
- In-app notifications for LM **require backend** `POST /notifications` (or equivalent) on trip submit — client-side rules only fire for the **current user's role**, so a staff submitter cannot push an in-app notification into the LM's browser session from the SPA alone

#### Backend asks (BLOCKING for full notification flow)
On `POST /api/trip-requests` (successful create):
1. **Email** all users with role `logistics_manager` (and optionally `logistics_officer`) — subject/body: requester name, origin → destination, departure datetime, purpose, link to `/logistics?tab=trip-requests`
2. **In-app** notification row per LM user: `type: trip_request_submitted`, `action_url: /logistics?tab=trip-requests`, surfaced via existing `GET /api/notifications`

On `POST /api/trip-requests/{id}/confirm`:
1. Email external passengers (existing ask from Item 6) + internal passengers + assigned driver
2. In-app notifications: `trip_assigned_driver`, `trip_assigned_passenger`
3. Create **one** `logistics_trips` row (or equivalent) and link back via `trip_requests.trip_id` / `logistics_trip_id` in confirm response
4. Auto-create journey stub: `POST /journeys` with `{ tripId }` so Track Journey is populated immediately

On `POST /api/trip-requests/{id}/comments` and `POST /api/trips/{id}/comments`:
- Persist comment; notify trip requester, assigned driver, and passengers (in-app; email optional)

---

### 3. Logistics Manager role access

| Change | File | Detail |
| --- | --- | --- |
| **Procurement Overview** (read-only) | `src/App.tsx`, `src/pages/Procurement.tsx` | `logistics_manager` added to `PROCUREMENT_OVERVIEW_ROLES`; page title → "Procurement Overview"; view-only banner; create/approval actions remain gated by existing role checks |
| **Sidebar label** | `src/components/layout/AppSidebar.tsx` | "Procurement Activity" renamed → **Procurement Overview** |
| **Vendors view** | `src/pages/Vendors.tsx` | LM can view vendor list + profiles; **Add Vendor** hidden unless `canManageVendors` (procurement roles) |
| **Removed from Logistics section** | `src/pages/Logistics.tsx` | **My Requests** tab and embedded "My Procurement Activity" (`LogisticsMyRequestsList`) removed — LM uses `/department` sidebar link or Procurement Overview instead |

#### Backend asks (vendors)
- `GET /api/vendors` and `GET /api/vendors/{id}` must allow `logistics_manager` (read). If currently 403, add role to vendor list/detail policies without granting create/delete/invite.

---

### 4. Pending delivery confirmations — MRF/SRF visibility

- `DeliveryConfirmationDetailSheet` fetches `GET /api/mrfs/{id}` (falls back to `GET /api/srfs/{id}`) and renders: reference, PO number, vendor, category, justification, **line items table** (description, unit, qty, unit price, total)
- Trip JCC path shows route, status, vendor/driver from the completed trip object
- User must review detail sheet before tapping **Generate GRN** / **Generate JCC**

#### Backend ask
- Ensure `GET /api/mrfs/{id}` returns `items[]` with `item_name`, `quantity`, `unit`, `unit_price`, `vendor_name`, `po_number` for every PO-linked MRF in the pending-GRN queue

---

### 5. GRN dialog layout fix

- `src/components/GRNCompletionDialog.tsx` — `DialogContent` widened to `w-[95vw] max-w-6xl max-h-[90vh]` (was default `max-w-lg` ≈ 512px)
- Line items table: added **Unit price** and **Total** columns; `min-w-[640px]` table inside `overflow-x-auto` container
- Applies to both **Generate** and **Upload** tabs (shared dialog shell)

---

### 6. Navigation summary (Logistics Manager)

| Sidebar | In-page Logistics tabs |
| --- | --- |
| Dashboard | Overview (stats + pending trip requests + delivery confirmations) |
| My Requests → `/department` | Trips, **Requests**, Journeys, Fleet, … |
| Logistics | *(My Requests tab removed)* |
| Vendors | |
| Procurement Overview → `/procurement` (read-only) | |

---

### 7. Files edited (this batch)

**New**
- `src/components/logistics/PendingTripRequestsPanel.tsx`
- `src/components/logistics/TripRequestApprovalDialog.tsx`
- `src/components/logistics/TripCommentsPanel.tsx`
- `src/components/logistics/DeliveryConfirmationDetailSheet.tsx`

**Modified**
- `src/services/api.ts`
- `src/services/logisticsApi.ts`
- `src/types/trip-request.ts`
- `src/types/logistics.ts`
- `src/pages/Logistics.tsx`
- `src/pages/Procurement.tsx`
- `src/pages/Vendors.tsx`
- `src/pages/details/TripDetailPage.tsx`
- `src/App.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/GRNCompletionDialog.tsx`
- `src/components/logistics/JourneyManagement.tsx`
- `src/components/logistics/LogisticsDeliveryConfirmations.tsx`
- `src/components/logistics/TripRequestDetailDialog.tsx`
- `src/services/notificationService.ts`
- `frontend_changes.md` (this entry)

---

### 8. Verification checklist (staging)

1. Staff submits trip request → LM sees row on **Logistics → Overview** pending panel (after backend lists `submitted` status).
2. LM opens Approve → assigns vehicle + internal driver → confirm succeeds → trip appears on Trips tab and Journeys tab.
3. LM assigns external driver → `external_driver` echoed on `GET /trips/{id}`.
4. `/trips/{id}` shows passengers, comments, journey tracker for the **same** id returned from confirm.
5. LM opens `/vendors` → sees vendor list (no Add Vendor button).
6. Pending delivery confirmation → eye icon → MRF line items visible → Generate GRN opens wide dialog with full table columns.
7. Backend: LM receives email + in-app notification on new trip request (requires backend notification dispatch).

---

## Logistics follow-up — Remove Requests tab & Procurement Overview; All Trips browse (Jun 2026)

### Removed (later revised)
- **Logistics → Requests tab** — removed from `src/pages/Logistics.tsx`. LM pending-approval inbox remains on the **Overview** tab only (`PendingTripRequestsPanel` compact).
- ~~**Procurement Overview for Logistics Manager**~~ — **re-added** (see below). Sidebar link, route gate, and read-only procurement page restored for `logistics_manager`.

### Re-added — Procurement Overview for Logistics Manager
- `src/components/layout/AppSidebar.tsx` — **Procurement → Procurement Overview** (`/procurement`) in Logistics Manager sidebar (between Operations and Analytics).
- `src/App.tsx` — `ProcurementRoute` uses `canAccessProcurementPage()` from `src/utils/procurementAccess.ts` (includes `logistics_manager`).
- `src/pages/Procurement.tsx` — read-only title **Procurement Overview**, subtitle, info banner; **Create PO** hidden when `isProcurementOverviewOnly`.
- `src/utils/procurementAccess.ts` — shared `PROCUREMENT_OVERVIEW_ROLES`, `canAccessProcurementPage()`, `isProcurementOverviewOnly()`.

**Backend ask:** `GET /api/mrfs`, `GET /api/srfs`, and `GET /api/dashboard/procurement-manager` (or a dedicated read-only overview endpoint) must return **200** for `logistics_manager` — otherwise the overview page loads empty. View-only; no POST/PATCH/DELETE for this role.

### Added — Organization-wide trip visibility (§10)

| Surface | Route | Audience |
| --- | --- | --- |
| **All Trips** browse | `/trips` | Every authenticated staff member |
| **Trip request detail** | `/trip-requests/:id` | Read-only org-wide; approve/assign only when `canManage` / logistics role |
| **Logistics trip detail** | `/trips/:id` | Read-only when `viewer.readOnly === true` |

**New files**
- `src/pages/AllTrips.tsx` — searchable/filterable org-wide list (`tripRequestApi.listAll` → `GET /trip-requests/all`)
- `src/pages/details/TripRequestDetailPage.tsx` — full request detail with progress, passengers, comments, journey (when linked), approve dialog for LM only
- `src/utils/tripViewer.ts` — `resolveTripViewer()`, `resolveLogisticsTripId()` helpers

**API client**
- `tripRequestApi.listAll({ status?, q?, limit? })` → `GET /api/trip-requests/all`
- `getById` / `getComments` now parse `viewer`, `readOnly`, `canManage`, `canComment`
- `tripsApi.getComments` returns `{ comments, canComment }`

**Read-only behaviour**
- `TripCommentsPanel` hides composer when `readOnly` or `canComment === false`
- `TripRequestDetailPage` hides **Approve & assign** when `viewer.readOnly` (unless `canManage`)
- `TripDetailPage` shows read-only alert and respects `canComment`

**Sidebar — Travel section** (all roles): **All Trips** + **Trip Request** (when user can create). Added to employee, finance, logistics_manager, logistics_officer, and full procurement nav.

### Backend asks (§10)
- Ship `GET /api/trip-requests/all` with `requesterName`, `requesterDepartment`, `logisticsTripId`, `viewer` block per row.
- Relax read access on detail/comment GET endpoints for any authenticated user; gate `POST` comments to involved staff + logistics (`canComment` flag on GET).
- Echo `viewer: { isInvolved, canManage, readOnly }` on `GET /trip-requests/{id}` and `GET /trips/{id}`.

### Updated verification
1. Any staff opens **All Trips** from sidebar → sees org-wide list.
2. Click row → `/trip-requests/:id` opens read-only for non-involved staff (no approve, no comment composer).
3. LM still sees pending queue on **Logistics → Overview** (not a separate tab).
4. LM opens **Procurement Overview** from sidebar → read-only stats and MRF/SRF lists at `/procurement`.

---

## 11. Procurement Overview — Logistics Manager (backend §11 + frontend wiring)

**Role:** `logistics_manager` (alias `logistics`)  
**Route:** `/procurement` — **Procurement Overview** (view-only)

### Backend contract (implemented server-side)
| Method | Path | LM access |
|--------|------|-----------|
| `GET` | `/api/mrfs` | Full org MRF list |
| `GET` | `/api/srfs` | Full org list; optional `?scope=logistics` / `?logistics_only=1` |
| `GET` | `/api/dashboard/procurement-manager` | Same payload as PM + `readOnly`, `isProcurementOverviewOnly`, `canManageProcurement` |
| `GET` | MRF/SRF detail reads | Allowed |
| `GET` | `/api/mrfs/{id}/available-actions` | `readOnly: true`; mutation flags stripped |
| Mutations | approve/reject, PO, GRN, uploads, etc. | **403** |

### Frontend wiring
| File | Change |
|------|--------|
| `src/utils/procurementAccess.ts` | `logistics` alias; `resolveProcurementOverviewMode()` merges API flags + client fallback |
| `src/utils/normalizeProcurementDashboard.ts` | Normalizes dashboard payload + KPIs from snake/camel case |
| `src/utils/stripReadOnlyActions.ts` | `applyReadOnlyAvailableActions()` when `available-actions` returns `readOnly` |
| `src/services/api.ts` | `dashboardApi.getProcurementManagerDashboard()` normalizes flags; `mrfApi.getAvailableActions` applies read-only strip |
| `src/types/index.ts` | `AvailableActions.readOnly?: boolean` |
| `src/pages/Procurement.tsx` | Loads `GET /dashboard/procurement-manager` on mount; API flags drive overview mode; KPIs from dashboard when present; hides **Create PO**, vendor registrations, MRN convert/reject when read-only |
| `src/components/MRFActionButtons.tsx` | Hides mutations when `readOnly`; still allows **Download PO** |

### Access helpers (mirror `App\Support\ProcurementOverviewAccess`)
- `canAccessProcurementPage(role)` — full procurement roles + LM overview roles
- `isProcurementOverviewOnly(role)` — client fallback (`logistics_manager` \| `logistics`)
- `resolveProcurementOverviewMode(role, apiFlags)` — prefer API flags from dashboard endpoint

### Verification (LM)
1. Sidebar **Procurement → Procurement Overview** visible for `logistics_manager`.
2. `/procurement` returns **200** for MRF/SRF lists and procurement-manager dashboard.
3. Read-only banner shown; **Create PO** and vendor registration review hidden.
4. MRF detail opens; `available-actions` shows no mutation buttons (download PO still works when file exists).
5. Workflow mutations return **403** if attempted via API.

---

## Batch 6 — Performance audit & fixes (perf primitives)

**Scope:** Findings + reusable primitives. No behavior changes to business modules — those are wired in a follow-up as we touch each page.

### Findings
- Vite build is healthy — heavy libs (`xlsx` 429KB, `pdf` 560KB) are already emitted as separate chunks; the remaining wins are keeping them off the initial critical path (async import) and virtualizing large tables.
- Code-splitting is in place via `src/routes/lazyPages.ts` — no route regressions to introduce.
- No `react-window`/`react-virtual` usage anywhere; large tables in Procurement / Vendors / SupplyChainDashboard render full DOM.
- Default `QueryClient` was missing `placeholderData: keepPreviousData`, so every background refetch flashed skeletons.
- No shared optimistic-mutation helper; delete/discard flows all wait on refetch.

### Shipped
| File | Change |
|------|--------|
| `src/lib/queryClient.ts` | Global `placeholderData: keepPreviousData`; retry now skips 4xx |
| `src/components/ui/VirtualizedTable.tsx` | New — `VirtualizedTable` + `VirtualizedList` using `@tanstack/react-virtual`, auto-off below threshold, sticky `<thead>`, shadcn-compatible markup |
| `src/lib/optimisticMutation.ts` | New — `optimisticListRemove` / `optimisticListUpdate` / `optimisticListInsert` with cancel + snapshot + rollback |
| `src/components/ui/PendingButton.tsx` | New — `<PendingButton isPending>` wrapper that swaps the leading icon for a spinner, disables, sets `aria-busy` |
| `src/utils/tableExport.ts` | `buildXlsxBlob` / `exportTableDataset` now async; `xlsx` moved from static to dynamic import so it doesn't ship on the critical path |
| `src/hooks/useTableExport.ts` | Awaits the newly async export |
| `package.json` | Added `@tanstack/react-virtual@^3` |

### Backend asks
None blocking. Future-facing: add `X-Total-Count` to any still-unbounded list endpoints so virtualization + windowed pagination can degrade gracefully.

### Adoption notes (for follow-up wiring)
1. Any list rendering more than ~50 rows should switch its `<Table>` body to `<VirtualizedTable>` — same `<tr>/<td>` markup, drop-in.
2. Every `useMutation` for CRUD should use one of the three helpers in `optimisticMutation.ts` inside `onMutate` and roll back in `onError`.
3. Every button that triggers a mutation should switch from `<Button>` + manual spinner to `<PendingButton isPending={mutation.isPending}>`.
4. When adding a new heavy dependency (>50KB), prefer `const mod = await import('...')` inside the async action, mirroring the pattern in `tableExport.ts`.
