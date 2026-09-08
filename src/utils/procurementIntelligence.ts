import type { MRF, SRF, Vendor } from "@/types";
import {
  daysSince,
  hasPO,
  isCompleted,
  isPendingApproval,
  isRejected,
  mrfCost,
  mrfCreated,
  mrfDate,
  mrfState,
  pctChange,
  projectName,
  sumBy,
  vendorName,
} from "./executiveIntelligence";

/**
 * Procurement intelligence layer.
 *
 * Pure aggregation over records the SCM portal already fetches (MRFs, SRFs,
 * vendors, platform KPIs). No new backend systems. Every metric below is
 * derived from a field the API already returns; where a field does not exist
 * the metric is reported as a data gap instead of being invented.
 */

/* ------------------------------------------------------------------ */
/* Period handling                                                     */
/* ------------------------------------------------------------------ */

export type PeriodKey = "7d" | "30d" | "3m" | "6m" | "ytd" | "custom";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "ytd", label: "This year" },
  { key: "custom", label: "Custom range" },
];

export interface Range {
  from: Date;
  to: Date;
  label: string;
  days: number;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export function periodRange(
  key: PeriodKey,
  custom?: { from?: Date; to?: Date },
): Range {
  const now = new Date();
  const to = endOfDay(key === "custom" && custom?.to ? custom.to : now);
  let from: Date;
  switch (key) {
    case "7d":
      from = startOfDay(new Date(now.getTime() - 6 * 86_400_000));
      break;
    case "30d":
      from = startOfDay(new Date(now.getTime() - 29 * 86_400_000));
      break;
    case "3m":
      from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()));
      break;
    case "6m":
      from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()));
      break;
    case "ytd":
      from = startOfDay(new Date(now.getFullYear(), 0, 1));
      break;
    default:
      from = startOfDay(custom?.from ?? new Date(now.getTime() - 29 * 86_400_000));
  }
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const preset = PERIOD_OPTIONS.find((p) => p.key === key);
  const label =
    key === "custom"
      ? `${from.toLocaleDateString("en-NG", { day: "numeric", month: "short" })} – ${to.toLocaleDateString(
          "en-NG",
          { day: "numeric", month: "short", year: "numeric" },
        )}`
      : (preset?.label ?? "Last 30 days");
  return { from, to, label, days };
}

export function previousRange(r: Range): Range {
  const span = r.to.getTime() - r.from.getTime();
  const to = new Date(r.from.getTime() - 1);
  const from = new Date(to.getTime() - span);
  return { from, to, label: "Previous period", days: r.days };
}

const inRange = (d: Date | null, r: Range) =>
  !!d && d.getTime() >= r.from.getTime() && d.getTime() <= r.to.getTime();

/* ------------------------------------------------------------------ */
/* Record readers                                                      */
/* ------------------------------------------------------------------ */

const raw = (r: unknown, key: string): string | undefined => {
  const v = (r as Record<string, unknown>)?.[key];
  return typeof v === "string" && v ? v : undefined;
};

const toDate = (v?: string): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** When the request cleared its final approval gate. */
export const approvedAt = (m: MRF): Date | null =>
  toDate(
    raw(m, "director_approved_at") ??
      raw(m, "scd_approved_at") ??
      raw(m, "scdApprovedAt") ??
      raw(m, "executive_approved_at") ??
      raw(m, "executiveApprovedAt") ??
      raw(m, "chairman_approved_at"),
  );

/** When procurement approved the request for sourcing. */
export const procurementApprovedAt = (m: MRF): Date | null =>
  toDate(raw(m, "procurement_approved_at") ?? raw(m, "procurementApprovedAt"));

/** When finance signed off. */
export const financeApprovedAt = (m: MRF): Date | null =>
  toDate(raw(m, "finance_approved_at") ?? raw(m, "financeApprovedAt"));

/** When the first RFQ was issued. */
export const rfqIssuedAt = (m: MRF): Date | null =>
  toDate(raw(m, "rfq_issued_at") ?? raw(m, "rfqIssuedAt"));

/** When the first vendor quotation arrived. */
export const quotationReceivedAt = (m: MRF): Date | null =>
  toDate(raw(m, "quotation_received_at") ?? raw(m, "quotationReceivedAt"));

/** When a purchase order came into existence for this request. */
export const poAt = (m: MRF): Date | null =>
  toDate(
    raw(m, "po_created_at") ??
      raw(m, "poCreatedAt") ??
      raw(m, "po_generated_at") ??
      raw(m, "poGeneratedAt") ??
      raw(m, "procurement_review_started_at"),
  );

/** When goods were actually received. */
export const deliveredAt = (m: MRF): Date | null =>
  toDate(
    raw(m, "actual_delivery_date") ??
      raw(m, "actualDeliveryDate") ??
      raw(m, "delivered_at") ??
      raw(m, "deliveredAt") ??
      raw(m, "goods_received_at") ??
      raw(m, "grn_completed_at") ??
      raw(m, "grnCompletedAt"),
  );

/** Promised delivery date recorded on the purchase order. */
export const expectedDeliveryAt = (m: MRF): Date | null =>
  toDate(
    raw(m, "expected_delivery_date") ??
      raw(m, "expectedDeliveryDate") ??
      raw(m, "delivery_due_date") ??
      raw(m, "required_by_date"),
  );

/** Backend-computed delivery status, when supplied. */
export const deliveryStatusOf = (m: MRF): string =>
  String(raw(m, "delivery_status") ?? raw(m, "deliveryStatus") ?? "").toLowerCase();

/** PO value recorded by the backend, falling back to the estimate. */
export const poValue = (m: MRF): number => {
  const r = m as unknown as Record<string, unknown>;
  const v = r.po_value ?? r.poValue ?? r.final_amount;

  const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : mrfCost(m);
};


export const srfCreated = (s: SRF): Date | null =>
  toDate((s as { created_at?: string }).created_at ?? s.createdAt ?? s.date);

export const srfApproved = (s: SRF): boolean =>
  /approved|po_|completed|delivered/i.test(
    String(
      (s as { workflow_state?: string }).workflow_state ??
        (s as { current_stage?: string }).current_stage ??
        (s as { status?: string }).status ??
        "",
    ),
  );

const DELIVERY_SLA_DAYS = 21;
const APPROVAL_SLA_DAYS = 3;
const STALL_DAYS = 7;
export const HIGH_VALUE = 5_000_000;

const days = (a: Date | null, b: Date | null): number | null =>
  a && b ? Math.max(0, (b.getTime() - a.getTime()) / 86_400_000) : null;

const avg = (values: (number | null)[]): number | null => {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
};

export const isApproved = (m: MRF): boolean =>
  !isRejected(m) && (approvedAt(m) != null || hasPO(m) || isCompleted(m) ||
    /approved|procurement|rfq|quote|vendor_select|po_/.test(mrfState(m)));

export const isDelivered = (m: MRF): boolean => {
  const status = deliveryStatusOf(m);
  if (status === "on_time" || status === "late" || status === "delivered") return true;
  return deliveredAt(m) != null || isCompleted(m);
};

/** Days a delivery ran past its promised date (null when not measurable). */
export const deliveryDelayDays = (m: MRF): number | null => {
  const done = deliveredAt(m);
  const expected = expectedDeliveryAt(m);
  if (!done || !expected) return null;
  return Math.round((done.getTime() - expected.getTime()) / 86_400_000);
};

export const deliveryLate = (m: MRF): boolean => {
  const status = deliveryStatusOf(m);
  if (status === "late") return true;
  if (status === "on_time") return false;
  const delay = deliveryDelayDays(m);
  if (delay != null) return delay > 0;
  const started = poAt(m) ?? approvedAt(m) ?? mrfCreated(m);
  const elapsed = days(started, deliveredAt(m));
  return elapsed != null && elapsed > DELIVERY_SLA_DAYS;
};

export const isOverdueDelivery = (m: MRF): boolean => {
  const status = deliveryStatusOf(m);
  if (status === "overdue") return true;
  if (status === "on_time" || status === "late" || status === "delivered") return false;
  if (!hasPO(m) || isDelivered(m) || isRejected(m)) return false;
  const expected = expectedDeliveryAt(m);
  if (expected) return expected.getTime() < Date.now();
  const started = poAt(m) ?? approvedAt(m) ?? mrfCreated(m);
  return daysSince(started) > DELIVERY_SLA_DAYS;
};


/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export interface ProcFilters {
  period: PeriodKey;
  from?: Date;
  to?: Date;
  project: string; // "all" or project/department name
  vendor: string; // "all" or vendor name
}

export const DEFAULT_FILTERS: ProcFilters = {
  period: "30d",
  project: "all",
  vendor: "all",
};

export function applyFilters(mrfs: MRF[], f: ProcFilters): MRF[] {
  return mrfs.filter((m) => {
    if (f.project !== "all" && projectName(m) !== f.project) return false;
    if (f.vendor !== "all" && vendorName(m) !== f.vendor) return false;
    return true;
  });
}

export function filterOptions(mrfs: MRF[]) {
  const projects = new Set<string>();
  const vendors = new Set<string>();
  for (const m of mrfs) {
    const p = projectName(m);
    if (p) projects.add(p);
    const v = vendorName(m);
    if (v) vendors.add(v);
  }
  return {
    projects: [...projects].sort(),
    vendors: [...vendors].sort(),
  };
}

/* ------------------------------------------------------------------ */
/* Trend series                                                        */
/* ------------------------------------------------------------------ */

export interface ActivityPoint {
  label: string;
  materialRequests: number;
  serviceRequests: number;
  approved: number;
  purchaseOrders: number;
  value: number;
}

function bucketsFor(r: Range): { label: string; from: Date; to: Date }[] {
  const out: { label: string; from: Date; to: Date }[] = [];
  if (r.days <= 31) {
    for (let d = new Date(r.from); d <= r.to; d = new Date(d.getTime() + 86_400_000)) {
      out.push({
        label: d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
        from: startOfDay(d),
        to: endOfDay(d),
      });
    }
    return out;
  }
  if (r.days <= 120) {
    for (let d = new Date(r.from); d <= r.to; d = new Date(d.getTime() + 7 * 86_400_000)) {
      const end = new Date(Math.min(d.getTime() + 6 * 86_400_000, r.to.getTime()));
      out.push({
        label: d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
        from: startOfDay(d),
        to: endOfDay(end),
      });
    }
    return out;
  }
  let cursor = new Date(r.from.getFullYear(), r.from.getMonth(), 1);
  while (cursor <= r.to) {
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    out.push({
      label: cursor.toLocaleDateString("en-NG", { month: "short" }),
      from: cursor,
      to: new Date(Math.min(end.getTime(), r.to.getTime())),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

export function activitySeries(mrfs: MRF[], srfs: SRF[], r: Range): ActivityPoint[] {
  return bucketsFor(r).map((b) => {
    const bucketRange: Range = { ...r, from: b.from, to: b.to };
    const created = mrfs.filter((m) => inRange(mrfCreated(m), bucketRange));
    return {
      label: b.label,
      materialRequests: created.length,
      serviceRequests: srfs.filter((s) => inRange(srfCreated(s), bucketRange)).length,
      approved: mrfs.filter((m) => inRange(approvedAt(m), bucketRange)).length,
      purchaseOrders: mrfs.filter((m) => hasPO(m) && inRange(poAt(m) ?? mrfDate(m), bucketRange))
        .length,
      value: sumBy(created, mrfCost),
    };
  });
}

/** Compact sparkline series (counts only) for KPI cards. */
export function sparkline(
  mrfs: MRF[],
  r: Range,
  dateFn: (m: MRF) => Date | null,
): { label: string; v: number }[] {
  return bucketsFor(r).map((b) => ({
    label: b.label,
    v: mrfs.filter((m) => inRange(dateFn(m), { ...r, from: b.from, to: b.to })).length,
  }));
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

export interface PipelineStage {
  key: string;
  label: string;
  count: number;
  avgDays: number | null;
  /** Percentage of records that have moved past this stage. */
  throughPct: number | null;
  tone: "default" | "warning" | "danger";
}

export function buildPipeline(mrfs: MRF[]): PipelineStage[] {
  const live = mrfs.filter((m) => !isRejected(m));
  const underReview = live.filter(
    (m) => !isApproved(m) && /submitted|review/.test(mrfState(m)) && !isCompleted(m),
  );
  const awaitingApproval = live.filter((m) => isPendingApproval(m) && !isApproved(m));
  const approved = live.filter((m) => isApproved(m));
  const sourcing = approved.filter(
    (m) => !hasPO(m) && /procurement|rfq|quote|vendor_select|comparison/.test(mrfState(m)),
  );
  const withPO = live.filter(hasPO);
  const awaitingDelivery = withPO.filter((m) => !isDelivered(m));
  const delivered = live.filter(isDelivered);

  const total = Math.max(1, live.length);
  const stage = (
    key: string,
    label: string,
    rows: MRF[],
    avgDays: number | null,
    warnAbove: number,
  ): PipelineStage => ({
    key,
    label,
    count: rows.length,
    avgDays,
    throughPct: Math.round((rows.length / total) * 100),
    tone:
      avgDays == null ? "default" : avgDays > warnAbove * 2 ? "danger" : avgDays > warnAbove ? "warning" : "default",
  });

  return [
    stage("created", "Requests created", live, null, Infinity),
    stage(
      "under_review",
      "Under review",
      underReview,
      avg(underReview.map((m) => daysSince(mrfCreated(m)))),
      2,
    ),
    stage(
      "awaiting_approval",
      "Awaiting approval",
      awaitingApproval,
      avg(awaitingApproval.map((m) => daysSince(mrfCreated(m)))),
      APPROVAL_SLA_DAYS,
    ),
    stage(
      "approved",
      "Approved",
      approved,
      avg(approved.map((m) => days(mrfCreated(m), approvedAt(m)))),
      APPROVAL_SLA_DAYS,
    ),
    stage(
      "sourcing",
      "Sourcing / price comparison",
      sourcing,
      avg(sourcing.map((m) => daysSince(approvedAt(m) ?? mrfCreated(m)))),
      3,
    ),
    stage(
      "po",
      "Purchase order created",
      withPO,
      avg(withPO.map((m) => days(approvedAt(m), poAt(m)))),
      3,
    ),
    stage(
      "awaiting_delivery",
      "Awaiting delivery",
      awaitingDelivery,
      avg(awaitingDelivery.map((m) => daysSince(poAt(m) ?? approvedAt(m) ?? mrfCreated(m)))),
      DELIVERY_SLA_DAYS,
    ),
    stage(
      "delivered",
      "Delivered / completed",
      delivered,
      avg(delivered.map((m) => days(mrfCreated(m), deliveredAt(m)))),
      30,
    ),
  ];
}

/* ------------------------------------------------------------------ */
/* Vendor performance                                                  */
/* ------------------------------------------------------------------ */

export interface VendorPerf {
  name: string;
  rating: number | null;
  activePOs: number;
  totalPOs: number;
  delivered: number;
  late: number;
  overdue: number;
  onTimePct: number | null;
  value: number;
  kycPending: boolean;
  score: number;
  /** Average days from purchase order to goods received (backend-supplied). */
  avgDeliveryDays: number | null;
  /** Share of orders the vendor completed (backend-supplied). */
  fulfilmentRate: number | null;
}

interface VendorPerformancePayload {
  total_pos?: number;
  completed_pos?: number;
  on_time_deliveries?: number;
  late_deliveries?: number;
  average_delivery_days?: number;
  fulfilment_rate?: number;
}

const numOrNull = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

export function buildVendorPerformance(mrfs: MRF[], vendors: Vendor[]): VendorPerf[] {
  const byName = new Map<string, MRF[]>();
  for (const m of mrfs) {
    const n = vendorName(m);
    if (!n || !hasPO(m)) continue;
    byName.set(n, [...(byName.get(n) ?? []), m]);
  }

  const vendorIndex = new Map(
    vendors.map((v) => [String(v.name ?? "").trim().toLowerCase(), v]),
  );

  const rows: VendorPerf[] = [];
  for (const [name, rowsForVendor] of byName) {
    const v = vendorIndex.get(name.toLowerCase());
    const vRec = (v ?? {}) as unknown as Record<string, unknown>;
    const perf = (vRec.performance ?? {}) as VendorPerformancePayload;

    const delivered = rowsForVendor.filter(isDelivered);
    const localLate = delivered.filter(deliveryLate).length;

    // Backend fulfilment history wins when present; local records fill the gap.
    const totalPOs = numOrNull(perf.total_pos ?? vRec.total_orders) ?? rowsForVendor.length;
    const completed =
      numOrNull(perf.completed_pos ?? vRec.completed_orders) ?? delivered.length;
    const onTime = numOrNull(perf.on_time_deliveries ?? vRec.on_time_deliveries);
    const late = numOrNull(perf.late_deliveries) ??
      (onTime != null ? Math.max(0, completed - onTime) : localLate);
    const overdue = rowsForVendor.filter(isOverdueDelivery).length;
    const onTimePct =
      onTime != null && completed > 0
        ? Math.round((onTime / completed) * 100)
        : delivered.length
          ? Math.round(((delivered.length - localLate) / delivered.length) * 100)
          : null;

    const rating = numOrNull(vRec.rating) && Number(vRec.rating) > 0 ? Number(vRec.rating) : null;
    rows.push({
      name,
      rating,
      activePOs: rowsForVendor.filter((m) => !isDelivered(m)).length,
      totalPOs,
      delivered: completed,
      late,
      overdue,
      onTimePct,
      value: sumBy(rowsForVendor, poValue),
      kycPending: !!v && /pending|inactive/i.test(String(v.status ?? "")),
      avgDeliveryDays: numOrNull(perf.average_delivery_days),
      fulfilmentRate: numOrNull(perf.fulfilment_rate),
      score:
        (rating ?? 3) * 10 +
        (onTimePct ?? 60) -
        overdue * 12 -
        late * 6 +
        Math.min(10, totalPOs),
    });
  }

  return rows.sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* Delivery + PO analytics                                             */
/* ------------------------------------------------------------------ */

export interface DeliveryStats {
  onTime: number;
  late: number;
  inProgress: number;
  overdue: number;
  upcoming: number;
  onTimePct: number | null;
  prevOnTimePct: number | null;
  trend: { label: string; onTime: number; late: number }[];
}

export function buildDeliveryStats(mrfs: MRF[], r: Range): DeliveryStats {
  const live = mrfs.filter((m) => !isRejected(m) && hasPO(m));
  const delivered = live.filter(isDelivered);
  const late = delivered.filter(deliveryLate);
  const overdue = live.filter(isOverdueDelivery);
  const inProgress = live.filter((m) => !isDelivered(m) && !isOverdueDelivery(m));
  const upcoming = inProgress.filter((m) => {
    const expected = expectedDeliveryAt(m);
    if (!expected) return false;
    const diff = (expected.getTime() - Date.now()) / 86_400_000;
    return diff >= 0 && diff <= 7;
  });

  const scored = (rows: MRF[]) => {
    const done = rows.filter(isDelivered);
    if (!done.length) return null;
    return Math.round(((done.length - done.filter(deliveryLate).length) / done.length) * 100);
  };

  const prev = previousRange(r);
  return {
    onTime: delivered.length - late.length,
    late: late.length,
    inProgress: inProgress.length,
    overdue: overdue.length,
    upcoming: upcoming.length,
    onTimePct: scored(live.filter((m) => inRange(deliveredAt(m) ?? mrfDate(m), r))),
    prevOnTimePct: scored(live.filter((m) => inRange(deliveredAt(m) ?? mrfDate(m), prev))),
    trend: bucketsFor(r).map((b) => {
      const rows = delivered.filter((m) =>
        inRange(deliveredAt(m) ?? mrfDate(m), { ...r, from: b.from, to: b.to }),
      );
      const lateRows = rows.filter(deliveryLate).length;
      return { label: b.label, onTime: rows.length - lateRows, late: lateRows };
    }),
  };
}

export interface PoStats {
  created: number;
  createdPrev: number;
  active: number;
  completed: number;
  delayed: number;
  awaitingDelivery: number;
  avgCompletionDays: number | null;
  totalValue: number;
  activeValue: number;
  topActive: MRF[];
  byVendor: { name: string; value: number; count: number }[];
  byProject: { name: string; value: number; count: number }[];
  valueTrend: { label: string; value: number }[];
}

export function buildPoStats(mrfs: MRF[], r: Range): PoStats {
  const live = mrfs.filter((m) => !isRejected(m));
  const withPO = live.filter(hasPO);
  const prev = previousRange(r);
  const completed = withPO.filter(isDelivered);

  const group = (keyFn: (m: MRF) => string) => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    for (const m of withPO) {
      const name = keyFn(m);
      if (!name) continue;
      const e = map.get(name) ?? { name, value: 0, count: 0 };
      e.value += mrfCost(m);
      e.count += 1;
      map.set(name, e);
    }
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 6);
  };

  return {
    created: withPO.filter((m) => inRange(poAt(m) ?? mrfDate(m), r)).length,
    createdPrev: withPO.filter((m) => inRange(poAt(m) ?? mrfDate(m), prev)).length,
    active: withPO.filter((m) => !isDelivered(m)).length,
    completed: completed.length,
    delayed: withPO.filter(isOverdueDelivery).length,
    awaitingDelivery: withPO.filter((m) => !isDelivered(m)).length,
    avgCompletionDays: avg(completed.map((m) => days(poAt(m) ?? mrfCreated(m), deliveredAt(m)))),
    totalValue: sumBy(withPO, mrfCost),
    activeValue: sumBy(withPO.filter((m) => !isDelivered(m)), mrfCost),
    topActive: withPO
      .filter((m) => !isDelivered(m))
      .sort((a, b) => mrfCost(b) - mrfCost(a))
      .slice(0, 5),
    byVendor: group(vendorName),
    byProject: group(projectName),
    valueTrend: bucketsFor(r).map((b) => ({
      label: b.label,
      value: sumBy(
        withPO.filter((m) => inRange(poAt(m) ?? mrfDate(m), { ...r, from: b.from, to: b.to })),
        mrfCost,
      ),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Processing performance                                              */
/* ------------------------------------------------------------------ */

export interface ProcessingStats {
  avgApprovalDays: number | null;
  prevApprovalDays: number | null;
  avgMrfCycleDays: number | null;
  avgSrfCycleDays: number | null;
  avgTimeToPoDays: number | null;
  prevTimeToPoDays: number | null;
  pendingBeyondSla: number;
  oldestPendingDays: number;
}

export function buildProcessing(mrfs: MRF[], srfs: SRF[], r: Range): ProcessingStats {
  const prev = previousRange(r);
  const live = mrfs.filter((m) => !isRejected(m));
  const approvalIn = (range: Range) =>
    avg(
      live
        .filter((m) => inRange(approvedAt(m), range))
        .map((m) => days(mrfCreated(m), approvedAt(m))),
    );
  const toPoIn = (range: Range) =>
    avg(
      live
        .filter((m) => hasPO(m) && inRange(poAt(m), range))
        .map((m) => days(approvedAt(m) ?? mrfCreated(m), poAt(m))),
    );

  const pending = live.filter(isPendingApproval);
  return {
    avgApprovalDays: approvalIn(r),
    prevApprovalDays: approvalIn(prev),
    avgMrfCycleDays: avg(
      live.filter(isDelivered).map((m) => days(mrfCreated(m), deliveredAt(m))),
    ),
    avgSrfCycleDays: avg(
      (srfs ?? [])
        .filter(srfApproved)
        .map((s) =>
          days(
            srfCreated(s),
            toDate((s as { updated_at?: string }).updated_at ?? s.updatedAt),
          ),
        ),
    ),
    avgTimeToPoDays: toPoIn(r),
    prevTimeToPoDays: toPoIn(prev),
    pendingBeyondSla: pending.filter((m) => daysSince(mrfCreated(m)) > APPROVAL_SLA_DAYS).length,
    oldestPendingDays: pending.length
      ? Math.max(...pending.map((m) => daysSince(mrfCreated(m))))
      : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Health, alerts, insights                                            */
/* ------------------------------------------------------------------ */

export type HealthStatus = "good" | "attention" | "critical" | "unknown";

export interface HealthItem {
  key: string;
  label: string;
  status: HealthStatus;
  value: string;
  reason: string;
}

export interface ProcAlert {
  id: string;
  severity: "critical" | "attention" | "monitor";
  title: string;
  detail: string;
  count?: number;
  bucket: ProcBucket;
}

export type ProcBucket =
  | "overdue_delivery"
  | "stalled_approval"
  | "pending_approval"
  | "no_activity"
  | "high_value"
  | "awaiting_delivery"
  | "active_po"
  | "completed"
  | "open";

export const BUCKET_TITLES: Record<ProcBucket, string> = {
  overdue_delivery: "Purchase orders overdue for delivery",
  stalled_approval: "Requests stuck in approval",
  pending_approval: "Requests awaiting approval",
  no_activity: "Cases with no recent activity",
  high_value: "High-value purchase commitments",
  awaiting_delivery: "Purchase orders awaiting delivery",
  active_po: "Active purchase orders",
  completed: "Completed requests",
  open: "Open procurement requests",
};

export function bucketFor(bucket: ProcBucket, mrfs: MRF[]): MRF[] {
  const live = mrfs.filter((m) => !isRejected(m));
  const open = live.filter((m) => !isCompleted(m));
  switch (bucket) {
    case "overdue_delivery":
      return live.filter(isOverdueDelivery);
    case "stalled_approval":
      return open.filter((m) => isPendingApproval(m) && daysSince(mrfDate(m)) >= STALL_DAYS);
    case "pending_approval":
      return open.filter(isPendingApproval);
    case "no_activity":
      return open.filter((m) => daysSince(mrfDate(m)) >= 14);
    case "high_value":
      return open.filter((m) => mrfCost(m) >= HIGH_VALUE).sort((a, b) => mrfCost(b) - mrfCost(a));
    case "awaiting_delivery":
      return live.filter((m) => hasPO(m) && !isDelivered(m));
    case "active_po":
      return live.filter(hasPO);
    case "completed":
      return live.filter(isDelivered);
    default:
      return open;
  }
}

export function buildHealth(
  pipeline: PipelineStage[],
  processing: ProcessingStats,
  delivery: DeliveryStats,
  vendorPerf: VendorPerf[],
  openWorkload: number,
  activePOs: number,
): HealthItem[] {
  const approvalStage = pipeline.find((s) => s.key === "awaiting_approval");
  const approvalDays = processing.avgApprovalDays;
  const approvalStatus: HealthStatus =
    approvalDays == null
      ? "unknown"
      : approvalDays <= APPROVAL_SLA_DAYS
        ? "good"
        : approvalDays <= APPROVAL_SLA_DAYS * 2
          ? "attention"
          : "critical";

  const deliveryStatus: HealthStatus =
    delivery.onTimePct == null
      ? "unknown"
      : delivery.onTimePct >= 90
        ? "good"
        : delivery.onTimePct >= 75
          ? "attention"
          : "critical";

  const rated = vendorPerf.filter((v) => v.rating != null);
  const avgRating = rated.length
    ? rated.reduce((s, v) => s + (v.rating ?? 0), 0) / rated.length
    : null;
  const vendorStatus: HealthStatus =
    avgRating == null
      ? "unknown"
      : avgRating >= 4
        ? "good"
        : avgRating >= 3
          ? "attention"
          : "critical";

  const workflowStatus: HealthStatus =
    delivery.overdue > 0 || processing.pendingBeyondSla > 5
      ? "critical"
      : processing.pendingBeyondSla > 0
        ? "attention"
        : "good";

  return [
    {
      key: "workflow",
      label: "Procurement workflow",
      status: workflowStatus,
      value:
        workflowStatus === "good"
          ? "Healthy"
          : workflowStatus === "attention"
            ? "Attention needed"
            : "Critical",
      reason:
        workflowStatus === "good"
          ? "No overdue deliveries and every request is inside the approval window."
          : `${processing.pendingBeyondSla} request(s) past the ${APPROVAL_SLA_DAYS}-day approval window and ${delivery.overdue} overdue delivery(s).`,
    },
    {
      key: "approval",
      label: "Approval performance",
      status: approvalStatus,
      value: approvalDays == null ? "No data" : `${approvalDays.toFixed(1)} days avg`,
      reason:
        approvalDays == null
          ? "No approvals completed in this period, so approval speed cannot be measured."
          : `${approvalStage?.count ?? 0} request(s) waiting now; oldest has waited ${processing.oldestPendingDays} day(s). Target is ${APPROVAL_SLA_DAYS} days.`,
    },
    {
      key: "delivery",
      label: "Delivery performance",
      status: deliveryStatus,
      value: delivery.onTimePct == null ? "No data" : `${delivery.onTimePct}% on time`,
      reason:
        delivery.onTimePct == null
          ? "No goods-received records in this period."
          : `${delivery.onTime} on time, ${delivery.late} late, ${delivery.overdue} overdue against a ${DELIVERY_SLA_DAYS}-day delivery window.`,
    },
    {
      key: "vendor",
      label: "Vendor performance",
      status: vendorStatus,
      value: avgRating == null ? "No ratings" : `${avgRating.toFixed(1)} / 5.0`,
      reason:
        avgRating == null
          ? "No vendor ratings recorded against vendors with purchase orders."
          : `${rated.length} rated vendor(s) supplying ${activePOs} active purchase order(s).`,
    },
    {
      key: "workload",
      label: "Open workload",
      status: openWorkload > 40 ? "attention" : "good",
      value: `${openWorkload} open`,
      reason: `${openWorkload} active request(s) and ${activePOs} purchase order(s) currently in flight.`,
    },
  ];
}

export function buildProcAlerts(
  mrfs: MRF[],
  vendorPerf: VendorPerf[],
  delivery: DeliveryStats,
  processing: ProcessingStats,
  pendingKyc: number,
): ProcAlert[] {
  const alerts: ProcAlert[] = [];
  const overdue = bucketFor("overdue_delivery", mrfs);
  if (overdue.length) {
    const oldest = Math.max(
      ...overdue.map((m) => daysSince(poAt(m) ?? approvedAt(m) ?? mrfCreated(m))),
    );
    alerts.push({
      id: "po-overdue",
      severity: "critical",
      title: `${overdue.length} purchase order${overdue.length > 1 ? "s are" : " is"} overdue for delivery`,
      detail: `Oldest overdue purchase order: ${oldest} day(s).`,
      count: overdue.length,
      bucket: "overdue_delivery",
    });
  }

  const stalled = bucketFor("stalled_approval", mrfs);
  if (stalled.length) {
    alerts.push({
      id: "stalled",
      severity: "critical",
      title: `${stalled.length} request${stalled.length > 1 ? "s have" : " has"} been waiting for approval too long`,
      detail: `No movement for ${STALL_DAYS}+ days. Oldest pending request: ${processing.oldestPendingDays} day(s).`,
      count: stalled.length,
      bucket: "stalled_approval",
    });
  }

  const idle = bucketFor("no_activity", mrfs);
  if (idle.length) {
    alerts.push({
      id: "no-activity",
      severity: "attention",
      title: `${idle.length} open case${idle.length > 1 ? "s have" : " has"} had no activity for 14+ days`,
      detail: "These requests are open but nothing has changed on them recently.",
      count: idle.length,
      bucket: "no_activity",
    });
  }

  const badVendors = vendorPerf.filter((v) => v.overdue > 0 || (v.onTimePct != null && v.onTimePct < 70));
  if (badVendors.length) {
    alerts.push({
      id: "vendor-delays",
      severity: "attention",
      title: `${badVendors.length} vendor${badVendors.length > 1 ? "s are" : " is"} delivering late`,
      detail: badVendors
        .slice(0, 3)
        .map((v) => `${v.name} (${v.onTimePct ?? 0}% on time)`)
        .join(", "),
      count: badVendors.length,
      bucket: "awaiting_delivery",
    });
  }

  if (pendingKyc > 0) {
    alerts.push({
      id: "kyc",
      severity: "attention",
      title: `${pendingKyc} vendor registration${pendingKyc > 1 ? "s" : ""} awaiting KYC review`,
      detail: "Sourcing options stay blocked until these vendors are approved.",
      count: pendingKyc,
      bucket: "open",
    });
  }

  if (delivery.upcoming > 0) {
    alerts.push({
      id: "upcoming",
      severity: "attention",
      title: `${delivery.upcoming} delivery deadline${delivery.upcoming > 1 ? "s" : ""} within 7 days`,
      detail: "Confirm readiness with the supplier before the due date.",
      count: delivery.upcoming,
      bucket: "awaiting_delivery",
    });
  }

  const highValue = bucketFor("high_value", mrfs);
  if (highValue.length) {
    alerts.push({
      id: "high-value",
      severity: "monitor",
      title: `${highValue.length} high-value commitment${highValue.length > 1 ? "s" : ""} in flight`,
      detail: `Each above ₦${HIGH_VALUE.toLocaleString()} — total ₦${Math.round(sumBy(highValue, mrfCost)).toLocaleString()}.`,
      count: highValue.length,
      bucket: "high_value",
    });
  }

  const order = { critical: 0, attention: 1, monitor: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

export interface Insight {
  id: string;
  label: string;
  headline: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
}

export function buildInsights(
  series: ActivityPoint[],
  pipeline: PipelineStage[],
  delivery: DeliveryStats,
  vendorPerf: VendorPerf[],
  poStats: PoStats,
  processing: ProcessingStats,
): Insight[] {
  const out: Insight[] = [];
  const half = Math.floor(series.length / 2);
  const first = series.slice(0, half);
  const second = series.slice(half);
  const sum = (rows: ActivityPoint[], key: keyof ActivityPoint) =>
    rows.reduce((s, p) => s + Number(p[key] ?? 0), 0);

  if (series.length >= 4) {
    const change = pctChange(sum(second, "approved"), sum(first, "approved"));
    if (change != null) {
      out.push({
        id: "approvals",
        label: "Procurement insight",
        headline: `Approvals ${change >= 0 ? "up" : "down"} ${Math.abs(Math.round(change))}% in the second half of this period`,
        detail: `${sum(second, "approved")} approvals recently versus ${sum(first, "approved")} earlier in the same window.`,
        tone: change >= 0 ? "positive" : "negative",
      });
    }
  }

  if (delivery.onTimePct != null && delivery.prevOnTimePct != null) {
    const change = delivery.onTimePct - delivery.prevOnTimePct;
    const worst = vendorPerf.filter((v) => v.late > 0 || v.overdue > 0).slice(0, 2);
    out.push({
      id: "delivery",
      label: "Delivery insight",
      headline: `Delivery performance ${change >= 0 ? "improved" : "declined"} by ${Math.abs(Math.round(change))} points`,
      detail: worst.length
        ? `Most delays sit with ${worst.map((v) => v.name).join(" and ")}.`
        : "No single vendor is driving the change.",
      tone: change >= 0 ? "positive" : "negative",
    });
  }

  const bottleneck = pipeline
    .filter((s) => s.avgDays != null && s.count > 0 && s.key !== "created")
    .sort((a, b) => (b.avgDays ?? 0) - (a.avgDays ?? 0))[0];
  if (bottleneck) {
    out.push({
      id: "bottleneck",
      label: "Workflow insight",
      headline: `${bottleneck.label} is the slowest stage right now`,
      detail: `${bottleneck.count} record(s) sitting there for an average of ${(bottleneck.avgDays ?? 0).toFixed(1)} day(s). ${processing.pendingBeyondSla} request(s) are past the ${APPROVAL_SLA_DAYS}-day approval target.`,
      tone: "negative",
    });
  }

  const topProject = poStats.byProject[0];
  const totalProjectValue = poStats.byProject.reduce((s, p) => s + p.value, 0);
  if (topProject && totalProjectValue > 0) {
    out.push({
      id: "workload",
      label: "Workload insight",
      headline: `${topProject.name} carries the most procurement value`,
      detail: `${Math.round((topProject.value / totalProjectValue) * 100)}% of purchase order value across ${topProject.count} order(s).`,
      tone: "neutral",
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Data gaps                                                           */
/* ------------------------------------------------------------------ */

export interface DataGap {
  field: string;
  purpose: string;
}

export function detectDataGaps(mrfs: MRF[], vendors: Vendor[]): DataGap[] {
  const gaps: DataGap[] = [];
  const withPO = mrfs.filter(hasPO);
  if (withPO.length && !withPO.some(expectedDeliveryAt)) {
    gaps.push({
      field: "Expected delivery date on the purchase order",
      purpose:
        "Right now late/overdue is estimated from a 21-day window. A promised date makes delivery performance exact.",
    });
  }
  if (withPO.length && !withPO.some(poAt)) {
    gaps.push({
      field: "Purchase order creation timestamp",
      purpose: "Needed for request-to-PO conversion time and PO ageing.",
    });
  }
  if (mrfs.length && !mrfs.some(deliveredAt)) {
    gaps.push({
      field: "Actual delivery / goods-received timestamp",
      purpose: "Needed for on-time delivery rate and full procurement cycle time.",
    });
  }
  if (mrfs.length && !mrfs.some(approvedAt)) {
    gaps.push({
      field: "Approval timestamp per stage",
      purpose: "Needed for average approval time and bottleneck detection.",
    });
  }
  if (vendors.length && !vendors.some((v) => Number(v.rating) > 0)) {
    gaps.push({
      field: "Vendor rating and fulfilment history",
      purpose: "Needed to rank suppliers and flag underperformers.",
    });
  }
  if (mrfs.length && !mrfs.some((m) => Number(mrfCost(m)) > 0)) {
    gaps.push({
      field: "Estimated cost / purchase order value",
      purpose: "Needed for procurement value trends, project and vendor spend.",
    });
  }
  return gaps;
}

/* ------------------------------------------------------------------ */
/* Activity grouping                                                   */
/* ------------------------------------------------------------------ */

export interface ActivityEvent {
  id: string;
  type?: string;
  title: string;
  description?: string;
  status?: string;
  date: string;
  actionUrl?: string;
}

const NOISE = /(login|logout|viewed|opened|session|token|heartbeat)/i;

export function groupActivities(
  events: ActivityEvent[],
): { label: string; events: ActivityEvent[] }[] {
  const meaningful = events.filter((e) => !NOISE.test(`${e.type ?? ""} ${e.title ?? ""}`));
  const groups = new Map<string, ActivityEvent[]>();
  const today = startOfDay(new Date()).getTime();
  for (const e of meaningful) {
    const d = toDate(e.date);
    let label = "Earlier";
    if (d) {
      const day = startOfDay(d).getTime();
      if (day === today) label = "Today";
      else if (day === today - 86_400_000) label = "Yesterday";
      else
        label = d.toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
    }
    groups.set(label, [...(groups.get(label) ?? []), e]);
  }
  return [...groups.entries()].map(([label, evts]) => ({ label, events: evts }));
}

export { APPROVAL_SLA_DAYS, DELIVERY_SLA_DAYS, STALL_DAYS };
