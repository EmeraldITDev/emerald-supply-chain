# PO Generation Troubleshooting Guide

## What I Fixed

### 1. **Added Loading State to Generate PO Button**
- Button now shows "Generating..." with spinner while processing
- Button is disabled during submission
- Form only resets on successful submission

### 2. **Enhanced Error Logging**
The system now logs detailed information at each step:
- Form validation before submission
- File details (name, size, type)
- Server response details
- Network errors

### 3. **Better Error Handling**
- File size validation (max 10MB)
- File type validation (.pdf, .doc, .docx)
- Detailed error messages from backend
- Network error detection

## How to Diagnose the Issue

### Step 1: Open Browser Console
1. Press `F12` or right-click → Inspect
2. Click the **Console** tab
3. Keep it open while testing

### Step 2: Try to Generate PO
1. Go to **Procurement Dashboard**
2. Find an MRF with status "Awaiting PO Generation"
3. Click **"Generate PO"**
4. Fill in ALL required fields:
   - ✅ Select a Vendor
   - ✅ Upload PO Document (.pdf, .doc, or .docx)
   - ✅ Enter Amount
   - ✅ Select Delivery Date
   - ✅ Select Payment Terms
5. Click **"Generate PO"**

### Step 3: Check Console Logs
You should see logs like:
```
PO Generation: Submitting { vendor, mrfId, amount, ... }
Sending PO generation request: { mrfId, poNumber, fileName, fileSize }
```

### Step 4: Share the Error
Copy ALL console messages (especially red errors) and send them to me.

## Common Issues & Solutions

### Issue 1: "No active vendors found"
**Cause:** No vendors with "Active" status in the system
**Solution:** 
- Go to Vendors page
- Approve at least one vendor registration
- Verify vendor status is "Active"

### Issue 2: "File size exceeds maximum"
**Cause:** PO document is larger than 10MB
**Solution:** Compress or split the PDF file

### Issue 3: "Invalid file type"
**Cause:** Uploaded file is not .pdf, .doc, or .docx
**Solution:** Convert file to an accepted format

### Issue 4: "Failed to generate PO (Status: 500)"
**Cause:** Backend server error
**Solution:** Check backend logs at:
```bash
cd "/Users/asukuonukaba/Desktop/SCM Backend/supply-chain-backend"
php artisan tail
```

### Issue 5: "Network error - unable to reach server"
**Cause:** Backend server not running or unreachable
**Solution:** 
- Verify backend is running
- Check CORS configuration
- Verify API_BASE_URL in frontend .env

### Issue 6: CORS Policy Error
**Cause:** Frontend domain not allowed by backend
**Solution:** Update backend `.env`:
```env
FRONTEND_URL=https://emerald-supply-chain.vercel.app
```
Then restart backend.

## What to Share with Me

When reporting the error, please provide:

1. **Console Logs** (all red errors)
2. **Toast Error Message** (what you see on screen)
3. **Network Tab**:
   - Click "Network" tab in browser console
   - Try PO generation again
   - Click the failed request (usually red)
   - Share the "Response" tab content

## Expected Behavior

**Successful PO Generation:**
```
1. Click "Generate PO"
2. Button shows "Generating..." with spinner
3. After 1-3 seconds: Success toast appears
4. Dialog closes
5. MRF status updates to "Awaiting Signed PO"
```

## Backend Checklist

If the issue persists, verify backend:

```bash
# Navigate to backend
cd "/Users/asukuonukaba/Desktop/SCM Backend/supply-chain-backend"

# Check if server is running
ps aux | grep "php.*artisan.*serve"

# Check storage permissions
php artisan storage:link
chmod -R 775 storage
chmod -R 775 bootstrap/cache

# Check .env configuration
cat .env | grep -E "DOCUMENTS_DISK|FILESYSTEM_DISK|APP_URL|FRONTEND_URL"

# View recent logs
tail -f storage/logs/laravel.log

# Clear caches
php artisan config:clear
php artisan cache:clear
php artisan route:clear
```
