
# Final Plan — Option B (Combined Read)

## Verification done in read-only

- **Local `formatRelativeTime` callers:** Confirmed only **one** caller in `src/pages/Dashboard.tsx` (line 337). Per your instruction, the local function stays in place either way — not deleted in this pass.
- **Fix 5 parent guard:** Read `src/pages/Procurement.tsx` lines 1550–1670. The quotation-selection UI at lines 1622–1670 is **not** wrapped by an extra parent guard beyond the section-level `if (!rfq || mrfQuotations.length === 0) return null;` at line 1625. The "Generate PO vs Select" branch at lines 1651–1662 is already correctly gated by `wfState` (workflowState in `invoice_approved` / `pending_po_upload` / `vendor_approved` → Generate PO; everything else → Select branch). **The Select branch already exists and renders for `procurement_review`.** No change needed for Fix 5 structure.
- **Fix 4 (Send RFQ):** Lines 1951–1973 — current condition already includes `workflowState === "procurement_review"` and `hasInitialApproval = isInitialApprovalApproved || isSupplyChainApproved`. This should pass. The button is still reported missing, which means a different upstream condition is excluding the row. Need real log values from the diagnostic logs at lines 1940–1949 / 1963–1971 before changing logic.

---

## Fix 1 — Vendor profile fields show literal "N/A" (Procurement view)

**File:** `src/pages/Vendors.tsx`
**Lines:** 1025, 1032, 1047, 1051, 1055, 1059, 1067

**Broken behavior:** Dual snake_case/camelCase accessors already exist, but the fallback is the literal string `'N/A'` instead of an em dash. Violates `mem://design/estimated-cost-null-display`.

**Minimal change:** Replace `'N/A'` with `'—'` in each of the seven listed lines. No accessor logic changes (already correct).

**Side effects:** None outside the vendor profile dialog.

---

## Fix 2 — Vendor Portal fields

**No change required.** `src/pages/VendorPortal.tsx` already uses dual accessors with em-dash fallback (verified in prior turn).

---

## Fix 3 — Dashboard timestamps default to 1:00 AM

**File:** `src/pages/Dashboard.tsx`
**Line:** 337 (call site only)

**Broken behavior:** The local `formatRelativeTime` (line 219) parses naïve ISO strings without a `Z` suffix, so the browser interprets them in local timezone. For West African Time (UTC+1) sources read as UTC and rendered locally, this collapses to 1:00 AM. The shared `formatRelativeTimeUtil` in `src/utils/dateUtils.ts` already handles this correctly (appends `Z` for naïve ISO strings, converts to Africa/Lagos).

**Minimal change:**
1. Add import: `import { formatRelativeTime as formatRelativeTimeUtil } from '@/utils/dateUtils';`
2. At line 337, replace `formatRelativeTime(activity.date)` with `formatRelativeTimeUtil(activity.date)`.
3. Leave the local `formatRelativeTime` function (line 219) untouched — it becomes dead code with zero callers, harmless, and respects "do not remove existing functionality."

**Side effects:** None. No other files touched.

---

## Fix 4 — "Send RFQ to Vendors" button missing

**Status: STOP — need log data before changing logic.**

The condition at line 1955 already accepts `workflowState === "procurement_review"` and `hasInitialApproval = isInitialApprovalApproved || isSupplyChainApproved`. If the button is still hidden after SCD approval, one of these is false at runtime and the only way to know which is to read the diagnostic console output at lines 1940–1949 and 1963–1971 for the affected MRF.

**What is needed from you:** open the affected non-Emerald MRF in Procurement (DevTools console open) and paste the two `[Procurement.SendRFQButton:inputs]` and `[Procurement.SendRFQButton:decision]` log entries. With those values I can identify the exact false condition and apply a one-line fix.

**Will not change:** any helper, the Emerald path, or the condition shape — until the log values confirm the blocker.

---

## Fix 5 — Quotation selection

**No change required.** The Select-branch JSX already renders for any `workflowState` other than `invoice_approved` / `pending_po_upload` / `vendor_approved`, including `procurement_review`. The section is only hidden when there is no RFQ or zero quotations (line 1625), which is correct.

If after Fix 4 lands the user still cannot see the selection UI on an MRF that has received quotations, the cause is upstream (RFQ/quotations not loaded into state for that MRF). That is a separate diagnostic — flag it then.

---

## Summary of edits to apply

| File | Lines | Change |
|------|-------|--------|
| `src/pages/Vendors.tsx` | 1025, 1032, 1047, 1051, 1055, 1059, 1067 | `'N/A'` → `'—'` (7 replacements, fallback string only) |
| `src/pages/Dashboard.tsx` | top of file + line 337 | Import `formatRelativeTime as formatRelativeTimeUtil` from `@/utils/dateUtils`; swap call site only |

**Not touched:** Emerald flow, `isSupplyChainApproved`, `isSupplyChainDirectorInitialApproved`, badge JSX, RFQ submission, any backend, `VendorPortal.tsx`, the local `formatRelativeTime` function in `Dashboard.tsx`, the quotation-selection JSX, the Send-RFQ-button condition.

**Held pending log data:** Fix 4.
