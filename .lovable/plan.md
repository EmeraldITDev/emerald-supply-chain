# Logistics Workflow End-to-End Fix

This project is the React frontend only; the Laravel API lives in a separate service. So this plan covers everything the frontend can own, and specifies the backend contract for the parts that must be server-side (notification fan-out, workflow routing, scheduled feedback triggers, feedback persistence). Frontend code will be written defensively so it renders gracefully until those endpoints ship.

## 1. Convert button only at the conversion stage
`canConvertToLogistics` in `src/utils/tripApprovalState.ts` currently falls back to a stage guess when `available_actions` is missing, which is what resurrects the button. Tighten it:
- Return false immediately when `isTripConverted` is true or a logistics trip id exists — before any fallback.
- Only allow the fallback when the trip is exactly at `scd_approved` and has no conversion evidence.
- Primary gate is `available_actions` from the API: when present and it does not contain a convert action, return false unconditionally, regardless of session registry state.
- The session registry (same pattern as `markTripDirectorApproved`) is a secondary optimistic layer only, consulted when `available_actions` is absent — it clears on refresh and must never be the sole gate.
Apply the single helper at all render sites: `TripRequestWorkflowActions`, `TripScheduling` row actions, `TripRequestDetailPage`, and `TripRequestDetailDialog`.

## 2 & 3. Conversion form as a full logistics planning workspace
Rework `TripRequestConversionDialog` to hydrate the full record via `tripRequestApi.getById` on open (list payloads are partial), then render sections:
- **Trip summary** (read-only): destination, purpose, origin, departure, arrival, requester, department.
- **Passengers**: seeded from internal passengers (ids + names) and external passengers (name, email, phone); both editable, external passengers add/remove inline.
- **Vehicle** — optional; no longer required when a vendor is handling transport.
- **Transport vendor** — optional, searchable vendor directory plus inline "add new external vendor".
- **Driver** — optional at conversion; system driver or manual entry (name, phone, email).
- **Accommodation** — preloaded from the request (name, address, contact, estimated cost, notes), editable, with vendor select and document upload via the existing attachment/S3 components.
- **Escort** — preloaded (required flag, description/personnel, notes), editable, vendor select and documents.
- **Cost summary** — live total of transport + accommodation + escort + extras.
Submit validation: at least one passenger, and either a vehicle or a transport vendor. Everything else optional, with two soft checks — if the originating request has `accommodation_required = true` and no accommodation name is filled, or `escort_required = true` and no escort description is filled, show an inline confirmation ("Accommodation was marked as required but no details are filled. Continue anyway?") rather than a hard block, since the Logistics Manager may have determined it is no longer needed.

## 4. SCD approval view
Extend `TripRequestDetailPage` (and the approval panel it hosts) so the director sees, on one page: trip details, vehicle, transport vendor + contact, driver name/phone/email, full passenger list, accommodation (vendor, address, cost), escort (vendor, cost), all attached documents with download links, and a total estimated logistics cost. Approve / Return / Reject stay on that page via the existing `TripRequestWorkflowActions`.
The approval panel reads `available_actions` from a fresh `GET /api/trip-requests/{id}` issued on mount — never from local state or the list payload. If `approve` is absent from `available_actions`, render a read-only status banner instead of the action buttons.

## 5. Post-approval sync and notifications
Frontend: on approve, invalidate the SCD dashboard, trips and trip-request queries and drop the row optimistically so the pending queue and the detail page never disagree. The notification bell already renders whatever the API returns — the fan-out to Logistics Managers (in-app + email, with trip code, destination, requester, timestamp, deep link) is a backend job and will be specified, not simulated client-side.

## 6. Internal vs external routing
Frontend reads the stage/`available_actions` the backend returns after approval and renders the right next action — Journey Management entry for fully internal trips, procurement handoff (link to the generated MRF/PO referencing the trip code) when any external vendor is involved. The routing decision itself is backend logic; the UI will not infer it locally beyond displaying what the API reports.

## 7. Journey Management display
`journeysApi.list` returns journeys with no related records, which is why fields show N/A. Add a normaliser that merges the journey with its linked trip/trip-request (already fetched via `tripsApi`) and renders: journey ref, originating trip code, origin, destination, vehicle make/model/plate, driver name + phone, passengers with departments, status, scheduled departure and expected return, accommodation, escort, documents. Fields genuinely missing after normalisation render as a grey dash (—) with a hover tooltip "This information has not been provided yet." — never a red error state, which would wrongly imply a failure. The durable fix — eager-loading relations on `GET /journeys` — is documented as a backend requirement.

## 8. Passenger feedback
Register `/journeys/:id/feedback` in the router as a public-after-auth route keyed on the journey's numeric id; the backend notification link must match this path exactly, to be confirmed with the backend team before the notification ships. The form, reachable straight from that link, captures: rating, status choice (satisfactory / excellent / still ongoing / took longer than expected), free-text comments. Add a **Passenger Feedback** section on the journey detail view listing each passenger's name, rating, status and comments, with CSV export through the existing export utilities. Scheduled trigger at completion time is backend.

## 9. Edit Trip form preloading
`EditTripRequestDialog` already hydrates via `getById`; the gap is in `TripRequestForm` field mapping. Map every field (both snake_case and camelCase): destination, purpose, origin, departure, arrival, internal + external passengers, booking scope, trip type, accommodation flag/name/address/contact/cost/notes, escort flag/description, vehicle, driver incl. external details, and transport/accommodation/escort vendors. Submit as a partial PUT driven by a `dirtyFields` set: every field the user touched is sent with its current value — including `null`/empty when they deliberately cleared it — and every untouched field is omitted, so the backend can distinguish "not changed" from "intentionally cleared".

## Backend contract to be documented
`frontend_changes.md` gets a new section **Logistics Workflow End-to-End Fix — Full Enhancement** listing every changed file, plus full documentation — method, path, complete request schema, complete response shape, required roles, and a plain-English note on what the frontend does with it — for these six endpoints:
- `GET /api/trip-requests/{id}` — enriched payload with full logistics details
- `POST /api/trip-requests/{id}/convert` — full conversion payload schema
- `GET /api/journeys` — enriched with relations
- `GET /api/journeys/{id}` — full journey detail
- `POST /api/journeys/{id}/feedback` — submit feedback
- `GET /api/journeys/{id}/feedback` — list feedback

The notification fan-out contract is documented alongside them.

## Technical notes
- No new design system or component library; extend `TripRequestConversionDialog`, `TripRequestForm`, `TripRequestDetailPage`, `JourneyManagement`, `EligiblePassengerPicker`, `AttachmentList`/`MultiFileDropzone`, `tripApprovalState.ts`.
- Attachments reuse the existing S3 upload path; notifications reuse the existing notification service.
- No new endpoints where an existing one can be extended with fields or query params.
