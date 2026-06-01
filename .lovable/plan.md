## Frontend Changes — Finance AP Phase 2 (Document registry)

Wire the new document-registry + GRN-from-line-items endpoints into types, services, and the GRN/Procurement UI. Backend work is out of scope.

### 1. Types

**`src/types/procurement-documents.ts`** — extend `ProcurementDocumentsResponse`:
- `documentsByType?: Partial<Record<ProcurementDocumentType, ProcurementDocument[]>>`
- `activeByType?: Partial<Record<ProcurementDocumentType, ProcurementDocument>>`

Add:
- `UploadProcurementDocumentPayload = { type: ProcurementDocumentType; file: File }`
- `GRNPreviewParams = { remarks?: string; grnNumber?: string; receivedAt?: string }`
- `GRNGeneratePayload = { confirm?: boolean; remarks?: string; grnNumber?: string; receivedAt?: string }`
- `GRNGenerateResponse = { document: ProcurementDocument; mrfGrnUrl?: string }`

**`src/types/index.ts`** — `AvailableActions`:
- add `canGenerateGRN?: boolean` (keep existing `canUploadGRN`).

### 2. Service `src/services/procurementApi.ts`

- `uploadProcurementDocument(mrfId, { type, file })` → multipart `POST /mrfs/{id}/procurement-documents`. Manually handles auth header + FormData (same pattern as `grnApi.completeGRN`). Dispatches `app:refresh` on success.
- `previewGRN(mrfId, params?)` → `GET /mrfs/{id}/grn/preview?...`. Returns `{ blob, objectUrl }`; query params optional. Returned `objectUrl` is opened in a new tab by the caller.
- `generateGRN(mrfId, payload)` → `POST /mrfs/{id}/grn/generate` JSON. Defaults `confirm: true`. Dispatches `app:refresh`.

### 3. GRN dialog — `src/components/GRNCompletionDialog.tsx`

Refactor into two tabs (Shadcn `Tabs`):
- **Generate from line items** — visible when `availableActions.canGenerateGRN`. Inputs: `grnNumber` (optional), `remarks` (textarea), `receivedAt` (date). Buttons: "Preview" (calls `previewGRN`, opens object URL in new tab), "Confirm & Generate" (calls `generateGRN`, success toast + close).
- **Upload existing file** — current behaviour (`grnApi.completeGRN`), visible when `availableActions.canUploadGRN`.

Fetch `availableActions` once on open (via `mrfApi.getAvailableActions`). Default to whichever tab is enabled; show both when both are allowed.

### 4. `src/components/MRFActionButtons.tsx`

- Add `onGenerateGRN?` prop and a "Generate GRN" button gated on `availableActions.canGenerateGRN` and procurement roles. Reuse existing dialog (the same `GRNCompletionDialog`) so callers can hook a single handler.
- Keep `canUploadGRN` button as-is.

### 5. Documents panel (new) — `src/components/procurement/ProcurementDocumentsPanel.tsx`

- Props: `mrfId: string`, optional `defaultUploadType`.
- On mount + `app:refresh`, fetch `procurementApi.getProcurementDocuments(mrfId)`.
- Render two sections:
  - **Active documents** — grid of cards keyed by `activeByType`, each showing type label, file name, version badge, "Open" link.
  - **All versions** — grouped accordion per `documentsByType` key with version + uploadedBy + uploadedAt and active badge.
- Inline upload form: `Select` (type: waybill, jcc, pfi, delivery_confirmation, other) + file input + Upload button. Validates ≤20MB and PDF/DOC/DOCX/JPG/PNG. On success, refetch.
- Empty state when no documents yet.
- Mount inside the existing PO Details dialog in `src/pages/Procurement.tsx` (below the existing PO content).

### Out of scope

- Backend changes.
- Reworking `Warehouse.tsx` GRN flows.
- Bulk download / version diff UI.

### Verification

- `tsc` passes.
- Generate GRN tab: Preview opens the new PDF in a tab; Confirm & Generate posts and reloads documents.
- Upload tab: existing legacy flow still works.
- Documents panel renders grouped list + active badges; uploading a waybill appears in the registry after refresh.
