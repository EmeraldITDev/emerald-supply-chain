# DASHBOARD & VENDOR MANAGEMENT - IMPLEMENTATION FIX GUIDE

**Purpose**: Fix empty vendor registrations display on Dashboard and Vendor Management pages

---

## ISSUE SUMMARY

**Symptoms**:
- Dashboard shows empty "Pending Vendor Registrations" section
- Vendor Management page shows "No registrations found"
- But stats show there are pending registrations (contradiction)

**Frontend Status**: ✅ Code is correct, waiting for backend data
**Backend Status**: ⚠️ Endpoints not returning vendor registration data correctly

---

## PART 1: ENHANCED DASHBOARD.TSX

### Current Issue
Dashboard.tsx calls `dashboardApi.getProcurementManagerDashboard()` which should return:
```json
{
  "stats": { ... },
  "pendingRegistrations": [...]  ← This is empty or missing
}
```

### Fix 1: Add Detailed Data Logging

**File**: [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx#L56)

Replace the `fetchDashboardData` function (lines 56-77) with:

```typescript
// Fetch dashboard data for procurement_manager
useEffect(() => {
  const fetchDashboardData = async () => {
    if (user?.role === "procurement_manager") {
      setLoading(true);
      try {
        console.log("🔄 Fetching procurement manager dashboard...");
        const response = await dashboardApi.getProcurementManagerDashboard();
        
        // Enhanced logging
        console.log("📊 Dashboard API Response:", {
          success: response.success,
          dataExists: !!response.data,
          stats: response.data?.stats,
          pendingRegistrationsCount: response.data?.pendingRegistrations?.length,
          pendingRegistrationsData: response.data?.pendingRegistrations,
          fullResponse: response,
        });

        if (response.success && response.data) {
          setDashboardData(response.data);
          
          // Verify data structure
          if (!response.data.pendingRegistrations || response.data.pendingRegistrations.length === 0) {
            console.warn("⚠️ WARNING: pendingRegistrations is empty or missing");
            console.warn("Check if backend is returning this field");
          }
          
          if (!response.data.stats) {
            console.warn("⚠️ WARNING: stats is missing from response");
          }
          
          console.log("✅ Dashboard data loaded successfully");
        } else {
          console.error("❌ Dashboard API returned error:", response.error);
        }
      } catch (error) {
        console.error("❌ Exception fetching dashboard:", error);
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  fetchDashboardData();
}, [user?.role, toast]);
```

### Fix 2: Add Debug Display (Optional)

Add this after the stats display (around line 220) to show debug info in development:

```typescript
const isDevelopment = import.meta.env.DEV;

// Add this in the JSX after your stats display:
{isDevelopment && dashboardData && (
  <Card className="bg-muted border-warning">
    <CardHeader>
      <CardTitle className="text-sm">🐛 Debug Info</CardTitle>
    </CardHeader>
    <CardContent className="text-xs space-y-1 font-mono">
      <p>pendingRegistrations: {dashboardData?.pendingRegistrations?.length || 0}</p>
      <p>stats.pendingKYC: {dashboardData?.stats?.pendingKYC || 0}</p>
      <p>stats.awaitingReview: {dashboardData?.stats?.awaitingReview || 0}</p>
      {dashboardData?.pendingRegistrations && (
        <pre className="text-xs overflow-auto max-h-32">
          {JSON.stringify(dashboardData.pendingRegistrations[0], null, 2)}
        </pre>
      )}
    </CardContent>
  </Card>
)}
```

### Fix 3: Handle Missing Backend Data Gracefully

**Update the Pending Vendor Registrations section** (lines 254-285):

```typescript
<Card>
  <CardHeader className="p-4 sm:p-6">
    <CardTitle className="text-base sm:text-lg">
      {dashboardData?.pendingRegistrations?.length 
        ? "Pending Vendor Registrations" 
        : "Recent Activities"}
    </CardTitle>
    <CardDescription className="text-xs sm:text-sm">
      {dashboardData?.pendingRegistrations?.length 
        ? `${dashboardData.pendingRegistrations.length} awaiting review`
        : dashboardData?.stats?.awaitingReview 
          ? `${dashboardData.stats.awaitingReview} awaiting review (list loading...)`
          : "Latest procurement actions"}
    </CardDescription>
  </CardHeader>
  <CardContent className="p-4 sm:p-6 pt-0">
    {loading ? (
      <div className="text-center py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
        Loading...
      </div>
    ) : dashboardData?.pendingRegistrations && dashboardData.pendingRegistrations.length > 0 ? (
      <div className="space-y-3 sm:space-y-4">
        {dashboardData.pendingRegistrations.slice(0, 5).map((reg: any) => (
          <div 
            key={reg.id} 
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3 last:border-0 cursor-pointer hover:bg-accent/50 p-2 rounded transition-colors"
            onClick={() => navigate(`/vendors/registration/${reg.id}`)}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{reg.companyName || reg.company_name}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {reg.category} • {new Date(reg.createdAt || reg.created_at).toLocaleDateString()}
              </p>
              {(reg.contactPerson || reg.contact_person) && (
                <p className="text-xs text-muted-foreground mt-1">
                  Contact: {reg.contactPerson || reg.contact_person}
                </p>
              )}
            </div>
            <Badge variant="outline" className="self-start sm:self-center">
              {reg.status || "Pending Review"}
            </Badge>
          </div>
        ))}
        {dashboardData.pendingRegistrations.length > 5 && (
          <Button 
            variant="ghost" 
            className="w-full mt-2"
            onClick={() => navigate("/vendors")}
          >
            View All ({dashboardData.pendingRegistrations.length})
          </Button>
        )}
      </div>
    ) : activitiesLoading ? (
      <div className="text-center py-4 text-sm text-muted-foreground">Loading activities...</div>
    ) : dashboardData?.stats?.awaitingReview ? (
      <div className="text-center py-4">
        <AlertCircle className="h-8 w-8 text-warning mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          {dashboardData.stats.awaitingReview} registrations pending, but list is empty
        </p>
        <p className="text-xs text-muted-foreground mt-1">Backend may need to be restarted</p>
        <Button 
          variant="outline" 
          size="sm"
          className="mt-2"
          onClick={() => navigate("/vendors")}
        >
          Go to Vendor Management
        </Button>
      </div>
    ) : recentActivities.length > 0 ? (
      <div className="space-y-3 sm:space-y-4">
        {recentActivities.slice(0, 5).map((activity) => (
          <div 
            key={activity.id} 
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3 last:border-0 cursor-pointer hover:bg-accent/50 p-2 rounded transition-colors"
            onClick={() => activity.actionUrl && navigate(activity.actionUrl)}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{activity.title}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {activity.type} • {formatRelativeTime(activity.date)}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full self-start sm:self-center whitespace-nowrap ${
                activity.status?.toLowerCase().includes("completed") || activity.status?.toLowerCase().includes("paid")
                  ? "bg-accent text-accent-foreground"
                  : activity.status?.toLowerCase().includes("approved")
                  ? "bg-primary/10 text-primary"
                  : activity.status?.toLowerCase().includes("rejected")
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary text-secondary-foreground"
              }`}>
              {activity.status}
            </span>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No pending registrations or recent activities
      </div>
    )}
  </CardContent>
</Card>
```

---

## PART 2: ENHANCED VENDOR MANAGEMENT PAGE (Vendors.tsx)

### Current Issue
Vendors.tsx calls both:
1. `vendorApi.getRegistrations()` → `GET /vendors/registrations` (empty)
2. `dashboardApi.getProcurementManagerDashboard()` → `GET /dashboard/procurement-manager` (empty)

### Fix 1: Add Enhanced Data Logging

**File**: [src/pages/Vendors.tsx](src/pages/Vendors.tsx#L330)

Replace the data fetch effect (around line 330) with:

```typescript
// Fetch vendor registrations directly so both procurement and procurement managers can access them
useEffect(() => {
  const fetchVendorData = async () => {
    setLoadingRegistrations(true);
    setLoadingStats(true);
    console.log("🔄 Fetching vendor data...");
    
    try {
      const [registrationsResponse, dashboardResponse] = await Promise.all([
        vendorApi.getRegistrations(),
        dashboardApi.getProcurementManagerDashboard(),
      ]);

      // Log registrations API response
      console.log("📋 Registrations API Response:", {
        success: registrationsResponse.success,
        count: registrationsResponse.data?.length,
        data: registrationsResponse.data,
        error: registrationsResponse.error,
      });

      // Log dashboard API response
      console.log("📊 Dashboard API Response:", {
        success: dashboardResponse.success,
        stats: dashboardResponse.data?.stats,
        pendingRegistrationsCount: dashboardResponse.data?.pendingRegistrations?.length,
        error: dashboardResponse.error,
      });

      // Process registrations
      if (registrationsResponse.success && registrationsResponse.data) {
        setVendorRegistrations(registrationsResponse.data);
        console.log("✅ Vendor registrations loaded:", registrationsResponse.data.length, "records");
      } else {
        console.error("❌ Failed to load registrations:", registrationsResponse.error);
        // Try to use dashboard data as fallback
        if (dashboardResponse.data?.pendingRegistrations?.length > 0) {
          console.warn("⚠️ Using dashboard data as fallback");
          setVendorRegistrations(dashboardResponse.data.pendingRegistrations);
        }
      }

      // Process dashboard stats
      if (dashboardResponse.success && dashboardResponse.data) {
        const stats = dashboardResponse.data.stats;
        const pendingCount = stats?.pendingKYC || 
                            dashboardResponse.data.pendingRegistrations?.length || 
                            registrationsResponse.data?.filter((reg: any) => 
                              reg.status === "Pending" || reg.status === "Under Review"
                            ).length || 0;

        setDashboardStats({
          totalVendors: stats?.totalVendors || 0,
          activeVendors: stats?.totalVendors || 0,
          pendingRegistrations: pendingCount,
          avgRating: stats?.avgRating || 0,
          onTimeDelivery: stats?.onTimeDelivery || 0,
        });
        console.log("✅ Dashboard stats loaded. Pending:", pendingCount);
      } else {
        console.error("❌ Failed to load dashboard stats:", dashboardResponse.error);
      }
    } catch (error) {
      console.error("❌ Exception fetching vendor data:", error);
      toast({
        title: "Error",
        description: "Failed to load vendor data",
        variant: "destructive",
      });
    } finally {
      setLoadingRegistrations(false);
      setLoadingStats(false);
    }
  };

  fetchVendorData();
}, [toast]);
```

### Fix 2: Improve Vendor Registrations List Rendering

**Update the tab rendering section** to handle both camelCase and snake_case field names:

```typescript
// In the JSX rendering section, wrap registration rendering with flexible field access:

const getFieldValue = (registration: any, fieldName: string) => {
  // Try camelCase first, then snake_case
  return registration[fieldName] || registration[fieldName.replace(/([A-Z])/g, '_$1').toLowerCase()];
};

// Then use it like:
<p className="font-medium truncate">
  {getFieldValue(registration, 'companyName') || 'Unknown Company'}
</p>
<p className="text-sm text-muted-foreground truncate">
  {getFieldValue(registration, 'contactPerson') || 'No contact'}
</p>
```

### Fix 3: Add Status Filter Fix

**Ensure status filtering handles all variations**:

```typescript
// Helper function to normalize status
const normalizeStatus = (status: string): string => {
  if (!status) return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

// When filtering:
const pendingRegistrations = vendorRegistrations.filter(r => {
  const normalizedStatus = normalizeStatus(r.status);
  return normalizedStatus === 'Pending' || normalizedStatus === 'Under review';
});

const approvedRegistrations = vendorRegistrations.filter(r => {
  const normalizedStatus = normalizeStatus(r.status);
  return normalizedStatus === 'Approved';
});

const rejectedRegistrations = vendorRegistrations.filter(r => {
  const normalizedStatus = normalizeStatus(r.status);
  return normalizedStatus === 'Rejected';
});
```

### Fix 4: Add Empty State with Action

**When no registrations are found, show helpful message**:

```typescript
{vendorRegistrations.length === 0 ? (
  <div className="text-center py-8">
    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
    <p className="text-lg font-medium mb-2">No Vendor Registrations</p>
    <p className="text-sm text-muted-foreground mb-4">
      {dashboardStats.pendingRegistrations > 0
        ? `${dashboardStats.pendingRegistrations} registrations reported but list is empty. Try refreshing.`
        : "No vendor registrations yet"}
    </p>
    <Button 
      onClick={() => window.location.reload()}
      variant="outline"
    >
      Refresh Page
    </Button>
  </div>
) : (
  // Existing rendering code
)}
```

---

## PART 3: VENDOR REGISTRATIONS LIST COMPONENT

**File**: [src/components/VendorRegistrationsList.tsx](src/components/VendorRegistrationsList.tsx#L40)

### Fix: Enhanced Filtering and Error Handling

```typescript
useEffect(() => {
  if (useExternalData) {
    setRegistrations(externalRegistrations || []);
    setLoading(externalLoading || false);
    return;
  }

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      console.log("📥 Fetching registrations from API...");
      const response = await vendorApi.getRegistrations();
      
      console.log("✅ getRegistrations Response:", {
        success: response.success,
        dataLength: response.data?.length || 0,
        firstRecord: response.data?.[0],
        error: response.error,
      });

      if (response.success && response.data) {
        // Ensure data is an array
        const dataArray = Array.isArray(response.data) ? response.data : [];
        setRegistrations(dataArray);
        
        if (dataArray.length === 0) {
          console.warn("⚠️ No registrations returned from API");
        }
      } else {
        console.error("❌ Failed to fetch registrations:", response.error);
        setRegistrations([]);
      }
    } catch (error) {
      console.error("❌ Exception in getRegistrations:", error);
      toast({
        title: "Error",
        description: "Failed to load vendor registrations",
        variant: "destructive",
      });
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  };

  fetchRegistrations();
}, [toast, useExternalData, externalRegistrations, externalLoading]);

// Filtering with case normalization
const normalizeStatus = (status: string): string => {
  if (!status) return 'Pending';
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  return normalized.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const pendingRegistrations = registrations.filter(r => {
  const normalizedStatus = normalizeStatus(r.status);
  return ['Pending', 'Under Review'].includes(normalizedStatus);
});

const approvedRegistrations = registrations.filter(r => {
  const normalizedStatus = normalizeStatus(r.status);
  return normalizedStatus === 'Approved';
});

const rejectedRegistrations = registrations.filter(r => {
  const normalizedStatus = normalizeStatus(r.status);
  return normalizedStatus === 'Rejected';
});

console.log("📊 Filtered registrations:", {
  total: registrations.length,
  pending: pendingRegistrations.length,
  approved: approvedRegistrations.length,
  rejected: rejectedRegistrations.length,
});
```

---

## PART 4: TESTING & VALIDATION

### Test 1: Browser Console Logs

After deploying the updated code:

1. Open **Chrome DevTools** (F12)
2. Go to **Console** tab
3. Log in to Dashboard
4. Look for these log messages:
   ```
   🔄 Fetching procurement manager dashboard...
   📊 Dashboard API Response: { success: true, stats: {...}, pendingRegistrationsCount: 5 }
   ✅ Dashboard data loaded successfully
   ```

5. Go to Vendor Management page
6. Look for:
   ```
   🔄 Fetching vendor data...
   📋 Registrations API Response: { success: true, count: 5, data: [...] }
   ✅ Vendor registrations loaded: 5 records
   ```

### Test 2: Network Tab

1. Open **Network** tab (next to Console)
2. On Dashboard, watch for requests:
   - `GET /api/dashboard/procurement-manager`
   - Status should be **200** (not 400, 403, 500)
   - Response should include `pendingRegistrations` array

3. On Vendor Management, watch for:
   - `GET /api/vendors/registrations`
   - Status should be **200**
   - Response should be array of registrations

### Test 3: Manual Backend Test

```bash
# Test the endpoints directly
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/dashboard/procurement-manager | jq '.data.pendingRegistrations'

curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/vendors/registrations | jq '.'
```

### Test 4: Database Verification

```sql
-- Check if vendor registrations actually exist
SELECT COUNT(*) as total,
       COUNT(CASE WHEN status ='Pending' THEN 1 END) as pending,
       COUNT(CASE WHEN status = 'Under Review' THEN 1 END) as under_review
FROM vendor_registrations;
```

---

## DEPLOYMENT CHECKLIST

Before deploying these frontend changes:

- [ ] **Verify Backend Endpoints Are Working**
  - Test `/dashboard/procurement-manager` returns `pendingRegistrations`
  - Test `/vendors/registrations` returns array of registrations

- [ ] **Update Frontend Code**
  - Dashboard.tsx with enhanced logging
  - Vendors.tsx with enhanced logging
  - VendorRegistrationsList.tsx with status normalization

- [ ] **Test in Development**
  - Check console logs show correct data
  - Verify vendor registrations display when they exist

- [ ] **Deploy to Production**
  - Roll out frontend changes
  - Monitor console logs for errors
  - Validate vendor registrations display correctly

- [ ] **If Still Broken**
  - Backend endpoint needs fixing (see VENDOR_REGISTRATION_DISPLAY_ISSUE_DIAGNOSIS.md)
  - Database migration needed
  - API response structure incorrect

---

## QUICK REFERENCE: EXPECTED DATA STRUCTURES

### Dashboard API Response
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalVendors": 25,
      "pendingKYC": 3,
      "awaitingReview": 2,
      "avgRating": 4.5,
      "onTimeDelivery": 96,
      "pendingMRFs": 1
    },
    "pendingRegistrations": [
      {
        "id": "uuid-123",
        "companyName": "Test Vendor Inc",
        "email": "contact@vendor.com",
        "category": "Equipment",
        "status": "Pending",
        "createdAt": "2026-03-30T10:00:00Z",
        "contactPerson": "John Doe"
      }
    ]
  }
}
```

### Registrations API Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "companyName": "Test Vendor Inc",
      "email": "contact@vendor.com",
      "category": "Equipment",
      "status": "Pending",
      "createdAt": "2026-03-30T10:00:00Z",
      "contactPerson": "John Doe",
      "documents": []
    }
  ]
}
```

---

*This guide provides complete frontend implementation to properly display vendor registrations once backend endpoints are fixed.*

