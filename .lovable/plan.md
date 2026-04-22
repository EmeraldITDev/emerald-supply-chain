

# Plan — Backfill Decision (Revised after verification)

## Verification results

**Endpoint check (gap 1):** Searched `src/services/api.ts` end-to-end. There is **no admin endpoint** to update another vendor's profile fields:
- `vendorApi.updateCredentials` → only `email` / `resetPassword` (line 2085).
- `vendorApi.updateProfile` → `PUT /vendors/profile`, vendor-self only, no `{id}` (line 2098).
- `vendorAuthApi.updateProfile` → vendor-self, whitelisted to `contact_person`, `phone`, `address` only (line 2245).

The four target fields (`annual_revenue`, `number_of_employees`, `year_established`, `website`) are accepted on `POST /vendors/register` (line 1810-1813) but there is no PUT/PATCH path that accepts them for an existing vendor as an admin. **Frontend work is blocked on backend until an admin update endpoint is added.**

**Type check (gap 2):** In the existing `vendorApi.register` payload (line 1812), `numberOfEmployees: string` and `annualRevenue: string`. The original registration form sends them as strings (likely range labels like `"11-50"`). So the database column is almost certainly `varchar`, not `integer`. Any admin edit dialog must mirror that contract: string for both. `yearEstablished: number` (line 1811).

**State-source check (gap 3, observation):** Confirmed via `src/services/api.ts` — `vendorApi.getById` (`GET /vendors/{id}`, line 1782) exists and returns the full `Vendor`. Any edit dialog must call `getById` on open, not read from the list cache.

## Revised recommendation

**Option B is still correct, but it is two-phase and the first phase is backend-side.**

### Phase 1 — Backend (blocker, not in this repo)
Backend team adds:
- `PUT /api/vendors/{uuid}` (admin-only) accepting `annual_revenue` (string), `number_of_employees` (string), `year_established` (integer 1900–current year), `website` (url string, nullable).
- Validator must reject unknown fields and enforce the same column types used by `register`.
- Authorization: `procurement_manager` or `supply_chain_director` only.

Until this exists, no frontend dialog can save successfully. Do not build the dialog against a non-existent endpoint.

### Phase 2 — Frontend (this repo, after Phase 1 ships)

1. **`src/services/api.ts`** — add one method:
   ```ts
   updateAdmin: async (id: string, data: {
     annualRevenue?: string;
     numberOfEmployees?: string;
     yearEstablished?: number;
     website?: string;
   }): Promise<ApiResponse<Vendor>> =>
     apiRequest<Vendor>(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) });
   ```

2. **`src/pages/Vendors.tsx`** — add an "Edit Profile Details" action per row, visible only to `procurement_manager` and `supply_chain_director` (use existing role guards already in this file).

3. **New dialog** `src/components/VendorProfileEditDialog.tsx`:
   - On open: call `vendorApi.getById(uuid)` to fetch the full record. Do **not** read from the list state.
   - Four inputs:
     - `annualRevenue` — text input (string, currency-formatted display only).
     - `numberOfEmployees` — text input (string). **Free text, not a select**, to match what `register` already sends and what the column stores. If the original registration form used a range select, replicate the same options here for consistency, but the value submitted is the string label.
     - `yearEstablished` — number input, min 1900, max current year.
     - `website` — url input, optional.
   - Empty values render as blank, not "N/A".
   - Submit calls `vendorApi.updateAdmin(uuid, payload)`. On success, refresh the list and close.

4. **"Profile incomplete" filter chip** on `Vendors.tsx` — flags vendors where any of the four fields is null on the list response. Lets admins triage the legacy backlog.

## Out of scope
- No bulk migration, no Laravel artisan command (backend's call).
- No change to `N/A` display logic — it correctly shows when data is null and disappears once backfilled.
- No vendor self-service re-entry flow.
- The four `Procurement.tsx` diagnostic-log bugs are unaffected.

## Decision needed

Confirm one of:

- **B1** — Proceed in two phases as above. I will pause until backend confirms `PUT /api/vendors/{uuid}` exists with the four whitelisted fields, then implement Phase 2.
- **B2** — Backend already has this endpoint and I missed it. Provide the exact route and accepted field names; I will wire Phase 2 directly.
- **A** — Skip the dialog. Accept legacy `N/A` for pre-fix vendors. Close the thread.

