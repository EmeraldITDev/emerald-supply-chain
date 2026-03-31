# VENDOR DOCUMENT EXPIRY - QUICK SUMMARY

**Issue**: Vendor registration documents cannot be viewed/downloaded after their expiry date  
**Root Cause**: Multiple layers - AWS S3 URL expiry, no frontend expiry checks, no backend expiry validation  
**Priority**: HIGH - Vendors can't access their critical compliance documents  

---

## The Problem (30-Second Version)

```
Timeline:
Day 1: Vendor uploads NUPRC_DPR certificate (expires 2027-03-31)
Day 365: System still serves the document ✅
Day 730: Document actually expires (2027-03-31 reached) ❌
Day 731+: User tries to download → 404 Error or permission denied
         BUT frontend shows no warning, no error message
```

**Why this happens**:
1. AWS S3 signed URLs expire after 7-24 hours
2. Database `status` field not automatically changed to 'Expired'
3. Frontend doesn't check `expiryDate` before allowing download
4. No warnings or renewal reminders

---

## What You Get

### 📄 3 New Documents Created

1. **[VENDOR_DOCUMENT_EXPIRY_FIX_GUIDE.md](VENDOR_DOCUMENT_EXPIRY_FIX_GUIDE.md)** (Complete guide)
   - Full problem analysis
   - Frontend implementation steps
   - Backend implementation steps
   - Database migration scripts
   - Testing checklist

2. **[VENDOR_DOCUMENT_EXPIRY_FRONTEND_CODE.tsx](VENDOR_DOCUMENT_EXPIRY_FRONTEND_CODE.tsx)** (Ready-to-use code)
   - Copy-paste helper functions
   - Ready-to-use download handler
   - Document rendering with expiry display
   - Just replace sections in VendorRegistrationReview.tsx

3. **This summary** (Quick reference)

---

## Quick Implementation Path

### Phase 1: Frontend Fix (30 minutes) ✅ IMMEDIATE
```
1. Open: src/pages/VendorRegistrationReview.tsx
2. Add helper functions:
   - isDocumentExpired()
   - isDocumentExpiringsooon()
   - getDaysUntilExpiry()
   - getExpiryStatusColor()
   - getExpiryStatusLabel()
3. Update: handleDownloadDocument() to check expiry
4. Update: Document rendering to show expiry status
5. Test in browser
```

**Copy code from**: [VENDOR_DOCUMENT_EXPIRY_FRONTEND_CODE.tsx](VENDOR_DOCUMENT_EXPIRY_FRONTEND_CODE.tsx)

### Phase 2: Backend Fix (2-3 hours) 🔧 REQUIRED
```
1. Backend endpoint must check expiry before allowing download
   - Return 410 Gone if document expired
   - Check both expiryDate field and 'Expired' status

2. Create scheduled job to auto-mark expired documents
   - Runs daily at midnight
   - Updates status from 'Approved' to 'Expired'
   - Notifies vendors of expiry

3. Use permanent S3 URLs instead of signed URLs with TTL
   - No more 404 errors due to URL expiry
   - Documents viewable for their entire validity period
```

**Implementation in**: [VENDOR_DOCUMENT_EXPIRY_FIX_GUIDE.md](VENDOR_DOCUMENT_EXPIRY_FIX_GUIDE.md) → Backend Fixes section

### Phase 3: Database Updates (30 minutes) 📊 REQUIRED
```
1. Add/verify expiry_date column in vendor_registration_documents
2. Add indexes for performance
3. Update existing expired documents to status = 'Expired'
```

---

## Before & After Comparison

### Before (Current)
```
User views vendor registration with expired NUPRC_DPR:
- Document list shows: "NUPRC_DPR | document.pdf" (no expiry info)
- User clicks Download
- 404 Error or permission denied
- User confused: "Why can't I download this?"
```

### After (With Fix)
```
User views vendor registration with expired NUPRC_DPR:
- Document list shows: "NUPRC_DPR ⏸️ EXPIRED - Cannot download"
- Red highlight/warning banner below
- Download button disabled, greyed out
- Message: "This document expired on 2027-03-31. Please upload a renewed version."
- User knows exactly what to do: Upload new version
```

---

## Key Features Added

### 🟢 Expired Document Detection
- ✅ Frontend checks expiry date on download
- ✅ Download blocked if expired
- ✅ Backend validates expiry before serving file
- ✅ Returns 410 Gone if expired

### 🟡 Warning System
- ✅ Expiring soon (30 days) shows orange warning
- ✅ Days until expiry displayed
- ✅ Visual indicators (colors, icons, badges)
- ✅ Warning banner for vendors

### 🔴 Status Management
- ✅ Automatic daily update of expired documents to 'Expired' status
- ✅ Vendors notified of expiry via email
- ✅ Vendor registration marked 'Documents Incomplete' when required docs expire
- ✅ Clear renewal prompts

### 🔗 Document Access
- ✅ Permanent S3 URLs (not expiring signed URLs)
- ✅ Multiple download methods (direct/API/OneDrive)
- ✅ Fallback if one method fails
- ✅ Logging for troubleshooting

---

## Document Expiry Schedule

| Document | Expires | Frequency | Action |
|----------|---------|-----------|--------|
| NUPRC_DPR | Annually | Yearly renewal | Required |
| PENCOM | Dec 31 | Yearly | Required |
| ITF | Dec 31 | Yearly | Required |
| NSITF | Dec 31 | Yearly | Required |
| OEM_CERTIFICATE | Annually | Yearly | Required |
| OEM_AUTHORIZATION | Annually | Yearly | Required |
| CAC | Never | N/A | Not required |
| TIN | Never | N/A | Not required |
| HSE_CERTIFICATE | Never | N/A | Not required |

---

## Testing Quick Checklist

```
Frontend:
☐ Login to Dashboard
☐ View Vendor Registration
☐ See document with past expiry date
☐ Verify document shows "EXPIRED - Cannot download"
☐ Verify Download button is disabled
☐ Verify warning banner appears
☐ See document with expiry <30 days
☐ Verify document shows orange warning
☐ Verify days until expiry displayed
☐ Click Download on expired document
☐ Verify toast error message "Document Expired..."

Backend:
☐ Test endpoint with past expiry date
☐ Verify returns 410 status code
☐ Run scheduled job manually
☐ Verify status changed to 'Expired'
☐ Verify email sent to vendor
☐ Test export with permanent S3 URL
☐ Check logs for errors
```

---

## Deployment Steps

### Step 1: Frontend (No downtime)
```bash
# 1. Update VendorRegistrationReview.tsx
# 2. Test in development
# 3. Deploy
# 4. Verify displays correctly
```

### Step 2: Database (Minimal downtime)
```bash
# Run migrations
php artisan migrate

# Update existing expired documents
UPDATE vendor_registration_documents 
SET status = 'Expired' 
WHERE expiry_date < NOW() AND status != 'Expired';

# Verify
SELECT COUNT(*) FROM vendor_registration_documents WHERE status = 'Expired';
```

### Step 3: Backend (May require restart)
```bash
# 1. Deploy code changes
# 2. Clear cache
php artisan cache:clear
php artisan config:clear

# 3. Restart PHP
sudo systemctl restart php-fpm

# 4. Activate scheduled job
# Add to crontab: 0 0 * * * cd /path/to/app && php artisan schedule:run >> /dev/null 2>&1

# 5. Verify
php artisan schedule:work  # Development/testing
```

---

## File Reference Guide

| File | Purpose | Status |
|------|---------|--------|
| [VENDOR_DOCUMENT_EXPIRY_FIX_GUIDE.md](VENDOR_DOCUMENT_EXPIRY_FIX_GUIDE.md) | Complete technical guide | ✅ Ready |
| [VENDOR_DOCUMENT_EXPIRY_FRONTEND_CODE.tsx](VENDOR_DOCUMENT_EXPIRY_FRONTEND_CODE.tsx) | Copy-paste frontend code | ✅ Ready |
| src/pages/VendorRegistrationReview.tsx | File to update | 🔧 To Update |
| Backend Controller | File to update | 🔧 To Update |
| Database Migration | File to create | 🔧 To Create |
| Scheduled Job | File to create | 🔧 To Create |

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Document still downloadable after expiry | DB status not updated | Run scheduled job: `php artisan documents:mark-expired` |
| Frontend shows no expiry warning | Code not updated | Use code from VENDOR_DOCUMENT_EXPIRY_FRONTEND_CODE.tsx |
| 404 on download of valid document | S3 URL expired (signed URL TTL) | Use permanent S3 URLs instead of signed URLs |
| Error message not shown to user | Backend not validating expiry | Check backend endpoint implementation in guide |
| Email not sent on expiry | Scheduled job not running | Verify crontab setup |

---

## Next Steps

1. **Read the Full Guide**
   → [VENDOR_DOCUMENT_EXPIRY_FIX_GUIDE.md](VENDOR_DOCUMENT_EXPIRY_FIX_GUIDE.md)

2. **Get Ready-to-Use Code**
   → [VENDOR_DOCUMENT_EXPIRY_FRONTEND_CODE.tsx](VENDOR_DOCUMENT_EXPIRY_FRONTEND_CODE.tsx)

3. **Frontend Dev**: Implement frontend fix (30 min)
   - Update VendorRegistrationReview.tsx
   - Test in browser
   - Deploy

4. **Backend Dev**: Implement backend fix (2-3 hours)
   - Update download endpoint
   - Create scheduled job
   - Use permanent S3 URLs
   - Test thoroughly

5. **Database Admin**: Run migrations
   - Create indexes
   - Update expired documents
   - Verify

6. **DevOps**: Activate scheduler
   - Add to crontab
   - Monitor logs
   - Test scheduled job

---

## Summary

**Timeline to Fix**:
- Frontend: 30 min
- Backend: 2-3 hours  
- Database: 30 min
- Testing: 1 hour
- **Total: ~4 hours**

**Impact**:
- ✅ Users won't get 404 errors on expired documents
- ✅ Clear warnings before expiry
- ✅ Automatic status updates
- ✅ Vendor renewal reminders
- ✅ Better user experience

**Resources**:
- 📄 Complete guide: VENDOR_DOCUMENT_EXPIRY_FIX_GUIDE.md
- 💻 Ready code: VENDOR_DOCUMENT_EXPIRY_FRONTEND_CODE.tsx
- 📋 This summary: VENDOR_DOCUMENT_EXPIRY_QUICK_SUMMARY.md

---

Start with the **Full Guide** → Then use **Frontend Code** → Then implement **Backend Changes**

