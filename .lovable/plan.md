## Module 3 — Logistics: Trip Scheduling (v4, final)

Same four sub-features. Three additional clarifications layered on top of v3.

---

### API Wiring (single source of truth)

All routes added to `src/services/logisticsApi.ts` as named groups; UI never hardcodes paths.

```ts
// vendorTripApi
GET    /api/vendor-portal/trips
POST   /api/vendor-portal/trips/:tripId/submission
POST   /api/vendor-portal/trips/:tripId/documents
GET    /api/trips/:tripId/submission

// tripVendorApi
POST   /api/trips/:tripId/invite-vendors
GET    /api/trips/:tripId/vendor-responses
POST   /api/trips/:tripId/select-vendor
POST   /api/trips/:tripId/route-to-procurement
POST   /api/trips/:tripId/notify-invoice

// accommodationApi
GET/POST /api/logistics/accommodations
GET/PATCH/DELETE /api/logistics/accommodations/:id
GET    /api/trips/:tripId/accommodations

// jccApi
POST   /api/trips/:tripId/jcc
GET    /api/trips/:tripId/jcc
PATCH  /api/trips/:tripId/jcc
GET    /api/trips/:tripId/jcc/prefill
POST   /api/trips/:tripId/jcc/submit
POST   /api/trips/:tripId/jcc/approve
GET    /api/trips/:tripId/jcc/pdf
```

Every successful mutation dispatches `app:refresh`.

---

### `formatTripStatus()` — definitive mapping

Single helper in `src/utils/displayId.ts` (or `src/utils/tripStatus.ts`). All badges, conditionals, and filters route through it.

```ts
// backend snake_case → display label
draft              → "Draft"
scheduled          → "Scheduled"
pending_approval   → "Pending Approval"
approved           → "Approved"
vendor_assigned    → "Vendor Assigned"
in_progress        → "In Progress"
completed          → "Completed"
closed             → "Closed"
cancelled          → "Cancelled"
// fallback: Title-Case the raw string and warn once in dev
```

If backend returns anything outside this set, the helper Title-Cases the value and logs a `console.warn` once per unknown value (dev only). No string literals in components.

---

### 3.1 — Vendor Portal: Trip Submission

**Files:** `VendorPortal.tsx` + new `VendorTripSubmissionForm.tsx`.

- Draft trip card → "Submit Trip Details" CTA opens drawer.
- Required fields per spec; Security Information optional; multi-file uploads tagged `Insurance Certificate | Road-Worthiness Certificate | Other`.
- **Per-file upload UI:** each file row shows a shadcn `Progress` bar during upload; on completion replaces with `filename + green check + Remove (×)`; failures show red icon + Retry. Submit disabled while any row is mid-upload.
- **Upload response shape (pre-flight #6):** normalised inside `vendorTripApi.uploadDoc` to `{ id, fileUrl, fileName }`. Components only see the normalised shape.
- After submit lock the form; chip flips through `formatTripStatus()`.

### 3.2 — Multi-Vendor Trip Request & Cost Comparison

**Files:** `TripScheduling.tsx` + new `TripVendorComparison.tsx`.

- New trip dialog: "Invite Multiple Vendors" switch → searchable multi-select with chips → **Send to All Selected Vendors** → `tripVendorApi.invite`.
- **Comparison table — full state coverage (review point #2):**
  - **Loading:** skeleton columns equal to count of invited vendors.
  - **Empty (no vendors invited):** card with message *"No vendors invited yet. Invite vendors from the trip actions menu."*
  - **Partial:** render one column per **invited** vendor (not just per response). Vendors who have responded show full data + **Select & Approve** button. Vendors who have not responded show their name with `Awaiting response` badge and a muted `—` for every other field; no Select button on those columns.
  - **Error on fetch:** inline destructive banner with Retry.
- **Sequential approval chain (locked from v3):**
  ```
  await selectVendor → await routeToProcurement → await notifyInvoice
  ```
  Each step in its own try/catch; failure of step 2 blocks step 3 with destructive banner + Retry Routing; failure of step 3 shows warning banner + Retry Notification. Success only when all three resolve.
- Vendor Portal approved-trip card shows persistent **"Submit Invoice"** CTA (target verified in pre-flight #5).

### 3.3 — Accommodation Module

**Files:** new `AccommodationBookings.tsx`; edit `Logistics.tsx`, `AppSidebar.tsx`.

- **Role matrix (locked):** `logistics_officer | logistics_manager | logistics | admin` get full CRUD; `supply_chain_director | procurement_manager` get read-only.
- List view per spec with filters; **+ New Booking** for CRUD roles only.
- Form per spec; check-out auto-derived from `check-in + nights`, read-only.
- Wired to `accommodationApi`; trip detail also shows linked bookings.

### 3.4 — Job Completion Certificate (JCC)

**Files:** new `JCCDialog.tsx`; edit `TripScheduling.tsx`.

- **Trigger:** "Close Trip / Issue JCC" enabled when status `in_progress` or `completed`. If JCC exists, swap to "View JCC" + status badge.
- **Drawer open sequence (review point #1 — explicit):**
  1. `await jccApi.get(tripId)` — if it returns an existing record, **rehydrate** all fields (header, certification statement, line items, signatory) into local state. Reference number renders read-only from the loaded record.
  2. If `get` returns 404 (no JCC yet), local state initialises empty. Reference field shows `—` with helper *"Generated when you save"*.
  3. Then check pre-fill: if `jccApi.getPrefill` returns suggestions **AND** local line items are empty (true for new JCCs and for Drafts saved with zero rows), show one-shot AlertDialog *"Pre-fill line items from vendor trip submissions?"* before the form is interactive. Never shown when an existing Draft already has rows.
- **Lazy creation:** drawer never calls `POST /jcc` on open. The first explicit `Save Draft` or `Submit JCC` creates the record (if step 1 returned 404); subsequent saves use `PATCH`. Closing without saving leaves zero database records.
- **Header:** company info from settings; reference (read-only post-save); Date Issued (today, editable); vendor name/address from approved trip/PO.
- **Certification statement:** prefilled textarea with `[service type] / [PO Number] / [Start Date] / [End Date]` substituted; freely editable.
- **Line items table:** SN auto, Description (textarea), Trip, Duration/Date, Remarks. Add/Remove rows; min 1 row to submit.
- **Signatory:** name + title from current user; digital signature image auto-applied (same mechanism as SCD PO signature).
- **Actions:** Save Draft, Submit, Approve (SCD only), Download PDF.
- **PDF policy:** Download PDF calls `jccApi.downloadPdf` (backend-rendered). If 404 → button disabled with tooltip *"PDF download will be available once backend rendering is enabled."* Separate, explicitly-badged **"Preview Draft (browser render)"** uses `window.print` on a styled hidden section — never the official certificate.
- Post-approval: trip → `closed`; "View JCC" + Download PDF remain.

---

### Cross-cutting

- **Files created:** `VendorTripSubmissionForm.tsx`, `TripVendorComparison.tsx`, `AccommodationBookings.tsx`, `JCCDialog.tsx`.
- **Files edited:** `Logistics.tsx`, `VendorPortal.tsx`, `TripScheduling.tsx`, `logistics/index.ts`, `services/logisticsApi.ts`, `types/logistics.ts`, `layout/AppSidebar.tsx`, `utils/displayId.ts` (or new `utils/tripStatus.ts`).
- **Tokens only** — `bg-warning/10` for Draft CTA, `bg-success/10` for Approved/Closed, `bg-destructive/10` for chain-failure banners. ₦ via existing formatter.
- **Privacy:** vendor portal screens never display internal estimated budgets.
- **Refresh:** every successful mutation dispatches `window.dispatchEvent(new CustomEvent('app:refresh'))`.

### Pre-flight verifications (surfaced, not silently assumed)

1. Confirm exact trip status strings from `GET /api/trips` first response → record any unknowns in `formatTripStatus()`.
2. Confirm `vendor-responses` payload shape (does it return per-invited-vendor entries with a `status` field, or only responders? If only responders, frontend joins against the original invite list to render Awaiting columns).
3. Confirm `jccApi.create` response field name for the reference number.
4. Confirm AppSidebar permission registration mechanism (role matrix already locked).
5. Verify existing vendor-portal invoice submission flow in `VendorPortal.tsx`. Present → CTA links to it; absent → CTA is a flagged placeholder, logged in implementation summary.
6. Verify document upload response shape from `POST /api/vendor-portal/trips/:tripId/documents` — normalisation isolated to `vendorTripApi.uploadDoc`.

### Out of Scope

- Backend-rendered JCC PDF (no client substitute for the official document).
- Backend invoice submission endpoint for vendors (frontend surface added; flagged if missing).
- SAP/Procurement PO generation downstream of `routeToProcurement` — only the trigger fires.
