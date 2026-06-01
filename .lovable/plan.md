# Update MRF Progress Tracker (revised v2)

Extend `src/components/MRFProgressTracker.tsx` with the full Finance AP-aware stage list, grouped into compact phase sections. Incorporates: conditional delivery steps for 100% advance, explicit Vendor Final Invoice step, explicit Finance Review step, and split document-vs-timestamp logic for step 7.

## Final step structure

```text
APPROVAL
  1. MRF Created
  2. Initial Approval (SCD or Executive depending on contract type)
  3. Procurement Review

SOURCING
  4. RFQ Issued to Vendors
  5. Vendor Quotes Received
  6. Vendor Selection Approved

PROCUREMENT
  7. Vendor Final Invoice Submitted
  8. PO Generated (payment schedule locked)
  9. PO Signed by SCD

DELIVERY  (entire phase hidden when payment schedule is 100% advance)
  10. GRN / Goods Received
  11. Delivery Documents Uploaded (waybill / JCC / delivery confirmation)

PAYMENT
  12. Finance Review
  13..N. Milestone Payments (dynamic, one row per schedule milestone)
  Final. Fully Paid / Closed
```

## Completion vs. duration — separation of concerns

For every new step, **completion state** and **duration line** come from independent sources. Missing one never blocks the other.

| Step | Completion source | Duration timestamp |
|------|-------------------|--------------------|
| 7 Vendor Final Invoice | `activeByType.vendor_invoice` present → complete | `vendor_invoice_submitted_at` (if missing, omit duration line — step still marked complete) |
| 9 PO Signed by SCD | Existing tracker payload / signed_po doc | `po_signed_at` |
| 10 GRN | `activeByType.grn` present → complete | `grn_generated_at` |
| 11 Delivery Documents | Any of `activeByType.waybill / jcc / delivery_confirmation` → complete | `delivery_docs_uploaded_at` |
| 12 Finance Review | `finance_reviewed_at` present (until a richer flag exists) | `finance_reviewed_at` |
| 13..N Milestone Payments | `milestone.status === 'paid'` → complete; `'eligible'` → pending | Per-milestone `paidAt` when available |

Rule: a step that has a "completion artifact" (document or status) is marked complete even when the corresponding timestamp is absent. The duration line is simply omitted in that case (consistent with the existing tracker behavior for missing timestamps).

## Conditionality

- **100% advance**: `paymentSchedule.milestones` has exactly one milestone with `percentage === 100` AND `triggerCondition === 'on_advance'`. When true, hide steps 10 and 11 entirely (not rendered, not counted in progress totals). Internal helper `isFullAdvanceSchedule(schedule?: PaymentSchedule)`.

## Data sources

- `mrfApi.getProgressTracker(mrfId)` → steps 1–6 and 9 from existing backend payload.
- `documentsByType` / `activeByType` from `getProcurementDocuments` → steps 7, 10, 11.
- `paymentSchedule` (passed in, or derived from `mrf.paymentScheduleSummary`) → renders the dynamic milestone rows; statuses map to tracker state (`pending` | `eligible` | `paid` → `not_started` | `pending` | `completed`).
- All durations still use real backend timestamps only.

## Compact visual treatment

- New `PhaseHeader` subcomponent: uppercase label, thin divider, mini status `3/3` + colored dot (success / warning / muted).
- Each phase wrapped in Shadcn `Collapsible`; defaults open for the phase containing the current step, others collapsed.
- Tighter spacing: `space-y-1.5` between steps, `h-8 w-8` step circles, connector `minHeight: 24px`.
- Overall Progress bar counts completed steps across the full expanded list (excluding hidden DELIVERY steps for 100%-advance MRFs).
- Milestone rows show inline `₦` amount + percentage; missing amounts render as `-`.

## Props changes

`MRFProgressTrackerProps` gains optional:
- `paymentSchedule?: PaymentSchedule`
- `documentsByType?: ProcurementDocumentsResponse['documentsByType']`
- `activeByType?: ProcurementDocumentsResponse['activeByType']`

`stageTimestamps` extended (all optional, duration-only):
- `po_signed_at`
- `vendor_invoice_submitted_at`
- `grn_generated_at`
- `delivery_docs_uploaded_at`
- `finance_reviewed_at`
- `payment_completed_at`

## Call sites

- `src/pages/Procurement.tsx` — pass `documentsByType`, `activeByType`, and `paymentSchedule` into the tracker (data already loaded).
- Other tracker mounts (`Dashboard.tsx`, `SupplyChainDashboard.tsx`, `AccountsPayable.tsx`, `FinanceDashboard.tsx`, `ExecutiveDashboard.tsx`) — pass new props only when data is already in scope; otherwise leave unchanged. Tracker degrades gracefully (falls back to existing 8-step payload + single generic "Payment" row).

## Out of scope

- Backend changes.
- Editing `SRFProgressTracker` / `ProcurementProgressTracker`.
- Building new Finance AP screens.
