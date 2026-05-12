## Goals
Give Logistics Manager (LM) the same request-creation power as employees, fix two maintenance bugs, and route logistics SRFs through Supply Chain Director → Procurement with full vehicle/maintenance context and read-only visibility for the LM.

## 1. Sidebar — Logistics Manager creates MRF/SRF
File: `src/components/layout/AppSidebar.tsx`

Replace the current `logistics_manager` branch (Dashboard + Logistics only) with a Logistics-focused nav that also includes Requests:
```
Main:      Dashboard
Requests:  My Requests, New MRF, New SRF, Annual Planning
Operations: Logistics, Vendors (read-only), Inventory
Analytics: Reports
```
LM already has a backend role; `/new-mrf`, `/new-srf` and `/department` routes are role-agnostic, so just exposing them is enough.

Also update `isEmployeeRole` consumers / route guards if they hard-block LM from `/new-mrf` or `/new-srf` (check `NewMRF.tsx`, `NewSRF.tsx`, `EmployeeDashboard.tsx`). Add `logistics_manager` to allowed creators.

## 2. Maintenance records not showing in Vehicle Details
File: `src/components/logistics/FleetManagement.tsx`

Two maintenance dialogs exist:
- `VehicleMaintenanceTab` (in details modal) — uses `fleetApi.listMaintenance/createMaintenance` (schedule-style records).
- `Add Maintenance Record` dialog (`handleAddMaintenance`) — writes to `maintenanceHistory` via a different endpoint, so new records never appear in the tab.

Fix by routing the "Add Maintenance Record" dialog through the same `fleetApi.createMaintenance` endpoint the tab reads from (or render `maintenanceHistory` inside `VehicleMaintenanceTab` as a second list). Preferred: consolidate to one source — submit via `fleetApi.createMaintenance`, then `fetchData()` so the Maintenance tab refreshes automatically.

## 3. Delete uploaded documents on a maintenance record
The maintenance flow currently has no per-record document UI. Plan:
- Extend `VehicleMaintenanceTab` row actions with a "Documents" popover listing attachments from `record.documents`.
- Add `fleetApi.deleteMaintenanceDocument(vehicleId, recordId, documentId)` and wire a trash button with confirm dialog.
- If backend doesn't expose delete, fall back to PATCH the record with a filtered `documents` array.

## 4. SRF workflow for logistics → SCD → Procurement → RFQ
Files: `src/pages/NewSRF.tsx`, `src/services/procurementApi.ts`, SCD dashboard (`SupplyChainDashboard.tsx`), `RFQManagement.tsx`.

- When `user.role === 'logistics_manager'`, NewSRF form adds a "Linked Vehicle" picker (calls `fleetApi.list`) and auto-attaches: vehicle plate, make/model/year, odometer, last/next maintenance dates, recent maintenance history (last 5), and active document list. Stored on the SRF as `vehicleContext`.
- SRF submitted by LM is routed `currentStage = 'supply_chain'` (skip executive) — confirm with backend contract; otherwise leave existing routing and surface to SCD via the existing "All Requests" tab.
- SCD approval action (existing `SupplyChainActionButtons`) already supports approve/reject; ensure approved logistics SRFs land in Procurement queue.
- In `RFQManagement` "Create RFQ" dialog, when source SRF has `vehicleContext`, pre-fill the description/specifications block with a formatted vehicle summary so vendors see plate, model, mileage, fault description, etc. Show a non-editable "Vehicle Context" panel above specs.

## 5. End-to-end visibility for Logistics Manager
- Reuse `ProcurementProgressTracker` on the LM dashboard (likely `Logistics.tsx` or a new "My Requests" tab) filtered to MRFs/SRFs `requesterId === user.id` OR `vehicleContext` present.
- Add a "Procurement Activity" panel listing: RFQs sent (vendor count), quotations received (with price/delivery), approval stage badges, PO status. Use existing `procurementApi.getRFQsForRequest`, `getQuotations`, `getPOForRequest`.
- Read-only — no approval actions for LM.

## Out of scope / backend dependencies
- Actual backend role permissions on `/new-mrf` and `/new-srf` endpoints for `logistics_manager` must allow create.
- New endpoint may be needed for `DELETE /maintenance/:id/documents/:docId`.
- SRF schema needs a `vehicle_context` JSON column (or attach as note metadata if not available).

I'll surface any 4xx responses encountered and adjust.

## Verification
- LM login → sidebar shows New MRF/SRF; can submit an SRF with vehicle context.
- Add maintenance from FleetManagement → record appears in Vehicle Details → Maintenance tab.
- Upload doc to maintenance record → trash icon removes it.
- SCD sees the SRF with vehicle context → approves → Procurement creates RFQ pre-filled with vehicle details → LM dashboard shows RFQ + quotations + approval progress.
