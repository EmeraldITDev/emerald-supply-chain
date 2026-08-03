/**
 * Single source of truth for whether a trip request is still awaiting the
 * Supervising Director's approval. Used by dashboard filters and per-row
 * action buttons so we never show an Approve button on a trip the backend
 * will reject as already-processed.
 */
export const DIRECTOR_PENDING_STATUSES = new Set([
  "submitted",
  "forwarded",
  "scd_review",
  "pending_approval",
  "pending_director_approval",
  "director_review",
  "awaiting_director_approval",
]);

export const TRIP_TERMINAL_STATUSES = new Set([
  "approved",
  "director_approved",
  "scd_approved",
  "scd_rejected",
  "logistics_processing",
  "vendor_sourcing",
  "converted",
  "converted_to_logistics",
  "logistics_created",
  "completed",
  "rejected",
  "cancelled",
  "returned",
]);

/** Canonical action names the backend may return in `available_actions`. */
export const SCD_APPROVE_ACTIONS = ["scd_approve", "director_approve"];
export const SCD_REJECT_ACTIONS = ["scd_reject", "director_reject"];
export const CONVERT_ACTIONS = ["convert_to_logistics", "convert"];

function norm(v: unknown): string {
  return String(v ?? "").toLowerCase().trim().replace(/\s+/g, "_");
}

/**
 * Session-scoped registry of trips this browser has already acted on.
 * The list endpoints occasionally return a stale row right after an approval;
 * this keeps the approved trip from reappearing in the SCD queue.
 */
const ACTED_KEY = "scm:trips:director-approved";

function readActed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(ACTED_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

export function markTripDirectorApproved(id: string | number): void {
  try {
    const set = readActed();
    set.add(String(id));
    sessionStorage.setItem(ACTED_KEY, JSON.stringify([...set]));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function wasTripDirectorApproved(id: string | number | undefined): boolean {
  if (id == null) return false;
  return readActed().has(String(id));
}

const APPROVED_TIMESTAMP_KEYS = [
  "director_approved_at",
  "directorApprovedAt",
  "scd_approved_at",
  "scdApprovedAt",
  "approved_at",
  "approvedAt",
];

/**
 * True when the record carries any evidence the Supervising Director already
 * acted — approval flags, approval timestamps, terminal stage/status, or a
 * linked logistics trip. Used so a stale stage label can never resurrect the
 * Approve button.
 */
export function isTripDirectorApproved(trip: Record<string, unknown>): boolean {
  const approval = norm(trip.approvalStatus ?? trip.approval_status);
  if (approval === "approved") return true;
  if (APPROVED_TIMESTAMP_KEYS.some((k) => trip[k])) return true;
  const stage = norm(trip.workflowStage ?? trip.workflow_stage);
  const status = norm(trip.status);
  const approvedStages = new Set([
    "approved",
    "director_approved",
    "scd_approved",
    "logistics_processing",
    "vendor_sourcing",
    "converted",
    "converted_to_logistics",
    "logistics_created",
    "completed",
  ]);
  if (approvedStages.has(stage) || approvedStages.has(status)) return true;
  if (trip.logistics_trip_id ?? trip.logisticsTripId) return true;
  return wasTripDirectorApproved(trip.id as string | number | undefined);
}

/** True once the trip has been turned into a logistics trip record. */
export function isTripConverted(trip: Record<string, unknown>): boolean {
  const stage = norm(trip.workflowStage ?? trip.workflow_stage);
  const status = norm(trip.status);
  const convertedStates = new Set([
    "converted",
    "converted_to_logistics",
    "logistics_created",
    "logistics_processing",
    "completed",
  ]);
  if (convertedStates.has(stage) || convertedStates.has(status)) return true;
  return Boolean(trip.logistics_trip_id ?? trip.logisticsTripId);
}

/**
 * Convert is only offered when the backend says so, or — when
 * `available_actions` is absent — while the trip sits at `scd_approved` and has
 * not already been converted.
 */
export function canConvertToLogistics(trip: Record<string, unknown>): boolean {
  const actions = readActions(trip as never);
  if (actions && actions.length > 0) {
    return actions.some((a) => CONVERT_ACTIONS.includes(a));
  }
  if (isTripConverted(trip)) return false;
  const stage = norm(trip.workflowStage ?? trip.workflow_stage);
  const status = norm(trip.status);
  return stage === "scd_approved" || status === "scd_approved";
}

function readActions(trip: {
  availableActions?: unknown;
  available_actions?: unknown;
}): string[] | undefined {
  const raw = (trip.availableActions ?? trip.available_actions) as unknown;
  return Array.isArray(raw) ? (raw as string[]).map((a) => norm(a)) : undefined;
}

/** True when the API explicitly (or, as a fallback, the state) allows SCD approval. */
export function canScdApprove(trip: {
  status?: unknown;
  workflow_stage?: unknown;
  workflowStage?: unknown;
  approval_status?: unknown;
  approvalStatus?: unknown;
  requires_scd_approval?: unknown;
  requiresScdApproval?: unknown;
  availableActions?: unknown;
  available_actions?: unknown;
}): boolean {
  const actions = readActions(trip);
  if (actions && actions.length > 0) {
    return actions.some((a) => SCD_APPROVE_ACTIONS.includes(a));
  }
  // Legacy API fallback (contract): only when the API omits available_actions.
  const stage = norm(trip.workflowStage ?? trip.workflow_stage);
  const approval = norm(trip.approvalStatus ?? trip.approval_status);
  if (stage) return stage === "scd_review" && approval !== "approved";
  const explicit = trip.requiresScdApproval ?? trip.requires_scd_approval;
  if (typeof explicit === "boolean") return explicit;
  return isTripAwaitingDirectorApproval(trip);
}

/** Mirror of canScdApprove for the reject action. */
export function canScdReject(trip: Parameters<typeof canScdApprove>[0]): boolean {
  const actions = readActions(trip);
  if (actions && actions.length > 0) {
    return actions.some((a) => SCD_REJECT_ACTIONS.includes(a));
  }
  return canScdApprove(trip);
}

export function isTripAwaitingDirectorApproval(trip: {
  status?: unknown;
  workflow_stage?: unknown;
  workflowStage?: unknown;
  approval_status?: unknown;
  approvalStatus?: unknown;
  availableActions?: unknown;
  available_actions?: unknown;
}): boolean {
  const status = norm(trip.status);
  const stage = norm(trip.workflowStage ?? trip.workflow_stage);
  const actions = readActions(trip);
  const approval = norm(trip.approvalStatus ?? trip.approval_status);

  // Any evidence of a completed director decision wins over stale stage labels.
  if (isTripDirectorApproved(trip as Record<string, unknown>)) return false;

  // Terminal states — never eligible regardless of stale stage labels.
  if (TRIP_TERMINAL_STATUSES.has(status)) return false;
  if (TRIP_TERMINAL_STATUSES.has(stage)) return false;
  if (approval === "approved" || approval === "rejected") return false;

  // Backend-provided actions are authoritative when present.
  if (actions && actions.length > 0) {
    return actions.some((a) => SCD_APPROVE_ACTIONS.includes(a));
  }

  return (
    DIRECTOR_PENDING_STATUSES.has(status) ||
    DIRECTOR_PENDING_STATUSES.has(stage) ||
    stage.includes("director")
  );
}

export function tripStatusPlainLabel(trip: {
  status?: unknown;
  workflow_stage?: unknown;
  workflowStage?: unknown;
}): string {
  const raw = String(
    trip.workflowStage ?? trip.workflow_stage ?? trip.status ?? "",
  );
  if (!raw) return "Unknown";
  const s = raw.toLowerCase().trim();
  if (s === "approved" || s === "director_approved") return "Approved";
  if (s === "scd_review") return "Awaiting Supply Chain Director";
  if (s === "scd_approved") return "Approved by Supply Chain Director";
  if (s === "scd_rejected") return "Rejected by Supply Chain Director";
  if (s === "logistics_processing") return "Logistics Processing";
  if (s === "vendor_sourcing") return "Sourcing External Vendor";
  if (s === "converted" || s === "converted_to_logistics" || s === "logistics_created")
    return "Converted to Logistics Request";
  if (s === "rejected") return "Rejected";
  if (s === "cancelled") return "Cancelled";
  if (s === "returned") return "Returned for revision";
  if (s === "completed") return "Completed";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}