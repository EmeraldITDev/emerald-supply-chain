

# Revised Plan — Three Concerns Resolved

## Bug 1A — Side-by-Side useEffect Comparison

**Lines 199-204:**
```ts
useEffect(() => {
  if (rfqs.length > 0) {
    fetchQuotations();
  }
}, [rfqs, fetchQuotations]);
```

**Lines 206-210:**
```ts
useEffect(() => {
  if (rfqs.length > 0) {
    fetchQuotations();
  }
}, [rfqs]);
```

**Verdict:** The body is identical. The only difference is the dependency array — 206-210 omits `fetchQuotations`, which means it uses a stale closure of `fetchQuotations` and also fires less often. It is a strict subset of 199-204's behavior. Removing 206-210 is safe — lines 199-204 already cover the same trigger (`rfqs` changing) plus correctly tracks `fetchQuotations` as a dependency.

**Fix:** Delete lines 206-210. No other changes.

---

## Bug 1B — Scope Clarification

**What the user actually sees:** Line 1756 renders `{timerColor && <Clock .../>}`. When `getApprovalTimerColor` returns `null` (which it does during SCD stage because `procurementManagerApprovalTime` is absent), no icon renders at all. The user describes this absence as "N/A" — there is no literal "N/A" text anywhere for the timer.

**Explicit scope of fix:**
1. Extend `getApprovalTimerColor` to check SCD-stage timestamps (e.g., `executive_approval_date`, `executive_approved_at`, `submitted_at`) when `procurementManagerApprovalTime` is absent and stage is `supply_chain` or `supply_chain_director_review`
2. Add elapsed time text (e.g., "2h 15m") next to the Clock icon at line 1756, so the timer conveys actual information — not just a colored dot
3. Only the SCD stage calculation is added. All other stage logic in `getApprovalTimerColor` stays untouched

This means **two code changes**: the function body (lines 561-574) and the render site (line 1756).

---

## Bug 4 — Console Log Guard

The diagnostic `console.log` added to line 410 will be wrapped in a development-only check:

```ts
if (process.env.NODE_ENV === 'development') {
  console.log('[VendorPortal] Profile response keys:', Object.keys(fullVendor));
  console.log('[VendorPortal] Document fields:', {
    documents: fullVendor.documents,
    registration_documents: fullVendor.registration_documents,
    kyc_documents: fullVendor.kyc_documents,
    files: fullVendor.files,
  });
}
```

This ensures no diagnostic output in production. The rest of the Bug 4 fix (field-name fallbacks at line 2003) is unchanged.

---

## No Other Changes

All other bugs (1C, 1D, 2A, 2B, 3) remain exactly as specified in the previous approved plan. Only the three concerns above are updated.

