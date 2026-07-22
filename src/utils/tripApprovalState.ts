/**
 * Single source of truth for whether a trip request is still awaiting the
 * Supervising Director's approval. Used by dashboard filters and per-row
 * action buttons so we never show an Approve button on a trip the backend
 * will reject as already-processed.
 */
export const DIRECTOR_PENDING_STATUSES = new Set([
  "submitted",
  "forwarded",
  "pending_approval",
  "pending_director_approval",
  "director_review",
  "awaiting_director_approval",
]);

export const TRIP_TERMINAL_STATUSES = new Set([
  "approved",
  "director_approved",
  "converted",
  "converted_to_logistics",
  "logistics_created",
  "completed",
  "rejected",
  "cancelled",
  "returned",
]);

function norm(v: unknown): string {
  return String(v ?? "").toLowerCase().trim().replace(/\s+/g, "_");
}

export function isTripAwaitingDirectorApproval(trip: {
  status?: unknown;
  workflow_stage?: unknown;
  workflowStage?: unknown;
  availableActions?: unknown;
  available_actions?: unknown;
}): boolean {
  const status = norm(trip.status);
  const stage = norm(trip.workflowStage ?? trip.workflow_stage);
  const actions = (trip.availableActions ?? trip.available_actions) as
    | string[]
    | undefined;

  // Terminal states — never eligible regardless of stale stage labels.
  if (TRIP_TERMINAL_STATUSES.has(status)) return false;
  if (TRIP_TERMINAL_STATUSES.has(stage)) return false;

  // Backend-provided actions are authoritative when present.
  if (Array.isArray(actions) && actions.length > 0) {
    return actions.includes("director_approve");
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
  if (s === "converted" || s === "converted_to_logistics" || s === "logistics_created")
    return "Converted to Logistics Request";
  if (s === "rejected") return "Rejected";
  if (s === "cancelled") return "Cancelled";
  if (s === "returned") return "Returned for revision";
  if (s === "completed") return "Completed";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}