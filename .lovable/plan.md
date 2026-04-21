

# Plan — Diagnostic Logs for Bugs 2 & 3 (with IIFE scope verification)

## IIFE scope verification (Bug 2)

The IIFE at line 1870 in `src/pages/Procurement.tsx` is the inline arrow function that computes `canShowPOButton` and conditionally returns the "Send RFQ to Vendors" button. It is invoked **inside the per-MRF card render loop** for every MRF (Emerald and non-Emerald, every workflow state). The IIFE itself runs unconditionally — only the JSX it *returns* is conditional on `canShowPOButton`. So a `console.log` placed at the top of the IIFE body, **before** the `canShowPOButton` evaluation, fires once per MRF render regardless of state. This is the correct placement.

To make this guarantee explicit, the log will be the **first statement** inside the IIFE — above any early returns, above `isPendingPOUpload`, above `hasInitialApproval`, above `canShowPOButton`. This way every MRF card emits one diagnostic line, including the affected non-Emerald MRF.

## Edit 1 — Bug 3 diagnostic log

**File:** `src/pages/Procurement.tsx`
**Function:** `fetchQuotations` (after the loop, just before `setQuotations(allQuotations)` at ~line 167)

```ts
if (import.meta.env.DEV) {
  console.log('[Procurement.fetchQuotations]', {
    rfqsCount: rfqs.length,
    rfqsSample: rfqs.slice(0, 3).map((r: any) => ({
      id: r.id,
      mrf_id: r.mrf_id,
      mrfId: r.mrfId,
      keys: Object.keys(r),
    })),
    quotationsCount: allQuotations.length,
    quotationsSample: allQuotations.slice(0, 3).map((q: any) => ({
      id: q.id,
      rfqId: q.rfqId,
      vendorName: q.vendorName,
      total: q.total,
    })),
  });
}
```

## Edit 2 — Bug 2 diagnostic log (unconditional, fires per MRF)

**File:** `src/pages/Procurement.tsx`
**Location:** First statement inside the IIFE at line 1870, before `isPendingPOUpload` / `hasInitialApproval` / `canShowPOButton` are computed.

```ts
if (import.meta.env.DEV) {
  console.log('[Procurement.SendRFQButton]', {
    mrfId: request.id,
    contract_type: (request as any).contract_type ?? (request as any).contractType,
    stage: getMRFStage(request as MRF),
    status: request.status,
    workflowState,
    isInitialApprovalApproved: isInitialApprovalApproved(request as MRF),
    isSupplyChainApproved: isSupplyChainApproved(request as MRF),
    isSupplyChainDirectorInitialApproved: isSupplyChainDirectorInitialApproved(request as MRF),
  });
}
```

`isPendingPOUpload`, `hasInitialApproval`, and `canShowPOButton` will be computed on the lines below as they currently are — and a second log line will be appended **after** those computations capturing those three values, so a single MRF emits two clearly-named lines (`SendRFQButton:inputs` and `SendRFQButton:decision`). This guarantees the inputs are visible even if a later evaluation throws.

## Out of scope

- No rendering changes
- No condition changes
- No changes to `isSupplyChainApproved`, `isSupplyChainDirectorInitialApproved`, `isInitialApprovalApproved`, `getWorkflowState`
- No backend / API changes
- Bug 5 still blocked on Bug 3 results

## Next step after the logs are in

User loads Procurement → Overview with the affected non-Emerald MRF visible, opens DevTools console, and shares both the `[Procurement.fetchQuotations]` line and the per-MRF `[Procurement.SendRFQButton]` lines. A targeted one-line fix will then be proposed.

