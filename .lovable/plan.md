

# Plan — Procurement Bugs 1, 4, 6 (Execute Now) + Bugs 2, 3, 5 (Blocked)

## Pre-execution verification

**Bug 1 scope check:** `isSupplyChainApproved` is already used inside the same component at line 1488 — same render scope. Safe to use at line 2025-2037.

**Bug 4 Spot B state-shape check:** `fetchQuotations` at line ~150 builds `quotations` via `{...n, ...metadata}` where `n = normalizeQuotation(item)` and `metadata` only adds vendor/RFQ display props — it does **not** overwrite `total`, `currency`, `deliveryDays`. So `quotation.total` at line 1577 is the normalized number. Verified safe.

## File: `src/pages/Procurement.tsx` — three surgical edits

### Edit 1 — Bug 1 (SCD badge on All MRFs tab, lines 2025-2037)

Replace the existing SCD badge block with the same pattern used on the MRF tab (line 1488-1500), adding the `isSupplyChainApproved(mrf as MRF)` fallback to the field-name chain. Executive badge above is **not touched**. Color stays purple, label stays "SCD Approved".

### Edit 2 — Bug 4 (Total Amount N/A)

**Spot A — All Vendor Quotations map (lines 2792-2822):**
Wrap each item in `const n = normalizeQuotation(item)` at the top of the map callback. Replace raw reads with normalized fields:
- `Total Amount` → `formatAmount(n.total, n.currency)`
- `Delivery Days` → `formatDays(n.deliveryDays)`
- `Payment Terms` → `displayString(n.paymentTerms)`
- `Validity` → `formatDays(n.validityDays)`
- Vendor name → `n.vendorName || vendor.name || 'Unknown Vendor'`

**Spot B — Inline mini-card (lines 1577-1585):**
Replace the `||` chain on numeric fields with the normalized field directly:
```ts
Price: {formatAmount(quotation.total ?? Number(quotation.price), quotation.currency ?? 'NGN')}
```
No `||` on numeric fields anywhere — preserves legitimate `0`.

### Edit 3 — Bug 6 (Remove non-functional View Details button, lines 2056-2063)

Delete only the `<Button variant="outline" size="sm" onClick={() => handleMRFClick(mrf)}>...View Details</Button>` element on the All MRFs tab. The wrapping `<div className="flex items-center gap-2 flex-wrap">` and the status `<Badge>` at line 2055 stay. `handleMRFClick` itself is **not** modified (still used by the MRF Official tab card click at line 1458).

## Bugs 2, 3, 5 — Blocked pending answers

These are **not executed**. Two open questions remain from the prior turn:

1. **Bug 3** — please provide either:
   - (a) the commit/file where the RFQ call was removed, or
   - (b) approval to add a one-shot `import.meta.env.DEV`-gated `console.log` inside `fetchQuotations` to confirm whether the cause is `mrf_id` field mismatch, response shape mismatch, or dedup collision.

2. **Bug 2** — please provide a sample MRF id (and contract type, Emerald or Non-Emerald) where "Send RFQ to Vendors" does not appear after SCD initial approval, so the cause can be identified as logic vs data without speculation.

**Bug 5** is auto-resolved by the Bug 3 fix (the select-quotation button is rendered inside the inline quotation list).

## Out of scope (will not change)

- Executive badge logic, styles, colors, or labels
- View Details button on any tab other than All MRFs
- `handleMRFClick` itself
- `normalizeQuotation` utility
- Any backend contract, endpoint, or response shape
- Any auth/role logic
- The SCD approval state machine (`isSupplyChainApproved`, `isExecutiveApproved`, `isSupplyChainDirectorInitialApproved`)

