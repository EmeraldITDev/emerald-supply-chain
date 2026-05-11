# Module 4 — Fleet Management Frontend (v3)

Implements all four sections of the uploaded spec. Revised against v2 review: locked tab order, reactivation reason minimum length, explicit `UNDER_MAINTENANCE` UI treatment.

## Pre-Flight Verifications (resolve before build)

1. **Expired-document `alert_colour`** — confirm with backend whether expired docs return `alert_colour: 'RED'` or `null`. If RED, drop client-side date fallback. If null, keep past-date fallback rendering destructive "Expired" badge.
2. **Global expiring-documents source** — confirm whether `GET /fleet/documents/alerts` exists. If yes, the StatCard calls it directly; if no, request backend add it. **Do not** ship a per-vehicle aggregation loop. Widget gated behind endpoint availability.
3. **`inactive_reason` field** — confirm field name on Vehicle response. If absent, banner shows generic *"This vehicle is currently Inactive."*; if present, render the human-readable reason.
4. **Drivers placement** — default: **sub-tab inside `FleetManagement.tsx`** (drivers are fleet resources). Switch to a top-level Logistics tab only if user confirms otherwise.
5. **`GET /fleet/maintenance/upcoming` shape** — confirm whether `days_remaining` is pre-computed by backend. Plan derives client-side, prefers backend value when present.
6. **Vehicle status enum casing** — confirm backend always returns/accepts uppercase `ACTIVE | INACTIVE | UNDER_MAINTENANCE` on `/status`, regardless of legacy lowercase elsewhere.

## API Wiring (`src/services/logisticsApi.ts`)

Extend `fleetApi` and add `driversApi`. All routes use existing `apiRequest` (auth handled). Every successful mutation dispatches `app:refresh`.

**Vehicle Documents**
- `listDocuments(vehicleId)` → `GET /fleet/vehicles/:id/documents` (returns `alert_colour`, `expiry_date`, `document_type`, `file_url`).
- `uploadDocument(vehicleId, file, document_type, expiry_date)` → `POST` (FormData).
- `deleteDocument(vehicleId, documentId)` → `DELETE …/:documentId`.
- `getDocumentAlerts()` → `GET /fleet/documents/alerts` *(only if pre-flight #2 confirms)*.

**Maintenance**
- `listMaintenance(vehicleId)` → `GET /fleet/vehicles/:id/maintenance`.
- `createMaintenance(vehicleId, body)` → `POST` `{ maintenance_type, interval_months, last_maintenance_date, notes }`.
- `updateMaintenance(vehicleId, scheduleId, body)` → `PATCH …/:scheduleId` (edit + Mark Complete with `{ last_maintenance_date: today }`).
- `getUpcomingMaintenance()` → `GET /fleet/maintenance/upcoming`.

**Status Override**
- `updateStatus(vehicleId, { status, reason, override_by })` → `PATCH /fleet/vehicles/:id/status`. Status enum exactly: `ACTIVE | INACTIVE | UNDER_MAINTENANCE`.

**Drivers** (new `driversApi`)
- `list()` → `GET /fleet/drivers`.
- `create(body)` → `POST /fleet/drivers`.
- `update(driverId, body)` → `PATCH /fleet/drivers/:driverId`.
- Body: `{ name, email?, phone_number, licence_number, ... }`.

## Types (`src/types/logistics.ts`)

- Extend `VehicleDocument`: `documentType`, `expiryDate`, `alertColour: 'GREEN'|'AMBER'|'RED'|null`.
- New `MaintenanceSchedule { id, vehicleId, maintenanceType, intervalMonths, lastMaintenanceDate, nextMaintenanceDate, status: 'scheduled'|'completed'|'overdue', notes? }`.
- New `Driver { id, name, email?, phoneNumber, licenceNumber, ... }`.
- `VehicleStatus` union extended for `ACTIVE | INACTIVE | UNDER_MAINTENANCE`. Optional `inactiveReason`, `inactiveReasonLabel` per pre-flight #3.

**`src/utils/vehicleStatus.ts`** — locked mapping:

```ts
// formatVehicleStatus()
ACTIVE             → "Active"            (success / green)
INACTIVE           → "Inactive"          (destructive / red)
UNDER_MAINTENANCE  → "Under Maintenance" (warning / amber)
// legacy lowercase passthrough (available, in_use, maintenance, out_of_service)
// title-cased with console.warn in dev
```

`vehicleStatusBadgeClass()` returns the matching token classes. **Every** badge, list row, and detail banner routes through these helpers — no hardcoded literals.

## 4.1 — Vehicle Documents Tab

New `VehicleDocumentsTab.tsx` inside View Vehicle dialog.
- Table: Type, Uploaded, Expiry, Status, Actions (View / Replace / Delete).
- Status & expiry-cell colour driven by backend `alert_colour`: GREEN→success, AMBER→warning, RED→destructive. Expired fallback (per pre-flight #1) only if `alert_colour` is null AND `expiry_date < today`.
- Upload form: dropdown locked to the 5 spec types, expiry date picker, file input (PDF/image accept).
- Banner if any expired doc present: `<Alert variant="destructive">` *"This vehicle has expired documents and has been set to Inactive."*

**Expiring Documents StatCard** on Fleet dashboard summary row — only rendered when `GET /fleet/documents/alerts` is confirmed available. Click → filter list. Bell-icon notifications deep-link with `?vehicle=:id&tab=documents`.

## 4.2 — Maintenance Tab + Widget + Trip Conflict

New `VehicleMaintenanceTab.tsx`:
- Table: Type, Last Date, Next Due, Interval (months), Status badge (Scheduled = blue, Completed = green, Overdue = red), Actions.
- Add/Edit form: Type (text), Interval months (number), Last Date (picker), Next Date (read-only, live `addMonths(last, interval)` preview), Notes.
- Mark Complete → `AlertDialog` *"Update Last Maintenance Date to today?"* → `updateMaintenance` with today.

**`UpcomingMaintenanceWidget.tsx`** (Fleet dashboard):
- Calls `getUpcomingMaintenance()`, filters 14-day window. `daysRemaining` derived client-side; backend `days_remaining` wins when present.
- Explicit states: **Loading** (skeleton rows), **Empty** (*"No maintenance due in the next 14 days."*), **Error** (destructive banner + Retry). Happy path: Plate, Type, Due Date, Days Remaining.

**Trip Assignment Warning** (`TripScheduling.tsx` vehicle picker):
- Always perform a **fresh `listMaintenance(vehicleId)`** on selection (no cache). If any `nextMaintenanceDate` is within 7 days, render inline `<Alert variant="warning">` with **Proceed Anyway** (dismiss, keep selection) and **Choose a Different Vehicle** (clear selection + reopen dropdown). Non-blocking.

## 4.3 — Status Indicators & Manual Override

In `FleetManagement.tsx`:
- Vehicle list row/card: badge always rendered via `vehicleStatusBadgeClass(status)` + `formatVehicleStatus(status)`. INACTIVE = red, UNDER_MAINTENANCE = amber, ACTIVE = green.
- Vehicle detail dialog top banner:
  - INACTIVE → destructive banner. If `inactiveReasonLabel` present, render it; else *"This vehicle is currently Inactive."*
  - UNDER_MAINTENANCE → warning banner *"This vehicle is currently Under Maintenance and unavailable for trip assignment."*
  - ACTIVE → no banner.
- **Vehicle picker in `TripScheduling.tsx`**: filter out `INACTIVE` and `UNDER_MAINTENANCE` vehicles from the assignable list (existing maintenance-conflict warning still applies to ACTIVE vehicles with upcoming maintenance).
- **Reactivate Vehicle** button visible only to `logistics_officer | logistics_manager | logistics | admin`, and only when status is INACTIVE or UNDER_MAINTENANCE. Opens `ReactivateVehicleDialog`:
  - Required Textarea reason, **minimum 10 characters** (live-validated; submit disabled until met; helper text shows count, e.g. `4 / 10 minimum`).
  - On submit → `updateStatus(id, { status: 'ACTIVE', reason, override_by: user.id })`.
  - Cancel / Confirm buttons.

> **`UNDER_MAINTENANCE` source of truth:** backend-set only (e.g. cron when maintenance overdue, or manual ops). Frontend never POSTs `UNDER_MAINTENANCE` via `updateStatus` — it only displays it and offers Reactivate to override back to ACTIVE.

## 4.4 — Driver Form Updates

New `DriverManagement.tsx` mounted as a **sub-tab inside `FleetManagement.tsx`**.
- **Email**: no required asterisk; helper text *"Optional — only if the driver has a work email address."*; validation: optional, but if filled must match standard email regex.
- **Phone Number**: required (`*`), `type="tel"`, validation: digits only (strip non-digits), min 10 digits.
- Driver list table includes Phone Number column.
- Driver detail and supervisor-facing trip detail in `TripScheduling.tsx` render `driver.phoneNumber` prominently as a `tel:` link.

## FleetManagement Sub-Tab Order (locked)

1. **Vehicles** (primary resource)
2. **Maintenance** (schedules for the resource)
3. **Drivers** (operators of the resource)
4. **Documents** (paperwork)

Documents tab here is the per-vehicle document view rendered through the active vehicle context (or a global view of expiring docs when no vehicle is selected — to be shaped during build but tab position is fixed).

## Files

**New**
- `src/components/logistics/VehicleDocumentsTab.tsx`
- `src/components/logistics/VehicleMaintenanceTab.tsx`
- `src/components/logistics/UpcomingMaintenanceWidget.tsx`
- `src/components/logistics/ReactivateVehicleDialog.tsx`
- `src/components/logistics/DriverManagement.tsx`
- `src/utils/vehicleStatus.ts`

**Edited**
- `src/services/logisticsApi.ts` (extend `fleetApi`, add `driversApi`)
- `src/types/logistics.ts`
- `src/components/logistics/FleetManagement.tsx` (locked sub-tab order, badge/banner via helpers, Reactivate flow, Expiring Docs StatCard)
- `src/components/logistics/TripScheduling.tsx` (filter INACTIVE/UNDER_MAINTENANCE vehicles, on-demand maintenance-conflict warning, driver phone display)
- `src/components/logistics/index.ts`

## Out of Scope
- Backend implementation of any endpoint above.
- Push/email notification transport (uses existing notification stack).
- Recalculating document tier colours on the client — always trust backend `alert_colour`.
- Frontend setting `UNDER_MAINTENANCE` via `updateStatus` (display-only on the FE).
