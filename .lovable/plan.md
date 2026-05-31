## Frontend Changes — Finance AP (Phases 0 & 1)

Wire the new backend contracts into the frontend. No backend code, no business-logic refactors beyond what the new endpoints require.

### Phase 0 — Type & service plumbing

1. **Types (`src/types/index.ts`)**
   - Add optional `scmTransactionId?: string` and `scm_transaction_id?: string` to `MRF`.
   - No UI surface yet (reserved for Finance AP correlation).

2. **New types file `src/types/procurement-documents.ts`**
   - `ProcurementDocumentType` union: `'vendor_invoice' | 'grn' | 'waybill' | 'jcc' | 'pfi' | 'po_pdf' | 'signed_po' | 'delivery_confirmation' | 'other'`.
   - `ProcurementDocument` interface matching response shape (id, mrfId, vendorId, type, fileName, filePath, fileUrl, uploadedBy{id,name}, uploadedAt, version, isActive).

3. **Service `src/services/procurementApi.ts`**
   - Add `getProcurementDocuments(mrfId, { type?, includeInactive? })` → `GET /mrfs/{id}/procurement-documents` with query params.

### Phase 1 — Payment schedule

4. **New types file `src/types/payment-schedule.ts`**
   - `PaymentTriggerCondition`: `'on_advance' | 'upon_delivery' | 'on_grn' | 'on_invoice' | 'on_completion' | (string & {})`.
   - `PaymentMilestoneTemplate`, `PaymentTermTemplate`.
   - `PaymentMilestone` (with `status`, `amount`, `triggerLabel`, `requiredDocuments`).
   - `PaymentSchedule` (`id`, `templateKey`, `templateName`, `version`, `isLocked`, `lockedAt`, `summary`, `milestones[]`).
   - `CreatePaymentSchedulePayload` (template-key OR custom milestones).

5. **New service `src/services/paymentScheduleApi.ts`**
   - `listTemplates()` → `GET /payment-term-templates`.
   - `getSchedule(mrfId)` → `GET /mrfs/{id}/payment-schedule` (treat 404 as `null`).
   - `createSchedule(mrfId, payload)` → `POST /mrfs/{id}/payment-schedule` (handle 422 percentages-must-total-100).
   - `updateSchedule(mrfId, payload)` → `PUT /mrfs/{id}/payment-schedule` (handle 409 `SCHEDULE_LOCKED`).
   - All mutations dispatch the global `app:refresh` event (match existing `procurementApi` pattern).

6. **Propagation type updates**
   - Add optional `paymentSchedule?: PaymentSchedule | null` and `payment_schedule?` to: `MRF`, RFQ types, Quotation types.
   - `src/types/procurement.ts` `PriceComparisonEntry`: add optional `paymentTerms?: string` and `paymentScheduleSummary?: string`. Add optional top-level `paymentSchedule` to the price-comparison response wrapper.

7. **UI surfaces (minimal, additive)**
   - **RFQ create/edit (`src/components/RFQManagement.tsx`)**: add a "Payment Schedule" section — template dropdown (from `listTemplates`) plus an editable milestone table (label, %, trigger). Save via create/update schedule API before the RFQ is sent. Show lock notice when `isLocked`.
   - **Price comparison table (`src/components/PriceComparisonTable.tsx` and `src/components/procurement/PriceComparisonTable.tsx`)**: add a "Payment Terms" column rendering `paymentScheduleSummary || paymentTerms || '—'`. Render the MRF-level schedule summary above the table when present.
   - **PO preview (`src/components/procurement/EmeraldPurchaseOrderPreview.tsx`)**: when `model.milestones` is provided, render a milestone table (Milestone #, Label, %, Amount, Trigger) in place of the free-text Payment Terms line. Keep fallback to existing `paymentTermsDisplay` when no schedule. Extend `emeraldPoDocumentModel` to carry optional `milestones[]` sourced from MRF `paymentSchedule`.

### Out of scope (this round)
- Surfacing `scmTransactionId` in any view.
- Document-upload UI from `procurement-documents` endpoint (types-only).
- Backend changes.

### Verification
- `tsc` passes (run as part of build).
- RFQ flow: template fetch populates dropdown; creating a custom schedule with percentages ≠ 100 surfaces backend validation error toast.
- Price comparison renders the new column without breaking existing rows.
- PO preview still renders for MRFs without a schedule (fallback path).
