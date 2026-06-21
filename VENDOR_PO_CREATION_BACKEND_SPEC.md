# Vendor Creation via Manual PO — Backend Specification

Status: **Backend implemented** · **Frontend integrated** (Jun 2026)

This document describes the manual-PO vendor dedupe & onboarding contract between
the React frontend and the Laravel API (`supply-chain-backend`). Backend
behaviour is live; the frontend calls `GET /vendors/lookup`, surfaces
`resolvedVendors` on PO finalise, and honours `profile_completed` on the
Vendor Portal.

**Vendor list:** `GET /api/vendors` excludes `Inactive` rows by default
(merged duplicates). Frontend passes `?include_inactive=1` only on Vendor
Management when **Show inactive merged** is enabled (pre-purge audit). PO/RFQ
directory pickers always use the default list. After backend merge + purge, use
**Refresh** on Vendor Directory to reload the canonical active list.

---

## 1. Problem recap

When a buyer creates a manual / fast-track PO (Procurement → Purchase Orders →
**Create PO**), they can type a brand-new supplier inline on the price
comparison sheet instead of picking from the vendor directory. Today the
backend appears to create a fresh vendor record each time, so the same vendor
ends up duplicated:

```
Vendor A (V001)
Vendor A (V002)
Vendor A (V003)
```

The improvements: prevent duplicates, require email + phone, auto-onboard the
vendor to the Vendor Portal, and let them complete their profile later.

---

## 2. Frontend changes shipped (context for backend)

These are already implemented in this repo and define the contract the backend
must honour:

| Area | File | Behaviour |
|------|------|-----------|
| Manual vendor on price comparison | `src/components/procurement/PriceComparisonTable.tsx` | Email **and** phone are now required and validated client-side; email format checked. Placeholders show `Email *` / `Phone *`. |
| Duplicate detection (client-side hint) | `src/components/procurement/PriceComparisonTable.tsx` (`findExistingVendorMatch`) | As the buyer types a manual vendor name/email, it is matched against the loaded `/vendors` directory. If a match is found, a warning + **"Use existing vendor"** button switches the row to the directory vendor. This is a **UX hint only** and is **not** authoritative. |
| Manual vendor payload | `src/services/procurementApi.ts` (`serializeRow`) | Rows still send `manual_vendor: { name, email, phone, address?, contact_person?, contact_person_email? }` on `PUT /mrfs/{id}/price-comparisons`. |
| Vendor Portal profile completion | `src/pages/VendorPortal.tsx`, `vendorAuthApi.updateProfile` in `src/services/api.ts` | The profile editor now submits additional fields and shows a "Complete your profile" banner when company-level fields are missing. |

> The client-side duplicate check only sees vendors returned by `GET /vendors`
> for the current session/filters. It can miss matches (pagination, status
> filters, race conditions). **The backend must be the source of truth.**

---

## 3. Backend asks

### 3.1 Enforce vendor de-duplication (REQUIRED)

**Goal:** never create more than one vendor for the same identity.

1. Add a **case-insensitive uniqueness** constraint/check on vendors for:
   - `email` (primary key for identity — preferred), and
   - `name` (company name), normalized (trim + lowercase + collapse whitespace).
   - Recommended DB indexes: unique index on `LOWER(email)`; functional/normalized index on company name for lookups.
2. When a manual PO is finalised (`POST /mrfs/{id}/generate-po`) and a row
   carries `manual_vendor`, the backend must **find-or-create**:
   - If a vendor with the same email (or normalized name) exists → **link to the
     existing vendor**; do not create a new record. Update only safe-to-fill
     blank fields (e.g. set phone if missing). Do **not** overwrite existing
     non-empty data.
   - Else → create a new vendor (see 3.2).
3. Return enough info for the UI to reflect what happened (see response shape in 3.4).

**New lookup endpoint (REQUIRED for reliable client-side detection):**

```
GET /vendors/lookup?email={email}&name={name}
```

Response:

```json
{
  "success": true,
  "data": {
    "match": {
      "id": "VND-014",
      "name": "Acme Industrial Ltd",
      "email": "sales@acme.com",
      "phone": "+234...",
      "status": "Active",
      "matchedOn": "email"   // "email" | "name"
    }
  }
}
```

- Returns `data.match: null` when there is no match.
- Should match case-insensitively on normalized email/name.
- The frontend will call this on blur of the manual vendor email/name fields to
  upgrade the heuristic check into an authoritative one. (Until this exists, the
  client falls back to matching against the already-loaded `/vendors` list.)

### 3.2 Auto-create + onboard vendor from manual PO (REQUIRED)

When a genuinely new `manual_vendor` is finalised on a PO:

1. **Create a vendor record** with the basic info captured on the PO:
   - `name` (required), `email` (required, unique), `phone` (required),
     plus optional `address`, `contact_person`, `contact_person_email`.
2. **Mark the record as portal-enabled but profile-incomplete.** Suggested
   fields (names flexible, but please document the final choice):
   - `status: "Pending"` (or existing onboarding status), and/or
   - `profile_completed: false` / `onboarding_source: "manual_po"`.
   The frontend treats a vendor as "incomplete" when `category`, `address`,
   `tax_id`, or `website` are blank — keeping those empty is enough to trigger
   the completion banner, but an explicit flag is cleaner.
3. **Provision Vendor Portal access:** create the auth credential the same way
   the invite/registration flows do (temporary password + `requiresPasswordChange: true`,
   matching `POST /vendors/auth/login`'s existing response field).
4. **Validate server-side** that email + phone are present and email is a valid,
   unique address. Reject finalise with a 422 and a clear message if not, so the
   buyer is forced to supply them. (Frontend already blocks empty/invalid, but
   enforce defensively.)

### 3.3 Vendor onboarding notifications (REQUIRED)

On auto-create from manual PO:

- Send the vendor an **onboarding email**: welcome + Vendor Portal URL + login
  email + temporary password (or a set-password link) + a prompt to complete
  their profile.
- Optionally notify the internal Vendor Management / Procurement team that a new
  vendor was created via PO and is pending profile completion.
- Reuse the existing vendor-invite mail pipeline (`POST /vendors/invite`) where
  possible. Respect the PO flow's `suppress_notifications` only for the MRF/PO
  workflow noise — the **vendor onboarding email should still send**.

### 3.4 `generate-po` response contract (REQUIRED)

So the UI can show "linked to existing vendor X" vs "created & invited vendor Y",
extend the `POST /mrfs/{id}/generate-po` success payload with per-supplier
resolution metadata, e.g.:

```json
{
  "success": true,
  "data": {
    "mrf": { /* ...as today... */ },
    "po_url": "https://...",
    "fast_tracked": true,
    "resolvedVendors": [
      {
        "input": { "name": "Acme", "email": "sales@acme.com" },
        "vendorId": "VND-014",
        "action": "linked_existing",      // "created" | "linked_existing"
        "onboardingEmailSent": false
      },
      {
        "input": { "name": "Beta Supplies", "email": "info@beta.com" },
        "vendorId": "VND-221",
        "action": "created",
        "onboardingEmailSent": true
      }
    ]
  }
}
```

This is additive; existing fields must remain. The frontend can surface this in
the finalise toast/banner. (If omitted, the feature still works but the UI can't
confirm dedupe/onboarding outcomes.)

### 3.5 Profile completion endpoint (REQUIRED)

The Vendor Portal now submits extra fields on profile save. The backend must
accept and persist them on:

```
PUT /vendors/auth/profile
```

New accepted fields (in addition to existing `contact_person`, `phone`, `address`):

| Field | Type | Notes |
|-------|------|-------|
| `category` | string | One of the known categories or `"Others"`. |
| `category_other` | string | Free text, only when `category === "Others"`. |
| `website` | string (URL) | Optional. |
| `tax_id` | string | TIN / tax information. |
| `year_established` | number/string | |
| `number_of_employees` | string | e.g. `"50-100"`. |
| `annual_revenue` | string | e.g. `"₦500M"`. |

Requirements:
- Validate types; ignore unknown fields gracefully.
- When the profile becomes complete, flip `profile_completed: true` (or clear the
  onboarding flag) so the completion banner disappears.
- Return the updated vendor in `data` (the frontend merges it into local state).

> Note: there are two profile update endpoints in the client
> (`vendorApi.updateProfile` → `PUT /vendors/profile` and
> `vendorAuthApi.updateProfile` → `PUT /vendors/auth/profile`). The Vendor Portal
> uses the **`/vendors/auth/profile`** (token-authenticated) one. Please apply
> the new fields there; mirror on `/vendors/profile` if the admin edit screen
> needs them too.

---

## 4. Data model / migration notes

- Unique, case-insensitive index on vendor `email`.
- Normalized lookup index on vendor `name`.
- Optional new columns: `profile_completed` (bool, default depends on source),
  `onboarding_source` (enum/string: `registration` | `invite` | `manual_po`).
- Ensure `category_other` storage matches the registration flow
  (`category_other` / `categoryOther`) for consistency.

---

## 5. Edge cases to handle server-side

1. **Two new manual vendors with the same email in one PO** → resolve to a single
   created vendor; link both rows.
2. **Manual vendor email equals an existing vendor's email but different name** →
   treat email as the identity; link to existing, do not rename it.
3. **Manual vendor name equals existing but different email** → flag/link by name;
   prefer email when both differ (document the precedence: email wins).
4. **Inactive/blocked existing vendor** → decide whether to reuse or reject;
   recommend returning the match with its `status` so Procurement can decide.
5. **Temporary password / set-password link expiry** → align with existing
   invite flow.
6. **Re-finalising / regenerating a PO** (`regenerate: true`) must **not** create
   duplicate vendors or re-send onboarding emails for already-onboarded vendors.

---

## 6. Acceptance criteria

- [ ] Finalising a manual PO with a brand-new supplier creates exactly **one**
      vendor; repeating with the same name/email links to it (no V001/V002/V003).
- [ ] `GET /vendors/lookup` returns authoritative matches by email and name.
- [ ] Email + phone are enforced server-side on manual vendor creation (422 on missing/invalid).
- [ ] New vendor receives portal credentials + onboarding email; can log in.
- [ ] Logged-in vendor can complete `category`, `address`, `website`, `tax_id`,
      and other business fields via `PUT /vendors/auth/profile`; data persists and
      the "Complete your profile" banner clears.
- [ ] `generate-po` returns `resolvedVendors` so the UI can confirm outcomes (nice-to-have).

---

## 8. Cleanup after merge (backend ops)

Only **Active** rows with the same name count as unresolved duplicates in `--list`.
After running merge/purge on the server, refresh **Vendor Management → Vendor Directory**.

```bash
# 1. See what still needs merging (Active duplicates only)
php artisan vendors:merge-duplicates --list

# 2. Merge a group (example)
php artisan vendors:merge-duplicates --canonical=V023 --merge=V020 --force

# 3. Remove inactive merged ghost rows from the database
php artisan vendors:merge-duplicates --purge-merged --force

# 4. Fix any row marked merged but still Active
php artisan vendors:merge-duplicates --repair-inactive --force
```

Keeper selection prefers **real email** (not `@supplier.placeholder`), then portal
user, then lowest vendor code.

| Frontend surface | Behaviour after purge |
|------------------|----------------------|
| Vendor Directory (default) | `GET /vendors` — Active + Pending only |
| Vendor Directory → **Show inactive merged** | `GET /vendors?include_inactive=1` — audit rows still in DB |
| **Refresh** button | Re-fetches directory + dashboard vendor KPI |
| Manual PO duplicate lookup | `GET /vendors/lookup` — Active matches; Inactive returned with status for audit |
| Dashboard **Total Vendors** | Counts from default vendor list (excludes Inactive) |

---

## 7. Open questions for backend team

1. What is the canonical onboarding status/flag name to use (`profile_completed`
   vs reusing `status: "Pending"`)?
2. Should an existing **Inactive** vendor be reused or blocked when matched?
3. Set-password link vs temporary password for PO-onboarded vendors — which does
   the current invite flow use, so the frontend messaging matches?
4. Is name-match (without email match) strong enough to auto-link, or should it
   only **warn** and require the buyer to confirm? (Frontend currently warns +
   offers "Use existing vendor" rather than forcing.)
