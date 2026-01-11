# Laravel Backend Integration Guide

This document provides comprehensive instructions for integrating the SCM frontend with your Laravel backend. It covers all workflows (MRF, RFQ, SRF), database migrations, API routes, controllers, and real-time notifications.

## Table of Contents
1. [Environment Setup](#environment-setup)
2. [Database Migrations](#database-migrations)
3. [API Routes](#api-routes)
4. [Controllers](#controllers)
5. [Workflow State Machines](#workflow-state-machines)
6. [Real-Time Notifications](#real-time-notifications)
7. [Email Notifications](#email-notifications)
8. [Testing](#testing)

---

## Environment Setup

### Frontend `.env`
```env
VITE_API_BASE_URL=https://your-laravel-api.com/api
VITE_WS_URL=wss://your-laravel-api.com/ws
```

### Laravel `.env`
```env
# Broadcasting (for real-time)
BROADCAST_DRIVER=pusher
# or for Laravel Reverb
BROADCAST_DRIVER=reverb

PUSHER_APP_ID=your-app-id
PUSHER_APP_KEY=your-app-key
PUSHER_APP_SECRET=your-app-secret
PUSHER_HOST=
PUSHER_PORT=443
PUSHER_SCHEME=https
PUSHER_APP_CLUSTER=mt1

# Mail
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your-username
MAIL_PASSWORD=your-password
MAIL_FROM_ADDRESS=noreply@emeraldcfze.com
MAIL_FROM_NAME="Emerald SCM"
```

---

## Database Migrations

### 1. MRN (Material Request Notes)
```php
// database/migrations/xxxx_create_mrns_table.php
Schema::create('mrns', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('control_number')->unique();
    $table->string('title');
    $table->string('department');
    $table->string('category');
    $table->enum('urgency', ['Low', 'Medium', 'High']);
    $table->text('justification');
    $table->foreignUuid('requester_id')->constrained('users');
    $table->enum('status', ['Pending', 'Under Review', 'Converted to MRF', 'Rejected'])->default('Pending');
    $table->foreignUuid('reviewed_by')->nullable()->constrained('users');
    $table->timestamp('review_date')->nullable();
    $table->text('review_notes')->nullable();
    $table->foreignUuid('converted_mrf_id')->nullable();
    $table->timestamps();
});

Schema::create('mrn_items', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('mrn_id')->constrained()->cascadeOnDelete();
    $table->string('name');
    $table->text('description')->nullable();
    $table->integer('quantity');
    $table->decimal('estimated_unit_cost', 15, 2);
    $table->timestamps();
});
```

### 2. MRF (Material Requisition Forms)
```php
// database/migrations/xxxx_create_mrfs_table.php
Schema::create('mrfs', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('reference_number')->unique();
    $table->string('title');
    $table->string('category');
    $table->text('description')->nullable();
    $table->integer('quantity');
    $table->decimal('estimated_cost', 15, 2);
    $table->enum('urgency', ['low', 'medium', 'high']);
    $table->text('justification');
    $table->foreignUuid('requester_id')->constrained('users');
    $table->string('department')->nullable();
    
    // Workflow status
    $table->string('status')->default('Pending Executive Approval');
    $table->enum('current_stage', [
        'submitted', 'executive', 'chairman', 'procurement', 
        'supply_chain', 'finance', 'approved', 'rejected', 'completed'
    ])->default('executive');
    
    // PO fields
    $table->string('po_number')->nullable();
    $table->string('unsigned_po_url')->nullable();
    $table->string('signed_po_url')->nullable();
    $table->integer('po_version')->default(1);
    
    // Comments
    $table->text('executive_comments')->nullable();
    $table->text('chairman_comments')->nullable();
    $table->text('supply_chain_comments')->nullable();
    $table->text('rejection_reason')->nullable();
    $table->text('po_rejection_reason')->nullable();
    
    // Flags
    $table->boolean('is_resubmission')->default(false);
    $table->foreignUuid('source_mrn_id')->nullable()->constrained('mrns');
    
    $table->timestamps();
});

// Approval history
Schema::create('mrf_approval_history', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('mrf_id')->constrained()->cascadeOnDelete();
    $table->string('stage');
    $table->foreignUuid('approver_id')->constrained('users');
    $table->string('approver_name');
    $table->enum('action', ['approved', 'rejected']);
    $table->text('remarks')->nullable();
    $table->timestamps();
});

// Document attachments
Schema::create('mrf_documents', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('mrf_id')->constrained()->cascadeOnDelete();
    $table->string('name');
    $table->string('file_path');
    $table->string('file_type');
    $table->integer('file_size');
    $table->timestamps();
});
```

### 3. SRF (Service Requisition Forms)
```php
// database/migrations/xxxx_create_srfs_table.php
Schema::create('srfs', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('reference_number')->unique();
    $table->string('title');
    $table->string('service_type');
    $table->text('description');
    $table->string('duration');
    $table->decimal('estimated_cost', 15, 2);
    $table->enum('urgency', ['low', 'medium', 'high']);
    $table->text('justification');
    $table->foreignUuid('requester_id')->constrained('users');
    $table->enum('status', ['Pending', 'Approved', 'Rejected', 'In Progress', 'Completed'])->default('Pending');
    $table->timestamps();
});
```

### 4. RFQ & Quotations
```php
// database/migrations/xxxx_create_rfqs_table.php
Schema::create('rfqs', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('reference_number')->unique();
    $table->foreignUuid('mrf_id')->constrained();
    $table->text('description');
    $table->integer('quantity');
    $table->decimal('estimated_cost', 15, 2);
    $table->date('deadline');
    $table->enum('status', ['Open', 'Closed', 'Awarded'])->default('Open');
    $table->string('payment_terms')->nullable();
    $table->string('delivery_terms')->nullable();
    $table->text('technical_requirements')->nullable();
    $table->foreignUuid('created_by')->constrained('users');
    $table->timestamps();
});

// Many-to-many: RFQs to Vendors
Schema::create('rfq_vendor', function (Blueprint $table) {
    $table->foreignUuid('rfq_id')->constrained()->cascadeOnDelete();
    $table->foreignUuid('vendor_id')->constrained()->cascadeOnDelete();
    $table->timestamp('notified_at')->nullable();
    $table->primary(['rfq_id', 'vendor_id']);
});

// Quotations
Schema::create('quotations', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('rfq_id')->constrained();
    $table->foreignUuid('vendor_id')->constrained();
    $table->decimal('price', 15, 2);
    $table->date('delivery_date');
    $table->string('payment_terms')->nullable();
    $table->string('warranty_period')->nullable();
    $table->text('notes')->nullable();
    $table->enum('status', ['Pending', 'Approved', 'Rejected'])->default('Pending');
    $table->string('document_url')->nullable();
    $table->timestamps();
});

Schema::create('quotation_line_items', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('quotation_id')->constrained()->cascadeOnDelete();
    $table->string('description');
    $table->integer('quantity');
    $table->decimal('unit_price', 15, 2);
    $table->timestamps();
});
```

### 5. Vendors
```php
// database/migrations/xxxx_create_vendors_table.php
Schema::create('vendors', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('name');
    $table->string('category');
    $table->decimal('rating', 3, 2)->default(0);
    $table->integer('total_orders')->default(0);
    $table->decimal('on_time_delivery', 5, 2)->default(0); // percentage
    $table->decimal('quality_rating', 3, 2)->default(0);
    $table->enum('status', ['Active', 'Pending', 'Suspended'])->default('Pending');
    $table->enum('kyc_status', ['Pending', 'Under Review', 'Verified', 'Rejected'])->default('Pending');
    $table->string('email')->unique();
    $table->string('phone');
    $table->text('address');
    $table->string('tax_id');
    $table->string('contact_person');
    $table->foreignUuid('user_id')->nullable()->constrained(); // linked user account
    $table->timestamps();
});

Schema::create('vendor_documents', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('vendor_id')->constrained()->cascadeOnDelete();
    $table->string('name');
    $table->string('document_type'); // registration, tax, certificate, etc.
    $table->string('file_path');
    $table->integer('file_size');
    $table->date('expiry_date')->nullable();
    $table->timestamps();
});

// Vendor Registrations (pending applications)
Schema::create('vendor_registrations', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('company_name');
    $table->string('category');
    $table->string('email');
    $table->string('phone');
    $table->text('address');
    $table->string('tax_id');
    $table->string('contact_person');
    $table->enum('status', ['Pending', 'Approved', 'Rejected'])->default('Pending');
    $table->foreignUuid('reviewed_by')->nullable()->constrained('users');
    $table->timestamp('reviewed_at')->nullable();
    $table->text('review_notes')->nullable();
    $table->timestamps();
});
```

### 6. Notifications
```php
// database/migrations/xxxx_create_notifications_table.php
Schema::create('notifications', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
    $table->string('type'); // mrf_created, rfq_received, quotation_approved, etc.
    $table->string('title');
    $table->text('message');
    $table->json('data')->nullable(); // additional context
    $table->string('action_url')->nullable();
    $table->boolean('is_read')->default(false);
    $table->timestamp('read_at')->nullable();
    $table->timestamps();
});

Schema::create('notification_preferences', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
    $table->boolean('email_enabled')->default(true);
    $table->boolean('push_enabled')->default(true);
    $table->boolean('sound_enabled')->default(true);
    $table->json('disabled_types')->nullable(); // array of notification types to disable
    $table->timestamps();
});
```

---

## API Routes

```php
// routes/api.php

use App\Http\Controllers\Api\{
    AuthController,
    MrnController,
    MrfController,
    SrfController,
    RfqController,
    QuotationController,
    VendorController,
    VendorRegistrationController,
    NotificationController,
    DashboardController,
};

// Public routes
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/vendor-registrations', [VendorRegistrationController::class, 'store']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    
    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/pending-counts', [DashboardController::class, 'pendingCounts']);
    Route::get('/dashboard/recent-activity', [DashboardController::class, 'recentActivity']);
    
    // MRNs
    Route::apiResource('mrns', MrnController::class);
    Route::post('/mrns/{mrn}/convert-to-mrf', [MrnController::class, 'convertToMrf']);
    Route::post('/mrns/{mrn}/reject', [MrnController::class, 'reject']);
    
    // MRFs
    Route::apiResource('mrfs', MrfController::class);
    Route::post('/mrfs/{mrf}/approve', [MrfController::class, 'approve']);
    Route::post('/mrfs/{mrf}/reject', [MrfController::class, 'reject']);
    Route::post('/mrfs/{mrf}/route', [MrfController::class, 'routeAfterExecutive']);
    Route::post('/mrfs/{mrf}/generate-po', [MrfController::class, 'generatePo']);
    Route::post('/mrfs/{mrf}/upload-unsigned-po', [MrfController::class, 'uploadUnsignedPo']);
    Route::post('/mrfs/{mrf}/upload-signed-po', [MrfController::class, 'uploadSignedPo']);
    Route::post('/mrfs/{mrf}/reject-po', [MrfController::class, 'rejectPo']);
    Route::post('/mrfs/{mrf}/process-payment', [MrfController::class, 'processPayment']);
    Route::post('/mrfs/{mrf}/approve-payment', [MrfController::class, 'approvePayment']);
    Route::post('/mrfs/{mrf}/mark-paid', [MrfController::class, 'markPaid']);
    Route::get('/mrfs/{mrf}/approval-history', [MrfController::class, 'approvalHistory']);
    
    // SRFs
    Route::apiResource('srfs', SrfController::class);
    Route::post('/srfs/{srf}/approve', [SrfController::class, 'approve']);
    Route::post('/srfs/{srf}/reject', [SrfController::class, 'reject']);
    Route::post('/srfs/{srf}/complete', [SrfController::class, 'complete']);
    
    // RFQs
    Route::apiResource('rfqs', RfqController::class);
    Route::post('/rfqs/{rfq}/close', [RfqController::class, 'close']);
    Route::post('/rfqs/{rfq}/award', [RfqController::class, 'award']);
    Route::get('/rfqs/{rfq}/quotations', [RfqController::class, 'quotations']);
    Route::get('/rfqs/{rfq}/comparison', [RfqController::class, 'comparison']);
    
    // Quotations
    Route::apiResource('quotations', QuotationController::class)->only(['index', 'show', 'store']);
    Route::post('/quotations/{quotation}/upload-document', [QuotationController::class, 'uploadDocument']);
    Route::put('/quotations/{quotation}/status', [QuotationController::class, 'updateStatus']);
    
    // Vendors
    Route::apiResource('vendors', VendorController::class)->only(['index', 'show', 'update']);
    Route::get('/vendors/stats', [VendorController::class, 'stats']);
    Route::get('/vendors/top-performers', [VendorController::class, 'topPerformers']);
    Route::get('/vendors/my-rfqs', [VendorController::class, 'myRfqs']);
    Route::get('/vendors/my-quotations', [VendorController::class, 'myQuotations']);
    Route::post('/vendors/{vendor}/documents', [VendorController::class, 'uploadDocument']);
    Route::delete('/vendors/{vendor}/documents/{document}', [VendorController::class, 'deleteDocument']);
    
    // Vendor Registrations
    Route::apiResource('vendor-registrations', VendorRegistrationController::class)->only(['index', 'show']);
    Route::post('/vendor-registrations/{registration}/documents', [VendorRegistrationController::class, 'uploadDocuments']);
    Route::post('/vendor-registrations/{registration}/approve', [VendorRegistrationController::class, 'approve']);
    Route::post('/vendor-registrations/{registration}/reject', [VendorRegistrationController::class, 'reject']);
    
    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::put('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    Route::put('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);
    Route::get('/notifications/preferences', [NotificationController::class, 'getPreferences']);
    Route::put('/notifications/preferences', [NotificationController::class, 'updatePreferences']);
});
```

---

## Controllers

### MRF Controller (Key Workflow Methods)
```php
// app/Http/Controllers/Api/MrfController.php

namespace App\Http\Controllers\Api;

use App\Models\Mrf;
use App\Events\MrfStatusChanged;
use App\Notifications\MrfApprovalRequired;
use App\Notifications\MrfApproved;
use App\Notifications\MrfRejected;
use Illuminate\Http\Request;

class MrfController extends Controller
{
    /**
     * Approve MRF at current stage
     */
    public function approve(Request $request, Mrf $mrf)
    {
        $request->validate([
            'stage' => 'required|string',
            'remarks' => 'nullable|string',
        ]);
        
        $user = auth()->user();
        $stage = $request->stage;
        
        // Record approval in history
        $mrf->approvalHistory()->create([
            'stage' => $stage,
            'approver_id' => $user->id,
            'approver_name' => $user->name,
            'action' => 'approved',
            'remarks' => $request->remarks,
        ]);
        
        // Determine next stage based on current stage and value
        $nextStage = $this->getNextStage($mrf, $stage);
        
        $mrf->update([
            'current_stage' => $nextStage['stage'],
            'status' => $nextStage['status'],
            "{$stage}_comments" => $request->remarks,
        ]);
        
        // Dispatch events for real-time notifications
        event(new MrfStatusChanged($mrf, 'approved', $stage));
        
        // Notify next approvers
        $this->notifyNextApprovers($mrf);
        
        return response()->json([
            'success' => true,
            'data' => $mrf->fresh()->load('approvalHistory'),
        ]);
    }
    
    /**
     * Route MRF after Executive approval
     * High-value (>₦1M) goes to Chairman, else to Procurement
     */
    public function routeAfterExecutive(Request $request, Mrf $mrf)
    {
        $request->validate([
            'route_to' => 'required|in:chairman,procurement',
            'comments' => 'nullable|string',
        ]);
        
        $routeTo = $request->route_to;
        
        if ($routeTo === 'chairman') {
            $mrf->update([
                'current_stage' => 'chairman',
                'status' => 'Pending Chairman Approval',
                'executive_comments' => $request->comments,
            ]);
        } else {
            $mrf->update([
                'current_stage' => 'procurement',
                'status' => 'Ready for PO Generation',
                'executive_comments' => $request->comments,
            ]);
        }
        
        event(new MrfStatusChanged($mrf, 'routed', $routeTo));
        
        return response()->json(['success' => true, 'data' => $mrf->fresh()]);
    }
    
    /**
     * Generate PO for approved MRF
     */
    public function generatePo(Request $request, Mrf $mrf)
    {
        $request->validate(['po_number' => 'required|string|unique:mrfs,po_number']);
        
        $mrf->update([
            'po_number' => $request->po_number,
            'current_stage' => 'supply_chain',
            'status' => 'PO Generated - Pending SCM Signature',
        ]);
        
        event(new MrfStatusChanged($mrf, 'po_generated'));
        
        return response()->json(['success' => true, 'data' => $mrf->fresh()]);
    }
    
    /**
     * Upload signed PO (by Supply Chain Director)
     */
    public function uploadSignedPo(Request $request, Mrf $mrf)
    {
        $request->validate(['file' => 'required|file|mimes:pdf|max:10240']);
        
        $path = $request->file('file')->store('signed-pos', 'public');
        
        $mrf->update([
            'signed_po_url' => $path,
            'current_stage' => 'finance',
            'status' => 'PO Signed - Pending Finance Processing',
        ]);
        
        event(new MrfStatusChanged($mrf, 'po_signed'));
        
        return response()->json(['success' => true, 'data' => $mrf->fresh()]);
    }
    
    /**
     * Reject PO (sends back to Procurement)
     */
    public function rejectPo(Request $request, Mrf $mrf)
    {
        $request->validate([
            'reason' => 'required|string',
            'comments' => 'nullable|string',
        ]);
        
        $mrf->update([
            'current_stage' => 'procurement',
            'status' => 'PO Rejected - Revision Required',
            'po_rejection_reason' => $request->reason,
            'supply_chain_comments' => $request->comments,
            'po_version' => $mrf->po_version + 1,
            'unsigned_po_url' => null, // Clear old PO
        ]);
        
        event(new MrfStatusChanged($mrf, 'po_rejected'));
        
        return response()->json(['success' => true, 'data' => $mrf->fresh()]);
    }
    
    /**
     * Mark as processed for payment (Finance)
     */
    public function processPayment(Mrf $mrf)
    {
        $mrf->update([
            'current_stage' => 'chairman', // Chairman final payment approval
            'status' => 'Processed for Payment - Pending Chairman Approval',
        ]);
        
        event(new MrfStatusChanged($mrf, 'processed_for_payment'));
        
        return response()->json(['success' => true, 'data' => $mrf->fresh()]);
    }
    
    /**
     * Chairman approves final payment
     */
    public function approvePayment(Mrf $mrf)
    {
        $mrf->update([
            'current_stage' => 'completed',
            'status' => 'Paid/Completed',
        ]);
        
        event(new MrfStatusChanged($mrf, 'payment_approved'));
        
        // Notify requester
        $mrf->requester->notify(new MrfApproved($mrf, 'Your request has been fully processed and paid.'));
        
        return response()->json(['success' => true, 'data' => $mrf->fresh()]);
    }
    
    private function getNextStage(Mrf $mrf, string $currentStage): array
    {
        $stages = [
            'executive' => fn() => $mrf->estimated_cost > 1000000 
                ? ['stage' => 'chairman', 'status' => 'Pending Chairman Approval']
                : ['stage' => 'procurement', 'status' => 'Ready for PO Generation'],
            'chairman' => ['stage' => 'procurement', 'status' => 'Ready for PO Generation'],
            'procurement' => ['stage' => 'supply_chain', 'status' => 'PO Generated - Pending SCM Signature'],
            'supply_chain' => ['stage' => 'finance', 'status' => 'PO Signed - Pending Finance'],
            'finance' => ['stage' => 'chairman', 'status' => 'Pending Chairman Payment Approval'],
        ];
        
        $next = $stages[$currentStage] ?? ['stage' => 'approved', 'status' => 'Approved'];
        
        return is_callable($next) ? $next() : $next;
    }
}
```

### RFQ Controller
```php
// app/Http/Controllers/Api/RfqController.php

namespace App\Http\Controllers\Api;

use App\Models\Rfq;
use App\Models\Vendor;
use App\Events\RfqCreated;
use App\Notifications\NewRfqReceived;
use Illuminate\Http\Request;

class RfqController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'mrf_id' => 'required|exists:mrfs,id',
            'description' => 'required|string',
            'quantity' => 'required|integer|min:1',
            'estimated_cost' => 'required|numeric|min:0',
            'deadline' => 'required|date|after:today',
            'vendor_ids' => 'required|array|min:1',
            'vendor_ids.*' => 'exists:vendors,id',
            'payment_terms' => 'nullable|string',
            'delivery_terms' => 'nullable|string',
            'technical_requirements' => 'nullable|string',
        ]);
        
        $rfq = Rfq::create([
            'reference_number' => 'RFQ-' . date('Y') . '-' . str_pad(Rfq::count() + 1, 4, '0', STR_PAD_LEFT),
            'mrf_id' => $validated['mrf_id'],
            'description' => $validated['description'],
            'quantity' => $validated['quantity'],
            'estimated_cost' => $validated['estimated_cost'],
            'deadline' => $validated['deadline'],
            'payment_terms' => $validated['payment_terms'],
            'delivery_terms' => $validated['delivery_terms'],
            'technical_requirements' => $validated['technical_requirements'],
            'created_by' => auth()->id(),
        ]);
        
        // Attach vendors
        $rfq->vendors()->attach($validated['vendor_ids'], [
            'notified_at' => now(),
        ]);
        
        // Notify each vendor
        $vendors = Vendor::whereIn('id', $validated['vendor_ids'])->get();
        foreach ($vendors as $vendor) {
            if ($vendor->user) {
                $vendor->user->notify(new NewRfqReceived($rfq));
            }
        }
        
        // Broadcast real-time event
        event(new RfqCreated($rfq));
        
        return response()->json([
            'success' => true,
            'data' => $rfq->load('vendors', 'mrf'),
        ], 201);
    }
    
    /**
     * Award RFQ to vendor
     */
    public function award(Request $request, Rfq $rfq)
    {
        $request->validate([
            'vendor_id' => 'required|exists:vendors,id',
            'quotation_id' => 'required|exists:quotations,id',
        ]);
        
        // Update winning quotation
        $rfq->quotations()->where('id', $request->quotation_id)->update(['status' => 'Approved']);
        
        // Reject other quotations
        $rfq->quotations()->where('id', '!=', $request->quotation_id)->update(['status' => 'Rejected']);
        
        // Close RFQ
        $rfq->update(['status' => 'Awarded']);
        
        // Notify winning vendor
        $vendor = Vendor::find($request->vendor_id);
        if ($vendor->user) {
            $vendor->user->notify(new \App\Notifications\RfqAwarded($rfq));
        }
        
        return response()->json(['success' => true, 'data' => $rfq->fresh()]);
    }
    
    /**
     * Get comparison data for quotations
     */
    public function comparison(Rfq $rfq)
    {
        $quotations = $rfq->quotations()->with('vendor')->get();
        
        if ($quotations->isEmpty()) {
            return response()->json(['success' => true, 'data' => null]);
        }
        
        $prices = $quotations->pluck('price')->map(fn($p) => floatval($p));
        $lowestPrice = $prices->min();
        $highestPrice = $prices->max();
        $avgPrice = $prices->avg();
        
        $scored = $quotations->map(function ($q) use ($lowestPrice, $highestPrice) {
            $vendor = $q->vendor;
            $priceScore = $highestPrice > $lowestPrice 
                ? (($highestPrice - $q->price) / ($highestPrice - $lowestPrice)) * 40 
                : 40;
            $deliveryDays = now()->diffInDays($q->delivery_date, false);
            $deliveryScore = max(0, 30 - max(0, $deliveryDays - 7));
            $vendorScore = ($vendor->rating / 5) * 30;
            
            return [
                'quotation' => $q,
                'vendor' => $vendor,
                'price_score' => round($priceScore),
                'delivery_score' => round($deliveryScore),
                'vendor_score' => round($vendorScore),
                'overall_score' => round($priceScore + $deliveryScore + $vendorScore),
            ];
        })->sortByDesc('overall_score')->values();
        
        return response()->json([
            'success' => true,
            'data' => [
                'lowest_price' => $lowestPrice,
                'highest_price' => $highestPrice,
                'avg_price' => $avgPrice,
                'quotations' => $scored,
                'recommended_id' => $scored->first()['quotation']['id'] ?? null,
            ],
        ]);
    }
}
```

---

## Workflow State Machines

### MRF Workflow States
```
┌─────────────┐
│  Submitted  │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Executive Review   │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │ >₦1M?    │
     └─────┬─────┘
       YES │ NO
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐  ┌─────────────┐
│Chairman │  │ Procurement │
│ Review  │  │ PO Generate │
└────┬────┘  └──────┬──────┘
     │              │
     └──────┬───────┘
            ▼
┌─────────────────────────┐
│  Supply Chain Director  │
│  (Sign/Reject PO)       │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │ Approved? │
      └─────┬─────┘
      YES   │   NO (back to Procurement)
            ▼
     ┌─────────────┐
     │   Finance   │
     │ (Process)   │
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │  Chairman   │
     │ (Payment)   │
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │  Completed  │
     └─────────────┘
```

---

## Real-Time Notifications

### Laravel Broadcasting Setup

```php
// app/Events/MrfStatusChanged.php
namespace App\Events;

use App\Models\Mrf;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class MrfStatusChanged implements ShouldBroadcast
{
    public Mrf $mrf;
    public string $action;
    public ?string $stage;
    
    public function __construct(Mrf $mrf, string $action, ?string $stage = null)
    {
        $this->mrf = $mrf;
        $this->action = $action;
        $this->stage = $stage;
    }
    
    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('user.' . $this->mrf->requester_id),
        ];
        
        // Broadcast to role-specific channels
        $roleChannels = $this->getRoleChannels();
        foreach ($roleChannels as $role) {
            $channels[] = new PrivateChannel('role.' . $role);
        }
        
        return $channels;
    }
    
    public function broadcastAs(): string
    {
        return 'mrf.' . $this->action;
    }
    
    public function broadcastWith(): array
    {
        return [
            'mrf_id' => $this->mrf->id,
            'title' => $this->mrf->title,
            'status' => $this->mrf->status,
            'stage' => $this->mrf->current_stage,
            'action' => $this->action,
            'timestamp' => now()->toISOString(),
        ];
    }
    
    private function getRoleChannels(): array
    {
        return match ($this->mrf->current_stage) {
            'executive' => ['executive'],
            'chairman' => ['chairman'],
            'procurement' => ['procurement'],
            'supply_chain' => ['supply_chain_director'],
            'finance' => ['finance'],
            default => [],
        };
    }
}
```

### Frontend WebSocket Integration

The frontend already has `src/services/websocket.ts` configured. Update your Laravel Echo setup:

```javascript
// In your Laravel app's bootstrap.js or separate file
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    forceTLS: true
});
```

---

## Email Notifications

### Create Notification Classes
```bash
php artisan make:notification MrfApprovalRequired
php artisan make:notification MrfApproved
php artisan make:notification MrfRejected
php artisan make:notification NewRfqReceived
php artisan make:notification RfqAwarded
php artisan make:notification VendorRegistrationApproved
php artisan make:notification DocumentExpiryReminder
```

### Example Email Notification
```php
// app/Notifications/MrfApprovalRequired.php
namespace App\Notifications;

use App\Models\Mrf;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class MrfApprovalRequired extends Notification
{
    public Mrf $mrf;
    public string $stage;
    
    public function __construct(Mrf $mrf, string $stage)
    {
        $this->mrf = $mrf;
        $this->stage = $stage;
    }
    
    public function via($notifiable): array
    {
        return ['mail', 'database', 'broadcast'];
    }
    
    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("MRF Approval Required: {$this->mrf->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("A Material Requisition Form requires your approval.")
            ->line("**Reference:** {$this->mrf->reference_number}")
            ->line("**Title:** {$this->mrf->title}")
            ->line("**Amount:** ₦" . number_format($this->mrf->estimated_cost))
            ->action('Review Request', url("/procurement/mrf/{$this->mrf->id}"))
            ->line('Please review and take action at your earliest convenience.');
    }
    
    public function toDatabase($notifiable): array
    {
        return [
            'mrf_id' => $this->mrf->id,
            'title' => "MRF Approval Required: {$this->mrf->title}",
            'message' => "A new MRF ({$this->mrf->reference_number}) requires your approval.",
            'action_url' => "/procurement/mrf/{$this->mrf->id}",
        ];
    }
    
    public function toBroadcast($notifiable): array
    {
        return [
            'type' => 'mrf_approval_required',
            'mrf_id' => $this->mrf->id,
            'title' => $this->mrf->title,
            'stage' => $this->stage,
        ];
    }
}
```

### Scheduled Document Expiry Reminders
```php
// app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    // Check document expiry daily
    $schedule->call(function () {
        $expiringDocs = VendorDocument::where('expiry_date', '<=', now()->addDays(30))
            ->where('expiry_date', '>', now())
            ->get();
            
        foreach ($expiringDocs as $doc) {
            $daysUntilExpiry = now()->diffInDays($doc->expiry_date);
            
            if (in_array($daysUntilExpiry, [30, 14, 7, 1])) {
                $doc->vendor->user?->notify(new DocumentExpiryReminder($doc, $daysUntilExpiry));
            }
        }
    })->daily();
}
```

---

## Testing

### API Test Examples
```bash
# Login
curl -X POST https://your-api.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Create MRN
curl -X POST https://your-api.com/api/mrns \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Office Supplies",
    "department": "IT",
    "category": "office-supplies",
    "urgency": "Medium",
    "justification": "Monthly supplies",
    "items": [
      {"name": "Paper", "description": "A4", "quantity": "10", "estimated_unit_cost": "500"}
    ]
  }'

# Approve MRF (Executive)
curl -X POST https://your-api.com/api/mrfs/{id}/approve \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stage": "executive", "remarks": "Approved for processing"}'

# Create RFQ
curl -X POST https://your-api.com/api/rfqs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mrf_id": "uuid-here",
    "description": "Office supplies",
    "quantity": 50,
    "estimated_cost": 25000,
    "deadline": "2025-02-01",
    "vendor_ids": ["vendor-uuid-1", "vendor-uuid-2"]
  }'
```

---

## Summary Checklist

### Backend Tasks
- [ ] Run migrations for all tables
- [ ] Configure Laravel Sanctum for API auth
- [ ] Set up Laravel Echo/Pusher/Reverb for broadcasting
- [ ] Configure mail driver (SMTP/SES)
- [ ] Create all notification classes
- [ ] Implement role-based authorization (Gates/Policies)
- [ ] Set up file storage (S3 recommended for production)
- [ ] Configure scheduled tasks for document expiry
- [ ] Add API rate limiting
- [ ] Set up CORS for frontend domain

### Frontend Environment
```env
VITE_API_BASE_URL=https://your-laravel-api.com/api
VITE_WS_URL=wss://your-laravel-api.com
VITE_PUSHER_APP_KEY=your-pusher-key
VITE_PUSHER_APP_CLUSTER=mt1
```

The frontend is now fully prepared to integrate with your Laravel backend!
