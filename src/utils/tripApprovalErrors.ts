/**
 * Canonical backend error codes for the trip approval / conversion workflow.
 * Every code maps to a specific, user-readable sentence — we never surface a
 * raw "An error occurred" or "Invalid state" string.
 */
export const TRIP_WORKFLOW_ERROR_MESSAGES: Record<string, string> = {
  ALREADY_APPROVED: "This trip has already been approved.",
  ALREADY_CONVERTED:
    "This trip has already been converted to a logistics request and no longer requires approval.",
  INVALID_STATE: "This trip is not currently awaiting approval.",
  FORBIDDEN: "You do not have permission to approve trip requests.",
  NOT_FOUND: "Trip not found.",
  VALIDATION_ERROR: "Please check the highlighted fields and try again.",
};

const GENERIC_PATTERNS = [/^an error occurred/i, /^invalid state/i, /^error$/i];

/**
 * True when the failure means our view of the trip is stale (the backend has
 * already moved it on). Callers should drop the row and refetch instead of
 * leaving a dead Approve button on screen.
 */
export function isStaleTripStateError(
  res: { error?: string; code?: string } | undefined,
): boolean {
  const code = res?.code ?? "";
  if (["INVALID_STATE", "ALREADY_APPROVED", "ALREADY_CONVERTED"].includes(code)) {
    return true;
  }
  const msg = (res?.error ?? "").toLowerCase();
  return /already been (converted|approved|processed|rejected)|not currently awaiting/.test(msg);
}

/** Resolve the best user-facing message for a failed trip workflow response. */
export function resolveTripWorkflowError(
  res: { error?: string; code?: string; raw?: unknown } | undefined,
  fallback = "The action could not be completed. Please refresh and try again.",
): string {
  const code =
    res?.code ??
    ((res?.raw as { code?: string } | undefined)?.code as string | undefined);
  const msg0 = (res?.error ?? "").toLowerCase();
  // Backends reuse INVALID_STATE for several situations — prefer the message
  // text when it tells us exactly what happened.
  if (/already been converted/.test(msg0)) {
    return TRIP_WORKFLOW_ERROR_MESSAGES.ALREADY_CONVERTED;
  }
  if (/already been approved/.test(msg0)) {
    return TRIP_WORKFLOW_ERROR_MESSAGES.ALREADY_APPROVED;
  }
  if (code && TRIP_WORKFLOW_ERROR_MESSAGES[code]) {
    return TRIP_WORKFLOW_ERROR_MESSAGES[code];
  }
  const msg = res?.error?.trim();
  if (!msg || GENERIC_PATTERNS.some((p) => p.test(msg))) return fallback;
  return msg;
}