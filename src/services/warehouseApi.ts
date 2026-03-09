import type { MaterialConsumption, CreateMaterialConsumptionData } from '@/types/warehouse';

const STORAGE_KEY = 'warehouse_materials_consumption';

// LocalStorage-based service (replace with API calls when backend is ready)
// Backend endpoints required:
// POST   /warehouse/materials-consumption
// GET    /warehouse/materials-consumption
// POST   /warehouse/materials-consumption/bulk-upload
// GET    /warehouse/materials-consumption/templates

const getStoredRecords = (): MaterialConsumption[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecords = (records: MaterialConsumption[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

export const warehouseApi = {
  getMaterialsConsumption: (filters?: {
    month?: string;
    location?: string;
    fse?: string;
  }): MaterialConsumption[] => {
    let records = getStoredRecords();

    if (filters?.month) {
      records = records.filter(r => r.dateIssued.startsWith(filters.month!));
    }
    if (filters?.location) {
      records = records.filter(r => r.location === filters.location);
    }
    if (filters?.fse) {
      records = records.filter(r =>
        (r.fse || '').toLowerCase().includes(filters.fse!.toLowerCase())
      );
    }

    return records;
  },

  createMaterialConsumption: (data: CreateMaterialConsumptionData): MaterialConsumption => {
    const records = getStoredRecords();
    const record: MaterialConsumption = {
      ...data,
      id: `DMC-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveRecords([record, ...records]);
    return record;
  },

  bulkCreateMaterialConsumption: (items: CreateMaterialConsumptionData[]): MaterialConsumption[] => {
    const records = getStoredRecords();
    const newRecords = items.map((data, idx) => ({
      ...data,
      id: `DMC-${Date.now()}-${idx}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    saveRecords([...newRecords, ...records]);
    return newRecords;
  },

  deleteMaterialConsumption: (id: string): void => {
    const records = getStoredRecords();
    saveRecords(records.filter(r => r.id !== id));
  },
};
