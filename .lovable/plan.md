

# Warehouse Module Upgrade Plan

## What the Documents Reveal

Two distinct warehouse workflows are being tracked manually in Excel:

### 1. Goods Receipt Note (GRN)
Tracks **incoming goods** received at the warehouse. Fields captured per line item:
- Item Description, Item Code, UOM, MRF No.
- Quantity Ordered vs Quantity Received
- Category (Safety Materials, Spare Parts, Lube Oil, Office Equipment, Office Consumable, Field Consumables)
- Warehouse Location (e.g., OB/OB, Oando WH)
- Date Received, Received By, Designation (role of receiver)
- Supplier Name, Waybill/Invoice No., Purchase Order No.
- Remarks

**Gap**: The existing GRN module (`GRNModule.tsx`) has a different structure -- it's PO-centric and is missing Item Code, MRF No., Category, Designation, and Waybill/Invoice No. fields. The form needs to be expanded to match the real-world data.

### 2. Daily Materials Consumption (DMC)
Tracks **materials issued out** of the warehouse for maintenance/operations. This workflow does **not exist** in the system at all. Fields:
- Date Issued, Unit Tag, Location, Equipment Model
- Maintenance Type (Corrective, Preventive, etc.)
- Owned By, Work Order, PE No.
- Item Code, Item Description, Qty Issued, UOM
- FSE (Field Service Engineer who received the item)
- Remark (e.g., "Returned")

Each monthly sheet also has sign-off fields for Site Manager, GMC Coordinator, Materials Coordinator, and Deputy LAR Manager.

---

## Implementation Plan

### Task 1: Create Daily Materials Consumption (DMC) Module
**New file**: `src/components/warehouse/DailyMaterialsConsumption.tsx`

- Add a new **"Materials Consumption"** tab to the Warehouse page
- Build a form dialog with all 14 fields from the Excel:
  - Date Issued (date picker)
  - Unit Tag (text input)
  - Location (select: OB/OB, EOC, KWALE, EBOCHA, or text input)
  - Equipment Model (text input)
  - Maintenance Type (select: Corrective, Preventive)
  - Owned By (text input, default "OANDO")
  - Work Order (text input, optional)
  - PE No. (text input, optional)
  - Item Code (text input)
  - Item Description (text input)
  - Qty Issued (number)
  - UOM (select: PC, PCS, Roll, Set, etc.)
  - FSE -- Field Service Engineer (text input)
  - Remark (text input, optional -- supports "Returned" flag)
- Table displays all entries with filtering by month, location, and FSE
- Add an Excel bulk upload option using a downloadable template matching the 14-column format
- Store data via API calls (with localStorage fallback like existing modules)

### Task 2: Enhance the Existing GRN Module
**Edit**: `src/components/GRNModule.tsx` and `src/types/grn.ts`

Update the GRN creation form and data model to include the missing fields from the real Goods Receipt Note:
- Add **Item Code** field per line item
- Add **MRF No.** field (links receipt to originating MRF)
- Add **Category** dropdown (Safety Materials, Spare Parts, Lube Oil, Office Equipment, Office Consumable, Field Consumables)
- Add **Designation** field for the receiver's role
- Add **Waybill/Invoice No.** field
- Ensure Warehouse Location, Received By, and Supplier Name are all present (some already exist)
- Update the GRN detail view and table columns to display these new fields

### Task 3: Add New Types
**New file**: `src/types/warehouse.ts`

```text
MaterialConsumption {
  id, dateIssued, unitTag, location, equipmentModel,
  maintenanceType, ownedBy, workOrder, peNumber,
  itemCode, itemDescription, qtyIssued, uom,
  fse, remark, createdAt
}
```

Update `GRNItem` in `src/types/grn.ts`:
```text
+ itemCode, mrfNumber, category, designation, waybillInvoiceNo
```

### Task 4: Add Warehouse API Service
**New file or update**: `src/services/warehouseApi.ts`

- `POST /warehouse/materials-consumption` -- create consumption record
- `GET /warehouse/materials-consumption` -- list with filters
- `POST /warehouse/materials-consumption/bulk-upload` -- Excel upload
- `GET /warehouse/materials-consumption/templates` -- download template
- Document these as **required backend endpoints** per the spec's rules (Lovable does not create backend endpoints)

### Task 5: Update Warehouse Page Layout
**Edit**: `src/pages/Warehouse.tsx`

- Add new "Materials Consumption" tab between GRN Management and Storage Locations
- Import and render the new `DailyMaterialsConsumption` component
- Reorder tabs logically: GRN Management | Materials Consumption | Storage Locations | Dispatch | EHS

### Task 6: Excel Bulk Upload for Both Modules
- Provide a downloadable DMC Excel template (14 columns matching the document)
- Provide a downloadable GRN Excel template (16 columns matching the document)
- Reuse the existing Excel parsing pattern from the logistics module
- Row-level validation with error feedback

---

## Summary of Changes

| Area | Action |
|------|--------|
| New component | `DailyMaterialsConsumption.tsx` -- full CRUD + table + bulk upload |
| New types | `src/types/warehouse.ts` for DMC data model |
| Updated types | `src/types/grn.ts` -- add itemCode, mrfNumber, category, designation, waybillInvoiceNo |
| Updated component | `GRNModule.tsx` -- expanded form fields + table columns |
| Updated page | `Warehouse.tsx` -- new tab for Materials Consumption |
| New service | `src/services/warehouseApi.ts` -- API layer for DMC |
| New templates | Excel templates for DMC and GRN bulk upload |

### Backend Endpoints Required (to be communicated to backend team)
- `POST /warehouse/materials-consumption`
- `GET /warehouse/materials-consumption`
- `POST /warehouse/materials-consumption/bulk-upload`
- `GET /warehouse/materials-consumption/templates`

No existing backend endpoints will be modified.

