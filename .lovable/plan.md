# Module 5 — Materials Tracking Frontend (v3 — final)

Implements both sections of the uploaded spec: enhanced Material Movement form and Material Job Completion Certificate (JCC). New domain — "movements in transit", **distinct from the existing inventory-style `MaterialsTracking.tsx`**, which is left intact.

## Pre-Flight Verifications (resolve before build)

1. **Vendor field source** — confirm `vendor_id` lookup uses the existing vendors endpoint (`vendorsApi.getAll`). Reuse if yes; otherwise request the logistics-specific endpoint.
2. **`condition_of_goods` enum** — confirm backend accepts exactly `NEW | USED | DAMAGED`. Display: New / Used / Damaged.
3. **`condition_on_arrival` enum on JCC** — confirm exactly `GOOD | DAMAGED | PARTIAL`. Display: Good / Damaged / Partial Delivery.
4. **`GET /jcc/prefill` shape** — confirm response is array of `{ materialName, quantity, condition, remarks }`. If wrapped, normalise once in `materialsMovementsApi`.
5. **`GET /jcc/pdf` availability** — if not yet live, ship the button **disabled** with tooltip *"PDF download will be available once backend rendering is enabled."* No client-side PDF substitute.
6. **Reference number** — confirmed by spec (`JCC/MAT/[YYYYMM]-[seq]`, backend on first `POST /jcc`). Read-only.
7. **`vendor_id` nullable / `vendor_name` free-text** — confirmed by spec. One of the two required.
8. **StatCard counts source** — confirm whether `GET /api/materials` returns top-level aggregates or a separate `GET /api/materials/summary` endpoint exists. If list is paginated, **never** derive from current page.
9. **Vendor address for Emerald-owned movements** — default plan: include optional `vendor_address` Textarea on the form when Emerald-owned mode is on; if backend rejects, drop the address line gracefully on the JCC header.

## API Wiring (`src/services/logisticsApi.ts`)

New `materialsMovementsApi` group (named to avoid collision with the existing inventory `materialsApi`). All routes via `apiRequest`. Every successful mutation dispatches `app:refresh`. Auto-retry on 5xx/network. Snake_case → camelCase mapped at the boundary in single normalisers (`normalizeMovement`, `normalizeJCC`).

**Movements**
- `list(params?)` → `GET /api/materials` (params: status, category, search, dateFrom, dateTo, destination)
- `getSummary()` → `GET /api/materials/summary` *(only if pre-flight #8 confirms)*
- `get(id)` → `GET /api/materials/:id`
- `create(body)` → `POST /api/materials`
- `update(id, body)` → `PATCH /api/materials/:id`
- `cancel(id)` → `DELETE /api/materials/:id` (soft-delete)
- `markInTransit(id)` → `POST /api/materials/:id/mark-in-transit`
- `markDelivered(id)` → `POST /api/materials/:id/mark-delivered`

**Material JCC**
- `getJCC(materialId)` → `GET /api/materials/:materialId/jcc` (404 → `null`, not throw)
- `createJCC(materialId, body)` → `POST /api/materials/:materialId/jcc`
- `updateJCC(materialId, body)` → `PATCH /api/materials/:materialId/jcc` (Draft only — server enforces)
- `getJCCPrefill(materialId)` → `GET /api/materials/:materialId/jcc/prefill` (called conditionally — see §5.2)
- `submitJCC(materialId)` → `POST /api/materials/:materialId/jcc/submit`
- `approveJCC(materialId)` → `POST /api/materials/:materialId/jcc/approve`
- `downloadJCCPdf(materialId)` → `GET /api/materials/:materialId/jcc/pdf` (blob)

## Types (`src/types/logistics.ts`)

```ts
type MaterialMovementStatus = 'pending' | 'in_transit' | 'delivered' | 'cancelled';
type MaterialJCCStatus = 'draft' | 'submitted' | 'approved';
type ConditionOfGoods = 'NEW' | 'USED' | 'DAMAGED';
type ConditionOnArrival = 'GOOD' | 'DAMAGED' | 'PARTIAL';

interface MaterialMovement {
  id; materialName; category; quantity;
  pickupLocation; destination;
  vendorId?: string; vendorName?: string; vendorAddress?: string; vendorPhone;
  vehiclePlate; driverName; driverPhone;
  expectedPickupAt; expectedDeliveryAt;
  conditionOfGoods: ConditionOfGoods;
  status: MaterialMovementStatus;
  linkedPoNumber?: string;
  jccId?: string; jccStatus?: MaterialJCCStatus;
  createdAt; updatedAt;
}

interface MaterialJCCLineItem { id?; sn; materialName; quantity; condition; remarks; }

interface MaterialJCC {
  id; materialId; referenceNumber; dateIssued;
  certificationStatement; conditionOnArrival: ConditionOnArrival;
  lineItems: MaterialJCCLineItem[];
  status: MaterialJCCStatus;
  signatoryName; signatoryTitle; signatureUrl?;
  vendorName; vendorAddress?; linkedPoNumber?;
  createdAt; updatedAt;
}

interface MaterialMovementSummary { total; pending; in_transit; delivered; cancelled; }
```

## Status Helper (`src/utils/materialStatus.ts`)

```ts
formatMaterialStatus(s):
  pending     → "Pending"     (neutral / muted)
  in_transit  → "In Transit"  (warning / amber)
  delivered   → "Delivered"   (success / green)
  cancelled   → "Cancelled"   (destructive / red)
  fallback    → Title-Case + console.warn

materialStatusBadgeClass(s) — token classes.

formatJCCStatus(s):
  draft     → "Draft"     (neutral)
  submitted → "Submitted" (info / blue)
  approved  → "Approved"  (success / green)
```

All badges and conditional UI route through these helpers — no string literals.

## 5.1 — Material Movements List + Form

**New `MaterialMovements.tsx`** (mounted as a new "Material Movements" sub-tab in `Logistics.tsx`, distinct from the legacy "Materials" inventory tab — both coexist).

**StatCards (Total / Pending / In Transit / Delivered):**
- Data source per pre-flight #8. **Selection logic — one-time on mount** (cached for the component lifetime, not re-evaluated on filter changes):
  1. Try `getSummary()`. If 200, use it and remember `source = 'summary'`.
  2. Else inspect first `list()` response for top-level aggregate fields (`total`, `pending`, `in_transit`, `delivered`, `cancelled`). If present, remember `source = 'list-aggregates'` and read them from every subsequent `list()` response.
  3. Else `source = 'unavailable'` → render `<Skeleton>` permanently with non-blocking helper *"Counts pending backend support"*. Never derive from `data.length`.
- After mutations (create/update/cancel/mark*), refresh via the same source: `getSummary()` if `source === 'summary'`, otherwise rely on the next `list()` response.

**Filters & search:**
- Status, category, date range, destination text.
- Search by material name / destination / vehicle plate.
- **Search input debounced 300ms** before firing `list(params)` (small `useDebouncedValue` hook). Status/category/date filters fire immediately.

**Table columns:** Material Name, Category, Quantity, Pickup, Destination, Status badge, Expected Delivery, Actions.

**Top-right `+ New Material Movement`** (CRUD roles only).

**Row actions (DropdownMenu):**
- **View** → opens detail drawer.
- **Edit** → opens form (only if status is `pending` or `in_transit`).
- **Mark In Transit** → AlertDialog confirm → `markInTransit`. Visible only when `pending`.
- **Mark Delivered** → AlertDialog confirm → `markDelivered`. Visible only when `in_transit` AND `jccStatus === 'approved'`. When JCC missing/not approved, render disabled with tooltip *"Approve the JCC before marking this movement as delivered."*
- **Cancel** → AlertDialog confirm → `cancel`.

**New `MaterialMovementForm.tsx`** (Dialog, max 85vh, internal scroll):

- Fields per spec table. Required marked `*`.
- **Vendor section:**
  - Default: searchable vendor combobox (reuse Procurement vendor dropdown if present; otherwise `Command`-based combobox over `vendorsApi.getAll`). Address read from selected vendor record.
  - Checkbox *"Emerald-owned vehicle (no vendor record)"* → toggles to free-text `Vendor Name` Input **plus optional `Vendor Address` Textarea** (per pre-flight #9). Submitting sends `vendor_name` (and `vendor_address` when present) instead of `vendor_id`.
- Datetimes use `<Input type="datetime-local">`. Inline validation: delivery > pickup; min 10-digit phones; condition required.
- Submit calls `create` or `update`. On success: toast, close, refresh list (and StatCards via the cached source).

## 5.2 — Material JCC

**New `MaterialJCCDialog.tsx`** (large Dialog, max 85vh internal scroll; mounted from movement detail "Close Movement / Issue JCC" button).

**Open sequence (strict order):**

1. `getJCC(materialId)`:
   - If record present → rehydrate header, certification, condition, line items. Reference number read-only.
   - If 404 (`null`) → empty local state. Reference shows `—` with helper *"Generated when you save."*
2. **Conditionally** call `getJCCPrefill(materialId)` **only when** there is no existing JCC OR the existing JCC is `draft` AND its line items are empty. Skip entirely for `submitted` / `approved` JCCs.
   - If suggestions returned AND local line items still empty → one-shot `AlertDialog`: *"Pre-fill line items from material movement details?"* Yes auto-fills, No leaves empty.

**Header section (read-only, auto-filled):** company info from `useApp` settings (or static fallback consistent with existing PO layout); JCC reference; Date Issued (date picker, defaults today, editable while draft); Vendor Name + Address from the movement record.
- If `vendorAddress` is missing (Emerald-owned with none provided), render the vendor block with name only — **no empty "Address:" label**, no placeholder dash.
- Linked PO number rendered only if present.

**Certification statement:** editable `<Textarea>` pre-filled with the spec text. Locked once status is `submitted` or `approved`.

**Condition on Arrival:** `<Select>` Good / Damaged / Partial Delivery — required to enable Submit.

**Line items table:** SN (auto), Material Name, Quantity, Condition, Remarks; `+ Add Row`; per-row remove (×); minimum 1 row to submit. Inputs disabled when status ≠ `draft`.

**Signatory section (read-only):** current user's name and title from `AuthContext`; signature image from `user.signatureUrl` if present (same field as SCD PO signature), else *"Signature will be applied on approval."*

**Mode resolution (drives footer button visibility):**

```ts
const canManage = canManageMovementsRole(role);
const canApprove = canApproveMaterialJCCRole(role);
const isDraftEditable = (jcc?.status ?? 'draft') === 'draft' && canManage;
const isPendingApproval = jcc?.status === 'submitted';
const readOnly = !isDraftEditable && !(isPendingApproval && canApprove);
```

**Actions (footer) — explicit visibility rules:**

- **Save as Draft** — visible **only when** `isDraftEditable`. First save → `createJCC`, then `updateJCC`. Captures returned `referenceNumber`.
- **Submit JCC** — visible **only when** `isDraftEditable`. Disabled until: condition selected, ≥1 line item with all fields filled, certification non-empty.
- **Approve JCC** — visible **only when** `isPendingApproval && canApprove` (`supply_chain_director` only). Calls `approveJCC`. Movement detail refetches afterward; backend is source of truth for status flip to `delivered`.
- **Download PDF** — always visible. Disabled with tooltip if pre-flight #5 says unavailable, OR if status ≠ `approved`.
- **Preview Draft (browser render)** — always visible.
- **Close** — always visible.

> **Read-only context summary (locked):** when neither `isDraftEditable` nor (`isPendingApproval && canApprove`) is true — i.e. a read-only role viewing any JCC, or any user viewing a submitted/approved JCC without approval rights — the dialog renders Header, Certification, Condition, Line Items, and Signatory in disabled state and the footer shows **only Download PDF, Preview Draft, and Close**. Save Draft / Submit / Approve are not rendered (not just disabled).

**Preview Draft watermark (locked):** absolutely-positioned full-page diagonal text *"DRAFT PREVIEW — NOT OFFICIAL CERTIFICATE"*, rotated −30°, centered, font-weight 800, font-size ~96px, color `hsl(var(--destructive) / 0.18)`, `pointer-events: none`, `z-index: 50`. Repeated once vertically so it spans short and long pages. Rendered inside the print stylesheet (`@media print`) so it survives `window.print()`.

**Movement detail integration (inside the View drawer):**
- If no JCC and status ∈ {`in_transit`, `delivered`} → **Close Movement / Issue JCC** button (CRUD roles only).
- If JCC exists → **View JCC** link + JCC status badge via `formatJCCStatus`. Clicking opens the same dialog; mode resolution above governs the rest.

## Role Gating (`AuthContext` `role`)

- Full CRUD on movements + Save/Submit JCC: `logistics_officer | logistics_manager | logistics | admin`.
- Read-only (no buttons, no actions menu): `supply_chain_director | procurement_manager`.
- Approve JCC: `supply_chain_director` only.
- Implemented via `canManageMovements(role)` / `canApproveMaterialJCC(role)` helpers colocated with components.

## Files

**New**
- `src/components/logistics/MaterialMovements.tsx`
- `src/components/logistics/MaterialMovementForm.tsx`
- `src/components/logistics/MaterialJCCDialog.tsx`
- `src/utils/materialStatus.ts`

**Edited**
- `src/services/logisticsApi.ts` — add `materialsMovementsApi` and JCC methods (do NOT touch existing inventory `materialsApi`).
- `src/types/logistics.ts` — add types and enums above.
- `src/pages/Logistics.tsx` — add new "Material Movements" tab.
- `src/components/logistics/index.ts` — export new components.

## Out of Scope

- Inventory management (legacy `MaterialsTracking.tsx` stays as-is).
- Backend implementation of any endpoint.
- Client-rendered official JCC PDF.
- Push/email notification transport.
- Auto-flipping movement status to `delivered` on JCC approval from the frontend (backend is source of truth; FE refetches).
