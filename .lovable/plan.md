

# Revised Plan — Addressing Three Verification Points

## Verification 1: `resolveTotal` field order — DO NOT CHANGE

**Finding:** The current order in `resolveTotal` is:
```
totalAmount ?? total_amount ?? price ?? total_order_value ?? totalOrderValue
```

The spec wants `price` after `total_order_value`. However, we cannot verify from the frontend whether any existing quotation has both `price` and `total_order_value` with different values — this is a backend data question we cannot answer from the codebase.

**Decision: Keep the current field order unchanged.** The existing order is already live and working. Changing precedence risks silently altering displayed amounts for existing records. If the backend team confirms the two fields never diverge, this can be swapped later as a separate low-risk change. The normalizer already covers all field names — the only question is priority, and the safe default is to not change what works.

This removes the `resolveTotal` reorder from the plan entirely.

## Verification 2: SupplyChainDashboard uses RAW API data

**Finding:** `mrfFullDetails.selectedQuotation` comes directly from `mrfApi.getFullDetails(mrf.id)` response — it is set as `setMrfFullDetails(response.data)` with no normalization step. The quotation object is raw backend data with snake_case fields (`payment_terms`, `delivery_date`, `validity_days`, `price`, `total_amount`).

**Decision:** Do NOT use `displayString(....paymentTerms ?? ....payment_terms)` — camelCase fields don't exist on this object. Instead, use the raw field names with the utility helpers:

```
formatAmount(obj.price ?? obj.total_amount, obj.currency ?? 'NGN')
displayString(obj.payment_terms)
formatDays(obj.validity_days)
displayString(obj.warranty_period)
displayString(obj.notes)
```

This keeps the fix correct without requiring the dashboard to adopt the full normalizer (which would be a larger refactor out of scope for this display-only fix).

## Verification 3: FinanceDashboard quotation section is LIVE, not dead code

**Finding:** Line 340 renders the quotation section conditionally:
```tsx
{quotation && Object.keys(quotation).length > 0 && (quotation.price || quotation.total_amount) && (
```

This is active code — it renders whenever `mrfApi.getFullDetails` returns a quotation object with pricing. Finance was removed from the MRF *approval workflow*, but the FinanceDashboard still displays MRF/quotation details in a read-only tracking view. The section is not dead code.

**Decision:** Proceed with the fix as planned. Change `{quotation.payment_terms && (...)}` to always render using `displayString(quotation.payment_terms)`.

---

## Updated File Plan (5 files)

| # | File | Changes |
|---|------|---------|
| 1 | `src/utils/normalizeQuotation.ts` | Add `formatDays`, `formatAmount`. Add `q.note` to notes fallback. Do NOT change `resolveTotal` field order. |
| 2 | `src/components/RFQManagement.tsx` | Replace ~6 inline display patterns with `formatDays`, `formatAmount`, `displayString` |
| 3 | `src/pages/Procurement.tsx` | Replace ~5 inline patterns including the 20-line delivery days IIFE |
| 4 | `src/pages/SupplyChainDashboard.tsx` | Replace 4 patterns using **raw snake_case field names** with helpers |
| 5 | `src/pages/FinanceDashboard.tsx` | Change conditional `payment_terms` render to always-render with `displayString` |

All other aspects of the previous plan remain unchanged.

