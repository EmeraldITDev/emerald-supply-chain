

# Fix: Pending Vendor Registrations Consistency & Remove Recent Activities

## Problem Summary
1. **Procurement Overview** fetches vendor registrations via `vendorApi.getRegistrations()` and pre-filters before passing to `VendorRegistrationsList` — this works
2. **Supply Chain Dashboard** renders `VendorRegistrationsList` without passing data, so the component fetches internally — but case-sensitive status filtering (`"Pending"` vs `"pending"`) may cause 0 results
3. Both pages show a `RecentActivities` component that should be removed from Procurement Overview (user request) — will also remove from Supply Chain Dashboard for consistency

## Changes

### 1. `src/pages/Procurement.tsx`
- **Remove** the `RecentActivities` import and the `<RecentActivities limit={10} />` block (lines 21, 1027-1028)

### 2. `src/pages/SupplyChainDashboard.tsx`
- **Add** `vendorApi` to the imports from `@/services/api`
- **Add** vendor registration state and fetch logic (same pattern as Procurement page lines 419-442): fetch via `vendorApi.getRegistrations()`, filter for Pending/Under Review with case-insensitive matching
- **Pass** `externalRegistrations` and `externalLoading` to the existing `VendorRegistrationsList` component
- **Remove** the `RecentActivities` import and usage (lines 22, 628-629)

### 3. `src/components/VendorRegistrationsList.tsx`
- Make the internal status filtering case-insensitive on line 75:
  ```
  r.status?.toLowerCase() === "pending" || r.status?.toLowerCase() === "under review"
  ```
- Apply the same fix to approved/rejected filters (lines 76-77) for robustness

### 4. `src/pages/Procurement.tsx` (vendor filter fix)
- Update line 427 to use case-insensitive matching:
  ```
  reg.status?.toLowerCase() === "pending" || reg.status?.toLowerCase() === "under review"
  ```

## Result
- Same `vendorApi.getRegistrations()` endpoint and same case-insensitive filtering logic used everywhere
- Procurement Manager and Supply Chain Director both see identical pending vendor registrations
- Recent Activities removed from Procurement Overview
- No duplicate or inconsistent data sources

