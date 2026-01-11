# Real-Time Notifications - Backend Requirements

This document outlines the backend tasks and endpoints required to support real-time notifications in the SCM system.

## Architecture Overview

```
┌─────────────┐     WebSocket      ┌─────────────────┐
│   Frontend  │ ◄──────────────────► │  WebSocket      │
│   Client    │                      │  Server         │
└─────────────┘                      └────────┬────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │   Event Bus /   │
                                     │   Message Queue │
                                     └────────┬────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
           ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
           │  Workflow   │           │   Email     │           │  Database   │
           │  Service    │           │   Service   │           │  Events     │
           └─────────────┘           └─────────────┘           └─────────────┘
```

## 1. WebSocket Server Implementation

### Endpoint
```
wss://your-domain.com/ws
```

### Authentication
- Accept JWT token in first message after connection
- Validate token and associate connection with user ID and role
- Maintain connection pool per user session

### Message Format
```typescript
interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  targetRoles?: string[];  // Optional: broadcast to specific roles
  targetUserIds?: string[]; // Optional: broadcast to specific users
}
```

### Required Event Types
| Event Type | Description | Target Roles |
|------------|-------------|--------------|
| `mrf_created` | New MRF submitted | executive, procurement, admin |
| `mrf_approved` | MRF approved at any stage | requester, procurement, finance |
| `mrf_rejected` | MRF rejected | requester |
| `vendor_registered` | New vendor registration | procurement, supply_chain_director |
| `quotation_submitted` | Vendor submitted a quote | procurement |
| `quotation_approved` | Quote selected for PO | vendor (specific) |
| `po_generated` | Purchase Order created | supply_chain_director |
| `po_signed` | PO signed and forwarded | finance, requester |
| `payment_processed` | Payment completed | requester, vendor |
| `grn_submitted` | Goods received | finance, requester |
| `document_expiring` | Compliance doc expiring | vendor (specific) |

### Sample Node.js Implementation
```javascript
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const wss = new WebSocket.Server({ port: 3000, path: '/ws' });
const connections = new Map(); // userId -> [WebSocket]

wss.on('connection', (ws) => {
  let userId = null;
  let userRole = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    // Handle authentication
    if (data.type === 'auth') {
      try {
        const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
        userId = decoded.userId;
        userRole = decoded.role;
        
        if (!connections.has(userId)) {
          connections.set(userId, []);
        }
        connections.get(userId).push(ws);
        
        ws.send(JSON.stringify({ type: 'auth_success', userId }));
      } catch (err) {
        ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }));
        ws.close();
      }
      return;
    }
    
    // Handle other messages (e.g., broadcast requests)
    // ...
  });

  ws.on('close', () => {
    if (userId && connections.has(userId)) {
      const userConnections = connections.get(userId);
      const index = userConnections.indexOf(ws);
      if (index > -1) userConnections.splice(index, 1);
      if (userConnections.length === 0) connections.delete(userId);
    }
  });
});

// Broadcast function to send notifications
function broadcastToRoles(event, payload, targetRoles) {
  // Query database for users with these roles
  // Send to all their active connections
}

function broadcastToUser(event, payload, userId) {
  if (connections.has(userId)) {
    const message = JSON.stringify({ type: event, payload, timestamp: new Date().toISOString() });
    connections.get(userId).forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

module.exports = { broadcastToRoles, broadcastToUser };
```

## 2. Event Triggers (Database/Workflow)

### When to Trigger Notifications

#### MRF Workflow Events
```sql
-- Trigger after MRF insert
CREATE TRIGGER notify_mrf_created
AFTER INSERT ON mrf_requests
FOR EACH ROW
EXECUTE FUNCTION notify_event('mrf_created');

-- Trigger after MRF status update
CREATE TRIGGER notify_mrf_status_change
AFTER UPDATE OF status ON mrf_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_mrf_status_change();
```

#### Vendor Registration Events
```sql
CREATE TRIGGER notify_vendor_registered
AFTER INSERT ON vendor_registrations
FOR EACH ROW
EXECUTE FUNCTION notify_event('vendor_registered');
```

### Backend Service Integration
```javascript
// In your MRF service
async function approveMRF(mrfId, approver, comments) {
  const mrf = await db.mrf.update({
    where: { id: mrfId },
    data: { status: 'approved', approverComments: comments }
  });
  
  // Trigger real-time notification
  const { broadcastToUser, broadcastToRoles } = require('./websocket');
  
  // Notify the requester
  broadcastToUser('mrf_approved', {
    mrfId: mrf.id,
    title: 'MRF Approved',
    message: `Your MRF "${mrf.title}" has been approved`,
  }, mrf.requesterId);
  
  // Notify procurement/finance
  broadcastToRoles('mrf_approved', {
    mrfId: mrf.id,
    title: 'MRF Approved',
    message: `MRF "${mrf.title}" approved - proceed with PO generation`,
  }, ['procurement', 'finance']);
  
  return mrf;
}
```

## 3. Email Integration (Parallel to Real-Time)

### Required Email Endpoints

#### POST /api/notifications/email
Send an email notification.

```typescript
interface EmailRequest {
  to: string | string[];
  subject: string;
  template: EmailTemplate;
  data: Record<string, any>;
}

type EmailTemplate = 
  | 'vendor_invitation'
  | 'vendor_registration_approved'
  | 'vendor_registration_rejected'
  | 'mrf_status_update'
  | 'po_ready_for_signature'
  | 'payment_processed'
  | 'document_expiry_reminder';
```

### Email Service Implementation
```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(to, subject, template, data) {
  const html = renderTemplate(template, data);
  
  await transporter.sendMail({
    from: '"SCM System" <noreply@yourcompany.com>',
    to: Array.isArray(to) ? to.join(',') : to,
    subject,
    html,
  });
}

// Daily cron job for document expiry reminders
async function sendExpiryReminders() {
  const expiringDocs = await db.vendorDocuments.findMany({
    where: {
      expiryDate: {
        lte: addDays(new Date(), 30),
        gte: new Date(),
      }
    },
    include: { vendor: true }
  });
  
  for (const doc of expiringDocs) {
    await sendEmail(
      doc.vendor.email,
      `Document Expiring: ${doc.name}`,
      'document_expiry_reminder',
      { vendorName: doc.vendor.companyName, documentName: doc.name, expiryDate: doc.expiryDate }
    );
  }
}
```

## 4. API Endpoints for Notification Management

### GET /api/notifications
Fetch user's notifications with pagination.

```typescript
// Response
{
  notifications: AppNotification[];
  unreadCount: number;
  total: number;
  page: number;
  pageSize: number;
}
```

### PUT /api/notifications/:id/read
Mark a notification as read.

### PUT /api/notifications/read-all
Mark all notifications as read for current user.

### DELETE /api/notifications/:id
Delete a specific notification.

### GET /api/notifications/preferences
Get user's notification preferences.

### PUT /api/notifications/preferences
Update user's notification preferences.

```typescript
interface NotificationPreferences {
  enableInApp: boolean;
  enableEmail: boolean;
  enableSound: boolean;
  mutedEvents: string[];
  emailDigestFrequency: 'realtime' | 'daily' | 'weekly' | 'never';
}
```

## 5. Database Schema

### Notifications Table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium',
  action_url VARCHAR(500),
  related_id UUID,
  related_type VARCHAR(100),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
```

### Notification Preferences Table
```sql
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  enable_in_app BOOLEAN DEFAULT TRUE,
  enable_email BOOLEAN DEFAULT TRUE,
  enable_sound BOOLEAN DEFAULT TRUE,
  muted_events TEXT[] DEFAULT '{}',
  email_digest_frequency VARCHAR(20) DEFAULT 'realtime',
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 6. Environment Variables Required

```env
# WebSocket Configuration
WS_PORT=3001
WS_PATH=/ws

# JWT for WebSocket Auth
JWT_SECRET=your-jwt-secret

# Email Configuration (SMTP)
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=465
SMTP_USER=noreply@yourcompany.com
SMTP_PASS=your-smtp-password

# Or use a service like SendGrid/Mailgun
SENDGRID_API_KEY=your-sendgrid-key

# Frontend WebSocket URL
VITE_WS_URL=wss://your-domain.com/ws
```

## 7. Testing Checklist

- [ ] WebSocket connection establishes successfully
- [ ] JWT authentication works for WebSocket
- [ ] Notifications broadcast to correct roles
- [ ] Notifications persist to database
- [ ] Email notifications send correctly
- [ ] Notification preferences are respected
- [ ] Document expiry reminders run daily
- [ ] Reconnection logic handles server restarts
- [ ] Rate limiting prevents notification spam
