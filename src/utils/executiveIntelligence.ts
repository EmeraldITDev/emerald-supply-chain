import type { MRF, SRF, Vendor } from "@/types";

/**
 * Executive intelligence layer.
 * Pure aggregation over data the SCM portal already fetches (MRFs, SRFs, vendors).
 * No new backend systems — this only re-reads existing records.
 */

export type Severity = "critical" | "high" | "medium";

export interface ExecAlert {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  count?: number;
  /** Drill-down bucket key handled by the dashboard. */
  bucket: DrillBucket;
}

export type DrillBucket =
  | "pending_approval"
  | "stalled"
  | "po_active"
  | "po_pending"
  | "po_awaiting_delivery"
  | "po_overdue"
  | "po_completed"
  | "high_value"
  | "open_material"
  | "open_service"
  | "vendor_concentration";

export interface TrendPoint {
  label: string;
  value: number;
  count: number;
}

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const mrfCost = (m: MRF): number =>
  num((m as { estimated_cost?: string }).estimated_cost ?? m.estimatedCost);

export const mrfState = (m: MRF): string =>
  String(
    (m as { workflow_state?: string }).workflow_state ??
      m.workflowState ??
      (m as { current_stage?: string }).current_stage ??
      m.currentStage ??
      m.status ??
      "",
  ).toLowerCase();

export const mrfStatus = (m: MRF): string => String(m.status ?? "").toLowerCase();

export const mrfDate = (m: MRF): Date | null => {
  const raw =
    (m as { updated_at?: string }).updated_at ??
    (m as { created_at?: string }).created_at ??
    m.date;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const mrfCreated = (m: MRF): Date | null => {
  const raw = (m as { created_at?: string }).created_at ?? m.date;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const daysSince = (d: Date | null): number =>
  d ? Math.floor((Date.now() - d.getTime()) / 86_400_000) : 0;

export const hasPO = (m: MRF): boolean =>
  Boolean((m as { po_number?: string }).po_number || m.poNumber) ||
  /po_generated|po_signed|po_pending|delivery|grn/.test(mrfState(m));

export const isCompleted = (m: MRF): boolean =>
  /completed|closed|delivered|paid/.test(mrfState(m)) ||
  Boolean((m as { grn_completed?: boolean }).grn_completed || m.grnCompleted);

export const isRejected = (m: MRF): boolean => /reject|cancel/.test(mrfState(m));

export const isPendingApproval = (m: MRF): boolean =>
  !isCompleted(m) &&
  !isRejected(m) &&
  /review|approval|submitted|pending/.test(mrfState(m));

export const isAwaitingDelivery = (m: MRF): boolean =>
  hasPO(m) && !isCompleted(m) && !isRejected(m);

export const isPoPendingApproval = (m: MRF): boolean =>
  /po_pending|po_generated|final_approval|awaiting_signature/.test(mrfState(m)) &&
  !isCompleted(m) &&
  !isRejected(m);

const STALL_DAYS = 7;
const OVERDUE_DAYS = 21;
export const HIGH_VALUE_THRESHOLD = 5_000_000;

export const isStalled = (m: MRF): boolean =>
  isPendingApproval(m) && daysSince(mrfDate(m)) >= STALL_DAYS;

export const isOverduePO = (m: MRF): boolean =>
  isAwaitingDelivery(m) && daysSince(mrfCreated(m)) >= OVERDUE_DAYS;

export const vendorName = (m: MRF): string =>
  String(
    (m as { vendor_name?: string; selected_vendor_name?: string; vendor?: { name?: string } })
      .vendor_name ??
      (m as { selected_vendor_name?: string }).selected_vendor_name ??
      (m as { vendor?: { name?: string } }).vendor?.name ??
      "",
  ).trim();

export const projectName = (m: MRF): string =>
  String(
    (m as { project_name?: string; project?: { name?: string } }).project_name ??
      (m as { project?: { name?: string } }).project?.name ??
      m.department ??
      "Unassigned",
  ).trim();

export function sumBy<T>(rows: T[], fn: (r: T) => number): number {
  return rows.reduce((s, r) => s + fn(r), 0);
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return current ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function spendTrend(mrfs: MRF[], months = 6): TrendPoint[] {
  const now = new Date();
  const buckets: TrendPoint[] = [];
  const index = new Map<string, TrendPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const point: TrendPoint = {
      label: d.toLocaleString("en-NG", { month: "short" }),
      value: 0,
      count: 0,
    };
    index.set(monthKey(d), point);
    buckets.push(point);
  }
  for (const m of mrfs) {
    const created = mrfCreated(m);
    if (!created) continue;
    const point = index.get(monthKey(created));
    if (!point) continue;
    point.value += mrfCost(m);
    point.count += 1;
  }
  return buckets;
}

export interface Concentration {
  name: string;
  value: number;
  count: number;
}

export function concentrationBy(
  mrfs: MRF[],
  keyFn: (m: MRF) => string,
  limit = 5,
): Concentration[] {
  const map = new Map<string, Concentration>();
  for (const m of mrfs) {
    const name = keyFn(m);
    if (!name) continue;
    const entry = map.get(name) ?? { name, value: 0, count: 0 };
    entry.value += mrfCost(m);
    entry.count += 1;
    map.set(name, entry);
  }
  return [...map.values()].sort((a, b) => b.value - a.value).slice(0, limit);
}

export interface ExecSnapshot {
  activeCases: number;
  openMaterial: number;
  openService: number;
  pendingApproval: number;
  activePOs: number;
  posPendingApproval: number;
  posAwaitingDelivery: number;
  posCompleted: number;
  posOverdue: number;
  highValue: MRF[];
  stalled: MRF[];
  completedThisMonth: number;
  activeValue: number;
  pendingValue: number;
  completedValue: number;
  awaitingDeliveryValue: number;
  atRiskValue: number;
  monthValue: number;
  prevMonthValue: number;
  monthCount: number;
  prevMonthCount: number;
  trend: TrendPoint[];
  byProject: Concentration[];
  byVendor: Concentration[];
  pipeline: { label: string; count: number; bucket: DrillBucket }[];
}

export function buildSnapshot(mrfs: MRF[], srfs: SRF[]): ExecSnapshot {
  const live = mrfs.filter((m) => !isRejected(m));
  const completed = live.filter(isCompleted);
  const open = live.filter((m) => !isCompleted(m));
  const pending = open.filter(isPendingApproval);
  const withPO = open.filter(hasPO);
  const overdue = withPO.filter(isOverduePO);
  const highValue = open
    .filter((m) => mrfCost(m) >= HIGH_VALUE_THRESHOLD)
    .sort((a, b) => mrfCost(b) - mrfCost(a));
  const stalled = open.filter(isStalled).sort((a, b) => daysSince(mrfDate(b)) - daysSince(mrfDate(a)));

  const trend = spendTrend(live);
  const monthPoint = trend[trend.length - 1];
  const prevPoint = trend[trend.length - 2];

  const openSrfs = (srfs ?? []).filter(
    (s) => !/complet|closed|reject|cancel/i.test(String((s as { status?: string }).status ?? "")),
  );

  const inProcurement = open.filter(
    (m) => /procurement|rfq|quote|vendor_select/.test(mrfState(m)) && !hasPO(m),
  );

  return {
    activeCases: open.length + openSrfs.length,
    openMaterial: open.length,
    openService: openSrfs.length,
    pendingApproval: pending.length,
    activePOs: withPO.length,
    posPendingApproval: open.filter(isPoPendingApproval).length,
    posAwaitingDelivery: withPO.filter((m) => !isPoPendingApproval(m)).length,
    posCompleted: completed.filter(hasPO).length,
    posOverdue: overdue.length,
    highValue,
    stalled,
    completedThisMonth: completed.filter(
      (m) => daysSince(mrfDate(m)) <= 30,
    ).length,
    activeValue: sumBy(withPO, mrfCost),
    pendingValue: sumBy(pending, mrfCost),
    completedValue: sumBy(completed, mrfCost),
    awaitingDeliveryValue: sumBy(withPO, mrfCost),
    atRiskValue: sumBy(overdue, mrfCost),
    monthValue: monthPoint?.value ?? 0,
    prevMonthValue: prevPoint?.value ?? 0,
    monthCount: monthPoint?.count ?? 0,
    prevMonthCount: prevPoint?.count ?? 0,
    trend,
    byProject: concentrationBy(live, projectName),
    byVendor: concentrationBy(live.filter(hasPO), vendorName),
    pipeline: [
      { label: "Awaiting review", count: open.filter((m) => /submitted|review/.test(mrfState(m))).length, bucket: "pending_approval" },
      { label: "Pending approval", count: pending.length, bucket: "pending_approval" },
      { label: "Under procurement", count: inProcurement.length, bucket: "open_material" },
      { label: "Awaiting delivery", count: withPO.length, bucket: "po_awaiting_delivery" },
      { label: "Recently completed", count: completed.filter((m) => daysSince(mrfDate(m)) <= 30).length, bucket: "po_completed" },
    ],
  };
}

export function buildAlerts(
  snap: ExecSnapshot,
  mrfs: MRF[],
  vendors: Vendor[],
): ExecAlert[] {
  const alerts: ExecAlert[] = [];

  if (snap.posOverdue > 0) {
    alerts.push({
      id: "po-overdue",
      severity: "critical",
      title: `${snap.posOverdue} purchase order${snap.posOverdue > 1 ? "s" : ""} overdue`,
      detail: `₦${Math.round(snap.atRiskValue).toLocaleString()} committed and still undelivered after ${OVERDUE_DAYS} days.`,
      count: snap.posOverdue,
      bucket: "po_overdue",
    });
  }

  if (snap.stalled.length > 0) {
    alerts.push({
      id: "stalled",
      severity: snap.stalled.length > 5 ? "critical" : "high",
      title: `${snap.stalled.length} request${snap.stalled.length > 1 ? "s" : ""} stuck in approval`,
      detail: `No movement for ${STALL_DAYS}+ days — a workflow bottleneck is forming.`,
      count: snap.stalled.length,
      bucket: "stalled",
    });
  }

  if (snap.highValue.length > 0) {
    alerts.push({
      id: "high-value",
      severity: "high",
      title: `${snap.highValue.length} high-value commitment${snap.highValue.length > 1 ? "s" : ""} in flight`,
      detail: `Each above ₦${HIGH_VALUE_THRESHOLD.toLocaleString()} — total ₦${Math.round(
        sumBy(snap.highValue, mrfCost),
      ).toLocaleString()}.`,
      count: snap.highValue.length,
      bucket: "high_value",
    });
  }

  const top = snap.byVendor[0];
  const totalVendorValue = sumBy(snap.byVendor, (v) => v.value);
  if (top && totalVendorValue > 0 && top.value / totalVendorValue >= 0.5 && snap.byVendor.length > 1) {
    alerts.push({
      id: "vendor-concentration",
      severity: "medium",
      title: `Spend concentrated with ${top.name}`,
      detail: `${Math.round((top.value / totalVendorValue) * 100)}% of active purchase value sits with a single vendor.`,
      bucket: "vendor_concentration",
    });
  }

  const growth = pctChange(snap.monthValue, snap.prevMonthValue);
  if (growth !== null && growth >= 40 && snap.monthValue > 0) {
    alerts.push({
      id: "spend-spike",
      severity: "medium",
      title: `Procurement value up ${Math.round(growth)}% this month`,
      detail: `₦${Math.round(snap.monthValue).toLocaleString()} raised this month versus ₦${Math.round(
        snap.prevMonthValue,
      ).toLocaleString()} last month.`,
      bucket: "open_material",
    });
  }

  const pendingVendors = (vendors ?? []).filter((v) =>
    /pending|review|incomplete/i.test(String((v as { status?: string }).status ?? "")),
  );
  if (pendingVendors.length > 0) {
    alerts.push({
      id: "vendor-pending",
      severity: "medium",
      title: `${pendingVendors.length} vendor record${pendingVendors.length > 1 ? "s" : ""} awaiting action`,
      detail: "Registrations or documents are incomplete and blocking sourcing.",
      count: pendingVendors.length,
      bucket: "vendor_concentration",
    });
  }

  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function bucketRecords(bucket: DrillBucket, mrfs: MRF[]): MRF[] {
  const live = mrfs.filter((m) => !isRejected(m));
  const open = live.filter((m) => !isCompleted(m));
  switch (bucket) {
    case "pending_approval":
      return open.filter(isPendingApproval);
    case "stalled":
      return open.filter(isStalled);
    case "po_active":
    case "po_awaiting_delivery":
      return open.filter(hasPO);
    case "po_pending":
      return open.filter(isPoPendingApproval);
    case "po_overdue":
      return open.filter(isOverduePO);
    case "po_completed":
      return live.filter((m) => isCompleted(m) && hasPO(m));
    case "high_value":
      return open.filter((m) => mrfCost(m) >= HIGH_VALUE_THRESHOLD);
    case "open_material":
      return open;
    default:
      return open;
  }
}

export const BUCKET_LABELS: Record<DrillBucket, string> = {
  pending_approval: "Requests pending approval",
  stalled: "Requests stuck in approval",
  po_active: "Active purchase orders",
  po_pending: "Purchase orders pending approval",
  po_awaiting_delivery: "Purchase orders awaiting delivery",
  po_overdue: "Overdue purchase orders",
  po_completed: "Completed purchase orders",
  high_value: "High-value commitments",
  open_material: "Open material requests",
  open_service: "Open service requests",
  vendor_concentration: "Vendor exposure",
};
