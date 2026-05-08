## Revised Plan: PO/SRF/RFQ Enhancements (2B-1 → 2B-8) with Safeguards

This revision locks down each risk you flagged. Same 7 deliverables, with defensive handling baked in.

---

### 2B-1 · Price-Comparison Table

**Component:** new `src/components/PriceComparisonTable.tsx`
- Columns: Vendor Name, Item Description, Unit Price, Quantity, Total Price, Selected, Selection Reason
- Selected row: `border-l-4 border-l-success bg-success/5`
- Empty state: amber banner "No price comparison data available for this PO"

**Safeguard (key mismatch):**
```ts
const rows =
  po.priceComparison ??
  po.priceComparisons ??
  po.price_comparison ??
  po.price_comparisons ??
  [];
```
A small `getPriceComparison(po)` helper in `src/utils/displayId.ts` (or new `src/utils/poHelpers.ts`) so both singular/plural and snake/camel keys resolve. Console-warn once in dev if both keys present with different values.

**Gating:** PO submission/approval action disabled when `rows.length === 0`, with tooltip "Add price comparison before submitting."

---

### 2B-2 · "Initiate SRF" Button (Fleet)

In `FleetManagement.tsx`, gated to `logistics_officer`. `AlertDialog` confirm → `POST /api/fleet/vehicles/{id}/initiate-srf`. On success: toast, disable button, dispatch `app:refresh`. No layout changes.

---

### 2B-3 · Designated Creator Management

**UserManagement.tsx:** new per-department section (admin/department_head only) → `PUT /api/departments/{id}/requisition-creator`.

**Safeguard (403 without name):**
```ts
// NewMRF.tsx / NewSRF.tsx
catch (err) {
  if (err.status === 403) {
    const name =
      err.body?.designated_creator?.name ||
      err.body?.designatedCreator?.name ||
      err.body?.message ||
      null;
    toast.error(
      name
        ? `Only ${name} can create requisitions for this department.`
        : "You are not the designated requisition creator for this department. Contact your department head."
    );
  }
}
```
Always renders a usable error even if backend returns just a status code.

---

### 2B-4 · Estimated Budget Optional

**Safeguard (correct form):** Before editing, search for the `Estimated Budget` field across `NewMRF.tsx`, `NewSRF.tsx`, RFQ creation flow (`RFQManagement.tsx` / send-RFQ dialog), and `POGenerationDialog.tsx`. Edit **only the form the user means** — per spec text "Estimated Budget should be optional when creating an RFQ", the target is the **Send RFQ / RFQ creation form**, not PO generation.
- Remove `required`, append `(Optional)` to label, drop disabled-state check tied to budget, allow empty submit.
- Keep budget privacy rule intact (never sent to vendors).

If we find the field in multiple forms during build, we confirm with you before changing more than the RFQ form.

---

### 2B-6 · T&C Template Display

New `src/services/poTermsApi.ts` → `GET /api/po-terms-templates/{type}`.

**Safeguard (no duplicate dialog):** Extend the **existing** PO generation dialog (locate via `rg "Generate.*PO|POGeneration|GeneratePO" src/`). Add:
- Read-only standard T&C card (loaded from API)
- Editable `Textarea` for additional custom terms
- `Generate` button disabled until standard T&C resolves OR until a clear "failed to load — retry" state shows

No new dialog file is created. If multiple PO-generation entry points exist, we surface the list to you before editing.

---

### 2B-7 · SCD Signature Upload + Sign PO

**Settings.tsx:** Digital Signature card with image upload preview.

**Safeguard (multipart vs base64):** Try multipart first, fall back to base64:
```ts
async function uploadSignature(userId, file) {
  try {
    const fd = new FormData();
    fd.append("signature", file);
    return await api.post(`/users/${userId}/signature`, fd); // multipart
  } catch (e) {
    if (e.status === 415 || e.status === 400) {
      const base64 = await fileToBase64(file);
      return await api.post(`/users/${userId}/signature`, { signature: base64 });
    }
    throw e;
  }
}
```
Logs which path succeeded once (dev only) so we can confirm with backend.

**Sign PO flow:** SCD-only button on `awaiting_scd_signature` POs → `POST /api/purchase-orders/{id}/sign` → status `Signed` → dispatch `app:refresh`. Procurement Manager view gets `Download Signed PO`.

---

### 2B-8 · Reject PO Flow

**Safeguard (existing dialog check):** Before any work, `rg "PORejectionDialog|RejectionDialog" src/`. 
- If `PORejectionDialog.tsx` exists → extend it (required Rejection Reason textarea, validation).
- If it does not exist → create it once, in `src/components/`. We will not leave an orphaned file under any circumstance.

PM PO list: amber `Badge` for `revision_required` / `returned_to_procurement`. PO detail shows rejection reason callout at top. `Resubmit for Approval` re-triggers submit endpoint, badge flips to `Pending SCD Approval`. Dispatch `app:refresh` after each mutation.

---

### Cross-cutting (unchanged)

- ₦ via existing formatters; UUID for API, formatted IDs for UI
- New endpoints centralized in `src/services/api.ts`
- Status strings added to PO type union in `src/types/index.ts`
- `window.dispatchEvent(new CustomEvent('app:refresh'))` after sign/reject/resubmit/SRF-initiate
- Semantic tokens only — no literal hex/Tailwind color names
- Out of scope: 2B-5 (backend-only)

---

### Pre-flight verifications during build (will surface to you, not silently guess)

1. **2B-1:** confirmed key name from first real PO response in network tab.
2. **2B-4:** confirmed which form(s) own the Estimated Budget field before editing.
3. **2B-6:** confirmed exact PO-generation dialog file path before extending.
4. **2B-7:** logged whether multipart or base64 succeeded on first signature upload.
5. **2B-8:** confirmed `PORejectionDialog.tsx` presence before extend-vs-create.

If any of these reveal a backend gap (e.g., 2A-3 doesn't return creator name), we ship the frontend with the safe fallback already in place and flag the gap to backend — no rework needed on our side.
