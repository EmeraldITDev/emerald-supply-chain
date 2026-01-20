# Backend Tasks Required for Frontend Implementation

This document outlines all backend API endpoints and functionality needed to support the frontend changes for RFQ details, Recent Activities, and MRF View Details features.

## 1. RFQ Details - Quotation Data Endpoint

### Endpoint: `GET /api/rfqs/{rfqId}/quotations`

**Current Status**: Likely exists but needs verification

**Required Response Format**:
```json
{
  "success": true,
  "data": {
    "rfq": {
      "id": "uuid",
      "mrf_id": "uuid",
      "title": "string",
      "status": "open|closed|awarded",
      "created_at": "2024-01-01T00:00:00Z",  // CRITICAL: Must be set when RFQ is dispatched
      "deadline": "2024-01-15T00:00:00Z",
      "estimated_cost": 100000
    },
    "quotations": [
      {
        "quotation": {
          "id": "uuid",
          "rfq_id": "uuid",
          "vendor_id": "uuid",
          "total_amount": 95000,
          "delivery_days": 30,  // CRITICAL: Must be included
          "delivery_date": "2024-02-01",
          "payment_terms": "Net 30",  // CRITICAL: Must be included
          "validity_days": 60,
          "status": "submitted|approved|rejected|closed",
          "submitted_at": "2024-01-05T00:00:00Z"
        },
        "vendor": {
          "id": "uuid",
          "name": "Vendor Name",
          "company_name": "Company Name",
          "email": "vendor@example.com",
          "rating": 4.5,
          "total_orders": 50
        },
        "items": [
          {
            "item_name": "Item 1",
            "quantity": 10,
            "unit_price": 9500,
            "total_price": 95000
          }
        ]
      }
    ],
    "statistics": {
      "total_quotations": 3,
      "lowest_bid": 90000,
      "highest_bid": 110000,
      "average_bid": 100000
    }
  }
}
```

**Backend Tasks**:
- ✅ Verify endpoint exists
- ✅ Ensure `delivery_days` field is included in quotation response
- ✅ Ensure `payment_terms` field is included in quotation response
- ✅ Ensure `created_at` timestamp is set when RFQ is dispatched/sent to vendors
- ✅ Include vendor information in response
- ✅ Include quotation items in response

---

## 2. Recent Activities Endpoint

### Endpoint: `GET /api/dashboard/recent-activities?role={role}`

**Current Status**: ❌ **NEEDS TO BE CREATED**

**Required Functionality**:
- Return role-specific recent activities
- Activities should be real-time (from actual database events)
- Support pagination/limit

**Request Parameters**:
- `role` (required): `employee|executive|procurement|supply_chain_director|finance|chairman|vendor`
- `limit` (optional): Number of activities to return (default: 10)

**Required Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "mrf_created|mrf_approved|mrf_rejected|rfq_sent|quotation_submitted|quotation_approved|quotation_rejected|po_generated|payment_processed|grn_received",
      "title": "MRF Created",
      "description": "MRF MRF-2024-001 was created by John Doe",
      "timestamp": "2024-01-01T10:30:00Z",
      "user": "John Doe",
      "entityId": "mrf-uuid",
      "entityType": "mrf",
      "status": "pending|approved|rejected"
    }
  ]
}
```

**Backend Implementation Tasks**:

### 2.1 Create Activity Logging System
- Create `activities` or `audit_logs` table:
  ```sql
  CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(255),
    entity_type VARCHAR(50), -- 'mrf', 'rfq', 'quotation', 'po', 'grn'
    entity_id UUID,
    status VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
  CREATE INDEX idx_activities_user_id ON activities(user_id);
  CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id);
  CREATE INDEX idx_activities_type ON activities(type);
  ```

### 2.2 Log Activities at Key Events
Log activities when these events occur:

**MRF Events**:
- `mrf_created`: When MRF is created
- `mrf_approved`: When Executive/Chairman approves MRF
- `mrf_rejected`: When MRF is rejected

**RFQ Events**:
- `rfq_sent`: When RFQ is dispatched/sent to vendors (set `created_at` timestamp)

**Quotation Events**:
- `quotation_submitted`: When vendor submits quotation
- `quotation_approved`: When quotation is approved/selected
- `quotation_rejected`: When quotation is rejected

**PO Events**:
- `po_generated`: When PO is generated

**Payment Events**:
- `payment_processed`: When Finance processes payment

**GRN Events**:
- `grn_received`: When GRN is received

### 2.3 Create Endpoint Handler
```php
// Laravel example
Route::get('/dashboard/recent-activities', [DashboardController::class, 'getRecentActivities']);

public function getRecentActivities(Request $request) {
    $role = $request->query('role');
    $limit = $request->query('limit', 10);
    
    // Filter activities based on role
    $query = Activity::query()
        ->orderBy('created_at', 'desc')
        ->limit($limit);
    
    // Role-specific filtering logic
    if ($role === 'employee') {
        // Show only activities for user's own MRFs
        $query->where('user_id', auth()->id())
              ->orWhere('entity_type', 'mrf')
              ->whereIn('entity_id', function($q) {
                  $q->select('id')
                    ->from('mrf_requests')
                    ->where('requester_id', auth()->id());
              });
    } elseif ($role === 'executive') {
        // Show MRF approvals/rejections, high-value items
        $query->whereIn('type', ['mrf_created', 'mrf_approved', 'mrf_rejected']);
    } elseif ($role === 'procurement') {
        // Show RFQ, quotation activities
        $query->whereIn('type', ['rfq_sent', 'quotation_submitted', 'quotation_approved', 'quotation_rejected', 'po_generated']);
    } elseif ($role === 'supply_chain_director') {
        // Show PO, vendor selection activities
        $query->whereIn('type', ['quotation_approved', 'po_generated']);
    } elseif ($role === 'finance') {
        // Show payment, PO activities
        $query->whereIn('type', ['po_generated', 'payment_processed']);
    } elseif ($role === 'chairman') {
        // Show high-value approvals, payment approvals
        $query->whereIn('type', ['mrf_approved', 'payment_processed']);
    } elseif ($role === 'vendor') {
        // Show RFQ received, quotation submitted activities
        $query->whereIn('type', ['rfq_sent', 'quotation_submitted', 'quotation_approved', 'quotation_rejected'])
              ->where('user_id', auth()->id()); // Vendor's own activities
    }
    
    $activities = $query->get()->map(function($activity) {
        return [
            'id' => $activity->id,
            'type' => $activity->type,
            'title' => $activity->title,
            'description' => $activity->description,
            'timestamp' => $activity->created_at->toISOString(),
            'user' => $activity->user_name,
            'entityId' => $activity->entity_id,
            'entityType' => $activity->entity_type,
            'status' => $activity->status,
        ];
    });
    
    return response()->json([
        'success' => true,
        'data' => $activities
    ]);
}
```

---

## 3. Quotation Status Management Endpoints

### 3.1 Close Quotation
**Endpoint**: `POST /api/quotations/{quotationId}/close`

**Current Status**: ❌ **NEEDS TO BE CREATED**

**Required Functionality**:
- Change quotation status from `submitted` to `closed`
- Only procurement managers can close quotations
- Update `updated_at` timestamp

**Request Body**: None (or optional reason)

**Response Format**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "closed",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

**Backend Implementation**:
```php
Route::post('/quotations/{id}/close', [QuotationController::class, 'close']);

public function close($id) {
    $quotation = Quotation::findOrFail($id);
    
    // Authorization check - only procurement can close
    if (auth()->user()->role !== 'procurement' && auth()->user()->role !== 'procurement_manager') {
        return response()->json(['success' => false, 'error' => 'Unauthorized'], 403);
    }
    
    // Only allow closing submitted quotations
    if ($quotation->status !== 'submitted') {
        return response()->json([
            'success' => false,
            'error' => 'Only submitted quotations can be closed'
        ], 400);
    }
    
    $quotation->status = 'closed';
    $quotation->updated_at = now();
    $quotation->save();
    
    // Log activity
    Activity::create([
        'type' => 'quotation_closed',
        'title' => 'Quotation Closed',
        'description' => "Quotation {$quotation->id} was closed by " . auth()->user()->name,
        'user_id' => auth()->id(),
        'user_name' => auth()->user()->name,
        'entity_type' => 'quotation',
        'entity_id' => $quotation->id,
        'status' => 'closed'
    ]);
    
    return response()->json([
        'success' => true,
        'data' => $quotation
    ]);
}
```

### 3.2 Reopen Quotation
**Endpoint**: `POST /api/quotations/{quotationId}/reopen`

**Current Status**: ❌ **NEEDS TO BE CREATED**

**Required Functionality**:
- Change quotation status from `closed` back to `submitted`
- Only procurement managers can reopen quotations
- Update `updated_at` timestamp

**Request Body**: None (or optional reason)

**Response Format**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "submitted",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

**Backend Implementation**:
```php
Route::post('/quotations/{id}/reopen', [QuotationController::class, 'reopen']);

public function reopen($id) {
    $quotation = Quotation::findOrFail($id);
    
    // Authorization check - only procurement can reopen
    if (auth()->user()->role !== 'procurement' && auth()->user()->role !== 'procurement_manager') {
        return response()->json(['success' => false, 'error' => 'Unauthorized'], 403);
    }
    
    // Only allow reopening closed quotations
    if ($quotation->status !== 'closed') {
        return response()->json([
            'success' => false,
            'error' => 'Only closed quotations can be reopened'
        ], 400);
    }
    
    $quotation->status = 'submitted';
    $quotation->updated_at = now();
    $quotation->save();
    
    // Log activity
    Activity::create([
        'type' => 'quotation_reopened',
        'title' => 'Quotation Reopened',
        'description' => "Quotation {$quotation->id} was reopened by " . auth()->user()->name,
        'user_id' => auth()->id(),
        'user_name' => auth()->user()->name,
        'entity_type' => 'quotation',
        'entity_id' => $quotation->id,
        'status' => 'submitted'
    ]);
    
    return response()->json([
        'success' => true,
        'data' => $quotation
    ]);
}
```

---

## 4. MRF Full Details Endpoint

### Endpoint: `GET /api/mrfs/{mrfId}/full-details`

**Current Status**: ✅ Likely exists (used in frontend)

**Required Response Format**:
```json
{
  "success": true,
  "data": {
    "mrf": {
      "id": "uuid",
      "title": "string",
      "status": "string",
      "current_stage": "procurement|supply_chain|finance|...",
      // ... all MRF fields
    },
    "rfqs": [
      {
        "id": "uuid",
        "title": "string",
        "status": "open|closed|awarded",
        "vendors": []
      }
    ],
    "quotations": [
      {
        "id": "uuid",
        "rfqId": "uuid",
        "rfqTitle": "string",
        "vendor": {},
        "totalAmount": 95000,
        "status": "submitted|approved|rejected",
        "attachments": []
      }
    ],
    "statistics": {
      "totalQuotations": 3,
      "totalRfqs": 1,
      "lowestBid": 90000,
      "highestBid": 110000,
      "averageBid": 100000
    }
  }
}
```

**Backend Tasks**:
- ✅ Verify endpoint exists and returns all required fields
- ✅ Ensure quotations include `delivery_days` and `payment_terms`
- ✅ Include progress tracker data (if separate endpoint)

---

## 5. MRF Progress Tracker Endpoint

### Endpoint: `GET /api/mrfs/{mrfId}/progress-tracker`

**Current Status**: ✅ Likely exists (used in frontend)

**Required Response Format**:
```json
{
  "success": true,
  "data": {
    "mrfId": "uuid",
    "title": "string",
    "currentStep": 3,
    "steps": [
      {
        "step": 1,
        "name": "MRF Created",
        "status": "completed",
        "completedAt": "2024-01-01T10:00:00Z",
        "completedBy": {
          "id": "uuid",
          "name": "John Doe"
        },
        "remarks": "Optional remarks"
      },
      {
        "step": 2,
        "name": "Executive Approval",
        "status": "completed",
        "completedAt": "2024-01-02T14:00:00Z",
        "completedBy": {
          "id": "uuid",
          "name": "Jane Executive"
        }
      },
      {
        "step": 3,
        "name": "RFQ Sent",
        "status": "current",
        "completedAt": null,
        "completedBy": null
      }
      // ... more steps
    ]
  }
}
```

**Backend Tasks**:
- ✅ Verify endpoint exists
- ✅ Ensure all workflow steps are included (8 steps: MRF Created → Executive → RFQ → Supply Chain → PO → Finance → GRN → Closed)
- ✅ Return proper status for each step (`completed`, `current`, `not_started`)
- ✅ Include completion timestamps and approver names

---

## 6. RFQ Creation - Timestamp Setting

### Endpoint: `POST /api/rfqs` (Create RFQ)

**Current Status**: ✅ Exists but needs verification

**Backend Tasks**:
- ✅ Ensure `created_at` timestamp is set when RFQ is created/dispatched
- ✅ This timestamp should represent when RFQ was sent to vendors, not just when record was created
- ✅ Consider adding `dispatched_at` field if different from `created_at`

**Implementation Check**:
```php
// When RFQ is created and sent to vendors
$rfq = RFQ::create([
    'mrf_id' => $mrfId,
    'title' => $title,
    'deadline' => $deadline,
    'status' => 'open',
    'created_at' => now(), // This should be set
    // ... other fields
]);

// Log activity
Activity::create([
    'type' => 'rfq_sent',
    'title' => 'RFQ Sent to Vendors',
    'description' => "RFQ {$rfq->id} was sent to " . count($vendorIds) . " vendors",
    'user_id' => auth()->id(),
    'user_name' => auth()->user()->name,
    'entity_type' => 'rfq',
    'entity_id' => $rfq->id,
    'status' => 'open'
]);
```

---

## 7. Quotation Submission - Ensure All Fields

### Endpoint: `POST /api/rfqs/{rfqId}/submit-quotation` (Vendor Portal)

**Current Status**: ✅ Exists but needs verification

**Backend Tasks**:
- ✅ Ensure `delivery_days` field is saved when quotation is submitted
- ✅ Ensure `payment_terms` field is saved when quotation is submitted
- ✅ Ensure `validity_days` field is saved (already implemented in frontend)

**Implementation Check**:
```php
$quotation = Quotation::create([
    'rfq_id' => $rfqId,
    'vendor_id' => auth()->id(), // vendor auth
    'total_amount' => $totalAmount,
    'delivery_days' => $request->delivery_days, // CRITICAL
    'delivery_date' => $request->delivery_date,
    'payment_terms' => $request->payment_terms, // CRITICAL
    'validity_days' => $request->validity_days ?? 30,
    'status' => 'submitted',
    // ... other fields
]);

// Log activity
Activity::create([
    'type' => 'quotation_submitted',
    'title' => 'Quotation Submitted',
    'description' => "Vendor " . auth()->user()->name . " submitted quotation for RFQ {$rfqId}",
    'user_id' => auth()->id(),
    'user_name' => auth()->user()->name,
    'entity_type' => 'quotation',
    'entity_id' => $quotation->id,
    'status' => 'submitted'
]);
```

---

## Summary Checklist

### Critical (Must Have)
- [ ] **Recent Activities Endpoint** - `GET /api/dashboard/recent-activities?role={role}`
- [ ] **Activity Logging System** - Create activities table and log all key events
- [ ] **Close Quotation Endpoint** - `POST /api/quotations/{id}/close`
- [ ] **Reopen Quotation Endpoint** - `POST /api/quotations/{id}/reopen`
- [ ] **RFQ Timestamp** - Ensure `created_at` is set when RFQ is dispatched
- [ ] **Quotation Fields** - Ensure `delivery_days` and `payment_terms` are saved and returned

### Verification (Should Verify)
- [ ] **RFQ Quotations Endpoint** - Verify `GET /api/rfqs/{id}/quotations` returns all required fields
- [ ] **MRF Full Details** - Verify endpoint returns complete data
- [ ] **MRF Progress Tracker** - Verify endpoint returns all 8 workflow steps

### Database Changes
- [ ] Create `activities` table
- [ ] Add indexes for performance
- [ ] Verify `quotations` table has `delivery_days` and `payment_terms` columns
- [ ] Verify `rfqs` table has `created_at` timestamp

---

## Testing Checklist

1. **Test Recent Activities**:
   - Create MRF → Verify activity appears
   - Approve MRF → Verify activity appears
   - Send RFQ → Verify activity appears
   - Submit quotation → Verify activity appears
   - Test role-specific filtering

2. **Test Quotation Status**:
   - Submit quotation → Status should be `submitted`
   - Close quotation → Status should be `closed`
   - Reopen quotation → Status should be `submitted` again

3. **Test RFQ Details**:
   - Create RFQ → Verify `created_at` is set
   - Submit quotation → Verify `delivery_days` and `payment_terms` are saved
   - View RFQ details → Verify all fields display correctly (no N/A)

4. **Test MRF Details**:
   - View MRF details → Verify progress tracker shows correct steps
   - Verify all MRF data displays correctly
