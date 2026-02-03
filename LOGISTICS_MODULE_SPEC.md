# SCM Logistics Module Upgrade

## Overview
This document defines the scope, architecture, and backend integration requirements for upgrading the **logistics layer of the Supply Chain Management (SCM) system**. The objective is to implement a **fully integrated, end-to-end logistics module** with clear workflows, automation, and visibility, eliminating manual email-based processes.

---

## Scope of the Logistics Module
The logistics module must comprehensively support:
- Personnel movement
- Material movement
- Trip scheduling
- Journey management
- Fleet management
- Role-based reporting and oversight

---

## Backend Requirements
The backend architecture must support:
- Bulk Excel uploads for trips and materials using predefined templates
- Role-based access control (logistics managers, coordinators, vendors, admins)
- Vendor workflows for internal, external, and one-time vendors
- Email-only authentication for one-time vendors
- Automated notifications triggered by workflow events
- Document uploads with expiry and lifecycle tracking
- Status and lifecycle tracking across trips, journeys, materials, fleet, and reports

---

## Frontend Requirements
The frontend must:
- Clearly separate **Trip Scheduling** from **Journey Management**
- Support bulk uploads with downloadable Excel templates
- Provide dashboards for trips, materials, and fleet operations
- Allow vendors and coordinators to submit required data via restricted, role-based views

---

## Trip & Vendor Handling
- Trips must support both internal and external vendors
- One-time vendors must be onboarded via email-only access
- Assigning a vendor to a trip must automatically trigger notifications
- Vendors must be able to submit journey management data without accessing the full system

---

## Fleet Management Requirements
Fleet management must include:
- Vehicle ownership tracking
- Documentation upload and expiry tracking
- Maintenance history
- Operational usage records
- Automated alerts for expiring documents or maintenance events
- UI placeholders for future GPS tracking integration

---

## Reporting & Compliance
- Logistics coordinators must be able to upload operational reports
- The system must automatically track, flag, and notify stakeholders of missing or overdue submissions

---

## Objective
Deliver a **fully integrated logistics workflow** with:
- No dependency on manual email coordination
- Clear operational visibility for logistics managers
- A scalable, future-ready backend architecture

---

# Backend Architecture

## Core Modules
1. Authentication & Roles
2. Vendors
3. Trips
4. Journey Management
5. Materials
6. Fleet Management
7. Documents
8. Notifications
9. Reporting
10. Bulk Uploads & Validation

---

## 1. Authentication & Roles
**Responsibilities**
- Role-based access control
- Email-only vendor access
- Permission enforcement

**Endpoints**
```
POST   /auth/login
POST   /auth/vendor-invite
POST   /auth/vendor-accept
GET    /auth/me
```

**Roles**
- Admin
- Logistics Manager
- Logistics Coordinator
- Vendor (internal, external, one-time)

---

## 2. Vendors Module
**Responsibilities**
- Vendor onboarding and lifecycle management
- Internal vs external vs one-time vendor handling
- Contact and compliance data management

**Endpoints**
```
POST   /vendors
GET    /vendors
GET    /vendors/{id}
PUT    /vendors/{id}
POST   /vendors/{id}/invite
```

---

## 3. Trips Module (Scheduling Layer)
**Responsibilities**
- Trip creation and planning
- Vendor assignment
- Material association
- High-level trip lifecycle management

**Endpoints**
```
POST   /trips
GET    /trips
GET    /trips/{id}
PUT    /trips/{id}
POST   /trips/{id}/assign-vendor
POST   /trips/bulk-upload
```

**Trip Status Flow**
```
Draft → Scheduled → Vendor Assigned → In Progress → Completed → Closed
```

---

## 4. Journey Management (Execution Layer)
**Responsibilities**
- Capture real movement data
- Departure, checkpoints, and arrival tracking
- Vendor-submitted journey updates

**Endpoints**
```
POST   /journeys
GET    /journeys/{trip_id}
PUT    /journeys/{id}
POST   /journeys/{id}/update-status
```

**Journey Status Flow**
```
Not Started → Departed → En Route → Arrived → Closed
```

---

## 5. Materials Module
**Responsibilities**
- Track materials per trip
- Quantity, condition, and movement history

**Endpoints**
```
POST   /materials
GET    /materials
GET    /materials/{id}
POST   /materials/bulk-upload
GET    /trips/{id}/materials
```

---

## 6. Fleet Management
**Responsibilities**
- Vehicle registry and ownership tracking
- Maintenance records
- Documentation and expiry monitoring

**Endpoints**
```
POST   /fleet/vehicles
GET    /fleet/vehicles
GET    /fleet/vehicles/{id}
PUT    /fleet/vehicles/{id}
POST   /fleet/vehicles/{id}/maintenance
POST   /fleet/vehicles/{id}/documents
```

**Future Readiness**
- GPS integration placeholders
- External tracking service hooks

---

## 7. Documents Module
**Responsibilities**
- Attach documents to trips, vehicles, and vendors
- Track document validity and expiry

**Endpoints**
```
POST   /documents
GET    /documents/{entity_type}/{entity_id}
DELETE /documents/{id}
```

---

## 8. Notifications Engine
**Responsibilities**
- Event-driven notifications
- Email and in-app notifications

**Trigger Events**
- Vendor assigned to a trip
- Journey status updates
- Missing or overdue reports
- Expiring fleet documents

**Endpoints**
```
POST   /notifications/send
GET    /notifications
```

---

## 9. Reporting & Compliance
**Responsibilities**
- Report uploads by logistics coordinators
- Automatic detection of missing submissions
- Manager-level visibility

**Endpoints**
```
POST   /reports
GET    /reports
GET    /reports/pending
```

---

## 10. Bulk Uploads & Validation
**Responsibilities**
- Excel template validation
- Row-level error feedback
- Partial success handling

**Endpoints**
```
POST   /uploads/trips
POST   /uploads/materials
GET    /uploads/templates
```

---

## End-to-End Integration Flow
1. Admin creates trips manually or via bulk upload
2. Vendors are assigned and notified automatically
3. Vendors submit journey data via restricted access
4. Materials and fleet usage are tracked in parallel
5. Reports are uploaded and validated
6. Missing data is flagged automatically
7. Logistics managers monitor all activity via dashboards

---

## Important Implementation Notes for Lovable

- Lovable **must not create or implement backend endpoints**, as Lovable does not manage or own the backend system.
- Lovable’s responsibility is to **consume and call existing backend endpoints only**, based on the APIs already provided.
- Where required functionality does not yet exist, Lovable should **clearly document and communicate the required new endpoints or backend changes**, but should not attempt to implement them.
- Any backend endpoints, services, or workflows that already exist must be **left unchanged** to avoid breaking the system.
- All proposed new endpoints or backend modifications must be explicitly communicated and approved before implementation.

### Change Communication Requirement
- Lovable must **inform the client of any changes** made to the system configuration, workflows, UI behavior, or API usage.
- This includes new data requirements, altered request/response payloads, new dependencies, or assumptions about backend behavior.
- No silent changes are acceptable. All changes must be documented and communicated clearly.

