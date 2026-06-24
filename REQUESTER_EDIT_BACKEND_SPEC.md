# Designated Requester Edit Window — Backend Specification

Status: **Backend required.** The frontend exposes edit actions when the backend grants
`can_requester_edit` (preferred) or, until that ships, when a client-side 48-hour
heuristic matches. Notifications and cross-role visibility are backend responsibilities.

## 1. Business rule

The **designated requisition creator** (see `PUT /api/departments/{id}/requisition-creator`)
or the **original submitter** (`requester_id`) may edit an MRF, SRF, or Trip Request
**within 48 hours** of `created_at`, provided the workflow has not advanced past the
editable stage.

Edits must **persist to the canonical record** so Procurement Manager, Supply Chain
Director, Executive, and Logistics Manager views all show the updated data on their
next fetch (lists, detail, progress tracker, PDFs).

## 2. Who may edit

| Entity | Eligible editor |
|--------|-----------------|
| MRF | `requester_id` **or** department designated requisition creator |
| SRF | `requester_id` **or** department designated requisition creator |
| Trip request | `requester_id` (staff who submitted the trip request) |

## 3. Time window

- Window starts at `created_at` (submission timestamp, not draft save).
- Window duration: **48 hours** exactly (`172800` seconds).
- After expiry: `can_requester_edit = false`; `PUT` returns **403** with code
  `REQUESTER_EDIT_WINDOW_EXPIRED`.

## 4. Workflow gates (when edit must be denied)

Deny edit (even inside 48h) when any of:

- PO has been generated (`po_generated`, `awaiting_scd_signature`, etc.)
- GRN requested / completed
- Request is `completed` or terminal
- Trip request has been confirmed / assigned to logistics trip (backend-defined)
- MRF/SRF is `rejected` — use existing **resubmit** flow instead of in-place edit

## 5. API contract

### 5.1 Flags on list + detail responses

Echo on `GET /api/mrfs`, `GET /api/mrfs/{id}`, `GET /api/srfs`, `GET /api/srfs/{id}`,
`GET /api/trip-requests`, `GET /api/trip-requests/{id}`:

```json
{
  "can_requester_edit": true,
  "requester_edit_expires_at": "2026-06-24T14:30:00Z"
}
```

Also extend `GET /api/mrfs/{id}/available-actions`:

```json
{
  "can_requester_edit": true,
  "requester_edit_expires_at": "2026-06-24T14:30:00Z"
}
```

### 5.2 Update endpoints (existing routes, tightened auth)

| Method | Path | Notes |
|--------|------|-------|
| `PUT` | `/api/mrfs/{id}` | Requester edit within window; same body as today |
| `PUT` | `/api/srfs/{id}` | Requester edit within window |
| `PUT` | `/api/trip-requests/{id}` | **New / formalise** — partial body allowed |

Reject with **403** + machine code when not allowed:
- `REQUESTER_EDIT_WINDOW_EXPIRED`
- `REQUESTER_EDIT_NOT_AUTHORIZED`
- `REQUESTER_EDIT_WORKFLOW_LOCKED`

### 5.3 Trip request update body

```json
{
  "destination": "Lagos",
  "purpose": "Client meeting",
  "origin": "HQ",
  "scheduled_departure_at": "2026-07-01T08:00:00Z",
  "scheduled_arrival_at": "2026-07-01T18:00:00Z",
  "passenger_user_ids": [12, 34],
  "booking_scope": "within_state",
  "external_passengers": [{ "name": "...", "email": "...", "phone": "..." }]
}
```

Re-validate booking lead-time rules on edit when departure date changes.

## 6. Notifications (backend only)

When a requester edit is saved:

1. **In-app notifications** to roles currently involved in the workflow, e.g.:
   - MRF: Procurement Manager, Executive, Supply Chain Director (based on current stage)
   - SRF: same pattern
   - Trip: Logistics Manager / assigned logistics reviewers
2. **Email** to the same audience with: request ID, requester name, summary of changed
   fields, link to the request in the app.
3. Optional: notify the requester on successful save (confirmation).

Suggested notification type keys:
- `mrf.requester_updated`
- `srf.requester_updated`
- `trip_request.requester_updated`

## 7. Audit trail

Append to approval/history timeline:

```json
{
  "action": "requester_edit",
  "user_id": 42,
  "user_name": "Jane Doe",
  "timestamp": "2026-06-22T16:00:00Z",
  "remarks": "Updated estimated cost and justification"
}
```

## 8. Frontend integration (implemented)

| File | Role |
|------|------|
| `src/utils/requesterEditWindow.ts` | 48h helpers; reads `can_requester_edit` |
| `src/components/requester/RequesterEditMrfDialog.tsx` | `PUT /mrfs/{id}` |
| `src/components/requester/RequesterEditSrfDialog.tsx` | `PUT /srfs/{id}` |
| `TripRequestForm` edit mode | `PUT /trip-requests/{id}` |
| Department dashboard MRF/SRF/trip lists | Edit button when allowed |

After successful edit the frontend dispatches `app:refresh` so open dashboards refetch.

## 9. Acceptance criteria

- [ ] Designated creator can edit own department MRF within 48h; PM/SCD/Executive see updates.
- [ ] Same for SRF and trip request.
- [ ] Edit blocked after 48h with clear 403 code.
- [ ] Edit blocked after PO generated / trip confirmed.
- [ ] In-app + email notifications sent to workflow participants on edit.
- [ ] `can_requester_edit` and `requester_edit_expires_at` on list and detail payloads.
- [ ] Rejected MRF still uses `/resubmit`, not in-place edit.
