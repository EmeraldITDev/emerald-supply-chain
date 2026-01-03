# Render Deployment Guide - Supply Chain App

## Overview

This document outlines the environment variables and configuration needed to deploy the Supply Chain Management (SCM) application on Render, using the same PostgreSQL database as the HRIS application.

## Architecture

- **Frontend**: React/TypeScript (Vite) - Currently on Vercel
- **Backend**: To be created (Laravel or Node.js) - Deploy on Render
- **Database**: Shared PostgreSQL database (same as HRIS)

---

## Backend Service Configuration (Render)

### Required Environment Variables

#### Database Connection (Same as HRIS)
```env
DB_CONNECTION=pgsql
DB_HOST=<your-postgres-host.onrender.com>
DB_PORT=5432
DB_DATABASE=<your-database-name>
DB_USERNAME=<your-db-username>
DB_PASSWORD=<your-db-password>
```

**Note**: Copy these exact values from your HRIS backend service on Render.

#### Application Configuration
```env
APP_ENV=production
APP_DEBUG=false
APP_KEY=<generate-new-app-key>
APP_URL=https://supply-chain-backend.onrender.com
APP_NAME="Supply Chain Management"
APP_TIMEZONE=UTC
```

#### Authentication (JWT)
```env
JWT_SECRET=<generate-strong-random-secret>
JWT_TTL=60
JWT_REFRESH_TTL=20160
```

#### CORS Configuration
```env
FRONTEND_URL=https://emerald-supply-chain.vercel.app
CORS_ALLOWED_ORIGINS=https://emerald-supply-chain.vercel.app,https://supply-chain-frontend.onrender.com
```

#### Session & Cache
```env
SESSION_DRIVER=database
SESSION_LIFETIME=120
CACHE_DRIVER=database
QUEUE_CONNECTION=database
```

---

## Frontend Configuration (If Deploying on Render)

If you choose to deploy the frontend on Render instead of Vercel:

### Environment Variables
```env
VITE_API_BASE_URL=https://supply-chain-backend.onrender.com/api
VITE_ENV=production
```

### Build Settings
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **Node Version**: `18.x` or `20.x`

---

## Render Service Setup Steps

### 1. Create Backend Web Service

1. Go to Render Dashboard → New → Web Service
2. Connect your GitHub repository
3. Select the repository: `emerald-supply-chain`
4. Configure:
   - **Name**: `supply-chain-backend`
   - **Environment**: `PHP` (if Laravel) or `Node` (if Node.js)
   - **Build Command**: 
     - Laravel: `composer install --no-dev --optimize-autoloader && php artisan migrate --force`
     - Node.js: `npm install && npm run build`
   - **Start Command**:
     - Laravel: `php artisan serve --host=0.0.0.0 --port=$PORT`
     - Node.js: `node server.js` or `npm start`

### 2. Add Environment Variables

In Render Dashboard → Your Service → Environment:
- Add all variables from the "Backend Service Configuration" section above
- Copy database credentials from your HRIS backend service

### 3. Create Database (If Not Using Existing)

If you want a separate database:
1. New → PostgreSQL
2. Copy connection details
3. Update environment variables

**OR** use the same database as HRIS (recommended):
- Copy DB credentials from HRIS backend service

### 4. Update Frontend API URL

If frontend is on Vercel:
- Add environment variable in Vercel Dashboard:
  ```
  VITE_API_BASE_URL=https://supply-chain-backend.onrender.com/api
  ```

If frontend is on Render:
- Add environment variables in Render Dashboard (see Frontend Configuration above)

---

## Database Schema Requirements

The backend needs to create tables for:

- `users` (authentication)
- `mrfs` (Material Requisition Forms)
- `srfs` (Service Requisition Forms)
- `rfqs` (Request for Quotations)
- `quotations`
- `vendors`
- `vendor_registrations`
- `purchase_orders`
- `grns` (Goods Receipt Notes)
- `inventory_items`
- `accounts_payable`
- `accounts_receivable`

**Note**: These can be in the same database as HRIS, but use different table names or a schema prefix to avoid conflicts.

---

## API Endpoints Required

Your backend must implement these endpoints (see `BACKEND_INTEGRATION.md`):

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### MRF (Material Requisition Forms)
- `GET /api/mrfs`
- `GET /api/mrfs/:id`
- `POST /api/mrfs`
- `PUT /api/mrfs/:id`
- `POST /api/mrfs/:id/approve`
- `POST /api/mrfs/:id/reject`
- `DELETE /api/mrfs/:id`

### SRF (Service Requisition Forms)
- `GET /api/srfs`
- `POST /api/srfs`
- `PUT /api/srfs/:id`

### RFQ (Request for Quotations)
- `GET /api/rfqs`
- `POST /api/rfqs`
- `PUT /api/rfqs/:id`

### Quotations
- `GET /api/quotations`
- `POST /api/quotations`
- `POST /api/quotations/:id/approve`
- `POST /api/quotations/:id/reject`

### Vendors
- `GET /api/vendors`
- `GET /api/vendors/:id`
- `POST /api/vendors/register`
- `GET /api/vendors/registrations`
- `POST /api/vendors/registrations/:id/approve`

---

## Security Checklist

- [ ] Generate strong `APP_KEY` and `JWT_SECRET`
- [ ] Set `APP_DEBUG=false` in production
- [ ] Configure CORS to only allow frontend domain
- [ ] Use HTTPS (Render provides this automatically)
- [ ] Implement rate limiting
- [ ] Add input validation on all endpoints
- [ ] Use parameterized queries (prevent SQL injection)
- [ ] Implement role-based access control (RBAC)
- [ ] Set up error logging (don't expose sensitive info)
- [ ] Configure database connection pooling

---

## Testing After Deployment

1. **Health Check**:
   ```bash
   curl https://supply-chain-backend.onrender.com/health
   ```

2. **Test Authentication**:
   ```bash
   curl -X POST https://supply-chain-backend.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password"}'
   ```

3. **Test Protected Endpoint**:
   ```bash
   curl https://supply-chain-backend.onrender.com/api/mrfs \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

---

## Troubleshooting

### Database Connection Issues
- Verify database credentials match HRIS backend
- Check if database allows connections from Render IPs
- Ensure database is not paused (Render free tier pauses after inactivity)

### CORS Errors
- Verify `FRONTEND_URL` matches your frontend domain exactly
- Check backend CORS middleware configuration
- Ensure preflight OPTIONS requests are handled

### API Not Found
- Verify routes are registered in backend
- Check API prefix (`/api`) matches frontend configuration
- Review Render build logs for errors

---

## Next Steps

1. **Create Backend**: Choose Laravel (like HRIS) or Node.js/Express
2. **Set Up Database**: Use same PostgreSQL as HRIS or create new schema
3. **Implement API Endpoints**: Follow `BACKEND_INTEGRATION.md` specification
4. **Deploy Backend**: Use Render Web Service
5. **Update Frontend**: Set `VITE_API_BASE_URL` environment variable
6. **Test Integration**: Verify all API calls work correctly
7. **Monitor**: Set up logging and error tracking

---

## Support

For backend implementation details, see:
- `BACKEND_INTEGRATION.md` - Complete API specification
- `API_QUICK_REFERENCE.md` - Quick endpoint reference
- `src/services/api.ts` - Frontend API service implementation

