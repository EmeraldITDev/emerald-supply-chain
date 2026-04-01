# MRF Creation Network Error - Troubleshooting Guide

## Error: "NetworkError when attempting to fetch resource"

This error occurs when the frontend cannot connect to the backend API server.

## Quick Diagnosis Steps

### 1. Check Backend Server Status
Visit these URLs in your browser to verify the backend is running:

- **API Base URL**: https://supply-chain-backend-hwh6.onrender.com/api
- **Health Check**: https://supply-chain-backend-hwh6.onrender.com/api/health (if available)

**Expected Response**: JSON data or 401 Unauthorized (not HTML error page)

### 2. Check Browser Console
1. Open Developer Tools (F12)
2. Go to Console tab
3. Try creating an MRF
4. Look for these error patterns:

**Network Error (Most Common):**
```
TypeError: NetworkError when attempting to fetch resource
Failed to fetch
```

**CORS Error:**
```
Access to fetch at 'https://supply-chain-backend-hwh6.onrender.com/api/mrfs'
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Server Down:**
```
GET https://supply-chain-backend-hwh6.onrender.com/api/mrfs net::ERR_CONNECTION_REFUSED
```

### 3. Test API Connectivity
Run this JavaScript in your browser console:

```javascript
// Test basic connectivity
fetch('https://supply-chain-backend-hwh6.onrender.com/api')
  .then(r => console.log('✅ API reachable:', r.status))
  .catch(e => console.error('❌ API unreachable:', e));

// Test MRF endpoint (should return 401 without auth)
fetch('https://supply-chain-backend-hwh6.onrender.com/api/mrfs')
  .then(r => console.log('✅ MRF endpoint:', r.status))
  .catch(e => console.error('❌ MRF endpoint unreachable:', e));
```

## Common Solutions

### Solution 1: Backend Server Issues
**Problem**: Render service is asleep, crashed, or has deployment issues

**Fix**:
1. Go to your Render dashboard: https://dashboard.render.com
2. Find your `supply-chain-backend-hwh6` service
3. Check service status (should be "Live")
4. If "Suspended", click "Resume"
5. If "Failed", check logs and redeploy
6. If no recent deployments, redeploy the service

### Solution 2: CORS Configuration
**Problem**: Backend doesn't allow requests from your frontend domain

**Backend Fix** (in your server code):
```javascript
// Express.js example
app.use(cors({
  origin: [
    'http://localhost:5173',           // Local development
    'https://your-frontend-domain.com' // Production
  ],
  credentials: true
}));
```

### Solution 3: Environment Variables
**Problem**: Wrong API URL configured

**Check**: Your `.env` file should have:
```
VITE_API_BASE_URL=https://supply-chain-backend-hwh6.onrender.com
```

### Solution 4: Network Issues
**Problem**: Firewall, VPN, or ISP blocking the connection

**Fix**:
1. Try from a different network
2. Disable VPN temporarily
3. Check firewall settings
4. Try incognito/private browsing mode

### Solution 5: Rate Limiting
**Problem**: Render free tier sleeping after inactivity

**Fix**: Access the API URL directly first to wake up the service, then try MRF creation.

## Debug Information Added

The frontend now includes enhanced logging. When you try to create an MRF:

1. **Console Logs**: Check browser console for detailed payload and API URL information
2. **Better Error Messages**: Network errors now show specific error types
3. **Debug Data**: Full request/response details logged for troubleshooting

## Emergency Fallback

If the backend is completely down, you can temporarily use a local backend:

1. Set in `.env`:
```
VITE_API_BASE_URL=http://localhost:3000
```

2. Start your local backend server on port 3000
3. Test MRF creation locally

## Next Steps

1. **Check Render Dashboard** - Verify backend service status
2. **Run Console Tests** - Use the JavaScript snippets above
3. **Check Logs** - Review Render service logs for errors
4. **Contact Support** - If it's a Render platform issue

The enhanced error handling will now provide more specific error messages to help identify the root cause.