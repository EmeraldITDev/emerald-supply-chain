import { apiRequest, API_BASE_URL, getAuthToken } from '@/services/api';
import type { ApiResponse } from '@/types';
import type {
  CatalogueItem,
  CreateCatalogueItemData,
  CreateGoodsReceiptData,
  CreateStockAdjustmentData,
  CreateStockCountData,
  CreateStockTransferData,
  CreateVendorReturnData,
  CreateWarehouseLocationData,
  InventoryRecord,
  LowStockAlert,
  StockCount,
  StockCountLine,
  StockMovement,
  WarehouseDashboardSummary,
  WarehouseLocation,
  WarehouseReportFilters,
  WarehouseReportKey,
} from '@/types/warehouse-inventory';

/**
 * Emerald Warehouse & Inventory Management (EWIMS) API client.
 * Follows the existing Laravel API conventions: `/api/warehouse/*`,
 * Sanctum bearer auth via `apiRequest`, `{ success, data }` envelopes.
 */

const dispatchRefresh = () => {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event('app:refresh'));
    } catch {
      // no-op
    }
  }
};

const qs = (params: Record<string, unknown> = {}) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.append(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

const listOf = <T,>(res: ApiResponse<unknown>, key: string): T[] => {
  const data = res.data as Record<string, unknown> | T[] | undefined;
  if (Array.isArray(data)) return data as T[];
  const nested = data?.[key as keyof typeof data];
  if (Array.isArray(nested)) return nested as T[];
  const items = (data as { items?: T[]; data?: T[] } | undefined)?.items
    ?? (data as { data?: T[] } | undefined)?.data;
  return Array.isArray(items) ? items : [];
};

const mutate = async <T,>(endpoint: string, method: string, body?: unknown) => {
  const res = await apiRequest<T>(endpoint, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.success) throw new Error(res.error || 'Request failed');
  dispatchRefresh();
  return res.data as T;
};

export const warehouseInventoryApi = {
  // ---- Warehouse structure -------------------------------------------------
  async getLocations(params: { warehouse_id?: string; level?: string; tree?: boolean } = {}) {
    const res = await apiRequest<unknown>(`/warehouse/locations${qs({ tree: 1, ...params })}`);
    if (!res.success) throw new Error(res.error || 'Failed to load warehouse locations');
    return listOf<WarehouseLocation>(res, 'locations');
  },
  createLocation: (data: CreateWarehouseLocationData) =>
    mutate<WarehouseLocation>('/warehouse/locations', 'POST', data),
  updateLocation: (id: string, data: Partial<CreateWarehouseLocationData>) =>
    mutate<WarehouseLocation>(`/warehouse/locations/${id}`, 'PUT', data),
  deleteLocation: (id: string) => mutate<void>(`/warehouse/locations/${id}`, 'DELETE'),

  // ---- Item catalogue ------------------------------------------------------
  async getItems(params: { search?: string; category?: string; item_type?: string; per_page?: number } = {}) {
    const res = await apiRequest<unknown>(`/warehouse/items${qs({ per_page: 50, ...params })}`);
    if (!res.success) throw new Error(res.error || 'Failed to load item catalogue');
    return listOf<CatalogueItem>(res, 'items');
  },
  async getItemByCode(code: string) {
    const res = await apiRequest<CatalogueItem>(`/warehouse/items/lookup${qs({ code })}`);
    if (!res.success) throw new Error(res.error || 'Item not found');
    return res.data as CatalogueItem;
  },
  createItem: (data: CreateCatalogueItemData) =>
    mutate<CatalogueItem>('/warehouse/items', 'POST', data),
  updateItem: (id: string, data: Partial<CreateCatalogueItemData>) =>
    mutate<CatalogueItem>(`/warehouse/items/${id}`, 'PUT', data),
  deleteItem: (id: string) => mutate<void>(`/warehouse/items/${id}`, 'DELETE'),

  /** Multipart upload of item images / datasheets — stored on the existing S3 bucket. */
  async uploadItemAttachments(itemId: string, files: File[], kind: 'image' | 'document' = 'document') {
    const { token } = getAuthToken();
    const form = new FormData();
    files.forEach((f, i) => {
      form.append(`attachments[${i}][file]`, f);
      form.append(`attachments[${i}][kind]`, kind);
    });
    const res = await fetch(`${API_BASE_URL}/warehouse/items/${itemId}/attachments`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed [${res.status}]: ${await res.text()}`);
    dispatchRefresh();
    return res.json();
  },

  // ---- Inventory -----------------------------------------------------------
  async getInventory(
    params: {
      search?: string;
      location_id?: string;
      category?: string;
      low_stock?: boolean;
      quarantined?: boolean;
      per_page?: number;
    } = {},
  ) {
    const res = await apiRequest<unknown>(`/warehouse/inventory${qs({ per_page: 100, ...params })}`);
    if (!res.success) throw new Error(res.error || 'Failed to load inventory');
    return listOf<InventoryRecord>(res, 'inventory');
  },
  async getLowStockAlerts() {
    const res = await apiRequest<unknown>('/warehouse/inventory/low-stock');
    if (!res.success) throw new Error(res.error || 'Failed to load low stock alerts');
    return listOf<LowStockAlert>(res, 'alerts');
  },

  // ---- Movements -----------------------------------------------------------
  async getMovements(params: { item_id?: string; location_id?: string; type?: string; per_page?: number } = {}) {
    const res = await apiRequest<unknown>(`/warehouse/movements${qs({ per_page: 50, ...params })}`);
    if (!res.success) throw new Error(res.error || 'Failed to load stock movements');
    return listOf<StockMovement>(res, 'movements');
  },
  createTransfer: (data: CreateStockTransferData) =>
    mutate<StockMovement>('/warehouse/movements/transfer', 'POST', data),
  createAdjustment: (data: CreateStockAdjustmentData) =>
    mutate<StockMovement>('/warehouse/movements/adjustment', 'POST', data),
  approveAdjustment: (movementId: string) =>
    mutate<StockMovement>(`/warehouse/movements/${movementId}/approve`, 'POST'),
  setQuarantine: (inventoryId: string, quarantined: boolean, reason_note?: string) =>
    mutate<InventoryRecord>(`/warehouse/inventory/${inventoryId}/quarantine`, 'POST', {
      quarantined,
      reason_note,
    }),
  createVendorReturn: (data: CreateVendorReturnData) =>
    mutate<StockMovement>('/warehouse/movements/vendor-return', 'POST', data),

  // ---- Goods receipt (extends the existing GRN workflow) -------------------
  createGoodsReceipt: (data: CreateGoodsReceiptData) =>
    mutate<{ grn_id?: string; grn_number?: string }>('/warehouse/goods-receipts', 'POST', data),
  async getGoodsReceipts(params: { po_id?: string; date_from?: string; date_to?: string } = {}) {
    const res = await apiRequest<unknown>(`/warehouse/goods-receipts${qs(params)}`);
    if (!res.success) throw new Error(res.error || 'Failed to load goods receipts');
    return listOf<Record<string, unknown>>(res, 'receipts');
  },

  // ---- Stock counts --------------------------------------------------------
  async getStockCounts(params: { status?: string } = {}) {
    const res = await apiRequest<unknown>(`/warehouse/stock-counts${qs(params)}`);
    if (!res.success) throw new Error(res.error || 'Failed to load stock counts');
    return listOf<StockCount>(res, 'counts');
  },
  async getStockCount(id: string) {
    const res = await apiRequest<StockCount>(`/warehouse/stock-counts/${id}`);
    if (!res.success) throw new Error(res.error || 'Failed to load stock count');
    return res.data as StockCount;
  },
  createStockCount: (data: CreateStockCountData) =>
    mutate<StockCount>('/warehouse/stock-counts', 'POST', data),
  submitCountLines: (id: string, lines: Pick<StockCountLine, 'id' | 'counted_qty' | 'note'>[]) =>
    mutate<StockCount>(`/warehouse/stock-counts/${id}/lines`, 'POST', { lines }),
  approveStockCount: (id: string) => mutate<StockCount>(`/warehouse/stock-counts/${id}/approve`, 'POST'),
  postStockCount: (id: string) => mutate<StockCount>(`/warehouse/stock-counts/${id}/post`, 'POST'),

  // ---- Dashboard & reports -------------------------------------------------
  async getDashboard() {
    const res = await apiRequest<WarehouseDashboardSummary>('/warehouse/dashboard');
    if (!res.success) throw new Error(res.error || 'Failed to load warehouse dashboard');
    return (res.data ?? {}) as WarehouseDashboardSummary;
  },
  async getReport(report: WarehouseReportKey, filters: WarehouseReportFilters = {}) {
    const res = await apiRequest<unknown>(
      `/warehouse/reports/${report.replace(/_/g, '-')}${qs({ ...filters })}`,
    );
    if (!res.success) throw new Error(res.error || 'Failed to load report');
    const data = res.data as { rows?: Record<string, unknown>[] } | Record<string, unknown>[] | undefined;
    return Array.isArray(data) ? data : (data?.rows ?? []);
  },
  /** Server-side export — mirrors the existing reports export convention. */
  reportExportUrl: (
    report: WarehouseReportKey,
    format: 'pdf' | 'xlsx' | 'csv',
    filters: WarehouseReportFilters = {},
  ) => `${API_BASE_URL}/warehouse/reports/${report.replace(/_/g, '-')}/export${qs({ format, ...filters })}`,
};