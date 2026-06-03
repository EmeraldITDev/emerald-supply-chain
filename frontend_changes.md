# Frontend Changes — Multi-Feature Update (in progress)

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
  - `POST /api/rfqs` and `PATCH /api/rfqs/{id}` accept the same `payment_milestones` array and persist it on the RFQ so vendor quotations and downstream POs can inherit it. Return it on RFQ detail.
  - `POST /api/mrfs` and `POST /api/srfs` accept the same shape (so MRFs/SRFs can carry the requested payment schedule from creation). Detail responses must echo it. The legacy `payment_terms` string column should remain read-only for backward compatibility.

### Item 2 — SCD quotation detail (investigation hook)
- Added a diagnostic `console.debug('[Item2/getQuotations]', …)` in `src/services/api.ts` `rfqApi.getQuotations` that logs the caller's role (from `localStorage.user`), success flag, quotation count, and the top-level keys of the first quotation + its nested `quotation` object + items length.
- **How to use:** open the price-comparison view as Procurement Manager, copy the log; reopen as Supply Chain Director and copy again. If `sampleQuotationKeys` differs (e.g. PM sees `payment_terms` / `delivery_days` / line items but SCD does not), it's a backend role-scope bug. The exact missing fields will then be listed here for the backend team.
- **Backend ask (pending diff):** ensure `GET /api/rfqs/{rfqId}/quotations` returns the **same** field set regardless of authenticated role for any user with read access (PM, SCD, Executive). No fields should be stripped by role-scoping.

### Item 6 — External passengers on trips
- Extended `CreateTripRequestData` in `src/types/logistics.ts` with optional `external_passengers: Array<{name, email, phone?}>`.
- `src/components/logistics/TripRequestForm.tsx` now renders an "External passengers (non-staff)" section under the staff `EligiblePassengerPicker`. Each row captures name (required), email (required, validated), and phone (optional). Submit is enabled if there is at least one staff passenger OR at least one valid external passenger; invalid email blocks submit with a toast.
- `tripRequestApi.create` forwards `external_passengers` only when at least one valid row is present.
- **Backend ask:**
  - `POST /api/trip-requests` and `PUT /api/trip-requests/{id}` accept `external_passengers: [{name: string, email: string, phone?: string}]`. Persist alongside `passenger_user_ids` so the detail response returns both arrays.
  - When the Logistics Manager **confirms** the trip (transition to `confirmed`/`scheduled`), send a transactional email to each external passenger's address. **Do NOT** send on draft save or initial submission. Email body should include: trip date/time, origin → destination, purpose, and the requester's name as the in-company contact. Plain transactional copy (no marketing content).
