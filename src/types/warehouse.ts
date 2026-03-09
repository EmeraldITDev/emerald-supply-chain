// Warehouse Module Types

export interface MaterialConsumption {
  id: string;
  dateIssued: string;
  unitTag: string;
  location: string;
  equipmentModel: string;
  maintenanceType: 'Corrective' | 'Preventive' | 'Other';
  ownedBy: string;
  workOrder?: string;
  peNumber?: string;
  itemCode: string;
  itemDescription: string;
  qtyIssued: number;
  uom: string;
  fse: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialConsumptionData {
  dateIssued: string;
  unitTag: string;
  location: string;
  equipmentModel: string;
  maintenanceType: 'Corrective' | 'Preventive' | 'Other';
  ownedBy: string;
  workOrder?: string;
  peNumber?: string;
  itemCode: string;
  itemDescription: string;
  qtyIssued: number;
  uom: string;
  fse: string;
  remark?: string;
}

export const DMC_LOCATIONS = ['OB/OB', 'EOC', 'KWALE', 'EBOCHA', 'Oando WH'] as const;

export const DMC_UOM_OPTIONS = ['PC', 'PCS', 'Roll', 'Set', 'Litre', 'Kg', 'Bag', 'Box', 'Pair', 'Meter', 'Bundle', 'Drum', 'Gallon', 'Tin', 'Pack'] as const;

export const GRN_CATEGORIES = [
  'Safety Materials',
  'Spare Parts',
  'Lube Oil',
  'Office Equipment',
  'Office Consumable',
  'Field Consumables',
] as const;

export const GRN_WAREHOUSE_LOCATIONS = ['OB/OB', 'Oando WH', 'EOC', 'KWALE', 'EBOCHA'] as const;
