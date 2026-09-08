/**
 * Supply Chain Director command centre — pure helpers.
 *
 * Everything here is derived from records the SCM backend already returns
 * (MRFs, SRFs, trip requests, vendor registrations, vendors). Nothing is
 * invented: when a value is not captured, the helper returns null so the UI
 * can show a dash and list the gap.
 */
import type { MRF, SRF, VendorRegistration } from "@/types";
import { getDisplayId } from "@/utils/displayId";
import { daysSince, mrfCreated, mrfDate, mrfCost } from "@/utils/executiveIntelligence";
import { HIGH_VALUE } from "@/utils/procurementIntelligence";

export type ApprovalKind = "mrf" | "srf" | "trip" | "vendor";

export interface ScdApprovalItem {
  key: string;
  kind: ApprovalKind;
  /** Identifier used for the approve / reject API call. */
  apiId: string;
  title: string;
  typeLabel: string;
  reference: string;
  requester: string;
  unit: string;
  priority: "high" | "medium" | "low";
  submitted: Date | null;
  waitingDays: number;
  summary: string;
  value: number | null;
  highValue: boolean;
  score: number;
  mrf?: MRF;
  srf?: SRF;
  trip?: Record<string, unknown>;
  registration?: VendorRegistration;
}

const rec = (v: unknown): Record<string, unknown> =>
  (v ?? {}) as Record<string, unknown>;

const text = (source: unknown, ...keys: string[]): string => {
  const r = rec(source);
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
};

const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

const urgencyPriority = (raw: string): ScdApprovalItem["priority"] => {
  const u = raw.toLowerCase();
  if (/high|urgent|critical|emergency/.test(u)) return "high";
  if (/low/.test(u)) return "low";
  return "medium";
};

const scoreOf = (
  priority: ScdApprovalItem["priority"],
  waitingDays: number,
  highValue: boolean,
) =>
  (priority === "high" ? 40 : priority === "medium" ? 15 : 0) +
  (highValue ? 25 : 0) +
  Math.min(30, waitingDays * 3);

/** Everything waiting on the Supply Chain Director, most urgent first. */
export function buildScdApprovalQueue(input: {
  mrfs: MRF[];
  srfs: SRF[];
  trips: Record<string, unknown>[];
  registrations: VendorRegistration[];
}): ScdApprovalItem[] {
  const items: ScdApprovalItem[] = [];

  for (const mrf of input.mrfs) {
    const submitted = mrfCreated(mrf) ?? mrfDate(mrf);
    const waitingDays = daysSince(submitted);
    const value = mrfCost(mrf) || null;
    const priority = urgencyPriority(String(mrf.urgency ?? ""));
    const highValue = (value ?? 0) >= HIGH_VALUE;
    items.push({
      key: `mrf-${mrf.id}`,
      kind: "mrf",
      apiId: String(rec(mrf).mrf_id ?? mrf.id),
      title: mrf.title || "Untitled material request",
      typeLabel: "Material request",
      reference: getDisplayId(mrf),
      requester: mrf.requester_name || mrf.requester || "Unknown",
      unit: text(mrf, "project_name", "projectName", "project") || String(mrf.department ?? "—"),
      priority,
      submitted,
      waitingDays,
      summary:
        [String(mrf.category ?? "").trim(), mrf.quantity != null ? `Qty ${mrf.quantity}` : ""]
          .filter(Boolean)
          .join(" • ") || "No summary captured",
      value,
      highValue,
      score: scoreOf(priority, waitingDays, highValue),
      mrf,
    });
  }

  for (const srf of input.srfs) {
    const r = rec(srf);
    const submitted = toDate(r.created_at ?? r.createdAt ?? r.date ?? r.submitted_at);
    const waitingDays = daysSince(submitted);
    const priority = urgencyPriority(String(r.urgency ?? r.priority ?? ""));
    const value = Number(r.estimated_cost ?? r.estimatedCost ?? 0) || null;
    const highValue = (value ?? 0) >= HIGH_VALUE;
    items.push({
      key: `srf-${String(r.id ?? r.srf_id ?? Math.random())}`,
      kind: "srf",
      apiId: String(r.srf_id ?? r.id ?? ""),
      title: text(srf, "title", "service_title", "description") || "Service request",
      typeLabel: "Service request",
      reference: getDisplayId(srf),
      requester:
        text(srf, "requester_name", "requesterName", "requester", "created_by_name") || "Unknown",
      unit: text(srf, "project_name", "projectName", "department") || "—",
      priority,
      submitted,
      waitingDays,
      summary: text(srf, "service_type", "category", "description") || "Service scope not captured",
      value,
      highValue,
      score: scoreOf(priority, waitingDays, highValue),
      srf,
    });
  }

  for (const trip of input.trips) {
    const r = rec(trip);
    const submitted = toDate(r.created_at ?? r.createdAt ?? r.submitted_at ?? r.date);
    const waitingDays = daysSince(submitted);
    const priority = urgencyPriority(String(r.urgency ?? r.priority ?? ""));
    items.push({
      key: `trip-${String(r.id ?? r.trip_id ?? Math.random())}`,
      kind: "trip",
      apiId: String(r.id ?? r.trip_id ?? ""),
      title:
        text(trip, "purpose", "title", "destination") || "Trip request",
      typeLabel: "Trip request",
      reference: text(trip, "request_number", "formatted_id", "reference") || String(r.id ?? "—"),
      requester: text(trip, "requester_name", "requested_by_name", "created_by_name") || "Unknown",
      unit: text(trip, "department", "project_name", "project") || "—",
      priority,
      submitted,
      waitingDays,
      summary:
        [text(trip, "origin", "pickup_location"), text(trip, "destination", "drop_location")]
          .filter(Boolean)
          .join(" → ") || "Route not captured",
      value: Number(r.estimated_cost ?? r.total_cost ?? 0) || null,
      highValue: false,
      score: scoreOf(priority, waitingDays, false),
      trip: r,
    });
  }

  for (const reg of input.registrations) {
    const submitted = toDate(reg.createdAt || reg.submittedDate);
    const waitingDays = daysSince(submitted);
    const priority: ScdApprovalItem["priority"] = waitingDays > 5 ? "high" : "medium";
    items.push({
      key: `vendor-${reg.id}`,
      kind: "vendor",
      apiId: String(reg.id),
      title: reg.companyName || "Vendor registration",
      typeLabel: "Vendor registration",
      reference: String(reg.id),
      requester: reg.contactPerson || "—",
      unit: reg.email || "—",
      priority,
      submitted,
      waitingDays,
      summary: "Awaiting review before this vendor can be used for sourcing",
      value: null,
      highValue: false,
      score: scoreOf(priority, waitingDays, false),
      registration: reg,
    });
  }

  return items.sort((a, b) => b.score - a.score || b.waitingDays - a.waitingDays);
}

export interface GlanceCard {
  id: string;
  headline: string;
  detail: string;
  tone: "neutral" | "good" | "warning" | "critical";
  actionLabel?: string;
  action?: string;
}

/** Plain-language "today at a glance" summary. */
export function buildGlance(input: {
  queue: ScdApprovalItem[];
  activeRequests: number;
  issues: number;
  overdueDeliveries: number;
  stalledRequests: number;
  vendorsNeedingAttention: number;
  totalVendorsWithHistory: number;
}): GlanceCard[] {
  const { queue } = input;
  const high = queue.filter((i) => i.priority === "high").length;

  return [
    {
      id: "approvals",
      headline: queue.length
        ? `You have ${queue.length} request${queue.length === 1 ? "" : "s"} awaiting your approval`
        : "Nothing is waiting for your approval",
      detail: queue.length
        ? high
          ? `${high} of them ${high === 1 ? "is" : "are"} high priority.`
          : "None of them are marked high priority."
        : "You are fully caught up.",
      tone: queue.length ? (high ? "critical" : "warning") : "good",
      actionLabel: queue.length ? "Review requests" : undefined,
      action: queue.length ? "approvals" : undefined,
    },
    {
      id: "activity",
      headline: input.activeRequests
        ? "Procurement activity is active"
        : "No procurement activity in progress",
      detail: input.activeRequests
        ? `${input.activeRequests} request${input.activeRequests === 1 ? " is" : "s are"} currently being processed.`
        : "Nothing is moving through the procurement workflow right now.",
      tone: "neutral",
      actionLabel: input.activeRequests ? "View active requests" : undefined,
      action: input.activeRequests ? "open" : undefined,
    },
    {
      id: "issues",
      headline: input.issues
        ? `${input.issues} item${input.issues === 1 ? "" : "s"} need attention`
        : "No delays or stalled requests",
      detail: input.issues
        ? `${input.overdueDeliveries} delayed deliver${input.overdueDeliveries === 1 ? "y" : "ies"} and ${input.stalledRequests} request${input.stalledRequests === 1 ? " has" : "s have"} been waiting too long.`
        : "Everything is progressing within the expected time.",
      tone: input.issues ? "critical" : "good",
      actionLabel: input.issues ? "View issues" : undefined,
      action: input.issues ? "issues" : undefined,
    },
    {
      id: "vendors",
      headline: input.totalVendorsWithHistory
        ? input.vendorsNeedingAttention
          ? "Some vendors need a closer look"
          : "Most vendors are performing well"
        : "No vendor delivery history yet",
      detail: input.totalVendorsWithHistory
        ? input.vendorsNeedingAttention
          ? `${input.vendorsNeedingAttention} vendor${input.vendorsNeedingAttention === 1 ? " requires" : "s require"} attention for late or overdue deliveries.`
          : "No vendor is currently running late on deliveries."
        : "Vendor performance appears once deliveries are recorded.",
      tone: input.vendorsNeedingAttention ? "warning" : "good",
      actionLabel: input.totalVendorsWithHistory ? "Review vendors" : undefined,
      action: "vendors",
    },
  ];
}

export interface ChangeLine {
  id: string;
  label: string;
  now: number;
  before: number;
  betterWhen: "higher" | "lower";
  unit?: string;
}

/** "What's changed" — this period against the one before it. */
export function buildChangeLines(lines: ChangeLine[]): (ChangeLine & {
  diff: number;
  sentence: string;
})[] {
  return lines.map((l) => {
    const diff = l.now - l.before;
    const dir = diff > 0 ? "more than" : diff < 0 ? "fewer than" : "the same as";
    const sentence =
      diff === 0
        ? `${l.now}${l.unit ?? ""} — unchanged from the previous period.`
        : `${l.now}${l.unit ?? ""}, ${Math.abs(diff)}${l.unit ?? ""} ${dir} the previous period.`;
    return { ...l, diff, sentence };
  });
}
