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

## Pending (to ship in the next loop)

### Item 1 — Payment milestone builder
- Component `src/components/payments/PaymentMilestoneBuilder.tsx` to be created (templates 100% Advance / 70-30 / 50-50 / 30-40-30 / custom, running total, disabled submit until 100%).
- Integrate into `NewMRF`, `NewSRF`, `RFQManagement`, `POGenerationDialog`, and `CreatePOForm` (preserving its existing `custom_terms`, `remarks`, `invoice_submission_cc`).
- **Backend ask:** MRF/SRF/RFQ/PO create+update accept `payment_milestones: [{label, percentage, trigger_condition?}]`; reject 422 when sum ≠ 100.

### Item 2 — SCD quotation detail
- Investigation step only: capture and diff PM vs SCD payloads for the quotation detail endpoint. If a field is missing in the SCD payload, document the backend fix here; do not patch the frontend renderer.

### Item 6 — External passengers on trips
- Extend `TripRequestForm` with an Internal/External toggle and an external passenger sub-form (name, email, phone). Track both arrays, render `External` badge.
- Add `externalPassengers` to `CreateStaffTripRequestData` and forward via `tripRequestApi.create`.
- **Backend ask:** POST/PUT `/trip-requests` accepts and persists `external_passengers[]`; detail returns both arrays. Notification email to external passengers fires only on Logistics Manager confirmation; body includes trip date/time, destination, purpose, and requester name as contact.
