# SCM Platform — Multi-Feature Fix & Enhancement Plan (v3)

Eight issues grouped by area. Reuse existing components/types wherever possible. Every backend-touching change gets a section in `frontend_changes.md` (method, path, request/response, plain-English description).

---

## 1. Payment Terms — Flexible Milestone Builder (MRF, SRF, RFQ, PO)

Reuse existing `src/types/payment-schedule.ts` (`PaymentMilestone`, templates, `sumMilestonePercentages`) and `src/services/paymentScheduleApi.ts`. Build one shared component:

- **New** `src/components/payments/PaymentMilestoneBuilder.tsx`
  - Template dropdown: 100% Advance, 70/30, 50/50, 30/40/30, Custom
  - Editable rows with `percentage`, `label`, optional trigger
  - Running total chip; red inline error when ≠ 100
  - Emits `PaymentMilestone[]` and `isValid` to parent

Integrate into:
- `src/pages/NewMRF.tsx` — replace freeform payment terms input
- `src/pages/NewSRF.tsx` — add the section (currently absent)
- `src/components/RFQManagement.tsx` — replace RFQ terms input
- `src/components/POGenerationDialog.tsx` — replace its free-text payment terms field
- `src/components/procurement/CreatePOForm.tsx` — **only** replace the free-text payment terms input. **Do NOT remove or alter** the existing `custom_terms` textarea, the `remarks` field, or the `invoice_submission_cc` field — those serve different purposes. The milestone builder slots in alongside them.

Disable submit while sum ≠ 100.

**Backend (document in `frontend_changes.md`):**
- MRF/SRF/RFQ/PO create+update accept `payment_milestones: [{label, percentage, trigger_condition?}]`
- 422 with clear error when sum ≠ 100
- Detail responses return the array; legacy `payment_terms` string kept read-only

---

## 2. SCD Quotation Detail — Show Full Payload (investigation-first)

**Required investigation before any code change:**
1. From `SupplyChainDashboard.tsx`, capture the raw API response for the quotation endpoint hit by SCD (network tab + temporary `console.log`).
2. Capture the same endpoint's response logged in as a Procurement Manager.
3. Diff the two payloads field-by-field (line items, vendor details, pricing, `documents[]`, payment terms).

**Fix rule:**
- If a field is **present in PM payload but missing in SCD payload** → it's a backend role-scope bug. **Do not patch the frontend renderer.** Document the required backend fix in `frontend_changes.md` and stop there.
- If both payloads contain the field but only SCD UI fails to render it → fix `normalizeQuotation.ts` and/or `PriceComparisonTable.tsx`.

Verify after fix: SCD sees line item table, unit/total prices, delivery period, payment terms, and downloadable S3 attachments — identical to PM.

---

## 3. SRF Progress Tracker — Human-Readable Labels

Update `src/components/SRFProgressTracker.tsx`, `src/utils/srfStatusBadge.ts`, `srfWorkflow.ts`:

| Raw status | Label |
|---|---|
| pending | Awaiting Initial Review |
| sc_director / awaiting_scd | Awaiting Supply Chain Director Approval |
| procurement | With Procurement Team |
| approved | Approved and Being Processed |
| rejected | Returned for Revision |
| po_generated | Purchase Order Created |
| finance | Submitted to Finance for Payment |
| complete / completed | Completed |

Centralise in one `SRF_STATUS_LABELS` map. Replace raw-string renders in `SRFCardList`, `SRFDetailDialog`, `SRFLineItemDetailDialog`, and any badge.

---

## 4. Logistics Dashboard — Clickable Metric Cards

In `src/pages/Logistics.tsx`, wrap the three summary cards with navigation:

- Active Trips → `trips` tab with default filter = active (via `?filter=active`)
- Fleet Vehicles → `fleet` tab
- Staff Drivers → `drivers` tab

`TripScheduling` reads `?filter` to preselect "active". Add `cursor-pointer`, hover lift, focus ring, and keyboard handler. No new pages needed.

---

## 5. Plate Number Bug (`TEMP-…`)

Root cause traced to `src/services/logisticsApi.ts` vehicle create (frontend sends `plate`; backend expects `plate_number`, treats it as empty, and auto-generates `TEMP-…`). **Verify this is the actual source before applying the fix** — re-read the file and the live request payload in the network tab. If the mismatch is elsewhere (e.g., a wrapping serializer, the FleetManagement form, or a different API method), fix it at the actual source instead of blindly patching `logisticsApi.ts`.

Frontend fix once confirmed: send `plate_number` (and mirror `registration_number` per `normalizeFleetVehicle.ts` aliases) on both `create` and `update`. Verify the response echoes the user-entered value.

**Backend note:** confirm endpoint persists `plate_number` when provided; only generate a placeholder when truly empty.

---

## 6. Trip Scheduling — External Passengers

Extend `src/components/logistics/TripRequestForm.tsx` and `EligiblePassengerPicker.tsx`:

- Tabs/segment: Internal (existing picker) vs External (form: full name*, email*, phone*)
- Track `internalPassengerIds: number[]` and `externalPassengers: {name,email,phone}[]`
- Combined list with `External` badge; remove from either group
- Update `CreateStaffTripRequestData` in `src/types/trip-request.ts`; forward via `tripRequestApi.create`

**Backend note (with notification scope):**
- POST/PUT `/trip-requests` accepts and persists `external_passengers[]`; detail returns both arrays.
- **External passenger notification email fires only when the trip is *confirmed by the Logistics Manager*** — not on draft save and not on initial request submission.
- Email body must include: trip date/time, destination, purpose, and the requester's name as the in-company contact. Plain transactional copy, no marketing content.

---

## 7. MRF/SRF Line Items Persistence

Findings:
- `NewMRF.tsx` already sends `line_items` with snake_case ✓
- `NewSRF.tsx:196` sends `items: lineItems` with camelCase ✗

Frontend fixes:
- `NewSRF.tsx`: map to `line_items: [{item_name, quantity, unit, budget_amount}]`.
- SRF detail views (`SRFDetailDialog`, `SRFLineItemDetailDialog`) read `line_items` from response.
- `normalizeSrfDetail` accepts both `lineItems` and `line_items`.
- **List endpoint check:** inspect the SRF list response (`/srfs`). The "No line items on file" message on cards suggests `line_items` is also missing from the list payload. Either:
  - request `line_items_count` on the list endpoint and render that on the card, **or**
  - lazy-fetch line items via the detail endpoint when a card is expanded.
  - Do not show "No line items on file" based on an absent field; only show it when the count is explicitly zero.

**Backend note:** `/srfs` and `/mrfs` create+update accept the snake_case `line_items` array and return them in detail. Add `line_items_count` (or full array) to the list response so cards aren't misleading. If SRF line-items table missing, create it.

---

## 8. Vendor Final Invoice Submission UI — Audit & Gaps

Phase 4 already shipped `src/components/vendor/VendorInvoicesPanel.tsx` (gate-aware upload, read-only after submit). Remaining work:

- Confirm panel mounts on the **per-MRF detail view** in the vendor portal. Add a "Submit Final Invoice" section to the per-MRF dialog if missing.
- Internal visibility: confirm `ProcurementDocumentsPanel` surfaces `vendor_invoice` rows for Procurement, SCD, Executive, Finance on MRF detail.
- Status copy after submit: "Invoice submitted — awaiting procurement review".
- **Gate-closed UX (explicit):** when `canSubmit === false` because SCD has not yet approved, the panel must **render an informational message**, not a hidden button or empty state. Copy: *"Your quote has been received. You will be notified when you can submit your final invoice."* Once `canSubmit === true`, swap to the upload control.
- Upload restricted to the awarded vendor only (server-enforced).

No new backend expected. Document any gaps found in `frontend_changes.md`.

---

## Technical Details

- Shared component path: `src/components/payments/PaymentMilestoneBuilder.tsx`.
- SRF labels in `src/utils/srfStatusBadge.ts` as `SRF_STATUS_LABELS`.
- Trip form passenger model extended in `src/types/trip-request.ts`; consumed by `TripRequestForm` and `tripRequestApi.create`.
- Fleet create payload patched at its true source (likely `src/services/logisticsApi.ts`, verify first).
- All client validation uses zod-style guards before submit.
- `frontend_changes.md` gets one section per backend-touching item (1, 2, 5, 6, 7 + any gaps in 8).

## Out of Scope

- Migrating historical `payment_terms` strings to milestone arrays (backend one-off).
- Building a dedicated Active Trips page (tab + filter is enough).
- Two-way invoice dispute flow (handled offline).
