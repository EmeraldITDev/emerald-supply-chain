import type { DashboardKPIs, Vendor } from '@/types';

export interface ProcurementOverviewContext {
  readOnly: boolean;
  isProcurementOverviewOnly: boolean;
  canManageProcurement: boolean;
}

/** Vendor-management stats block on GET /dashboard/procurement-manager. */
export interface ProcurementDashboardStats {
  totalVendors: number;
  pendingKYC: number;
  awaitingReview: number;
  avgRating: number;
  onTimeDelivery: number;
  pendingMRFs: number;
}

export interface ProcurementManagerDashboardPayload extends ProcurementOverviewContext {
  kpis?: DashboardKPIs;
  stats?: ProcurementDashboardStats;
  [key: string]: unknown;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeKpis(raw: Record<string, unknown> | undefined): DashboardKPIs | undefined {
  if (!raw) return undefined;
  const k = (raw.kpis as Record<string, unknown>) ?? raw;
  return {
    totalPosGenerated: num(k.totalPosGenerated ?? k.total_pos_generated),
    totalMrfsApproved: num(k.totalMrfsApproved ?? k.total_mrfs_approved),
    totalSrfsApproved: num(k.totalSrfsApproved ?? k.total_srfs_approved),
    priceComparisonCount: num(k.priceComparisonCount ?? k.price_comparison_count),
  };
}

/** Normalize vendor stats — handles camelCase, snake_case, and root-level aliases. */
export function normalizeProcurementDashboardStats(
  statsRaw: unknown,
  rootRaw?: Record<string, unknown>,
): ProcurementDashboardStats {
  const s = (statsRaw && typeof statsRaw === 'object' ? statsRaw : {}) as Record<
    string,
    unknown
  >;
  const root = rootRaw ?? {};
  return {
    totalVendors: num(
      s.totalVendors ??
        s.total_vendors ??
        s.activeVendors ??
        s.active_vendors ??
        s.vendorCount ??
        s.vendor_count ??
        root.totalVendors ??
        root.total_vendors ??
        root.activeVendors ??
        root.active_vendors,
    ),
    pendingKYC: num(
      s.pendingKYC ?? s.pending_kyc ?? s.pendingKyc ?? root.pendingKYC ?? root.pending_kyc,
    ),
    awaitingReview: num(
      s.awaitingReview ?? s.awaiting_review ?? root.awaitingReview ?? root.awaiting_review,
    ),
    avgRating: num(
      s.avgRating ??
        s.avg_rating ??
        s.averageRating ??
        s.average_rating ??
        root.avgRating ??
        root.avg_rating,
    ),
    onTimeDelivery: num(
      s.onTimeDelivery ??
        s.on_time_delivery ??
        s.onTimeDeliveryRate ??
        s.on_time_delivery_rate ??
        root.onTimeDelivery ??
        root.on_time_delivery,
    ),
    pendingMRFs: num(
      s.pendingMRFs ?? s.pending_mrfs ?? s.pendingMrf ?? root.pendingMRFs ?? root.pending_mrfs,
    ),
  };
}

/** Count directory vendors for KPIs (Active + Pending; Inactive excluded by default API). */
export function countRegisteredVendors(vendors: Vendor[]): number {
  return vendors.filter((v) => v.status === 'Active' || v.status === 'Pending').length;
}

/**
 * Prefer a positive vendor count from the live directory when dashboard stats
 * are missing or zero (common when the backend uses alternate field names).
 */
export function resolveTotalVendorCount(
  stats: ProcurementDashboardStats | undefined,
  vendors: Vendor[] | undefined,
): number {
  const fromStats = stats?.totalVendors ?? 0;
  const fromList = vendors ? countRegisteredVendors(vendors) : 0;
  if (fromStats > 0) return fromStats;
  return fromList;
}

export function normalizeProcurementManagerDashboard(
  data: unknown,
): ProcurementManagerDashboardPayload {
  const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const readOnly = Boolean(raw.readOnly ?? raw.read_only);
  const isProcurementOverviewOnly = Boolean(
    raw.isProcurementOverviewOnly ?? raw.is_procurement_overview_only,
  );
  const canManageProcurement = Boolean(
    raw.canManageProcurement ?? raw.can_manage_procurement ?? !readOnly,
  );
  const kpis = normalizeKpis(raw);
  const stats = normalizeProcurementDashboardStats(raw.stats, raw);
  return {
    ...raw,
    readOnly,
    isProcurementOverviewOnly,
    canManageProcurement,
    kpis,
    stats,
  };
}
