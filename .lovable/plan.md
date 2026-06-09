## Sequencing (v3 — verification gates explicit)

Four batches. Each gated by a verification checklist before the next can start.

---

## Batch 0 — Pre-flight verification

### 0a. Procurement Manager role recognition
- Test environment: **staging** (preview URL against live Render backend). Production not used; local does not exercise the real `/auth/me` shape.
- **Prerequisite:** vendor registration must be confirmed working in staging first. If registration is broken, fix it (or unblock CORS) before 0b runs — otherwise 0b's vendor user can't be created and the audit gives false negatives.
- Steps: log in as PM, capture `localStorage.userData.role` + `/auth/me`. Walk vendor registration review, RFQ send, MRF delete-button visibility (once added).
- If role string mismatches `role-permissions-and-aliasing-v4`, patch the alias map.
- Document confirmed role string in `frontend_changes.md`.

### 0b. Vendor portal capability audit (de-assumed)
- Environment: same staging vendor user from 0a prerequisite.
- Click through end-to-end: Submit Final Invoice, Submit RFQ Response, Quotation tracking.
- Result table per capability: works | broken | missing. Anything "broken" reclassifies to Batch 1.

### Gate to Batch 1
Both 0a and 0b complete with documented results. Reclassified bugs added to Batch 1 scope.

---

## Batch 1 — Bugs

### Reclassified from Batch 0b (priority order)
- **Bug E (Sub-batch 1.6 — IN PROGRESS, frontend fallback shipped).** RFQ vendor response not visible on PM, `GET /api/rfqs/{id}/quotations` 500. Vendor-side `submitQuotation` payload (`/api/rfqs/{id}/submit-quotation`) verified — items normalized to array, FormData / JSON branches correct, `validity_days` always populated. Frontend now: (1) logs full error context via `[BugE/getQuotations]` on every failure; (2) **falls back to `GET /quotations/rfq/{rfqId}` + `GET /rfqs/{rfqId}`** when the wrapped endpoint returns 0/undefined/5xx status, synthesizing the same `{ rfq, quotations:[{quotation,vendor,items}], statistics }` shape so PM comparison view is unblocked (`_fallback: true` flag set for diagnostics). **BLOCKING backend ask:** fix `GET /api/rfqs/{id}/quotations` 500 — likely a serializer crash when a quotation row is missing the joined `vendor` row or has `items` stored as `{}` instead of `[]`. Acceptance: returns 200 with the documented wrapped shape for every RFQ that has at least one submitted quotation, including those submitted via the FormData path with `attachments[]`. Remove the flat-endpoint fallback once green.
- **Bug C — RFQ to vendors is incomplete.** _DONE (frontend)._ `VendorPortal` now forwards `payment_milestones`, `additional_notes`/`notes`, `terms_conditions`, and `attachments`/`supportingDocuments` through to `VendorQuoteSubmission`, which renders a "Buyer's requested terms" block in the Selected RFQ panel covering all four. Backend ask: `/vendors/rfqs` must include these fields on every RFQ row.
- **Bug A — Final Invoice UI missing on MRF detail.** Backend accepts upload; no surface to display/download on MRF record. Extend existing `VendorInvoicesPanel` pattern into MRF detail view rather than building a new component.
- **Bug B — Budget vs Actuals shows "No line items available" even when MRF has line items.** Confirmed: this is a fetch/display mapping regression, not a save-side issue. Scope: trace `mrfApi.getLineItemPnL` response shape against what `ProfitAndLossTable` / `LineItemPnLSection` expect, fix the mapping. If the backend response genuinely lacks the line items, log a backend ask to join MRF line items into the P&L payload.
- **Bug D — Custom payment-terms split in vendor portal.** _DONE._ Bespoke advance/balance inputs replaced with `PaymentMilestoneBuilder` (any number of milestones, sum-to-100 enforced). Submit serializes a human label (e.g. `"Custom: 30% / 40% / 30%"`) into `payment_terms` AND forwards a structured `payment_milestones` array to `vendorPortalApi.submitQuotation` (now in the type and both JSON + FormData payloads). Backend ask: `POST /api/rfqs/{id}/submit-quotation` must accept and persist `payment_milestones`.

### Promoted from Batch 2 — PO form refactor (1a/1b/1c)
Promoted into Batch 1 because the current `CreatePOForm.tsx` is unusable for manual testing and blocks the Batch 1 verification pass.
- **1a — Multiple line items per supplier.** _DONE._ Each row in `PriceComparisonTable` now has a `+ Line item` (copy) action that inserts a new row pre-filled with the same directory vendor or manual vendor block, so a single supplier can carry any number of items. Backend payload remains a flat array of rows keyed by `vendor_id` / `manual_vendor`; no schema change required.
- **1b — Remove the min-2-supplier guard.** _DONE._ `validatePriceComparison` no longer requires ≥2 rows. Initial form state starts with 1 row, the Remove button is disabled only at length ≤1, and supporting copy now reads "Add one or more supplier quotes". Single-supplier (manual PO) POs can be generated and routed.
- **1c — Required-field audit with inline + top-summary errors.** _DONE._ Each row now computes per-cell errors (`supplier`, `item_description`, `unit_price`, `quantity`) rendered as red borders + inline messages. `CreatePOForm` aggregates a `blockingErrors` list (Section 1 + Section 2) and renders a destructive summary card directly above the footer when generation is blocked; Generate & Route tooltip now points at the summary instead of repeating a generic message.

### NEW — Draft PO persistence and resume (Option A)
_DONE (Sub-batch 1.5) — backend confirmed shipped._ The Purchase Orders tab in `src/pages/Procurement.tsx` lists MRFs whose backing row has `is_po_draft: true` alongside fully-generated POs. Drafts render an amber **Draft** badge, swap the workflow status pill for a "Draft" label, surface `po_draft_saved_at` as a "Last saved …" timestamp, and expose a **Continue Draft** button that re-opens `CreatePODialog` / `CreatePOForm.tsx` pre-filled. Backend now emits `is_po_draft` / `isPoDraft` / `po_draft_saved_at` / `poDraftSavedAt` on every row of `GET /api/mrfs`, `GET /api/mrfs/{id}`, `GET /api/dashboard/finance` (legacyMRFs + financeApMRFs + financeMRFs), and `GET /api/dashboard/procurement-manager` (pendingMRFs) via the shared `scmTransactionApiFields()` helper. Re-POST to `/api/mrfs/{id}/generate-po` with `save_as_draft: true` updates the same MRF in place — no new PO, no PDF, no workflow advance, no Finance or SCD notifications (first save records `saved_po_draft`, subsequent saves `updated_po_draft`). Finalize (same endpoint without `save_as_draft`) clears `po_draft_saved_at`, generates the PDF, advances workflow, sends notifications, and preserves the draft `po_number` (request → existing `mrf.po_number` → auto-generate). `canSavePODraft()` allows re-save when a draft exists; `canGeneratePO()` allows finalize whenever `isPoDraft()` is true for procurement role with unsigned PO. No backend asks remaining for 1.5.

**1.5b — Discard saved draft (DONE frontend, BLOCKING backend ask).** Each draft row in the Purchase Orders tab now exposes a destructive **Discard Draft** button next to **Continue Draft** that opens an `AlertDialog` confirmation. On confirm we call `mrfApi.discardPODraft(apiId)` → `DELETE /api/mrfs/{id}/po-draft`, then refresh the list. **Backend ask:** implement `DELETE /api/mrfs/{id}/po-draft` for procurement role; clear `po_draft_saved_at`, `is_po_draft`, and any persisted draft payload/`po_number` reservation without touching `status` / `workflow_state`, without emitting Finance or SCD notifications, and record an `discarded_po_draft` audit event. Return the updated MRF row using `scmTransactionApiFields()`.

### 1d. Manual PO must not trigger MRF email
Trace `CreatePOForm.tsx` + `ManualPOQuickStartDialog.tsx` + `POGenerationDialog.tsx`; remove side-effect MRF notify call. Backend ask: suppress `mrf.created` email when `source === 'manual_po'`.

### 2. Hide PO-generated MRFs (heuristic)
`isPoGeneratedMrf()` in `src/utils/poHelpers.ts`. Apply across all MRF list surfaces; keep visible in Procurement History + PO detail.

**Confirmed root cause from manual test:** the backend is not persisting `source: 'po_generated'` / `is_po_linked: true` on the MRF record, so the heuristic's authoritative branches never fire and the half-finished MRF leaks into list views.

Fix:
- **Backend ask (BLOCKING for full fix):** `POST /api/mrfs` must persist `source` and `is_po_linked` when the client sends them (currently dropped). Until this lands, the heuristic must not rely on them.
- **Frontend hardening:** ensure ALL fallback branches in `isPoGeneratedMrf()` fire — authoritative flags AND `created_via` AND the justification-text pattern written by `ManualPOQuickStartDialog` ("Manual PO created without RFQ"). Today only the linked-PO branch reliably fires, which fails for half-finished POs that have no linked PO row yet.
- Add a unit test covering: (a) MRF with only justification text, (b) MRF with `source` flag, (c) MRF with linked PO id, (d) plain MRF must NOT be hidden.

### 4. Progress tracker — Delivery Documents
Step completes only when docs registry contains GRN | waybill | JCC | delivery_confirmation.

### 5. PO closure
Compute `missingDocs` for advance-payment POs with payment complete. **Close button explicit loading state** ("Checking documents…", disabled) while docs fetch is in-flight — never enabled before fetch resolves. Warning Alert + tooltip listing missing. Backend ask: server-side 422 + `missing_documents[]`.

### 6. Vendor trip assignment 500
- Diagnostic `console.debug` in `logisticsApi.ts`.
- Defensive frontend handling for `{assigned:true, email_failed:true}` shape.
- **Concrete removal owner & date:** tag the TODO with `// TODO(@procurement-team, remove by 2026-06-22): backend BLOCKING fix tracked in frontend_changes.md §Item 6.` Removal is added as a follow-up entry in `frontend_changes.md` "Pending cleanup" section so it has a named owner and deadline, not just a comment.
- Backend ask logged with `BLOCKING` tag.

### Batch 1 verification checklist (gate to Batch 2)
Manual smoke test, ~15 min:
1. Progress tracker on an MRF with no delivery docs → "Delivery Documents Uploaded" is NOT complete.
2. Create a manual PO → no MRF-created email is dispatched (check email log / network).
3. After manual PO creation → associated MRF does NOT appear in Active / Official / All MRF tabs. DOES appear in Procurement History and inside the PO record.
4. On an advance-payment PO with payment complete, missing docs → Close button shows "Checking documents…" while fetching, then disabled with tooltip listing missing docs.
5. Vendor trip assignment → either backend fix landed (preferred), or defensive path returns a warning toast instead of a blocking error.
6. PO form: can add multiple line items per supplier, single-supplier PO can be generated/routed, empty/invalid rows block Generate & Route with inline + top-summary errors.
7. Stop halfway through a manual PO → draft PO appears in the PO list with a Draft badge and a Continue action that re-opens the form pre-filled.
8. Budget vs Actuals on an MRF that has line items → P&L panel shows those line items (no "No line items available" message).
9. Manual PO MRF stays hidden from Active / Official / All MRF lists even when the PO was abandoned mid-creation (justification-text fallback fires).

All nine must pass before Batch 2 is approved to start.

---

## Batch 2 — Features (scope finalised after Batch 0 + 1)

**Scope caveat:** Item 7's exact size is unknown until 0b results land. Do not estimate Batch 2 effort until Batch 0 completes.

### 3. PM MRF delete at any stage
_DONE._ Removed the `isEarlyStage` / `hasPO` gate in `src/pages/Procurement.tsx`; Procurement Managers now see Delete on every MRF in both the Active list and the All MRFs tab. `AlertDialog` copy rewritten to spell out the cascade (linked RFQs, quotations, draft/generated POs, approvals, audit history) and that vendors may still hold a copy of any already-sent RFQ. Calls existing `mrfApi.delete(uuid)` — no new endpoint. Backend ask: `DELETE /api/mrfs/{id}` must accept PM deletions at any workflow stage and cascade as documented in `frontend_changes.md` § Batch 2 — Item 3.

### 7. Vendor portal
Build whatever 0b flagged. Plus procurement visibility on MRF/RFQ (per-submission terms, deadlines, comparison, evaluation).

### 8a/8b/8d/8e. Trip scheduling
_8a/8d/8e DONE._ `TripScheduling`'s Create + Edit Trip dialogs gained an **"Use external driver"** switch that swaps the internal-driver select for `name` / `phone` / `license_number` inputs (8a); payload sends `external_driver: { name, phone, license_number }` and clears `driver_user_id`. New **Edit Passengers** dropdown action opens a focused dialog that only carries the `EligiblePassengerPicker` and calls `tripsApi.update(id, { passenger_user_ids })` (8e). New **Book Accommodation** dropdown action switches the Logistics page to the Accommodation tab via `window.dispatchEvent("logistics:set-tab", "accommodation")` and prefills the booking dialog (passenger names, destination, check-in) via `window.dispatchEvent("accommodation:prefill", …)` — `AccommodationBookings` now listens for that event (8d). 8b notifications remain backend-only. **Backend ask:** `POST` and `PUT` on `/api/trips` and `/api/trips/{id}` must accept the `external_driver` block and persist it; `driver_user_id` and `external_driver` are mutually exclusive on a given trip. See `frontend_changes.md` § Batch 2 — Item 8.

### 9. Fleet / Driver / Maintenance
Driver phone+license+docs; maintenance module; vehicle edit.

---

## Batch 3 — SMS / Termii documentation only
`frontend_changes.md` entries for endpoint, env vars, queue, log table, triggers, future UI surfaces. No frontend code.

---

## Batch 4 — Nav (modals → routed pages)

**Scope is fixed at eight new routes** (`/mrfs/:id`, `/pos/:id`, `/rfqs/:id`, `/trips/:id`, `/fleet/:id`, `/drivers/:id`, `/vendors/:id`, `/maintenance/:id`) + breadcrumbs + sidebar dead-end fixes.

**Sidebar audit scope is restricted to fixing dead ends only.** If the audit surfaces opportunities for new index pages, restructured sections, or other navigation rework, those findings are logged for a future batch — they do not expand Batch 4. This keeps Batch 4 shippable.

---

## Technical notes

- Item 2 heuristic isolated to one helper.
- Item 4 reuses existing docs fetch.
- Item 5 Close button has explicit loading state during doc fetch.
- Item 6 frontend defensive code has owner + deadline + follow-up entry in `frontend_changes.md` Pending cleanup section.
- Batch 0 runs in staging only; vendor registration confirmed working before 0b.
- Batch 1 verification checklist is the gate to Batch 2.
- Memory updates: MRF Deletion Permissions (PM any stage), new "PO-generated MRF visibility" entry, role aliasing entry if 0a finds mismatch.

---

## Out of scope / deferred

- Termii frontend surfaces (until backend ships).
- Sidebar restructuring beyond dead-end fixes.
- New index pages beyond the eight detail routes.
- Soft vs hard delete decision on Item 3 (backend's call).

---

## Order of work

1. **Batch 0** (staging, vendor reg first). Gate: 0a + 0b documented.
2. **Batch 1** bugs. Gate: 5-point verification checklist passes.
3. **Batch 2** features (scope final after 0b).
4. **Batch 3** SMS docs.
5. **Batch 4** nav (scope-locked to 8 routes + dead-end fixes).

Approve to start Batch 0.
