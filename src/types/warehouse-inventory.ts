// Emerald Warehouse & Inventory Management (EWIMS) types.
// Mirrors the backend contract documented in WAREHOUSE_INVENTORY_BACKEND_SPEC.md.

export type WarehouseLocationLevel = 'warehouse' | 'zone' | 'aisle' | 'rack' | 'shelf' | 'bin';

export const WAREHOUSE_LOCATION_LEVELS: WarehouseLocationLevel[] = [
  'warehouse',
  'zone',
  'aisle',
  'rack',
  'shelf',
  'bin',
];

export interface WarehouseLocation {
  id: string;
  code: string;
  name: string;
  level: WarehouseLocationLevel;
  parent_id?: string | null;
  warehouse_id?: string | null;
  capacity?: number | null;
  occupied?: number | null;
  utilization_percent?: number | null;
  is_active?: boolean;
  item_count?: number | null;
  children?: WarehouseLocation[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateWarehouseLocationData {
  code: string;
  name: string;
  level: WarehouseLocationLevel;
  parent_id?: string | null;
  capacity?: number | null;
  is_active?: boolean;
}

export type ItemType =
  | 'spare_part'
  | 'consumable'
  | 'raw_material'
  | 'finished_good'
  | 'tool'
  | 'equipment';

export const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: 'spare_part', label: 'Spare Part' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'finished_good', label: 'Finished Good' },
  { value: 'tool', label: 'Tool' },
  { value: 'equipment', label: 'Equipment' },
];

export interface CatalogueItemAttachment {
  id: string;
  name: string;
  url: string;
  type?: string | null;
  size?: number | null;
  uploaded_at?: string;
}

export interface CatalogueItem {
  id: string;
  sku: string;
  barcode?: string | null;
  qr_code?: string | null;
  description: string;
  item_type: ItemType | string;
  category?: string | null;
  subcategory?: string | null;
  manufacturer?: string | null;
  brand?: string | null;
  uom: string;
  alternate_uoms?: { uom: string; factor: number }[];
  weight_kg?: number | null;
  dimensions?: string | null;
  hs_code?: string | null;
  tax_classification?: string | null;
  hazard_classification?: string | null;
  safety_information?: string | null;
  certifications?: string[];
  images?: CatalogueItemAttachment[];
  attachments?: CatalogueItemAttachment[];
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCatalogueItemData {
  sku: string;
  description: string;
  item_type: ItemType | string;
  uom: string;
  barcode?: string;
  category?: string;
  subcategory?: string;
  manufacturer?: string;
  brand?: string;
  weight_kg?: number;
  dimensions?: string;
  hs_code?: string;
  tax_classification?: string;
  hazard_classification?: string;
  safety_information?: string;
}

export type ValuationMethod = 'fifo' | 'lifo' | 'weighted_average';

export const VALUATION_METHODS: { value: ValuationMethod; label: string }[] = [
  { value: 'fifo', label: 'FIFO' },
  { value: 'lifo', label: 'LIFO' },
  { value: 'weighted_average', label: 'Weighted Average' },
];

export interface InventoryRecord {
  id: string;
  item_id: string;
  sku: string;
  description: string;
  category?: string | null;
  uom: string;
  location_id?: string | null;
  location_path?: string | null;
  bin_code?: string | null;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  reorder_level?: number | null;
  safety_stock_level?: number | null;
  batch_number?: string | null;
  lot_number?: string | null;
  serial_number?: string | null;
  expiry_date?: string | null;
  manufacturing_date?: string | null;
  unit_cost?: number | null;
  total_value?: number | null;
  valuation_method?: ValuationMethod | string | null;
  is_quarantined?: boolean;
  last_movement_at?: string | null;
}

export type StockMovementType =
  | 'receipt'
  | 'transfer'
  | 'adjustment'
  | 'issue'
  | 'return_to_vendor'
  | 'quarantine'
  | 'count_posting';

export interface StockMovement {
  id: string;
  movement_type: StockMovementType | string;
  item_id: string;
  sku: string;
  description?: string | null;
  quantity: number;
  uom?: string | null;
  from_location_id?: string | null;
  from_location_path?: string | null;
  to_location_id?: string | null;
  to_location_path?: string | null;
  reason_code?: string | null;
  reason_note?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  performed_by_name?: string | null;
  requires_approval?: boolean;
  approval_status?: 'pending' | 'approved' | 'rejected' | null;
  created_at: string;
}

export interface CreateStockTransferData {
  item_id: string;
  quantity: number;
  from_location_id: string;
  to_location_id: string;
  batch_number?: string;
  note?: string;
}

export const STOCK_ADJUSTMENT_REASONS = [
  'damage',
  'loss',
  'count_discrepancy',
  'expiry',
  'quality_hold',
  'other',
] as const;

export type StockAdjustmentReason = (typeof STOCK_ADJUSTMENT_REASONS)[number];

export interface CreateStockAdjustmentData {
  item_id: string;
  location_id: string;
  quantity_delta: number;
  reason_code: StockAdjustmentReason | string;
  reason_note: string;
}

export interface CreateVendorReturnData {
  item_id: string;
  vendor_id: string;
  po_id?: string;
  quantity: number;
  location_id: string;
  reason_note: string;
}

export type StockCountStatus =
  | 'scheduled'
  | 'in_progress'
  | 'pending_review'
  | 'approved'
  | 'posted'
  | 'cancelled';

export interface StockCountLine {
  id: string;
  item_id: string;
  sku: string;
  description?: string | null;
  location_id?: string | null;
  location_path?: string | null;
  expected_qty: number;
  counted_qty?: number | null;
  variance?: number | null;
  note?: string | null;
}

export interface StockCount {
  id: string;
  reference: string;
  count_type: 'cycle' | 'full' | string;
  status: StockCountStatus | string;
  scheduled_date?: string | null;
  warehouse_id?: string | null;
  location_id?: string | null;
  location_path?: string | null;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  lines?: StockCountLine[];
  variance_count?: number | null;
  created_at?: string;
}

export interface CreateStockCountData {
  count_type: 'cycle' | 'full';
  scheduled_date: string;
  location_id?: string;
  assigned_to_id?: string;
  note?: string;
}

export interface LowStockAlert {
  id: string;
  item_id: string;
  sku: string;
  description: string;
  qty_on_hand: number;
  reorder_level?: number | null;
  safety_stock_level?: number | null;
  location_path?: string | null;
  severity?: 'low' | 'critical' | string;
  uom?: string | null;
}

export interface WarehouseDashboardSummary {
  total_inventory_value?: number;
  total_stock_items?: number;
  qty_available?: number;
  qty_reserved?: number;
  low_stock_count?: number;
  overstock_count?: number;
  dead_stock_count?: number;
  pending_counts?: number;
  utilization?: { location_id: string; location_path: string; utilization_percent: number }[];
  recent_receipts?: {
    id: string;
    grn_number?: string | null;
    po_number?: string | null;
    received_at?: string | null;
    vendor_name?: string | null;
  }[];
  recent_movements?: StockMovement[];
}

export type WarehouseReportKey =
  | 'inventory_summary'
  | 'stock_ledger'
  | 'inventory_aging'
  | 'low_stock'
  | 'dead_stock'
  | 'abc_analysis'
  | 'stock_valuation'
  | 'goods_receipt_history';

export interface WarehouseReportFilters {
  date_from?: string;
  date_to?: string;
  warehouse_id?: string;
  category?: string;
  item_id?: string;
  valuation_method?: ValuationMethod;
  dead_stock_days?: number;
}

export interface GoodsReceiptLineInput {
  po_line_id: string;
  item_id?: string;
  qty_received: number;
  location_id: string;
  batch_number?: string;
  lot_number?: string;
  serial_number?: string;
  expiry_date?: string;
  manufacturing_date?: string;
  discrepancy_note?: string;
}

export interface CreateGoodsReceiptData {
  po_id: string;
  mrf_id?: string;
  received_at?: string;
  waybill_number?: string;
  lines: GoodsReceiptLineInput[];
}