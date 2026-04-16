

# Implementation Plan — S3 URL Expiry on Vendor Registration Documents

## File: `src/pages/VendorRegistrationReview.tsx`

### Change 1 — Add utility functions (after line 284)

Three local functions inserted after the existing expiry helpers:

**`parseS3UrlExpiry(url: string): Date | null`** — Extracts `X-Amz-Date` and `X-Amz-Expires` from S3 signed URL query params, computes and returns the expiry `Date`. Returns `null` if params missing or URL is invalid.

**`getS3UrlExpiryStatus(url: string)`** — Calls `parseS3UrlExpiry`, returns `{ label, color, expiryDate }`:
- `hoursLeft <= 0` → `{ label: 'Expired', color: 'destructive' }`
- `hoursLeft <= 24` → `{ label: 'Expiring Soon', color: 'warning' }`
- Otherwise → `{ label: 'Active', color: 'default' }`
- Returns `null` if no S3 params

**`formatExpiryDate(date: Date): string`** — Returns e.g. `"Apr 17, 2026 at 5:00 AM"`

### Change 2 — Update document row rendering (lines 615-633)

Inside the `doc.expiryDate` conditional block (line 620), add a fallback: when `doc.expiryDate` is absent, resolve the S3 URL from `doc.file_share_url || doc.fileShareUrl || doc.file_url || doc.fileUrl`, call `getS3UrlExpiryStatus`, and render:

1. A `Badge` with the status label and appropriate variant color
2. Text: `"Expires: Apr 17, 2026 at 5:00 AM"`

The existing `doc.expiryDate` logic remains the primary path — the S3 URL parsing is the fallback when no explicit expiry field exists.

### Change 3 — Dev-only diagnostic log (inside the document map)

```ts
if (import.meta.env.DEV) {
  console.log('[VendorRegistrationReview] Sample doc URL:', resolvedUrl);
}
```

Only logs the first document URL, once.

### No other changes

No new files, no new libraries, no changes to upload flow or OneDriveLink component.

