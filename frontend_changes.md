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
