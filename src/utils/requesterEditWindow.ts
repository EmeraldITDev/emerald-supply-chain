/** Designated requester may edit within 48 hours of submission (backend is authoritative). */
export const REQUESTER_EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

export type RequesterEditableRecord = {
  created_at?: string | null;
  createdAt?: string | null;
  date?: string | null;
  requester_id?: string | number | null;
  requesterId?: string | number | null;
  requester?: string | { name?: string } | null;
  requester_name?: string | null;
  requesterName?: string | null;
  workflow_state?: string | null;
  workflowState?: string | null;
  status?: string | null;
  can_requester_edit?: boolean | null;
  canRequesterEdit?: boolean | null;
  requester_edit_expires_at?: string | null;
  requesterEditExpiresAt?: string | null;
};

export function getRecordCreatedAt(record: RequesterEditableRecord): string | null {
  return (
    record.created_at ||
    record.createdAt ||
    record.date ||
    null
  );
}

export function isWithinRequesterEditWindow(
  createdAt: string | Date | null | undefined,
  nowMs: number = Date.now(),
  windowMs: number = REQUESTER_EDIT_WINDOW_MS,
): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t >= 0 && nowMs - t <= windowMs;
}

export function requesterEditExpiresAt(
  createdAt: string | Date | null | undefined,
  windowMs: number = REQUESTER_EDIT_WINDOW_MS,
): string | null {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + windowMs).toISOString();
}

function normalizeWorkflow(record: RequesterEditableRecord): string {
  return String(record.workflow_state || record.workflowState || record.status || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Client-side guard: block edits once workflow has advanced past early review. */
function isWorkflowEditable(record: RequesterEditableRecord): boolean {
  const wf = normalizeWorkflow(record);
  if (!wf) return true;
  if (wf.includes("reject")) return false; // use resubmit flow for rejected MRF/SRF
  if (wf.includes("complete")) return false;
  if (wf.includes("confirmed")) return false;
  if (wf.includes("draft")) return false;
  if (wf.includes("po_generated") || wf.includes("grn_")) return false;
  if (wf.includes("awaiting_scd_signature")) return false;
  return true;
}

function isRecordRequester(
  record: RequesterEditableRecord,
  user?: { id?: number | string; name?: string; email?: string } | null,
): boolean {
  if (!user) return false;
  const rid = record.requester_id ?? record.requesterId;
  if (rid != null && user.id != null && String(rid) === String(user.id)) {
    return true;
  }
  const requesterName =
    typeof record.requester === "object" && record.requester
      ? record.requester.name
      : typeof record.requester === "string"
        ? record.requester
        : record.requester_name || record.requesterName;
  if (!requesterName) return false;
  return (
    requesterName === user.name ||
    requesterName === user.email
  );
}

export type RequesterEditAccess = {
  canEdit: boolean;
  expiresAt: string | null;
  reason?: string;
};

/**
 * Resolve whether the current user may edit this request within the 48-hour window.
 * Backend flags (`can_requester_edit`) take precedence when present.
 */
export function resolveRequesterEditAccess(
  record: RequesterEditableRecord,
  user?: { id?: number | string; name?: string; email?: string } | null,
  nowMs: number = Date.now(),
): RequesterEditAccess {
  const expiresAt =
    record.requester_edit_expires_at ||
    record.requesterEditExpiresAt ||
    requesterEditExpiresAt(getRecordCreatedAt(record));

  const backendFlag = record.can_requester_edit ?? record.canRequesterEdit;
  if (backendFlag === true) {
    return { canEdit: true, expiresAt };
  }
  if (backendFlag === false) {
    return {
      canEdit: false,
      expiresAt,
      reason: "The 48-hour edit window has closed or this request can no longer be edited.",
    };
  }

  if (!isRecordRequester(record, user)) {
    return {
      canEdit: false,
      expiresAt,
      reason: "Only the designated requester can edit this request.",
    };
  }

  if (!isWorkflowEditable(record)) {
    return {
      canEdit: false,
      expiresAt,
      reason: "This request has moved past the stage where edits are allowed.",
    };
  }

  const createdAt = getRecordCreatedAt(record);
  const within = isWithinRequesterEditWindow(createdAt, nowMs);
  return {
    canEdit: within,
    expiresAt,
    reason: within
      ? undefined
      : "Edits are only allowed within 48 hours of submission.",
  };
}

export function formatRequesterEditTimeRemaining(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m remaining to edit`;
  return `${minutes}m remaining to edit`;
}
