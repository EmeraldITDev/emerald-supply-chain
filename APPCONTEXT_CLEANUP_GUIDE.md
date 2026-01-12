# AppContext Cleanup Guide

## Overview

The AppContext (`src/contexts/AppContext.tsx`) still contains localStorage-based state management for MRF, SRF, and RFQ workflows. While all UI components have been updated to use the real API, the AppContext still provides local-only CRUD functions that are no longer needed for core workflows.

## Current State

### What Still Uses localStorage in AppContext:
1. **MRF Requests** (lines 323-450)
   - Initial state loaded from localStorage
   - `addMRF`, `updateMRF`, `approveMRF`, `rejectMRF` functions
   - Persistence effect (line 447-450)

2. **SRF Requests** (lines 408-455)
   - Initial state loaded from localStorage
   - `addSRF` function
   - Persistence effect (line 452-455)

3. **RFQs and Quotations** (lines 734-759, 761-773)
   - Hardcoded initial data (not from localStorage)
   - `addRFQ`, `updateRFQ`, `addQuotation`, `updateQuotation` functions

4. **Trips, Vehicles, Staff Drivers** (lines 478-624, 1220-1298)
   - Logistics/Transportation data (separate from core workflows)
   - Can remain for now or be migrated later

### What Components Still Import from AppContext:

```typescript
// Still use AppContext (but not for MRF/SRF/RFQ operations):
- src/pages/Procurement.tsx (uses srfRequests, purchaseOrders, mrns, trips, vehicles)
- src/pages/Logistics.tsx (uses trips, vehicles, staffDrivers)
- src/pages/Warehouse.tsx (uses vendors, vehicles)
- src/pages/Dashboard.tsx (uses mrfRequests, srfRequests for display only)
```

## Cleanup Options

### Option 1: Complete Removal (Aggressive)
**Remove all MRF/SRF/RFQ state from AppContext**

**Pros:**
- Clean separation of concerns
- No confusion between local and API data
- Smaller context, better performance

**Cons:**
- Requires updating all components that read from AppContext
- More component refactoring needed
- May break some display logic

**Implementation:**
```typescript
// Remove from AppContext.tsx:
- mrfRequests state and initialization
- srfRequests state and initialization
- rfqs, quotations state
- All add/update/approve/reject functions for these entities
- localStorage persistence effects
```

### Option 2: Hybrid API-Backed State (Recommended)
**Keep AppContext but fetch from API instead of localStorage**

**Pros:**
- Minimal component changes
- Centralized state management
- Easy to add caching/polling
- Gradual migration path

**Cons:**
- AppContext becomes an API data cache
- Some redundancy with direct API calls

**Implementation:**
```typescript
// In AppContext.tsx:
export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [mrfRequests, setMrfRequests] = useState<MRF[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch from API on mount
  useEffect(() => {
    const fetchData = async () => {
      const response = await mrfApi.getAll();
      if (response.success) {
        setMrfRequests(response.data || []);
      }
      setLoading(false);
    };
    fetchData();
  }, []);
  
  // Remove all CRUD functions (add, update, approve, reject)
  // Components should call API directly
  
  return (
    <AppContext.Provider value={{ mrfRequests, loading, ... }}>
      {children}
    </AppContext.Provider>
  );
};
```

### Option 3: Migrate to React Query (Modern)
**Replace AppContext with React Query for API state**

**Pros:**
- Industry standard solution
- Built-in caching, refetching, optimistic updates
- Automatic loading and error states
- Better performance

**Cons:**
- Requires learning React Query
- More upfront refactoring
- Additional dependency

**Implementation:**
```typescript
// Install: npm install @tanstack/react-query

// In App.tsx:
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider> {/* Keep only for non-API state */}
          <Router>...</Router>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// In components:
import { useQuery } from '@tanstack/react-query';

function MRFList() {
  const { data: mrfs, isLoading } = useQuery({
    queryKey: ['mrfs'],
    queryFn: () => mrfApi.getAll()
  });
  
  // Automatically refetches, caches, handles errors
}
```

## Recommended Approach

**Hybrid (Option 2)** for immediate cleanup, then migrate to **React Query (Option 3)** for long-term maintainability.

### Step-by-Step Implementation:

1. **Remove localStorage initialization** (Lines 323-331, 408-415)
   ```typescript
   // BEFORE:
   const [mrfRequests, setMrfRequests] = useState<MRFRequest[]>(() => {
     const stored = localStorage.getItem("mrfRequests");
     // ...
   });
   
   // AFTER:
   const [mrfRequests, setMrfRequests] = useState<MRFRequest[]>([]);
   ```

2. **Remove localStorage persistence effects** (Lines 447-455)
   ```typescript
   // REMOVE THESE:
   React.useEffect(() => {
     localStorage.setItem("mrfRequests", JSON.stringify(mrfRequests));
   }, [mrfRequests]);
   ```

3. **Remove CRUD functions** (Lines 790-862, 890-902, 975-999)
   ```typescript
   // REMOVE: addMRF, updateMRF, approveMRF, rejectMRF, addSRF, addRFQ, etc.
   // Components now call API directly
   ```

4. **Update components reading from AppContext**
   - `Procurement.tsx` - Use API for SRF list
   - `Dashboard.tsx` - Fetch from API or use props
   - Other dashboards - Already using API ✅

5. **Keep non-workflow data**
   - Trips, Vehicles, StaffDrivers (logistics)
   - Can migrate these later

## Migration Checklist

- [ ] Remove MRF localStorage initialization
- [ ] Remove SRF localStorage initialization
- [ ] Remove RFQ hardcoded data
- [ ] Remove localStorage persistence effects
- [ ] Remove addMRF, updateMRF, approveMRF, rejectMRF
- [ ] Remove addSRF function
- [ ] Remove addRFQ, updateRFQ functions
- [ ] Remove addQuotation, updateQuotation functions
- [ ] Update Procurement.tsx to fetch SRFs from API
- [ ] Update Dashboard.tsx to fetch from API
- [ ] Keep logistics/vehicle state (or migrate separately)
- [ ] Test all dashboards work without AppContext CRUD
- [ ] Consider React Query migration

## Testing After Cleanup

1. **Dashboard** - Should display MRFs/SRFs (fetch from API)
2. **Procurement** - Should list SRFs from backend
3. **Employee Dashboard** - Can still submit MRFs (via API)
4. **Executive Dashboard** - Can approve/reject (via API)
5. **All workflows** - Still function end-to-end

## Conclusion

**Current Priority:** Low (system is functional)  
**Recommended Timeline:** Next sprint  
**Estimated Effort:** 2-3 hours for Hybrid approach

The system is production-ready as-is. This cleanup is for code quality and maintainability, not functionality.
