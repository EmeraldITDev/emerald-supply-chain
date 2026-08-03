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