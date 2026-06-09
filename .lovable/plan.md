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
- **Bug E (BLOCKING) — RFQ vendor response not visible on PM, 500 error.** Regression. Investigate `submitQuotation` payload (vendor side) + `getQuotations` (PM side). Highest priority; everything else in RFQ flow is blocked behind PM visibility.
- **Bug C — RFQ to vendors is incomplete.** Payment Milestones, Additional Notes, T&Cs, Supporting Documents are dropped before vendor sees them. Trace `rfqApi.create`/distribute payload and the vendor-side render in `VendorPortal` → `VendorQuoteSubmission`.
- **Bug A — Final Invoice UI missing on MRF detail.** Backend accepts upload; no surface to display/download on MRF record. Extend existing `VendorInvoicesPanel` pattern into MRF detail view rather than building a new component.
- **Bug B — Budget vs Actuals shows "No line items available" even when MRF has line items.** Confirmed: this is a fetch/display mapping regression, not a save-side issue. Scope: trace `mrfApi.getLineItemPnL` response shape against what `ProfitAndLossTable` / `LineItemPnLSection` expect, fix the mapping. If the backend response genuinely lacks the line items, log a backend ask to join MRF line items into the P&L payload.
- **Bug D — Custom payment-terms split in vendor portal.** Reuse `PaymentMilestoneBuilder` (already supports Custom with sum-to-100 validation) inside `VendorQuoteSubmission` instead of adding a parallel control.

### Promoted from Batch 2 — PO form refactor (1a/1b/1c)
Promoted into Batch 1 because the current `CreatePOForm.tsx` is unusable for manual testing and blocks the Batch 1 verification pass.
- **1a — Multiple line items per supplier.** Suppliers carry `line_items[]`; UI lets PM add/remove rows freely.
- **1b — Remove the min-2-supplier guard.** Allow generate/route with a single supplier (manual PO case).
- **1c — Required-field audit with inline + top-summary errors.** Warn on empty rows / missing required fields before the Generate & Route button enables; surface a list at the top of the form pointing to each offending row.

### NEW — Draft PO persistence and resume (Option A)
Currently if a user starts a manual PO and bails halfway, only the backing MRF exists and there is no way to resume the PO. Causes confusion / feels broken.
- On first "Save Draft" (or first field commit after `ManualPOQuickStartDialog`), persist a PO row with `status: 'draft'` to the backend.
- Surface draft POs in the main PO list with a clear **Draft** badge and a **Continue** action that re-opens `CreatePOForm.tsx` pre-filled with the draft.
- Drafts must be editable, deletable, and excluded from approval / SCD signature queues until explicitly submitted.
- Backend ask (logged in `frontend_changes.md`): `POST /api/pos` must accept `status: 'draft'`, `GET /api/pos?status=draft` must return them, and `PATCH /api/pos/{id}` must allow updating draft rows without triggering approval routing.

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

All five must pass before Batch 2 is approved to start.

---

## Batch 2 — Features (scope finalised after Batch 0 + 1)

**Scope caveat:** Item 7's exact size is unknown until 0b results land. Do not estimate Batch 2 effort until Batch 0 completes.

### 1a/1b/1c. PO form refactor
Suppliers carry `line_items[]`. Remove min-2-supplier guard. Required-field audit with inline + top-summary errors.

### 3. PM MRF delete at any stage
AlertDialog with required copy. Gated by PM role. **Depends on 0a passing.**

### 7. Vendor portal
Build whatever 0b flagged. Plus procurement visibility on MRF/RFQ (per-submission terms, deadlines, comparison, evaluation).

### 8a/8b/8d/8e. Trip scheduling
External drivers, accommodation, edit passenger list. 8b notifications backend-only.

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
