# VENDOR DOCUMENT EXPIRY ISSUE - DIAGNOSIS & FIX GUIDE

**Date**: March 31, 2026  
**Issue**: Vendor registration documents cannot be viewed after they expire  
**Root Cause**: Multi-layered - AWS URL expiry + database status not updated + no frontend validation  

---

## PROBLEM ANALYSIS

### What's Happening

1. **Documents Stop Being Viewable After Expiry**
   - User tries to download document after expiry date
   - System returns 404 or permission error
   - No helpful error message to user

2. **Why This Happens**
   - AWS S3 signed URLs have TTL (time-to-live)
   - Database `status` field not automatically updated to 'Expired'
   - Frontend doesn't check expiry before download
   - No renewal mechanism or warnings

3. **Which Documents Are Affected**
   - **Annual Expiry** (must renew yearly): NUPRC_DPR, PENCOM, ITF, NSITF, OEM_CERTIFICATE, OEM_AUTHORIZATION
   - **Non-Expiring**: CAC, TIN, HSE_CERTIFICATE, LETTER_OF_INTRODUCTION, COMPANY_PROFILE, CAC_FORM_7, CAC_FORM_5, BANK_REFERENCE

---

## CURRENT STATE ANALYSIS

### Database Schema (VendorDocument)
```typescript
interface VendorDocument {
  id: string;
  name: string;
  type: VendorDocumentType;
  fileData: string;              // Base64 or S3 path
  fileName: string;
  fileSize: number;
  uploadDate: string;
  expiryDate?: string;           // ← Stored but not checked
  status: 'Pending' | 'Approved' | 'Rejected' | 'Expired';  // ← Can be 'Expired' but might not be updated
  rejectionReason?: string;
  isRequired: boolean;
}
```

### Document Requirements
```typescript
// Documents that expire annually:
{ type: 'NUPRC_DPR', expiresAnnually: true }
{ type: 'PENCOM', expiresAnnually: true }
{ type: 'ITF', expiresAnnually: true }
{ type: 'NSITF', expiresAnnually: true }
{ type: 'OEM_CERTIFICATE', expiresAnnually: true }
{ type: 'OEM_AUTHORIZATION', expiresAnnually: true }
```

### Current Issues

**Issue 1: AWS S3 Signed URLs Expire**
```
S3 signed URL TTL: typically 7 days - 24 hours
Document expiryDate: might be 1-2 years away
Result: 404 error before document actually expires
```

**Issue 2: Database Status Not Updated**
```sql
-- Document stored with future expiryDate:
INSERT INTO vendor_registration_documents 
(id, type, expiry_date, status) 
VALUES ('doc-1', 'NUPRC_DPR', '2027-03-31', 'Approved');

-- After 2 years, document actually expires but status is still 'Approved'
-- No automatic status update to 'Expired'
SELECT * FROM vendor_registration_documents WHERE id = 'doc-1';
-- Result: status = 'Approved' (WRONG - should be 'Expired')
```

**Issue 3: No Frontend Validation**
```typescript
// handleDownloadDocument() doesn't check expiry
const handleDownloadDocument = async (document: VendorDocument) => {
  // ❌ No check for:
  // - if (document.expiryDate && new Date(document.expiryDate) < new Date()) { return error; }
  // - if (document.status === 'Expired') { return error; }
  
  // Just attempts download without validation
  const response = await vendorApi.downloadDocument(id, documentId);
};
```

**Issue 4: No Expiry Warnings**
- Users don't know documents are about to expire
- No pre-expiry notifications (30 days before)
- No automatic renewal reminders

---

## COMPLETE FIX STRATEGY

### FRONTEND FIXES (Immediate)

#### Fix 1: Add Document Expiry Validation [VendorRegistrationReview.tsx]

**Add this validation function** at the top of the component:

```typescript
// Helper functions for document expiry
const isDocumentExpired = (document: VendorDocument): boolean => {
  if (!document.expiryDate) return false;
  return new Date(document.expiryDate) < new Date();
};

const isDocumentExpiringsoon = (document: VendorDocument, daysWarning: number = 30): boolean => {
  if (!document.expiryDate) return false;
  const expiryDate = new Date(document.expiryDate);
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + daysWarning);
  return expiryDate <= warningDate && expiryDate >= new Date();
};

const getDaysUntilExpiry = (expiryDate: string | undefined): number | null => {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getExpiryStatusColor = (document: VendorDocument) => {
  if (!document.expiryDate) return 'text-muted-foreground';
  if (isDocumentExpired(document)) return 'text-destructive';
  if (isDocumentExpiringsooon(document, 30)) return 'text-warning';
  return 'text-muted-foreground';
};

const getExpiryStatusLabel = (document: VendorDocument): string => {
  if (!document.expiryDate) return 'No expiry';
  if (isDocumentExpired(document)) return 'EXPIRED - Cannot download';
  const daysLeft = getDaysUntilExpiry(document.expiryDate);
  if (daysLeft === null) return 'No expiry';
  if (daysLeft <= 0) return 'EXPIRED - Cannot download';
  if (daysLeft <= 30) return `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
  return `Expires: ${new Date(document.expiryDate).toLocaleDateString()}`;
};
```

#### Fix 2: Update handleDownloadDocument to Prevent Expired Downloads

**Replace the current handleDownloadDocument function** with:

```typescript
const handleDownloadDocument = async (document: VendorDocument) => {
  // Check if document is expired
  if (isDocumentExpired(document)) {
    toast({
      title: "Document Expired",
      description: `${document.name} expired on ${new Date(document.expiryDate!).toLocaleDateString()}. Please upload a new version.`,
      variant: "destructive",
    });
    return;
  }

  // Warn if expiring soon
  const daysLeft = getDaysUntilExpiry(document.expiryDate);
  if (daysLeft !== null && daysLeft <= 30 && daysLeft > 0) {
    console.warn(`⚠️ Document ${document.name} will expire in ${daysLeft} days`);
  }

  const doc = document as any;
  const registrationId = registration?.id;
  const fileName = doc.fileName || doc.file_name || doc.name || doc.original_name || doc.originalName || 'document';
  const documentId = doc.id || doc.document_id;
  const directUrl = doc.file_share_url || doc.fileShareUrl || doc.file_url || doc.fileUrl;

  console.log('Document download initiated:', {
    documentId,
    registrationId,
    fileName,
    directUrl,
    expiryDate: document.expiryDate,
  });

  try {
    if (directUrl && directUrl.startsWith('http')) {
      // Direct URL (OneDrive, Direct S3)
      const link = document.createElement('a');
      link.href = directUrl;
      link.download = fileName;
      link.click();
      
      toast({
        title: "Opening Document",
        description: "Document is being downloaded. Check your downloads folder.",
      });
    } else if (id && documentId) {
      console.log('Using API download endpoint for document:', documentId);

      try {
        const response = await vendorApi.downloadDocument(id, documentId);

        if (response.success) {
          toast({
            title: "Downloaded",
            description: "Document downloaded successfully",
          });
        } else {
          toast({
            title: "Download Failed",
            description: response.error || "Unable to download document",
            variant: "destructive",
          });
        }
      } catch (apiError) {
        console.error('API download error:', apiError);
        toast({
          title: "Error",
          description: "An error occurred while downloading the document",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Error",
        description: "Unable to download document - no document ID or direct URL found",
        variant: "destructive",
      });
      console.error('No download method available:', { documentId, directUrl, registrationId: id });
    }
  } catch (error) {
    console.error('Download error:', error);
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Failed to download document",
      variant: "destructive",
    });
  }
};
```

#### Fix 3: Update Document Display to Show Expiry Status

**Replace the document rendering section** (around line 610) with:

```typescript
{documents.length === 0 ? (
  <div className="text-center py-8 text-muted-foreground">
    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
    <p>No documents uploaded</p>
  </div>
) : (
  <div className="space-y-3">
    {documents.map((doc, index) => {
      const expired = isDocumentExpired(doc);
      const expiringSoon = isDocumentExpiringsooon(doc, 30) && !expired;
      
      return (
        <div
          key={doc.id || index}
          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
            expired 
              ? 'bg-destructive/5 border-destructive/20' 
              : expiringSoon 
              ? 'bg-warning/5 border-warning/20' 
              : 'bg-card hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileText className={`h-8 w-8 shrink-0 ${expired ? 'text-destructive' : 'text-primary'}`} />
            <div className="min-w-0">
              <p className="font-medium truncate">{getDocumentLabel(doc.type)}</p>
              <p className="text-xs text-muted-foreground truncate">
                {doc.fileName || doc.name} • {formatFileSize(doc.fileSize)}
              </p>
              {doc.expiryDate && (
                <>
                  <div className={`text-xs flex items-center gap-1 mt-1 font-semibold ${getExpiryStatusColor(doc)}`}>
                    <Clock className="h-3 w-3" />
                    {getExpiryStatusLabel(doc)}
                  </div>
                  {expired && (
                    <p className="text-xs text-destructive mt-1">
                      📝 This document needs to be renewed
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          {((doc as any).file_share_url || (doc as any).fileShareUrl) ? (
            <OneDriveLink
              webUrl={(doc as any).file_share_url || (doc as any).fileShareUrl}
              fileName={doc.fileName || doc.name}
              variant="button"
              size="sm"
              disabled={expired}
            />
          ) : (
            <Button
              variant={expired ? "destructive" : "outline"}
              size="sm"
              onClick={() => handleDownloadDocument(doc)}
              disabled={expired}
              title={expired ? "This document has expired and cannot be downloaded" : "Download document"}
            >
              <Download className="h-4 w-4 mr-1" />
              {expired ? "Expired" : "Download"}
            </Button>
          )}
        </div>
      );
    })}
    
    {/* Show expired documents warning */}
    {documents.some(d => isDocumentExpired(d)) && (
      <div className="mt-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
        <p className="text-sm text-destructive font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {documents.filter(d => isDocumentExpired(d)).length} document(s) have expired and need renewal
        </p>
      </div>
    )}
    
    {/* Show upcoming expiry warning */}
    {documents.some(d => isDocumentExpiringsooon(d, 30) && !isDocumentExpired(d)) && (
      <div className="mt-2 p-3 bg-warning/5 border border-warning/20 rounded-lg">
        <p className="text-sm text-warning font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {documents.filter(d => isDocumentExpiringsooon(d, 30) && !isDocumentExpired(d)).length} document(s) will expire within 30 days
        </p>
      </div>
    )}
  </div>
)}
```

---

### BACKEND FIXES (Required)

#### Fix 1: Auto-Update Expired Document Status

**Add a scheduled job** (runs daily at midnight) to update expired documents:

```php
// Laravel - Create a scheduled command
// app/Console/Commands/UpdateExpiredDocuments.php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\VendorRegistrationDocument;
use Carbon\Carbon;

class UpdateExpiredDocuments extends Command
{
    protected $signature = 'documents:mark-expired';

    public function handle()
    {
        // Mark documents as expired if expiry_date has passed
        $updated = VendorRegistrationDocument::where('status', 'Approved')
            ->where('expiry_date', '<', Carbon::now())
            ->update(['status' => 'Expired']);
        
        $this->info("Updated {$updated} expired documents");
        
        // Also mark registrations as 'Documents Incomplete' if they have expired required docs
        $this->handleExpiredVendorRegistrations();
    }
    
    private function handleExpiredVendorRegistrations()
    {
        // Get all registrations with expired documents
        $registrations = VendorRegistration::where('status', 'Approved')
            ->get();
        
        foreach ($registrations as $registration) {
            $hasExpiredRequiredDoc = $registration->documents()
                ->where('is_required', true)
                ->where('status', 'Expired')
                ->exists();
            
            if ($hasExpiredRequiredDoc) {
                // Update registration status
                $registration->update([
                    'status' => 'Documents Incomplete',
                    'review_notes' => 'One or more required documents have expired',
                ]);
                
                // Send notification to vendor
                \Mail::send('emails.expired-documents', 
                    ['registration' => $registration],
                    function ($message) use ($registration) {
                        $message->to($registration->email)
                                ->subject('Action Required: Vendor Documents Expired');
                    }
                );
                
                $this->info("Marked registration {$registration->id} as Documents Incomplete");
            }
        }
    }
}

// In app/Console/Kernel.php, add to schedule:
protected function schedule(Schedule $schedule)
{
    $schedule->command('documents:mark-expired')->dailyAt('00:00'); // Run daily at midnight
}
```

#### Fix 2: Update Document Download Endpoint

**Backend must check expiry before allowing download**:

```php
// app/Http/Controllers/VendorRegistrationController.php

public function downloadDocument($registrationId, $documentId)
{
    $user = Auth::user();
    $registration = VendorRegistration::findOrFail($registrationId);
    
    // Authorization check
    if (!$this->canAccessVendorRegistration($user, $registration)) {
        return response()->json(['error' => 'Unauthorized'], 403);
    }
    
    // Find document
    $document = VendorRegistrationDocument::where('id', $documentId)
        ->where('vendor_registration_id', $registrationId)
        ->firstOrFail();
    
    // ✅ CHECK IF DOCUMENT IS EXPIRED
    if ($document->expiryDate && Carbon::parse($document->expiryDate)->isPast()) {
        return response()->json([
            'error' => 'Document has expired',
            'message' => "This document expired on " . $document->expiryDate->format('Y-m-d'),
        ], 410); // 410 Gone - Resource no longer available
    }
    
    // ✅ CHECK IF STATUS IS MARKED AS EXPIRED
    if ($document->status === 'Expired') {
        return response()->json([
            'error' => 'Document is marked as expired',
            'message' => 'Please upload a renewed version of this document',
        ], 410);
    }
    
    // Get file from S3
    $filePath = $document->file_path;
    
    try {
        $disk = Storage::disk('s3');
        
        if (!$disk->exists($filePath)) {
            return response()->json(['error' => 'File not found in storage'], 404);
        }
        
        $fileContent = $disk->get($filePath);
        $fileName = $document->file_name || basename($filePath);
        
        return response()->streamDownload(
            fn() => echo $fileContent,
            $fileName,
            [
                'Content-Type' => $disk->mimeType($filePath),
                'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
            ]
        );
    } catch (Exception $e) {
        return response()->json([
            'error' => 'Failed to download document',
            'message' => $e->getMessage()
        ], 500);
    }
}
```

#### Fix 3: Generate Non-Expiring S3 URLs

**Instead of creating signed URLs with TTL, use permanent S3 paths**:

```php
// When storing document:
$document->file_path = "vendors/{$registration->id}/documents/{$document->id}/{$file->getClientOriginalName()}";
Storage::disk('s3')->put($document->file_path, $file->get());

// ❌ DON'T do this (expires):
$temporaryUrl = Storage::disk('s3')->temporaryUrl($filePath, now()->addDay());

// ✅ DO this (permanent):
$permanentUrl = config('filesystems.disks.s3.url') . '/' . $document->file_path;

// OR use S3 API to get non-expiring signed URL:
$s3Client = new S3Client([
    'version' => 'latest',
    'region'  => config('aws.region'),
]);

$cmd = $s3Client->getCommand('GetObject', [
    'Bucket' => config('filesystems.disks.s3.bucket'),
    'Key'    => $filePath
]);

$request = $s3Client->createPresignedRequest($cmd, '+20 minutes'); // Long-lived
$presignedUrl = (string)$request->getUri();
```

#### Fix 4: Add Expiry Warning Endpoint

**Backend provides list of documents about to expire**:

```php
public function getExpiringDocuments(Request $request)
{
    $user = Auth::user();
    
    // Get all vendor registrations accessible to user
    $registrations = $this->getAccessibleRegistrations($user);
    
    $warningDays = $request->query('days', 30);
    $today = Carbon::today();
    $warningDate = $today->clone()->addDays($warningDays);
    
    $expiringDocuments = VendorRegistrationDocument::whereIn(
        'vendor_registration_id',
        $registrations->pluck('id')
    )
    ->where('expiry_date', '<=', $warningDate)
    ->where('expiry_date', '>', $today)
    ->where('status', 'Approved')
    ->with('registration')
    ->get()
    ->map(function ($doc) {
        return [
            'id' => $doc->id,
            'registration_id' => $doc->vendor_registration_id,
            'company_name' => $doc->registration->company_name,
            'document_type' => $doc->type,
            'expiry_date' => $doc->expiry_date,
            'days_until_expiry' => $doc->expiry_date->diffInDays(Carbon::today()),
        ];
    });
    
    return response()->json([
        'success' => true,
        'data' => $expiringDocuments,
    ]);
}

// Route
Route::get('/vendors/documents/expiring', 'VendorRegistrationController@getExpiringDocuments')
    ->middleware('auth:api');
```

---

### DATABASE MIGRATION

**Create migration to ensure expiry_date column exists and add expiry checking**:

```php
// database/migrations/[timestamp]_update_vendor_documents_expiry.php

Schema::table('vendor_registration_documents', function (Blueprint $table) {
    // Add if doesn't exist
    if (!Schema::hasColumn('vendor_registration_documents', 'expiry_date')) {
        $table->dateTime('expiry_date')->nullable()->after('upload_date');
    }
    
    // Add index for quick expiry queries
    if (!Schema::hasIndex('vendor_registration_documents', 'idx_expiry_date')) {
        $table->index('expiry_date');
    }
    
    // Add index on status for filtering
    if (!Schema::hasIndex('vendor_registration_documents', 'idx_status')) {
        $table->index('status');
    }
});

// Run: php artisan migrate
```

---

## IMPLEMENTATION CHECKLIST

### Frontend Changes
- [ ] Add `isDocumentExpired()` helper function
- [ ] Add `isDocumentExpiringsooon()` helper function  
- [ ] Add `getDaysUntilExpiry()` helper function
- [ ] Add `getExpiryStatusColor()` helper function
- [ ] Add `getExpiryStatusLabel()` helper function
- [ ] Update `handleDownloadDocument()` to check expiry
- [ ] Update document display to show expiry status
- [ ] Add expired/expiring warning banners
- [ ] Disable download button for expired documents
- [ ] Add visual indicators (color coding, icons)

### Backend Changes
- [ ] Create `UpdateExpiredDocuments` scheduled command
- [ ] Update `downloadDocument()` endpoint with expiry check
- [ ] Generate permanent S3 URLs instead of signed URLs with TTL
- [ ] Add `getExpiringDocuments()` endpoint
- [ ] Create database migration for indexes
- [ ] Deploy scheduled job
- [ ] Set up automated email reminders

### Database Updates
- [ ] Verify `expiry_date` column exists
- [ ] Add indexes for performance
- [ ] Update existing 'Approved' documents that are actually expired to 'Expired' status

---

## TESTING VERIFICATION

### Test 1: Expired Document Download Prevention
```bash
# Create a test document with past expiry date
curl -X POST http://localhost:8000/api/vendors/registrations/1/documents \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@test.pdf" \
  -F "type=TIN" \
  -F "expiry_date=2020-01-01"

# Try to download
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/api/vendors/registrations/1/documents/DOC-ID/download

# Expected: 410 Gone status with message about expiry
```

### Test 2: Frontend Expiry Display
1. Login to Dashboard
2. Go to Vendor Management → Vendor Registration
3. Scroll to Documents section
4. Verify:
   - ✅ Expired documents show red "EXPIRED - Cannot download"
   - ✅ Expiring soon (30 days) show orange warning
   - ✅ Download button disabled for expired documents
   - ✅ Banner warning appears for expired/expiring docs

### Test 3: Automatic Status Update
```bash
# Run schedule
php artisan schedule:work  # Development
# Production: cron job runs daily at midnight

# Check database
SELECT * FROM vendor_registration_documents WHERE expiry_date < NOW() AND status = 'Expired';

# Expected: All past-expiry documents marked 'Expired'
```

### Test 4: Warning Endpoint
```bash
curl -H "Authorization: Bearer TOKEN" \
  'http://localhost:8000/api/vendors/documents/expiring?days=30'

# Expected: JSON with documents expiring within 30 days

{
  "success": true,
  "data": [
    {
      "id": "doc-123",
      "company_name": "Acme Corp",
      "document_type": "NUPRC_DPR",
      "expiry_date": "2026-04-15",
      "days_until_expiry": 15
    }
  ]
}
```

---

## USER EXPERIENCE IMPROVEMENTS

### Pre-Expiry Warnings

**Email notification** (sent 30 days before expiry):
```
Subject: Document Renewal Required - NUPRC_DPR expires in 30 days

Dear Vendor,

Your NUPRC_DPR document will expire on April 31, 2026.

Please renew and upload the new version as soon as possible.
Accessing this document after expiry will not be allowed.

Log in: https://yourplatform.com/vendors/profile
Upload documents: https://yourplatform.com/vendors/profile/documents

---
Emerald Supply Chain
```

**In-App Dashboard Alert**:
```
⚠️  ACTION REQUIRED
Your NUPRC_DPR document will expire in 30 days.
Upload renewal: Click here
```

### Post-Expiry Status

**When document expires**:
- ❌ Status changed to 'Expired'
- 🔴 Color: Red indicator
- 📝 Message: "This document expired on [date]. Please upload a renewed version."
- 🚫 Download disabled
- 📧 Email sent: "Your document has expired and needs renewal"

---

## DEPLOYMENT PROCEDURE

1. **Backup Database**
   ```bash
   mysqldump -u user -p database > backup.sql
   ```

2. **Deploy Backend Changes**
   ```bash
   git pull origin main
   php artisan migrate
   php artisan optimize
   ```

3. **Deploy Frontend Changes**
   - Update VendorRegistrationReview.tsx with new functions
   - Test in development environment
   - Build and deploy

4. **Activate Scheduled Job**
   ```bash
   # Add to crontab (Linux)
   0 0 * * * cd /path/to/app && php artisan schedule:run >> /dev/null 2>&1
   ```

5. **Monitor**
   - Check backend logs for scheduled job execution
   - Verify documents marked as expired after date passes
   - Monitor email delivery for expiry warnings

---

## QUICK REFERENCE

### Document Expiry Dates
| Document | Expires | Renewal |
|----------|---------|---------|
| NUPRC_DPR | Annually | Required |
| PENCOM | Dec 31 | Required |
| ITF | Dec 31 | Required |
| NSITF | Dec 31 | Required |
| OEM_CERTIFICATE | Annually | Required |
| OEM_AUTHORIZATION | Annually | Required |
| CAC | Never | Not required |
| TIN | Never | Not required |
| HSE_CERTIFICATE | Never | Not required |
| Others | As needed | As needed |

---

*This document provides complete guide to fix vendor document expiry issues across frontend, backend, and database.*

