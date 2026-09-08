/**
 * Executive-specific aggregation helpers.
 *
 * Pure functions only — no API calls, no React. Everything here is derived
 * from records the SCM backend already returns (MRFs, SRFs, vendor
 * registrations). Where the backend does not capture a field, the helper
 * returns `null` rather than inventing a value.
 */
import type { MRF, VendorRegistration } from "@/types";
import {
  daysSince,
  mrfCost,
  mrfCreated,
  mrfDate,
} from "@/utils/executiveIntelligence";
import { HIGH_VALUE, approvedAt } from "@/utils/procurementIntelligence";
import { getDisplayId } from "@/utils/displayId";

export const EXEC_APPROVAL_SLA_DAYS = 2;

export type ApprovalPriority = "high" | "medium" | "low";

export interface ApprovalItem {
  key: string;
  kind: "mrf" | "vendor";
  mrf?: MRF;
  registration?: VendorRegistration;
  title: string;
  typeLabel: string;
  reference: string;
  requester: string;
  unit: string;
  priority: ApprovalPriority;
  submitted: Date | null;
  waitingDays: number;
  summary: string;
  value: number | null;
  currency: string;
  /** Higher score = more deserving of the executive's next minute. */
  score: number;
  highValue: boolean;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  NGN: "₦",
};

export const currencySymbol = (code?: string | null): string =>
  CURRENCY_SYMBOLS[String(code ?? "").toUpperCase()] ?? "₦";

export const formatValue = (value: number | null, currency = "NGN"): string =>
  value == null || value <= 0
    ? "-"
    : `${currencySymbol(currency)}${Math.round(value).toLocaleString()}`;

const read = (r: unknown, key: string): unknown =>
  (r as Record<string, unknown> | null | undefined)?.[key];

const str = (r: unknown, ...keys: string[]): string => {
  for (const k of keys) {
    const v = read(r, k);
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

const priorityOf = (mrf: MRF): ApprovalPriority => {
  const u = String(mrf.urgency ?? "").toLowerCase();
  if (u.includes("high") || u.includes("urgent") || u.includes("critical")) return "high";
  if (u.includes("low")) return "low";
  return "medium";
};

/** Build the executive approval queue, most deserving of attention first. */
export function buildApprovalQueue(
  pendingMrfs: MRF[],
  registrations: VendorRegistration[],
): ApprovalItem[] {
  const items: ApprovalItem[] = [];

  for (const mrf of pendingMrfs) {
    const submitted = mrfCreated(mrf) ?? mrfDate(mrf);
    const waitingDays = daysSince(submitted);
    const value = mrfCost(mrf) || null;
    const priority = priorityOf(mrf);
    const highValue = (value ?? 0) >= HIGH_VALUE;
    const quantity = mrf.quantity != null ? `Qty ${mrf.quantity}` : "";
    const category = String(mrf.category ?? "").trim();

    items.push({
      key: `mrf-${mrf.id}`,
      kind: "mrf",
      mrf,
      title: mrf.title || "Untitled request",
      typeLabel: "Material requisition",
      reference: getDisplayId(mrf),
      requester: mrf.requester_name || mrf.requester || "Unknown",
      unit:
        str(mrf, "project_name", "projectName", "project") ||
        String(mrf.department ?? "") ||
        "—",
      priority,
      submitted,
      waitingDays,
      summary: [category, quantity].filter(Boolean).join(" • ") || "No summary captured",
      value,
      currency: str(mrf, "currency") || "NGN",
      highValue,
      score:
        (priority === "high" ? 40 : priority === "medium" ? 15 : 0) +
        (highValue ? 25 : 0) +
        Math.min(30, waitingDays * 3) +
        (waitingDays > EXEC_APPROVAL_SLA_DAYS ? 10 : 0),
    });
  }

  for (const reg of registrations) {
    const submitted = (() => {
      const v = reg.createdAt || reg.submittedDate;
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    })();
    const waitingDays = daysSince(submitted);
    items.push({
      key: `vendor-${reg.id}`,
      kind: "vendor",
      registration: reg,
      title: reg.companyName || "Vendor registration",
      typeLabel: "Vendor registration",
      reference: String(reg.id),
      requester: reg.contactPerson || "—",
      unit: reg.email || "—",
      priority: waitingDays > 5 ? "high" : "medium",
      submitted,
      waitingDays,
      summary: "Awaiting review before the vendor can be sourced",
      value: null,
      currency: "NGN",
      highValue: false,
      score: 12 + Math.min(30, waitingDays * 3),
    });
  }

  return items.sort((a, b) => b.score - a.score || b.waitingDays - a.waitingDays);
}

export interface ApprovalSummary {
  pending: number;
  approvedThisPeriod: number;
  rejected: number;
  completed: number;
  highPriority: number;
  dueToday: number;
  oldestWaitingDays: number;
  approvedThisWeek: number;
  avgApprovalDays: number | null;
  highValuePending: number;
  highValueTotal: number;
}

export function buildApprovalSummary(
  queue: ApprovalItem[],
  buckets: { approved: MRF[]; rejected: MRF[]; completed: MRF[] },
  range: { from: Date; to: Date },
): ApprovalSummary {
  const weekAgo = Date.now() - 7 * 86_400_000;
  const inRange = (d: Date | null) => !!d && d >= range.from && d <= range.to;

  const approvalDurations = buckets.approved
    .map((m) => {
      const a = approvedAt(m);
      const c = mrfCreated(m);
      return a && c ? Math.max(0, (a.getTime() - c.getTime()) / 86_400_000) : null;
    })
    .filter((v): v is number => v != null);

  const highValuePending = queue.filter((i) => i.highValue);

  return {
    pending: queue.length,
    approvedThisPeriod: buckets.approved.filter((m) => inRange(approvedAt(m) ?? mrfDate(m)))
      .length,
    rejected: buckets.rejected.length,
    completed: buckets.completed.length,
    highPriority: queue.filter((i) => i.priority === "high").length,
    dueToday: queue.filter((i) => i.waitingDays >= EXEC_APPROVAL_SLA_DAYS).length,
    oldestWaitingDays: queue.length ? Math.max(...queue.map((i) => i.waitingDays)) : 0,
    approvedThisWeek: buckets.approved.filter((m) => {
      const d = approvedAt(m) ?? mrfDate(m);
      return !!d && d.getTime() >= weekAgo;
    }).length,
    avgApprovalDays: approvalDurations.length
      ? approvalDurations.reduce((s, v) => s + v, 0) / approvalDurations.length
      : null,
    highValuePending: highValuePending.length,
    highValueTotal: highValuePending.reduce((s, i) => s + (i.value ?? 0), 0),
  };
}

/** Personal activity roll-up for requests this executive raised themselves. */
export function summariseMyRequests(mrfs: MRF[]) {
  const state = (m: MRF) =>
    String(
      m.workflow_state ?? m.workflowState ?? m.current_stage ?? m.currentStage ?? m.status ?? "",
    ).toLowerCase();
  return {
    submitted: mrfs.length,
    pending: mrfs.filter((m) => /submitted|review|approval|pending/.test(state(m))).length,
    approved: mrfs.filter((m) => /approved|procurement|rfq|quote|po_|delivery/.test(state(m)))
      .length,
    completed: mrfs.filter((m) => /complete|closed|delivered/.test(state(m))).length,
    rejected: mrfs.filter((m) => /reject/.test(state(m))).length,
  };
}
