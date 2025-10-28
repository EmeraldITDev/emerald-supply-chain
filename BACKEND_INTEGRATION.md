# Backend Integration Guide

This document explains how to connect your own backend to the SCM frontend application.

## Architecture Overview

The frontend is structured with a clean separation of concerns:

```
src/
├── types/           # TypeScript interfaces for all data models
├── services/        # API service layer
├── hooks/          # React hooks for API calls
├── contexts/       # Global state management
├── lib/            # Mock data (for development)
└── components/     # UI components
```

## Quick Start

### 1. Configure API Base URL

Create a `.env` file in the root directory:

```env
VITE_API_BASE_URL=https://your-backend-api.com/api
```

Or set it at build time:
```bash
VITE_API_BASE_URL=https://api.production.com npm run build
```

### 2. Implement Required API Endpoints

Your backend must implement the following RESTful endpoints:

## API Endpoints Specification

### Authentication

#### POST `/auth/login`
Login user with credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "employee",
    "department": "Operations",
    "createdAt": "2025-01-15T10:00:00Z"
  },
  "token": "jwt-token-here"
}
```

#### POST `/auth/logout`
Logout current user.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true
}
```

#### GET `/auth/me`
Get current authenticated user.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "employee",
  "department": "Operations",
  "createdAt": "2025-01-15T10:00:00Z"
}
```

---

### Material Requisition Forms (MRF)

#### GET `/mrfs`
Get all MRFs with optional filters.

**Query Parameters:**
- `status` - Filter by status (Pending, Approved, Rejected, etc.)
- `search` - Search in title/description
- `sortBy` - Sort field (date, estimatedCost, etc.)
- `sortOrder` - Sort direction (asc, desc)

**Response:**
```json
[
  {
    "id": "MRF-2025-001",
    "title": "Office Supplies - Q1 2025",
    "category": "Office Supplies",
    "urgency": "Medium",
    "description": "Printer cartridges and paper",
    "quantity": "100",
    "estimatedCost": "50000",
    "justification": "Regular supplies",
    "requester": "John Doe",
    "requesterId": "user-123",
    "date": "2025-01-15",
    "status": "Pending",
    "currentStage": "procurement",
    "approvalHistory": [],
    "rejectionReason": null,
    "isResubmission": false
  }
]
```

#### GET `/mrfs/:id`
Get single MRF by ID.

#### POST `/mrfs`
Create new MRF.

**Request Body:**
```json
{
  "title": "Office Supplies",
  "category": "Office Supplies",
  "urgency": "Medium",
  "description": "Description here",
  "quantity": "100",
  "estimatedCost": "50000",
  "justification": "Justification here"
}
```

#### PUT `/mrfs/:id`
Update existing MRF.

#### POST `/mrfs/:id/approve`
Approve MRF (procurement/finance role required).

**Request Body:**
```json
{
  "remarks": "Approved for processing"
}
```

#### POST `/mrfs/:id/reject`
Reject MRF.

**Request Body:**
```json
{
  "reason": "Insufficient budget justification"
}
```

#### DELETE `/mrfs/:id`
Delete MRF.

---

### Service Requisition Forms (SRF)

#### GET `/srfs`
Get all SRFs.

**Query Parameters:**
- `status` - Filter by status
- `search` - Search query

#### POST `/srfs`
Create new SRF.

**Request Body:**
```json
{
  "title": "HVAC Maintenance",
  "serviceType": "Maintenance",
  "urgency": "High",
  "description": "Annual HVAC maintenance",
  "duration": "3 days",
  "estimatedCost": "150000",
  "justification": "Scheduled maintenance"
}
```

#### PUT `/srfs/:id`
Update SRF.

---

### Request for Quotations (RFQ)

#### GET `/rfqs`
Get all RFQs.

**Query Parameters:**
- `status` - Filter by status (Open, Closed, Awarded)

**Response:**
```json
[
  {
    "id": "RFQ-2025-001",
    "mrfId": "MRF-2025-001",
    "mrfTitle": "Office Supplies",
    "description": "Request for office supplies quotation",
    "quantity": "100",
    "estimatedCost": "50000",
    "deadline": "2025-02-01",
    "status": "Open",
    "vendorIds": ["V001", "V002"],
    "createdAt": "2025-01-20T10:00:00Z"
  }
]
```

#### POST `/rfqs`
Create new RFQ.

**Request Body:**
```json
{
  "mrfId": "MRF-2025-001",
  "description": "Request for quotation",
  "quantity": "100",
  "estimatedCost": "50000",
  "deadline": "2025-02-01",
  "vendorIds": ["V001", "V002"]
}
```

#### PUT `/rfqs/:id`
Update RFQ.

---

### Quotations

#### GET `/quotations`
Get all quotations.

#### GET `/quotations/vendor/:vendorId`
Get quotations by vendor.

#### POST `/quotations`
Submit quotation (vendor only).

**Request Body:**
```json
{
  "rfqId": "RFQ-2025-001",
  "vendorId": "V001",
  "vendorName": "Steel Works Ltd",
  "price": "45000",
  "deliveryDate": "2025-02-15",
  "notes": "Includes delivery and installation"
}
```

#### POST `/quotations/:id/approve`
Approve quotation.

#### POST `/quotations/:id/reject`
Reject quotation.

---

### Vendors

#### GET `/vendors`
Get all vendors.

**Query Parameters:**
- `status` - Filter by status (Active, Inactive, Pending)
- `category` - Filter by category

**Response:**
```json
[
  {
    "id": "V001",
    "name": "Steel Works Ltd",
    "category": "Raw Materials",
    "rating": 4.8,
    "totalOrders": 45,
    "status": "Active",
    "email": "contact@steelworks.com",
    "phone": "+234-800-000-0001",
    "address": "Lagos, Nigeria",
    "taxId": "TIN-001",
    "contactPerson": "Ahmed Ali"
  }
]
```

#### GET `/vendors/:id`
Get vendor by ID.

#### POST `/vendors/register`
Register new vendor (public endpoint).

**Request Body:**
```json
{
  "companyName": "New Vendor Ltd",
  "category": "Office Supplies",
  "email": "vendor@example.com",
  "phone": "+234-800-000-0000",
  "address": "Lagos, Nigeria",
  "taxId": "TIN-123456789",
  "contactPerson": "John Doe"
}
```

#### GET `/vendors/registrations`
Get all vendor registrations (procurement only).

#### POST `/vendors/registrations/:id/approve`
Approve vendor registration (procurement only).

---

## Authentication Flow

1. User submits login credentials
2. Backend validates and returns JWT token + user data
3. Frontend stores token in localStorage
4. All subsequent requests include token in Authorization header
5. Backend validates token and returns appropriate data/errors

### Token Storage

```typescript
// Stored in localStorage
localStorage.setItem('authToken', token);

// Included in all API requests
headers: {
  'Authorization': `Bearer ${token}`
}
```

---

## Role-Based Access Control

Implement these roles in your backend:

- **employee** - Can create MRF/SRF, view own requests
- **procurement** - Can approve/reject MRF/SRF, manage RFQs, vendors
- **finance** - Can review and approve budgets
- **admin** - Full access

### Example Authorization Check

```javascript
// Backend middleware example
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Usage
app.post('/mrfs/:id/approve', requireRole('procurement'), approveHandler);
```

---

## Error Handling

All endpoints should return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid input data
- `INTERNAL_ERROR` - Server error

---

## Using the API in Frontend

### Example: Creating MRF

```typescript
import { mrfApi } from '@/services/api';
import { useMutation } from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';

function CreateMRFComponent() {
  const { toast } = useToast();
  
  const { execute, loading, error } = useMutation(
    mrfApi.create,
    {
      onSuccess: (data) => {
        toast({
          title: "Success",
          description: "MRF created successfully"
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error,
          variant: "destructive"
        });
      }
    }
  );

  const handleSubmit = async (formData) => {
    await execute(formData);
  };

  return (
    // Your form component
  );
}
```

### Example: Fetching Data

```typescript
import { mrfApi } from '@/services/api';
import { useQuery } from '@/hooks/useApi';

function MRFListComponent() {
  const { data, loading, error, refetch } = useQuery(
    () => mrfApi.getAll({ status: 'Pending' }),
    { autoFetch: true }
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {data?.map(mrf => (
        <div key={mrf.id}>{mrf.title}</div>
      ))}
    </div>
  );
}
```

---

## Mock Data Development

While developing without backend, the app uses mock data from `src/lib/mockData.ts`.

To disable mock data and force API calls:
1. Set `VITE_API_BASE_URL` in `.env`
2. Mock data automatically disabled when API URL is set

---

## Testing Your Backend

### 1. Health Check
Test basic connectivity:
```bash
curl https://your-api.com/health
```

### 2. Authentication
```bash
curl -X POST https://your-api.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 3. Protected Endpoint
```bash
curl https://your-api.com/api/mrfs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## CORS Configuration

Your backend must allow CORS from the frontend domain:

```javascript
// Express.js example
const cors = require('cors');

app.use(cors({
  origin: ['http://localhost:5173', 'https://your-frontend.com'],
  credentials: true
}));
```

---

## Deployment Checklist

- [ ] Set production `VITE_API_BASE_URL`
- [ ] Implement all required API endpoints
- [ ] Add JWT authentication
- [ ] Implement role-based access control
- [ ] Configure CORS properly
- [ ] Add rate limiting
- [ ] Set up error logging
- [ ] Test all endpoints
- [ ] Set up database migrations
- [ ] Configure backups

---

## Support

For questions about the frontend integration:
- Review `src/services/api.ts` for all API calls
- Check `src/types/index.ts` for data structures
- See `src/hooks/useApi.ts` for usage patterns

## Next Steps

1. Set up your backend server
2. Implement the authentication endpoints first
3. Add MRF/SRF endpoints
4. Test with Postman/curl
5. Configure `.env` with your API URL
6. Test frontend integration
7. Deploy!
