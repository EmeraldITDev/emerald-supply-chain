# Frontend integration: new formatted_id

The backend now returns `formatted_id` / `formattedId` (e.g. `MRF-EMERALD-IT-LAP-2026-001`) and `legacy_id` / `legacyId` on MRF, SRF, RFQ records, plus a new `GET /api/search` endpoint. Per project rule (`vendor-data-integrity-standards-v2`), UUIDs (the `id` field) must continue to be used for all API calls; only display + search should use `formatted_id`.

## Goals

1. Show the new `formatted_id` everywhere a request ID is rendered (cards, tables, dialogs, breadcrumbs, exports, PDFs, emails, toasts).
2. Keep all API calls using the UUID `id`.
3. Backward compat: if `formatted_id` is missing, fall back to `legacy_id`, then `id`.
4. Replace mock global search with the new `/api/search` endpoint, matching formatted IDs.

## Plan

### 1. Types (`src/types/index.ts`)
Add optional `formatted_id?`, `formattedId?`, `legacy_id?`, `legacyId?`, plus `department?`, `category?` to MRF, SRF, RFQ interfaces.

### 2. Display helper (new `src/utils/displayId.ts`)
Single source of truth:
```ts
export const getDisplayId = (r) => r?.formattedId ?? r?.formatted_id ?? r?.legacyId ?? r?.legacy_id ?? r?.id ?? '';
```
All UI consumes this — never reads `.id` directly for display.

### 3. UI replacements
Sweep these files and replace inline `mrf.id` / `request.id` / `rfq.id` / `srf.id` rendered as text with `getDisplayId(...)`. Keep `.id` for handlers, keys, and API args:
- `src/pages/Procurement.tsx` (cards, dialog headers, search filter)
- `src/pages/DepartmentDashboard.tsx`, `EmployeeDashboard.tsx`, `ExecutiveDashboard.tsx`, `ChairmanDashboard.tsx`, `SupplyChainDashboard.tsx`, `FinanceDashboard.tsx`, `Dashboard.tsx`
- `src/pages/AccountsPayable.tsx`, `AccountsReceivable.tsx`, `BudgetControl.tsx`, `Projects.tsx`, `Reports.tsx`, `MRNDetail.tsx`, `VendorPortal.tsx`
- `src/components/RFQManagement.tsx`, `MRFActionButtons.tsx`, `MRFApprovalDialog.tsx`, `POGenerationDialog.tsx`, `PORejectionDialog.tsx`, `MRFProgressTracker.tsx`, `ProcurementProgressTracker.tsx`, `RecentActivities.tsx`, `NotificationCenter.tsx`, `DashboardAlerts.tsx`, `AuditTrail.tsx`, `VendorQuoteSubmission.tsx`, `ExportMenu.tsx`
- Search filters: include both `id` and `getDisplayId(r)` so old + new IDs both match locally.

### 4. Breadcrumbs (`src/components/Breadcrumbs.tsx`)
Update the dynamic-ID regex to also match the new format (`/^[A-Z]+(-[A-Z0-9]+)+/`), so `MRF-EMERALD-IT-LAP-2026-001` shows in the trail correctly.

### 5. Global search (`src/components/GlobalSearch.tsx`)
Replace the mock results array with a debounced fetch to `GET /api/search?q=...` via a new `searchApi.global(q)` in `src/services/api.ts`. Map results → `{id, formatted_id, title, type}` and route to the appropriate page.

### 6. Exports / PDFs (`src/utils/exportData.ts`, `src/components/ExportMenu.tsx`)
Use `getDisplayId` for the "ID" column in CSV/Excel exports and downloaded filenames.

### 7. Toasts
In create flows (`NewMRF`, `NewSRF`, `NewMRN`, RFQ creation), show the returned `formatted_id` in the success toast: "MRF MRF-EMERALD-IT-LAP-2026-001 submitted".

## Out of scope
- No backend changes (already done by backend team).
- No schema/route changes.
- Vendor portal: do NOT expose internal codes that leak budget/category info beyond what's already shown — only show `formatted_id` if the existing UI was already showing an ID.

## Technical notes
- `getDisplayId` is pure and null-safe; never falls back to URL parsing.
- All `mrfApi.getById(id)` etc. calls keep using UUID; backend already accepts both, but UUID stays canonical.
- Local `.filter()` searches add `getDisplayId(r).toLowerCase().includes(q)` alongside existing `r.id` match for backward compat.

## Validation
- Open MRF list → cards show new format.
- Open detail dialog → header + breadcrumb show new format.
- Cmd+K search → typing `LAP` or `EMERALD` returns matching items from `/api/search`.
- CSV export → "ID" column contains formatted IDs.
- Create new MRF → toast shows new format from response.
