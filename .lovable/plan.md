# Trip Request Workflow — Draft/Submit, RFQ Visibility, SCD Approval, Procurement PO

Aligns the trip request frontend with the new backend contract: explicit draft vs submit actions, backend-driven edit window, RFQ/quotation visibility for Logistics and SCD, and a logistics PO queue in Procurement.

## What changes for users

**Requesters**
- The trip request form gets two buttons instead of one: "Save as Draft" and "Submit Trip Request" (create mode); "Save Changes" and "Submit Trip Request" when editing a draft.
- Drafts appear in My Requests with a grey "Draft" badge and an inline "Submit" button.
- The "X hours remaining to edit" countdown only shows on submitted trips the backend says are still editable — never on drafts.

**Logistics Manager**
- Trip rows show "Waiting for vendor quotations" (rfq_pending) or "All quotations received" (rfq_received).
- Trip detail gains a Vendor Quotations table (service, vendor, price, status, document link, total), a recommendation note field, and a "Submit to Supply Chain Director" action enabled at rfq_received.
- Any action button not present in the trip's `available_actions` is removed, including hardcoded "Review Trip Request" entry points.

**Supply Chain Director**
- The approval view shows all quotations grouped by transport / accommodation / escort, with vendor contact, notes, documents, the logistics recommendation highlight, and total estimated cost.
- SCD can tick preferred vendors; the selection is sent with the approval and the trip leaves the pending queue immediately.

**Procurement Manager**
- New "Logistics POs" section listing trips at `procurement_pending`, with a "Create PO" action that pre-fills the PO form from the backend payload (line items, totals, currency, supporting docs) — no manual re-entry.

## Technical notes

Types (`src/types/trip-request.ts`): add `TripRfq`, `TripPoPayload`; extend `StaffTripRequest` with `is_draft`, `edit_deadline`, `can_be_edited_by_requester`, `submitted_at`, `rfqs`, `total_estimated_cost`, `logistics_recommendation` (optional, snake+camel tolerant as with existing fields).

`src/services/api.ts` (`tripRequestApi`): add `submit(id)` → `POST /trip-requests/{id}/submit`; `getRfqs(id)` → `GET /trip-requests/{id}/rfqs`; `getPoPayload(id)` → `GET /logistics-trips/{id}/po-payload`; and a trip-request-scoped `scdApprove(id, { action, remarks, approved_vendor_ids })` → `POST /trip-requests/{id}/scd-approve`. Note: the existing `scdApprove` on the logistics API hits `/trips/{id}/scd-approve` with no body — the new payload-carrying method is added on `tripRequestApi` and the SCD UI is pointed at it.

`TripRequestForm.tsx`: split the single footer button into the two-button pairs; `handleSubmit` takes `{ save_as_draft }`; draft edit mode calls `update` then optionally `submit`. Keep existing dirty-field partial-PUT behaviour.

Edit countdown: `TripRequestDetailPage.tsx`, `MyTripRequestsList.tsx`, `EditTripRequestDialog.tsx` and `DepartmentDashboard.tsx` currently rely on `resolveRequesterEditAccess`, which falls back to computing 48h from `created_at`. Extend `src/utils/requesterEditWindow.ts` to prefer `can_be_edited_by_requester` / `edit_deadline` and to return `canEdit: false` with no timer whenever `is_draft` is true; add a small live-ticking `EditCountdown` component used by the detail page.

RFQ panel: new `TripQuotationsPanel` component (reusing `TripVendorComparison` markup where it fits) mounted on `TripRequestDetailPage`, fetched via React Query key `['trip-rfqs', id]`, enabled for `rfq_pending | rfq_received | scd_review`.

SCD: quotation grouping + vendor checkboxes rendered inside the existing SCD approval panel (`TripRequestApprovalDialog` / `TripRequestWorkflowActions`); on success invalidate the trip query and the SCD pending queue keys used by `SupplyChainDashboard.tsx`.

Procurement: new tab in `src/pages/Procurement.tsx` querying `/trip-requests?status=procurement_pending`, gated on procurement roles; "Create PO" fetches the payload then navigates to the PO form with router state, and `CreatePOForm` hydrates from `location.state.preloaded`.

Errors: reuse and extend `src/utils/tripApprovalErrors.ts` (it already maps ALREADY_CONVERTED / ALREADY_APPROVED / INVALID_STATE / FORBIDDEN / NOT_FOUND / VALIDATION_ERROR) as the single handler for every trip mutation's `onError` — no new duplicate map.

Currency stays Naira (₦) via the existing currency util; missing values render as a dash per project convention.