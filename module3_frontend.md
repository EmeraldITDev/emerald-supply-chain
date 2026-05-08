# Module 3 – Logistics: Trip Scheduling
## Frontend Development Prompt — Lovable

---

### Context
This document covers all UI components, screens, flows, and interactions for the Trip Scheduling submodule of the Logistics Module in the SCM system.

---

## 3.1 — Vendor Portal: Driver & Vehicle Details on Trip Assignment

### New Screen: Vendor Portal — Trip Detail & Submission Form

**Location:** Vendor Portal → Assigned Trips → [Trip] → Submit Details

**Behaviour:**
- When a vendor logs into the Vendor Portal and views an assigned trip, show a **"Submit Trip Details"** button/section if no submission has been made yet.
- The form should be locked (read-only) after submission, with a status badge showing `Submitted` or `Approved`.

**Form Fields:**

| Field | Type | Required |
|---|---|---|
| Vehicle Make | Text input | Yes |
| Vehicle Model | Text input | Yes |
| Plate Number | Text input | Yes |
| Driver Name | Text input | Yes |
| Driver Phone Number | Text input | Yes |
| Driver Licence Number | Text input | Yes |
| Security Information | Textarea | No |
| Supporting Documents | Multi-file upload | Yes |

**Document Upload Component:**
- Allow multiple file uploads.
- Label each upload with a document type: `Insurance Certificate`, `Road-Worthiness Certificate`, or `Other`.
- Show upload progress and file name after upload.
- Display previously uploaded documents as a list with a remove option (before submission).

**Trip Status Indicator:**
- Show a status chip/badge on the trip card: `Draft`, `Pending Approval`, `Approved`.
- A trip in `Draft` status should display a prominent call-to-action: *"Action Required: Submit Trip Details to proceed."*

---

## 3.2 — Multi-Vendor Trip Request & Cost Comparison

### Updated Screen: Trip Request — Vendor Selection

**Location:** Logistics → Trip Scheduling → New/Edit Trip Request

**Changes:**
- Add a **"Invite Multiple Vendors"** toggle/option during trip creation.
- When enabled, show a multi-select vendor picker (searchable dropdown or checkbox list).
- Show the list of selected vendors as removable chips/tags before sending.
- Add a **"Send to All Selected Vendors"** button that dispatches invitations.

---

### New Screen: Trip Vendor Response Comparison Table

**Location:** Logistics → Trip Scheduling → [Trip] → Compare Vendor Responses

**Layout:** A side-by-side or tabular comparison view. Each column represents one responding vendor.

**Columns per vendor:**

| Field | Display |
|---|---|
| Vendor Name | Text |
| Quoted Price | Currency formatted (e.g. ₦ 250,000) |
| Vehicle Make & Model | Text |
| Plate Number | Text |
| Driver Name | Text |
| Documents Submitted | Linked icons/badges (click to preview) |

**Actions:**
- **"Select & Approve"** button per vendor column — selecting one greys out all others and prompts a confirmation modal.
- Confirmation modal: *"You are approving [Vendor Name] for this trip at [Price]. This will route the trip to Procurement for PO generation. Confirm?"*
- After approval, show a success state and update the trip status to `Approved`.

---

## 3.3 — Accommodation Module

### New Screen: Accommodation Bookings

**Location:** Logistics → Accommodation (new nav item under Logistics)

**List View:**
- Table/card list of all accommodation bookings.
- Columns: Passenger Name(s), Destination, Hotel Name, Check-in Date, No. of Nights, Linked Trip, Actions.
- Filter by: date range, destination, linked trip.
- **"+ New Booking"** button in the top-right.

---

### New/Edit Accommodation Booking Form

**Form Fields:**

| Field | Type | Required |
|---|---|---|
| Passenger Name(s) | Tag/chip input (multi-entry) | Yes |
| Destination State | Text input | Yes |
| Destination City | Text input | Yes |
| Number of Nights | Number input | Yes |
| Hotel Name | Free-text input (no dropdown) | Yes |
| Check-in Date | Date picker | Yes |
| Linked Trip | Searchable dropdown → existing trips | No |

- Check-out date should be **auto-calculated** and displayed (read-only): `Check-in Date + Number of Nights`.
- Linked Trip field should be optional but show a helper text: *"Link this booking to an existing trip schedule."*

---

## 3.4 — Job Completion Certificate (JCC) for Trips

### Updated Screen: Trip Detail Page

**Location:** Logistics → Trip Scheduling → [Trip]

**Changes:**
- Add a **"Close Trip / Issue JCC"** button at the bottom of a completed trip's detail page.
- Button should only be active when the trip status is `Completed` or `In Progress` (as applicable per business rules).
- If a JCC already exists, replace the button with a **"View JCC"** link and a status badge (`Draft`, `Submitted`, `Approved`).

---

### New Screen/Modal: Job Completion Certificate Form

**Trigger:** Clicking "Close Trip / Issue JCC"

**Display as:** A full-page form or a large modal/drawer.

**Form Fields (placeholder — to be updated once JCC template is received from Joseph Akinyanmi):**

| Field | Type | Required |
|---|---|---|
| Trip Reference | Read-only (auto-filled) | — |
| Issued By | Read-only (current user) | — |
| Delivery Confirmed | Toggle / Yes-No radio | Yes |
| Condition of Goods (if applicable) | Textarea | No |
| Remarks | Textarea | No |
| Attachments | File upload | No |

**Actions:**
- **"Save as Draft"** — saves without submitting.
- **"Submit JCC"** — submits for approval; locks the form.
- **"Approve JCC"** — visible only to authorised approvers; finalises and closes the trip.

**Post-approval State:**
- Trip card/status should update to `Closed / Completed`.
- JCC should be downloadable as a PDF from the trip detail page.
