# MRF Document Storage Guide - AWS S3 Integration

## Overview
This document explains how document storage works for the Material Request Form (MRF) process, with a focus on AWS S3 integration for secure, scalable document management.

## AWS S3 Configuration

### 1. AWS Account Setup
- **Region**: Choose a region close to your users (e.g., `us-east-1`, `eu-west-1`)
- **S3 Bucket**: Create a dedicated bucket for MRF documents
  - Bucket name: `your-app-mrf-documents` (must be globally unique)
  - Enable versioning for document history
  - Enable server-side encryption (SSE-S3)

### 2. IAM Permissions
Create an IAM user or role with the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-app-mrf-documents",
        "arn:aws:s3:::your-app-mrf-documents/*"
      ]
    }
  ]
}
```

### 3. Access Credentials
- **Access Key ID**: Store securely (not in code)
- **Secret Access Key**: Store securely (not in code)
- Use AWS IAM roles for EC2/ECS deployments
- Use AWS Secrets Manager or Parameter Store for key management

## Backend Configuration (Render)

### 1. Environment Variables
Add these environment variables to your Render service:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-app-mrf-documents

# Optional: Custom S3 endpoint (for non-AWS S3-compatible services)
AWS_S3_ENDPOINT=https://s3.amazonaws.com

# File upload settings
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_FILE_TYPES=pdf,doc,docx,xlsx,xls,jpg,jpeg,png
```

### 2. Backend Dependencies
Ensure your backend has the AWS SDK installed:

**Node.js/Express:**
```bash
npm install aws-sdk multer multer-s3
```

**Python/Django:**
```bash
pip install boto3 django-storages
```

**PHP/Laravel:**
```bash
composer require league/flysystem-aws-s3-v3
```

### 3. Backend Implementation

#### File Upload Handler
```javascript
// Node.js example
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      // Generate unique filename with MRF ID
      const mrfId = req.params.mrfId;
      const timestamp = Date.now();
      const extension = file.originalname.split('.').pop();
      const filename = `mrf-${mrfId}/${timestamp}-${file.fieldname}.${extension}`;
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES.split(',');
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});
```

#### File Download Handler
```javascript
// Generate pre-signed URL for secure downloads
app.get('/mrfs/:mrfId/documents/:documentId/download', async (req, res) => {
  try {
    const { mrfId, documentId } = req.params;

    // Verify user has access to this MRF
    const mrf = await MRF.findById(mrfId);
    if (!mrf) {
      return res.status(404).json({ error: 'MRF not found' });
    }

    // Check user permissions
    if (!await checkUserAccess(req.user, mrf)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get document metadata from database
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Generate pre-signed URL (expires in 1 hour)
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: document.s3Key,
      Expires: 3600 // 1 hour
    };

    const url = s3.getSignedUrl('getObject', params);
    res.json({ downloadUrl: url });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to generate download link' });
  }
});
```

## Document Storage Structure

### S3 Bucket Organization
```
your-app-mrf-documents/
├── mrf-{mrfId}/
│   ├── pfi-{timestamp}.pdf                    # Pro Forma Invoice
│   ├── quotation-vendor-{vendorId}-{timestamp}.pdf
│   ├── po-unsigned-{timestamp}.pdf           # Purchase Order (unsigned)
│   ├── po-signed-{timestamp}.pdf             # Purchase Order (signed)
│   ├── grn-{timestamp}.pdf                   # Goods Received Note
│   └── supporting-docs-{timestamp}.{ext}    # Additional documents
└── temp/                                     # Temporary uploads (cleanup after processing)
```

### Database Schema
Store document metadata in your database:

```sql
CREATE TABLE mrf_documents (
  id VARCHAR(255) PRIMARY KEY,
  mrf_id VARCHAR(255) NOT NULL,
  document_type ENUM('pfi', 'quotation', 'po_unsigned', 'po_signed', 'grn', 'supporting'),
  original_filename VARCHAR(255) NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  s3_bucket VARCHAR(255) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_by VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,  -- For documents with expiry dates
  is_deleted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (mrf_id) REFERENCES mrfs(id)
);
```

## Security Considerations

### 1. Access Control
- **Pre-signed URLs**: Use for temporary access (1-24 hours)
- **User Permissions**: Verify user access to MRF before allowing downloads
- **Document Expiry**: Implement expiry for sensitive documents

### 2. Data Protection
- **Encryption**: Enable SSE-S3 for server-side encryption
- **HTTPS Only**: Force SSL/TLS for all S3 operations
- **Access Logging**: Enable S3 access logging for audit trails

### 3. File Validation
- **Size Limits**: Enforce maximum file sizes (e.g., 10MB)
- **Type Validation**: Only allow specific file types
- **Virus Scanning**: Consider integrating virus scanning for uploads

## Implementation Steps

### 1. AWS Setup
1. Create S3 bucket with proper permissions
2. Generate IAM credentials
3. Configure CORS for web uploads (if needed)

### 2. Backend Updates
1. Install AWS SDK dependencies
2. Add environment variables
3. Implement upload/download handlers
4. Update database schema for document metadata

### 3. Frontend Integration
1. Update file upload components to use new endpoints
2. Handle pre-signed URLs for downloads
3. Add loading states and error handling

### 4. Testing
1. Test file uploads with various file types
2. Test downloads with permission checks
3. Test file expiry and cleanup
4. Test error scenarios (invalid files, network issues)

## Monitoring & Maintenance

### 1. Cost Monitoring
- Monitor S3 storage costs
- Set up billing alerts
- Implement lifecycle policies for old documents

### 2. Performance
- Use CloudFront CDN for frequently accessed documents
- Implement caching strategies
- Monitor download/upload speeds

### 3. Backup & Recovery
- Enable S3 versioning for document history
- Set up cross-region replication for critical documents
- Regular backup verification

## Troubleshooting

### Common Issues
1. **Access Denied**: Check IAM permissions and bucket policies
2. **File Not Found**: Verify S3 key paths and bucket names
3. **Upload Fails**: Check file size limits and CORS configuration
4. **Download Expires**: Ensure pre-signed URLs are generated correctly

### Debug Steps
1. Check AWS CloudWatch logs for S3 operations
2. Verify environment variables are set correctly
3. Test S3 connectivity from backend
4. Validate file paths and permissions

## Migration from Local Storage

If migrating from local file storage:

1. **Upload Existing Files**: Script to upload local files to S3
2. **Update Database**: Update file paths to S3 URLs/keys
3. **Update Code**: Replace local file operations with S3 operations
4. **Test Thoroughly**: Ensure all file operations work with S3
5. **Cleanup**: Remove local files after successful migration

This guide provides a complete foundation for implementing secure, scalable document storage for your MRF process using AWS S3.