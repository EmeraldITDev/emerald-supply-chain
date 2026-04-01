# CORS Fix for MRF API - Backend Configuration

## Problem
The frontend is getting CORS errors when trying to create MRFs:
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://supply-chain-backend-hwh6.onrender.com/api/mrfs. (Reason: CORS header 'Access-Control-Allow-Origin' missing). Status code: 500.
```

## Root Cause
The backend server is not configured to allow cross-origin requests from the frontend domain.

## Backend Fixes Required

### For Express.js/Node.js Backend

Add this CORS configuration to your `server.js` or main app file:

```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// CORS Configuration - BEFORE other middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:5173',        // Local development (Vite default)
      'http://localhost:3000',        // Alternative local port
      'https://emerald-supply-chain.vercel.app',  // Production frontend
      'https://your-frontend-domain.com',          // Add your actual domain
      'https://supply-chain-frontend.onrender.com' // If using Render for frontend
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,  // Allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Your other middleware...
app.use(express.json());
```

### For Laravel/PHP Backend

Update `config/cors.php`:

```php
<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://emerald-supply-chain.vercel.app',
        'https://your-frontend-domain.com'
    ],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
```

### For Django/Python Backend

Update your `settings.py`:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://emerald-supply-chain.vercel.app",
    "https://your-frontend-domain.com",
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_HEADERS = [
    'content-type',
    'authorization',
    'x-requested-with',
    'accept',
    'origin',
]

# If using django-cors-headers
INSTALLED_APPS = [
    # ... other apps
    'corsheaders',
]

MIDDLEWARE = [
    # ... other middleware
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
]
```

## Quick Test After Backend Fix

After updating your backend CORS configuration:

1. **Redeploy** your backend to Render
2. **Test the API** directly:
   ```bash
   curl -X OPTIONS -H "Origin: http://localhost:5173" \
        -H "Access-Control-Request-Method: POST" \
        -v https://supply-chain-backend-hwh6.onrender.com/api/mrfs
   ```

3. **Check for CORS headers** in the response:
   ```
   Access-Control-Allow-Origin: http://localhost:5173
   Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
   Access-Control-Allow-Credentials: true
   ```

## Temporary Workaround (For Development Only)

If you need to test immediately, you can temporarily disable CORS checks in your browser:

**Chrome/Edge:**
1. Open DevTools (F12)
2. Go to Network tab
3. Right-click any request
4. Select "Disable cross-origin restrictions"

**Firefox:**
1. Type `about:config` in address bar
2. Search for `security.fileuri.strict_origin_policy`
3. Set to `false`

**⚠️ WARNING:** This is only for local testing. Never disable CORS in production.

## Verify the Fix

After implementing the backend CORS fix:

1. **Check browser console** - CORS errors should disappear
2. **Check network tab** - Requests should show 200/201 status instead of CORS errors
3. **Test MRF creation** - Should work without network errors

## Additional Backend Issues

The 500 status code suggests there may also be server-side errors. After fixing CORS, check your backend logs for:

1. **Database connection issues**
2. **Missing environment variables**
3. **Validation errors in MRF creation**
4. **File upload handling issues**

## Environment Variables to Check

Make sure your Render backend has these environment variables:

```bash
# Database
DATABASE_URL=your_database_url

# JWT/Auth
JWT_SECRET=your_jwt_secret

# CORS (if needed)
FRONTEND_URL=https://emerald-supply-chain.vercel.app

# AWS S3 (if using file uploads)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=your_bucket_name
```

## Next Steps

1. **Update backend CORS configuration**
2. **Redeploy to Render**
3. **Test MRF creation**
4. **Check backend logs** for any remaining 500 errors
5. **Update allowed origins** with your production domain when ready