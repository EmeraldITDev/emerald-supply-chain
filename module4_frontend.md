# Module 4 – Logistics: Fleet Management
## Frontend Development Prompt — Lovable

---

### Context
This document covers all UI components, screens, flows, and interactions for the Fleet Management submodule of the Logistics Module in the SCM system.

---

## 4.1 — Vehicle Document Upload & Expiry Notifications

### Updated Screen: Vehicle Detail Page — Documents Tab

**Location:** Fleet Management → Vehicles → [Vehicle] → Documents

**Layout:**
- Display documents grouped by type in a card or table grid.
- Each document type row shows: Document Type, Uploaded Date, Expiry Date, Status Badge, and Actions (View / Replace).

**Document Type Options (dropdown):**
- Insurance Certificate
- Vehicle Licence
- Transport Permit
- Road-Worthiness Certificate
- Local Government Papers

**Upload Component:**
- Select document type from dropdown.
- Pick expiry date via date picker.
- Upload file (PDF/image).
- "Upload Document" button to confirm.

**Status Badges & Colour Coding:**

| State | Colour | Condition |
|---|---|---|
| Valid | 🟢 Green | Expiry is more than 6 weeks away |
| Expiring Soon | 🟡 Amber | 8–42 days to expiry |
| Critical | 🔴 Red | 1–7 days to expiry |
| Expired | ⛔ Grey/Red | Expiry date has passed |

- Apply the colour to the expiry date cell and/or a status badge — not just an icon.
- If a document is expired, show a banner on the vehicle detail page: *"This vehicle has expired documents and has been set to Inactive."*

---

### Notification Panel / Alert Feed

**Location:** Notifications bell icon (global) + Logistics Dashboard widget

- Each expiry alert appears as a notification item: *"[Document Type] for [Plate Number] expires in [X] days."*
- Clicking the notification navigates to the vehicle's Documents tab.
- On the Fleet dashboard, add an **"Expiring Documents"** summary widget showing a count of vehicles with documents in the Amber or Red tier.

---

## 4.2 — Scheduled Maintenance Records & Notifications

### Updated Screen: Vehicle Detail Page — Maintenance Tab

**Location:** Fleet Management → Vehicles → [Vehicle] → Maintenance

**List View:**
- Show all maintenance records in a table: Maintenance Type, Last Date, Next Due Date, Interval, Status Badge, Actions (Edit / Mark Complete).

**Status Badges:**

| Status | Colour |
|---|---|
| Scheduled | 🔵 Blue |
| Completed | 🟢 Green |
| Overdue | 🔴 Red |

---

### Add / Edit Maintenance Record Form

**Form Fields:**

| Field | Type | Required |
|---|---|---|
| Maintenance Type | Text input (e.g. Oil Change, Full Service) | Yes |
| Interval (months) | Number input | Yes |
| Last Maintenance Date | Date picker | Yes |
| Next Maintenance Date | Read-only, auto-calculated | — |
| Notes | Textarea | No |

- `Next Maintenance Date` should update live as the user changes Last Date or Interval.
- **"Mark as Completed"** action on an existing record should prompt: *"Update Last Maintenance Date to today?"* with a confirm button, then auto-recalculate the next date.

---

### Trip Assignment Warning — Maintenance Conflict

When a logistics officer selects a vehicle for a trip:
- If the vehicle has maintenance due within 7 days, show an **inline warning banner** within the trip assignment form:

> ⚠️ *"This vehicle has scheduled maintenance on [date], which is within 7 days. Are you sure you want to proceed with this assignment?"*

- Show two buttons: **"Proceed Anyway"** and **"Choose a Different Vehicle"**.
- Do not block the assignment — allow the officer to override with confirmation.

---

### Fleet Dashboard — Maintenance Widget

Add a **"Upcoming Maintenance"** summary card on the Fleet dashboard showing vehicles with maintenance due in the next 14 days. Each row: Vehicle Plate, Maintenance Type, Due Date, Days Remaining.

---

## 4.3 — Vehicle Status: Inactive Indicator & Manual Override

### Vehicle List & Detail

- If a vehicle's status is `INACTIVE`, show a clear **red "Inactive" badge** on the vehicle card/row in the fleet list.
- On the vehicle detail page, show a **banner at the top** explaining why it was set to inactive (e.g. *"Vehicle automatically set to Inactive due to expired Insurance Certificate."*).
- Provide a **"Reactivate Vehicle"** button (visible to logistics officers only) that opens a confirmation modal asking for a reason before reactivating.

**Reactivation Modal:**
- Text: *"You are manually reactivating this vehicle. Please provide a reason."*
- Reason field: Textarea (required).
- Buttons: **"Confirm Reactivation"** / **"Cancel"**.

---

## 4.4 — Driver Profile: Email Optional, Phone Number Required

### Updated Screen: Add / Edit Driver Form

**Location:** Fleet Management → Drivers → Add New / Edit Driver

**Changes:**
- Remove the `*` (required indicator) from the Email field. Add helper text: *"Optional — only if the driver has a work email address."*
- Add a new **Phone Number** field marked as required (`*`).
- Phone number field should include basic format validation (minimum digit length).

**Driver List / Table View:**
- Add a **Phone Number** column to the driver list table.
- Ensure phone number is visible on the driver detail/profile page.
- Where supervisor-facing views show driver contact info (e.g. trip detail, fleet dashboard), display the phone number prominently so it can be used for direct contact.

**Validation Rules (client-side):**
- Email: optional, but if entered must pass standard email format check.
- Phone Number: required, numeric, minimum 10 digits.
