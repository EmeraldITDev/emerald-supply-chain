

# Final Polish — FinanceDashboard.tsx Amount Fix

## Two changes from the approved plan

### 1. Use `??` for the quotation variable

The plan currently has:
```ts
const quotation = item.quotation || {};
```

Replace with:
```ts
const quotation = item.quotation ?? {};
```

Consistent with the `??`-everywhere rule. Applied in the card rendering block where `quotation` is used for payment_terms display.

### 2. Updated summary wording

The summary line changes from:

> "Every `||` on amount fields replaced with `??`"

To:

> "Three amount-reading patterns in FinanceDashboard.tsx are replaced with the systematic q/rawAmount extraction pattern using the full five-field fallback chain and `??` throughout. No wider data, fetch, or storage logic changes. Only quotation amount extraction, amount-based visibility checks, and amount display formatting are affected."

## Scope

These are the only two refinements. All other aspects of the approved plan (Fix A filter, Fix B card display, Fix C render condition, `formatAmount` import, zero-value and nested object verification) remain exactly as specified.

