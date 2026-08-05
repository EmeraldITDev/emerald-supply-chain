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
  "pending_scd_approval",
  "awaiting_scd_approval",
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
  "converted_to_logistics_request",
  "converted_to_journey",
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

/**
 * Secondary, optimistic-only registry of trips converted in this browser
 * session. Cleared on refresh by design — `available_actions` from the API is
 * always the primary gate.
 */
const CONVERTED_KEY = "scm:trips:converted";

function readConverted(): Set<string> {
  try {
    const raw = sessionStorage.getItem(CONVERTED_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

export function markTripConverted(id: string | number): void {
  try {
    const set = readConverted();
    set.add(String(id));
    sessionStorage.setItem(CONVERTED_KEY, JSON.stringify([...set]));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function wasTripConvertedLocally(id: string | number | undefined): boolean {
  if (id == null) return false;
  return readConverted().has(String(id));
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
    "converted_to_logistics_request",
    "converted_to_journey",
    "logistics_created",
    "logistics_processing",
    "completed",
  ]);
  if (convertedStates.has(stage) || convertedStates.has(status)) return true;
  if (trip.logistics_trip_id ?? trip.logisticsTripId) return true;
  if (trip.journey_id ?? trip.journeyId) return true;
  return wasTripConvertedLocally(trip.id as string | number | undefined);
}

/**
 * True when a row must be hidden from the active Scheduled Trips directory
 * because the backend has already converted it into a logistics request or a
 * journey. Mirrors the backend exclusion on the list query.
 */
export function isConvertedTripRow(trip: Record<string, unknown>): boolean {
  const stage = norm(trip.workflowStage ?? trip.workflow_stage);
  const status = norm(trip.status);
  const state = norm(trip.workflow_state ?? trip.workflowState);
  const convertedStates = new Set([
    "converted",
    "converted_to_logistics_request",
    "converted_to_journey",
    "logistics_processing",
    "logistics_created",
  ]);
  if (convertedStates.has(state)) return true;
  if (trip.logistics_journey_id ?? trip.logisticsJourneyId) return true;
  if (wasTripConvertedLocally(trip.id as string | number | undefined)) return true;
  return (
    convertedStates.has(status) || convertedStates.has(stage)
  );
}

/**
 * Post-conversion status banner driven purely by backend fields
 * (`quotation_required` + `workflow_state`), never by role.
 */
export function resolveTripStageBanner(
  trip: Record<string, unknown>,
): { title: string; tone: "info" | "warning" | "success" | "error" } | null {
  const stage = norm(trip.workflowStage ?? trip.workflow_stage ?? trip.workflow_state);
  const quotationRequired = trip.quotation_required ?? trip.quotationRequired;
  if (stage === "logistics_processing") {
    return {
      title: `Converted to Logistics Request — status: ${String(
        trip.status ?? "scheduled",
      )}. The logistics team is now processing this request.`,
      tone: "success",
    };
  }
  if (stage === "pending_vendor_quotation" || quotationRequired === true) {
    return {
      title: "Pending Vendor Quotation — Send RFQ to vendors to continue",
      tone: "warning",
    };
  }
  if (stage === "pending_scd_approval") {
    return { title: "Awaiting Supply Chain Director Approval", tone: "info" };
  }
  if (stage === "scd_rejected") {
    return { title: "Rejected by the Supply Chain Director", tone: "error" };
  }
  if (stage === "converted_to_journey") {
    return { title: "Journey created — this request is now a journey", tone: "success" };
  }
  if (stage === "converted_to_logistics_request") {
    return { title: "Converted to a logistics request", tone: "success" };
  }
  return null;
}

/**
 * `available_actions` from the API is the primary and final gate: when it is
 * present and does not offer a convert action, the button never renders,
 * whatever the local session registry says. The registry and the converted
 * heuristics are only consulted when the API omits `available_actions`.
 */
export function canConvertToLogistics(trip: Record<string, unknown>): boolean {
  // 1. Session registry — fastest check, immune to stale payloads.
  if (wasTripConvertedLocally(trip.id as string | number | undefined)) return false;

  // 2. Hard stops from backend state — these win over available_actions.
  const status = norm(trip.status);
  const state = norm(trip.workflow_state ?? trip.workflowState);
  const stage = norm(trip.workflowStage ?? trip.workflow_stage);
  if (status === "converted" || status === "scheduled") return false;
  const convertedStates = new Set([
    "logistics_processing",
    "converted",
    "converted_to_logistics_request",
    "converted_to_journey",
    "logistics_created",
  ]);
  if (convertedStates.has(state) || convertedStates.has(stage)) return false;
  if (trip.logistics_journey_id ?? trip.logisticsJourneyId) return false;
  if (trip.logistics_request_id ?? trip.logisticsRequestId) return false;
  if (trip.logistics_trip_id ?? trip.logisticsTripId) return false;
  if (trip.journey_id ?? trip.journeyId) return false;

  // 3. available_actions is the source of truth when present.
  const actions = readActions(trip as never);
  if (actions) {
    return actions.some((a) => CONVERT_ACTIONS.includes(a));
  }
  // 4. Fallback only when the backend told us nothing.
  if (isTripConverted(trip)) return false;
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
  // A locally recorded approval always wins over a stale server payload.
  if (wasTripDirectorApproved((trip as { id?: string | number }).id)) return false;
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
  if (s === "pending_scd_approval") return "Awaiting Supply Chain Director Approval";
  if (s === "pending_vendor_quotation") return "Pending Vendor Quotation";
  if (s === "converted_to_journey") return "Converted to Journey";
  if (
    s === "converted" ||
    s === "converted_to_logistics" ||
    s === "converted_to_logistics_request" ||
    s === "logistics_created"
  )
    return "Converted to Logistics Request";
  if (s === "rejected") return "Rejected";
  if (s === "cancelled") return "Cancelled";
  if (s === "returned") return "Returned for revision";
  if (s === "completed") return "Completed";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Label for list rows: reflects a director decision even when the list payload
 * still carries the pre-approval stage string.
 */
export function resolveTripDisplayStatus(trip: Record<string, unknown>): string {
  if (isTripConverted(trip)) return "Converted to Logistics Request";
  if (isTripDirectorApproved(trip)) return "Approved by Supply Chain Director";
  if (isTripAwaitingDirectorApproval(trip)) return "Awaiting Supply Chain Director";
  return tripStatusPlainLabel(trip);
}