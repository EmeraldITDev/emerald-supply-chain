# API Quick Reference

Quick guide for common backend integration tasks.

## 🔌 Connect Your API

```bash
# 1. Create .env file
echo "VITE_API_BASE_URL=http://localhost:3000/api" > .env

# 2. Restart dev server
npm run dev
```

## 🔑 Authentication Example

### Login Request
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Login Response
```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "procurement",
    "department": "Procurement",
    "createdAt": "2025-01-20T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Authenticated Request
```http
GET /api/mrfs
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📋 Common Endpoints

### MRF Operations

```http
# List MRFs
GET /api/mrfs?status=Pending&search=office

# Create MRF
POST /api/mrfs
{
  "title": "Office Supplies",
  "category": "Office Supplies",
  "urgency": "Medium",
  "description": "Monthly supplies",
  "quantity": "100",
  "estimatedCost": "50000",
  "justification": "Regular purchase"
}

# Approve MRF
POST /api/mrfs/MRF-2025-001/approve
{
  "remarks": "Approved for processing"
}

# Reject MRF
POST /api/mrfs/MRF-2025-001/reject
{
  "reason": "Insufficient budget justification"
}
```

### Vendor Operations

```http
# Register Vendor
POST /api/vendors/register
{
  "companyName": "New Vendor Ltd",
  "category": "Office Supplies",
  "email": "vendor@example.com",
  "phone": "+234-800-000-0000",
  "address": "Lagos, Nigeria",
  "taxId": "TIN-123456789",
  "contactPerson": "John Doe"
}

# List Vendors
GET /api/vendors?category=Raw+Materials&status=Active
```

## 🎯 Frontend Usage

### Create MRF Component
```typescript
import { mrfApi } from '@/services/api';
import { useMutation } from '@/hooks/useApi';

const { execute, loading } = useMutation(mrfApi.create, {
  onSuccess: () => console.log('Created!'),
  onError: (err) => console.error(err)
});

// Call it
await execute({
  title: "Office Supplies",
  category: "Office Supplies",
  urgency: "Medium",
  // ... rest of data
});
```

### Fetch MRF List
```typescript
import { mrfApi } from '@/services/api';
import { useQuery } from '@/hooks/useApi';

const { data, loading, refetch } = useQuery(
  () => mrfApi.getAll({ status: 'Pending' })
);
```

## 🧪 Test with cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123"}'

# Get MRFs (save token from login)
curl http://localhost:3000/api/mrfs \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Create MRF
curl -X POST http://localhost:3000/api/mrfs \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test MRF",
    "category": "Office Supplies",
    "urgency": "Medium",
    "description": "Test",
    "quantity": "10",
    "estimatedCost": "5000",
    "justification": "Testing"
  }'
```

## 🛠️ Backend Checklist

### Minimum Required Endpoints

- [ ] `POST /api/auth/login` - User login
- [ ] `GET /api/auth/me` - Get current user
- [ ] `GET /api/mrfs` - List MRFs
- [ ] `POST /api/mrfs` - Create MRF
- [ ] `GET /api/vendors` - List vendors
- [ ] `POST /api/vendors/register` - Register vendor

### Nice to Have

- [ ] `POST /api/mrfs/:id/approve` - Approve workflow
- [ ] `GET /api/rfqs` - RFQ management
- [ ] `POST /api/quotations` - Quotation submission
- [ ] File upload endpoints
- [ ] Search and filtering

## 🔒 Security Headers

Your backend should return:

```http
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

## 📊 Response Format

### Success
```json
{
  "id": "MRF-2025-001",
  "title": "Office Supplies",
  "status": "Pending",
  // ... rest of data
}
```

### Error
```json
{
  "success": false,
  "error": "User not found",
  "code": "NOT_FOUND"
}
```

## 🐛 Debug Tips

```javascript
// Check if token exists
console.log(localStorage.getItem('authToken'));

// Test API directly
fetch('http://localhost:3000/api/mrfs', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  }
}).then(r => r.json()).then(console.log);

// Clear token
localStorage.removeItem('authToken');
```

## 🚀 Deploy

### Frontend
```bash
# Set production API URL
VITE_API_BASE_URL=https://api.yourdomain.com npm run build

# Deploy dist/ folder
```

### Backend
- Enable HTTPS
- Update CORS origin to production URL
- Use environment variables for secrets
- Set up proper logging
- Enable rate limiting

## 📞 API Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

## 💾 Data Models

See `src/types/index.ts` for complete TypeScript interfaces:
- `User` - User account
- `MRF` - Material Requisition Form
- `SRF` - Service Requisition Form
- `RFQ` - Request for Quotation
- `Quotation` - Vendor quotation
- `Vendor` - Vendor information

## 🎓 Learning Path

1. ✅ Set up `.env` with API URL
2. ✅ Implement `/auth/login` endpoint
3. ✅ Test login in app
4. ✅ Implement `/mrfs` GET endpoint
5. ✅ Test MRF list display
6. ✅ Implement `/mrfs` POST endpoint
7. ✅ Test MRF creation
8. ✅ Continue with other endpoints...

---

**Pro Tip:** Start simple with authentication, then add features one at a time. Test each endpoint before moving to the next!
