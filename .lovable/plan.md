
# PO Generator with Price Comparison — Implementation Plan (v3)

Builds the two-section "Create PO" flow described in `po_generator_frontend.md`, scoped to an existing MRF. Replaces the current single-shot Generate PO action in Procurement with a multi-section form (PO Details → Price Comparison → Review & Submit), Save-as-Draft + Finalise behavior, and a status badge helper for the PO list.

Legacy `generatePO()` in `src/services/api.ts` stays untouched (other callers depend on it). The new flow uses a new `procurementApi` group.

---

## Resolved Clarifications (v2 → v3)

**v3 additions:**

- **Lock release on error** — every code path that acquires `isSavingRef.current = true` releases it inside a `finally` block. Pseudocode pattern enforced in `CreatePOForm`:
  ```ts
  if (isSavingRef.current) return;
  isSavingRef.current = true;
  setIsSaving(true);
  try {
    await savePriceComparison(...);
    await savePODraft(...);
  } catch (err) {
    // surface error to UI
  } finally {
    isSavingRef.current = false;
    setIsSaving(false);
  }
  ```
  This applies to manual Save Draft, Generate & Route, AND the autosave tick. The form can never freeze permanently from an unhandled throw.

- **`app:refresh` only on success** — the dispatch lives **inside each `procurementApi` mutation, after the `await` resolves and only when the response is `success: true`**. Failed mutations (network error, 4xx, 5xx, validation) do NOT dispatch. Pattern:
  ```ts
  const res = await apiRequest(...);
  if (res.success) window.dispatchEvent(new Event('app:refresh'));
  return res;
  ```
  No optimistic dispatching before the await, no dispatching in catch blocks.

**v2 carryovers:**

1. **Autosave race condition** — `isSavingRef` lock checked-and-set atomically. Held autosave ticks are dropped (not queued). Autosave is paused for 5s after any successful manual save.
2. **Save Draft preserves partial PC rows** — always sends current PC state (even partial / empty). PC failure → non-blocking warning toast, draft save still proceeds. Strict validation enforced only on Generate & Route.
3. **Empty PC array** — client sends `{ rows: [] }`; if backend rejects, we catch it and skip the PC call so the PO draft still saves.
4. **Hydration loading state** — `Skeleton` matching the two-section structure inside the dialog. 15s timeout shows "Backend slow to respond — retry?" inline state.
5. **Mobile/tablet** — desktop-first. Dialog uses `w-[95vw] max-w-5xl max-h-[85vh] overflow-y-auto`. Section 2 table wrapped in `overflow-x-auto`.
6. **`po_draft_saved_at`** — primary from `data.mrf.po_draft_saved_at`; fallback to client-stamped `Date.now()` if backend omits it.

**Open question — answered:** PC supplier combobox uses the **full `/api/vendors` list**, not just RFQ vendors. The PC documents alternatives considered, which can include non-RFQ vendors. The Section 1 vendor (server-resolved from approved quotation) is read-only display; the form does not enforce equality between it and the PC's Selected row (backend remains the source of truth).

---

## Pre-Flight Verifications (still required)

1. **PO number** — backend-generated only; never collected on form. Read-only after finalise.
2. **CC email** — defaults `lateef.olanrewaju@emeraldcfze.com`, editable, blocklist rejects `douglas.anuforo@emeraldcfze.com` (client validator, never auto-suggested).
3. **Vendor combobox** — uses `vendor_id` string (e.g. `VND-001`), not numeric `id`.
4. **T&C** — only `po_type` + optional `custom_terms` are sent; standard text never POSTed back. 404 from `/po-terms-templates/{type}` → inline warning + Generate disabled.
5. **MRF eligibility** — entry button visible only when `rfqStatus === 'approved'` AND `status ∈ {pending_po_upload, procurement, po rejected}`. Label flips to "Continue PO Draft" when `is_po_draft`.
6. **Persistence order** — Save Draft / Finalise both: (a) `PUT price-comparisons`, (b) `POST generate-po`. On Finalise, (a) failure aborts (b). On Save Draft, (a) failure shows non-blocking warning and (b) still runs.
7. **Role gating** — Save Draft / Generate / Regenerate restricted to `procurement_manager | procurement | admin`. View-only for `supply_chain_director`.

---

## Files

**New**
- `src/services/procurementApi.ts` — `getPOTermsTemplate(type)`, `getPriceComparison(mrfId)`, `savePriceComparison(mrfId, rows)`, `savePODraft(mrfId, payload)`, `finalisePO(mrfId, payload)`, `getMRFForPO(mrfId)`. All through existing `apiRequest`. **`app:refresh` dispatched only after a successful response is awaited.**
- `src/types/procurement.ts` — `POTermsTemplate`, `PriceComparisonRow`, `PriceComparisonEntry`, `POFormPayload`, `POProjection`, `POStatusKey`.
- `src/utils/poStatus.ts` — `formatPOStatus({status, workflow_state, is_po_draft, signed_po_url})` and `poStatusBadgeClass(key)` using semantic tokens.
- `src/components/procurement/PriceComparisonTable.tsx` — controlled component: `value`, `onChange`, `vendors` (full list), `disabled`. Two starter rows, Add/Remove (min 2 visual guard), live total, single-Selected radio with `bg-success/10` highlight, inline validation badges. `overflow-x-auto`.
- `src/components/procurement/CreatePOForm.tsx` — owns hydration, dirty tracking, autosave (3s debounce, lock-protected via `try/finally`, draft mode only, paused 5s after manual save), submit flow, cancel-confirm modal, sticky footer. Skeleton during hydration. 15s slow-backend retry banner.
- `src/components/procurement/index.ts` — barrel export.

**Edited**
- `src/pages/Procurement.tsx` — opens `CreatePOForm` in a `Dialog` (`w-[95vw] max-w-5xl max-h-[85vh] overflow-y-auto`) on eligible MRF rows. Button label flips between "Generate PO" and "Continue PO Draft" based on `is_po_draft`. Paperclip icon + tooltip when `priceComparisons?.length > 0`. Status badge column driven by `formatPOStatus()`.

---

## Section 1 — PO Details (fields → API binding)

| Field | Binding |
|---|---|
| MRF chip (read-only) | from URL/context |
| PO Type (Goods/Services/Logistics) | `po_type` — drives template fetch |
| Vendor (read-only, server-resolved from approved quotation) | display only |
| PO Date | display only (server stamps `po_generated_at`) |
| Delivery / Service Date | appended into `remarks` |
| Ship-to Address | `ship_to_address` |
| Payment Terms | appended into `custom_terms` |
| Tax Rate (%) | `tax_rate` |
| Invoice To Email | `invoice_submission_email`, default `accountpayables@emeraldcfze.com` |
| CC Email | `invoice_submission_cc`, default `lateef.olanrewaju@emeraldcfze.com`; blocks `douglas.anuforo@emeraldcfze.com` |
| Standard T&C | read-only block from `data.content` |
| Custom Terms | `custom_terms` textarea |
| Additional Notes | `remarks` |

On `po_type` change → refetch template; 404 shows inline warning and disables Generate.

---

## Section 2 — Price Comparison Sheet

Editable table: Supplier (combobox over **full vendor list**), Item Description, Unit Price (₦), Quantity, Total (live `unit × qty`, read-only display), Notes / Selection Reason, Selected (radio).

- Starts with 2 empty rows. "+ Add Supplier" / "×" remove (min 2 visual guard, not enforced on Save Draft so users don't lose typed data).
- Selected row: `bg-success/10` highlight.
- Inline validation badges only block **Generate**, not Save Draft.
- Persistence: `PUT /api/mrfs/{id}/price-comparisons` — bulk replace.
- Autosave: debounced 3s, draft mode only, lock-protected, paused 5s after manual save, skipped on validation failure.

---

## Section 3 — Review & Submit

Collapsible read-only summary (collapsed by default). When `is_po_draft`, banner: "Draft last saved {relative time}".

---

## Footer Actions

- **Save as Draft** — enabled with any Section 1 input. Lock-acquired in `try/finally`. Always sends current PC state. PC failure → warning toast, draft save still proceeds. Success → "Draft saved." toast, refresh saved-at stamp, pause autosave 5s.
- **Generate & Route for Approval** — enabled only when all required PO fields valid + ≥ 2 PC rows + 1 selected + all required PC fields filled. Lock-acquired in `try/finally`. PC save first; abort on failure with inline error. On success: `POST generate-po`, toast `"PO {po_number} generated and routed to Supply Chain Director."`, close form, expose "Open PDF" → `unsigned_po_url`.
- **Download Draft PDF** — visible only after finalisation; opens `unsigned_po_url`.
- **Cancel** — confirm modal "Save as Draft / Discard / Continue editing" if any data entered.

Disabled-Generate tooltip: *"Complete all PO details and add at least 2 supplier quotes with one selected before generating."*

Backend error code → friendly message map (`FORBIDDEN`, `NOT_FOUND`, `RFQ_NOT_APPROVED`, `INVALID_STATUS`, `DUPLICATE_PO_NUMBER`, `PO_ALREADY_SIGNED`, `VALIDATION_ERROR` with field-level surfacing).

---

## PO List View — Status Badges

`formatPOStatus()` priority: `signed > rejected > draft > status-based`.

| Inputs | Label | Variant |
|---|---|---|
| `signed_po_url` set or `workflow_state: po_signed` / `status: po signed` | Signed | success |
| `status: po rejected` | Rejected | destructive |
| `is_po_draft` (no `unsigned_po_url`) | Draft PO | neutral |
| `status: pending_po_upload` | Awaiting PO | neutral |
| `status: awaiting_scd_signature` | Pending Signature | warning |
| `status: supply_chain` | With Supply Chain | neutral |
| `status: finance` | With Finance | info |

Row actions: View / Continue Draft (when draft) / Download Unsigned (when `unsigned_po_url`) / Download Signed (when `signed_po_url`) / Regenerate (procurement, while not signed). Paperclip on rows with non-empty `priceComparisons`.

---

## Out of Scope

SCD signing (`upload-signed-po`), PO rejection flow, "suggest historical average price" affordance, multi-currency formatting, mobile-first redesign of the form.
