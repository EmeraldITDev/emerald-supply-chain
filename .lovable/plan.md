# MRF Workflow Time Tracking — Final Execution Plan

**Directives:**

1. **Proceed immediately** with implementation. Do not stop to ask for clarification on missing fields.
2. **Strict Type Safety:** Use only the timestamps defined in `src/types/index.ts`. Do not use `(mrf as any)` for logic.
3. **Graceful Omission:** If a stage requires a timestamp not on the type (e.g., RFQ, Quotations), simply do not render the duration for that specific stage.

---

## Fix 1 — Repair "Time Elapsed" Indicator

**File:** `src/pages/Procurement.tsx` **Lines:** `722–793` (Helpers), `2400–2415` (Row render).

**Action:** Implement `getStageStartTime` using the available fields to replace the current `N/A` bug.

TypeScript

```
const getStageStartTime = (mrf: MRF): string | null => {
  const stage = getMRFStage(mrf);
  const wf = getWorkflowState(mrf);

  if (wf === 'supply_chain_director_approved' || stage === 'procurement' || stage === 'procurement_review') {
    return mrf.procurement_review_started_at 
      ?? mrf.director_approved_at 
      ?? mrf.executive_approved_at 
      ?? mrf.created_at;
  }
  
  if (stage === 'supply_chain' || stage === 'supply_chain_director_review') {
    return mrf.executive_approved_at ?? mrf.created_at;
  }

  return mrf.created_at;
};

```

- Update `getApprovalTimerColor` and `getElapsedTimeText` to use this helper.

---

## Fix 2 — Stage-Level Durations in Progress Tracker

**File:** `src/components/MRFProgressTracker.tsx` & `src/pages/Procurement.tsx`.

**Action:** 1. **Tracker Prop:** Add `stageTimestamps?: Partial<MRF>` to `MRFProgressTracker.tsx`. 2. **Duration Logic:** Render a muted duration line (e.g., "Took: 2d 4h" or "Elapsed: 5h") **only** for these type-safe stages: * **Submission → Approval:** `created_at` to `director_approved_at` (or `executive_approved_at`). * **Approval → Procurement:** `director_approved_at` to `procurement_review_started_at`. * **Procurement → GRN:** `procurement_review_started_at` to `grn_completed_at`. 3. **Omit Untracked:** Do not render duration text for RFQ, Quotations, or PO stages (timestamps missing on type). 4. **Integration:** In `Procurement.tsx` (~line 3374), pass `selectedMRFForDetails` to the tracker.

---

## Fix 3 — Overall Workflow Performance Badge

**File:** `src/pages/Procurement.tsx` **Location:** MRF row header badges (`1832–1899`).

**Action:** Implement the performance indicator using available proxies for completion.

TypeScript

```
const createdMs = new Date(request.created_at).getTime();

// Use latest available workflow timestamp as completion proxy
const completionProxy = request.grn_completed_at 
  ?? request.payment_approved_at 
  ?? request.procurement_review_started_at;

const isCompleted = getMRFStage(request as MRF) === 'completed';

const totalElapsed = (isCompleted && completionProxy)
  ? new Date(completionProxy).getTime() - createdMs
  : Date.now() - createdMs;

const isDelayed = totalElapsed > 5 * 24 * 60 * 60 * 1000;

```

- **Green "Efficient":** `< 5 days`.
- **Amber "Delayed":** `≥ 5 days`.
- Render only on the Procurement view MRF row.

---

**Execution Priority:** Apply all fixes (1, 2, and 3) in a **single response**. I have explicitly waived the "Stop and Ask" conditions for the missing RFQ, Quotations, and PO timestamps—proceed by omitting those specific duration lines from the UI. In your chat response, provide a brief summary of these skipped stages and list the exact timestamp fields required in the `MRF` type to enable them in the future.