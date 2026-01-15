# Available Actions Implementation Summary

This document summarizes the implementation of the role-based access control pattern using the `/api/mrfs/{id}/available-actions` endpoint as specified in `FRONTEND_IMPLEMENTATION_GUIDE.md`.

## What Has Been Implemented

### 1. Type Definitions ✅
- Added `AvailableActions` interface to `src/types/index.ts`
- Includes all permission flags: `canEdit`, `canApprove`, `canReject`, `canGeneratePO`, etc.
- Includes `availableActions` array with action keys

### 2. API Service ✅
- Added `getAvailableActions(mrfId: string)` method to `mrfApi` in `src/services/api.ts`
- Returns `ApiResponse<AvailableActions>`

### 3. Reusable Components ✅

#### `ExecutiveActionButtons` Component
- Location: `src/components/ExecutiveActionButtons.tsx`
- Fetches available actions on mount
- Only shows Approve/Reject buttons if `canApprove`/`canReject` are true
- Hides buttons entirely if actions are not available (doesn't disable them)

#### `MRFActionButtons` Component
- Location: `src/components/MRFActionButtons.tsx`
- Handles multiple action types (Generate PO, Download PO, Upload GRN, Delete PO, Delete MRF)
- Conditionally renders based on available actions and user role
- Supports compact mode for list views

### 4. Updated Pages ✅

#### ExecutiveDashboard
- Now uses `ExecutiveActionButtons` component
- Buttons only show when `canApprove` or `canReject` is true
- Follows the pattern: fetch actions → conditionally render

#### Procurement Page
- `handleGeneratePO` now checks `canGeneratePO` before proceeding
- Validates permissions from backend before showing PO generation dialog

## Implementation Patterns

### For Detail Pages (Single MRF View)
```typescript
// Fetch available actions when component mounts
const [availableActions, setAvailableActions] = useState<AvailableActions | null>(null);

useEffect(() => {
  const fetchActions = async () => {
    const response = await mrfApi.getAvailableActions(mrfId);
    if (response.success && response.data) {
      setAvailableActions(response.data);
    }
  };
  fetchActions();
}, [mrfId]);

// Conditionally render buttons
{availableActions?.canApprove && (
  <Button onClick={handleApprove}>Approve</Button>
)}
```

### For List Pages (Multiple MRFs)
Two approaches:

#### Approach 1: Check on Action (Recommended for lists)
```typescript
const handleAction = async (mrf: MRF) => {
  const response = await mrfApi.getAvailableActions(mrf.id);
  if (response.success && response.data?.canGeneratePO) {
    // Proceed with action
  } else {
    toast.error("Action not available");
  }
};
```

#### Approach 2: Use Component (For critical actions)
Use `MRFActionButtons` component which fetches actions per MRF:
```typescript
<MRFActionButtons
  mrf={mrf}
  onGeneratePO={() => handleGeneratePO(mrf)}
  compact={true}
/>
```

## Pages That Need Updates

### High Priority
1. **SupplyChainDashboard** - Should use available actions for:
   - Upload Signed PO button
   - Reject PO button
   
2. **FinanceDashboard** - Should use available actions for:
   - Process Payment button
   - Request GRN button

3. **DepartmentDashboard** (Staff View) - Should use available actions for:
   - Delete MRF button (if allowed)

### Medium Priority
4. **Procurement Page** - Already checks on action, but could:
   - Use `MRFActionButtons` component for cleaner code
   - Pre-fetch actions for visible MRFs (with virtualization)

5. **ChairmanDashboard** - Should use available actions for approval

## Key Principles Applied

✅ **Always fetch available actions** - Never hardcode permissions  
✅ **Hide, don't disable** - Remove buttons entirely if action unavailable  
✅ **Backend is source of truth** - Frontend only reflects backend permissions  
✅ **Error handling** - Gracefully handle API failures  
✅ **Loading states** - Show loading indicators while fetching actions  

## Testing Checklist

- [ ] Executive can only approve/reject when `canApprove` is true
- [ ] Procurement can only generate PO when `canGeneratePO` is true
- [ ] Supply Chain Director can only upload signed PO when action is available
- [ ] Finance can only process payment when `canProcessPayment` is true
- [ ] Staff cannot see action buttons they can't perform
- [ ] Closed MRFs show no action buttons
- [ ] Buttons are hidden (not disabled) when unavailable

## Notes

- For list views with many MRFs, consider:
  - Lazy loading actions (only fetch when button is hovered/clicked)
  - Caching actions per MRF
  - Virtual scrolling to limit visible items
  - Batch fetching if backend supports it

- The backend endpoint uses the MRF's `mrf_id` field, not the `id` field. Make sure the correct identifier is used.
