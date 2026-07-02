import type { MRF } from "@/types";

export type MrfDashboardBucket = "pending" | "approved" | "rejected" | "completed";

export function getWorkflowState(mrf: MRF): string {
  return String(mrf.workflow_state || mrf.workflowState || "")
    .toLowerCase()
    .trim();
}

export function getCurrentStage(mrf: MRF): string {
  return String(mrf.current_stage || mrf.currentStage || "")
    .toLowerCase()
    .trim();
}

export function getFirstApprovalRole(mrf: MRF): string {
  return String(
    (mrf as { firstApprovalByRole?: string }).firstApprovalByRole ||
      (mrf as { first_approval_by_role?: string }).first_approval_by_role ||
      "",
  )
    .toLowerCase()
    .trim();
}

export function getMrfSortDate(mrf: MRF): number {
  const raw = mrf.created_at || (mrf as any).createdAt || (mrf as any).date || "";
  const t = Date.parse(String(raw));
  return Number.isNaN(t) ? 0 : t;
}

export function sortMrfsOldestFirst(mrfs: MRF[]): MRF[] {
  return [...mrfs].sort((a, b) => getMrfSortDate(a) - getMrfSortDate(b));
}

export function sortMrfsNewestFirst(mrfs: MRF[]): MRF[] {
  return [...mrfs].sort((a, b) => getMrfSortDate(b) - getMrfSortDate(a));
}

export function isMrfCompleted(mrf: MRF): boolean {
  const ws = getWorkflowState(mrf);
  const status = String(mrf.status || "").toLowerCase();
  const stage = getCurrentStage(mrf);
  return (
    ws === "closed" ||
    ws === "operationally_complete" ||
    ws === "financially_complete" ||
    status === "completed" ||
    stage === "completed" ||
    mrf.grn_completed === true ||
    (mrf as { grnCompleted?: boolean }).grnCompleted === true
  );
}

/** Executive or parallel first approval awaiting executive action */
export function isExecutivePendingApproval(mrf: MRF): boolean {
  const status = String(mrf.status || "").toLowerCase().trim();
  const currentStage = getCurrentStage(mrf);
  const workflowState = getWorkflowState(mrf);

  return (
    workflowState === "parallel_first_approval" ||
    currentStage === "parallel_first_approval" ||
    status === "executive_review" ||
    currentStage === "executive_review" ||
    currentStage === "executive" ||
    workflowState === "executive_review"
  );
}

export function isExecutiveRejected(mrf: MRF): boolean {
  const ws = getWorkflowState(mrf);
  const stage = getCurrentStage(mrf);
  if (ws === "executive_rejected" || stage === "executive_rejected") {
    return true;
  }
  const status = String(mrf.status || "").toLowerCase();
  const lastRole = String(
    (mrf as { last_action_by_role?: string }).last_action_by_role || "",
  ).toLowerCase();
  return status.includes("reject") && lastRole === "executive";
}

export function isExecutiveApproved(mrf: MRF): boolean {
  if (isExecutivePendingApproval(mrf) || isExecutiveRejected(mrf)) {
    return false;
  }
  if (getFirstApprovalRole(mrf) === "executive") {
    return true;
  }
  return Boolean(
    mrf.executive_approved || (mrf as { executiveApproved?: boolean }).executiveApproved,
  );
}

export function classifyExecutiveMrf(mrf: MRF): MrfDashboardBucket | null {
  if (isExecutivePendingApproval(mrf)) return "pending";
  if (isExecutiveRejected(mrf)) return "rejected";
  if (isMrfCompleted(mrf)) return "completed";
  if (isExecutiveApproved(mrf)) return "approved";
  return null;
}

export function getExecutiveApprovalDate(mrf: MRF): string | null {
  return (
    mrf.executive_approved_at ||
    (mrf as { executiveApprovedAt?: string }).executiveApprovedAt ||
    null
  );
}

/** SCD first approval (parallel or legacy) */
export function isScdPendingFirstApproval(mrf: MRF): boolean {
  const stage = getCurrentStage(mrf);
  const workflowState = getWorkflowState(mrf);
  return (
    stage === "parallel_first_approval" ||
    workflowState === "parallel_first_approval" ||
    stage === "director_review" ||
    stage === "supply_chain_director_review" ||
    workflowState === "supply_chain_director_review"
  );
}

export function isScdPendingVendorApproval(mrf: MRF): boolean {
  const workflowState = getWorkflowState(mrf);
  return workflowState === "vendor_selected" || workflowState === "invoice_received";
}

export function isScdPendingPoSignature(mrf: MRF): boolean {
  const stage = getCurrentStage(mrf);
  const workflowState = getWorkflowState(mrf);
  const unsignedUrl =
    mrf.unsigned_po_url ||
    (mrf as { unsignedPoUrl?: string }).unsignedPoUrl;
  const signedUrl =
    mrf.signed_po_url || (mrf as { signedPoUrl?: string }).signedPoUrl;
  return (
    (stage === "supply_chain" || workflowState === "po_generated") &&
    Boolean(unsignedUrl) &&
    !signedUrl
  );
}

export function isScdPendingFinalApproval(mrf: MRF): boolean {
  return getCurrentStage(mrf) === "final_approval";
}

export function isScdPendingMrfAction(mrf: MRF): boolean {
  return (
    isScdPendingFirstApproval(mrf) ||
    isScdPendingVendorApproval(mrf) ||
    isScdPendingPoSignature(mrf) ||
    isScdPendingFinalApproval(mrf)
  );
}

export function isScdRejected(mrf: MRF): boolean {
  const ws = getWorkflowState(mrf);
  if (ws === "supply_chain_director_rejected") {
    return true;
  }
  const status = String(mrf.status || "").toLowerCase();
  const lastRole = String(
    (mrf as { last_action_by_role?: string }).last_action_by_role || "",
  ).toLowerCase();
  return (
    status.includes("reject") &&
    (lastRole === "supply_chain_director" || lastRole === "supply_chain")
  );
}

export function isScdApproved(mrf: MRF): boolean {
  if (isScdPendingMrfAction(mrf) || isScdRejected(mrf)) {
    return false;
  }
  if (getFirstApprovalRole(mrf) === "supply_chain_director") {
    return true;
  }
  const scdAt =
    (mrf as { scd_approved_at?: string }).scd_approved_at ||
    (mrf as { director_approved_at?: string }).director_approved_at ||
    (mrf as { scdApprovedAt?: string }).scdApprovedAt;
  if (scdAt) {
    return true;
  }
  const poSigned =
    (mrf as { po_signed_at?: string }).po_signed_at ||
    (mrf as { poSignedAt?: string }).poSignedAt;
  if (poSigned) {
    return true;
  }
  const lastRole = String(
    (mrf as { last_action_by_role?: string }).last_action_by_role || "",
  ).toLowerCase();
  if (lastRole === "supply_chain_director" || lastRole === "supply_chain") {
    const ws = getWorkflowState(mrf);
    if (
      [
        "supply_chain_director_approved",
        "procurement_review",
        "procurement_approved",
        "vendor_selected",
        "invoice_approved",
        "po_generated",
        "po_signed",
      ].includes(ws)
    ) {
      return true;
    }
  }
  return false;
}

export function classifyScdMrf(mrf: MRF): MrfDashboardBucket | null {
  if (isScdPendingMrfAction(mrf)) return "pending";
  if (isScdRejected(mrf)) return "rejected";
  if (isMrfCompleted(mrf)) return "completed";
  if (isScdApproved(mrf)) return "approved";
  return null;
}

export function getScdApprovalDate(mrf: MRF): string | null {
  return (
    (mrf as { scd_approved_at?: string }).scd_approved_at ||
    (mrf as { director_approved_at?: string }).director_approved_at ||
    (mrf as { scdApprovedAt?: string }).scdApprovedAt ||
    (mrf as { po_signed_at?: string }).po_signed_at ||
    (mrf as { poSignedAt?: string }).poSignedAt ||
    null
  );
}

export function getMrfRejectionReason(mrf: MRF): string | null {
  return (
    mrf.rejectionReason ||
    (mrf as { rejection_reason?: string }).rejection_reason ||
    (mrf as { executive_remarks?: string }).executive_remarks ||
    (mrf as { scd_remarks?: string }).scd_remarks ||
    null
  );
}

export function getMrfStatusLabel(mrf: MRF): string {
  const firstLabel = (mrf as { firstApprovalStatusLabel?: string })
    .firstApprovalStatusLabel;
  if (firstLabel) {
    return firstLabel;
  }
  return String(mrf.status || getWorkflowStageFallback(mrf));
}

function getWorkflowStageFallback(mrf: MRF): string {
  return getCurrentStage(mrf) || getWorkflowState(mrf) || "—";
}

export function bucketExecutiveMrfs(mrfs: MRF[]): Record<MrfDashboardBucket, MRF[]> {
  const buckets: Record<MrfDashboardBucket, MRF[]> = {
    pending: [],
    approved: [],
    rejected: [],
    completed: [],
  };
  for (const mrf of mrfs) {
    const bucket = classifyExecutiveMrf(mrf);
    if (bucket) {
      buckets[bucket].push(mrf);
    }
  }
  buckets.pending = sortMrfsOldestFirst(buckets.pending);
  buckets.approved = sortMrfsNewestFirst(buckets.approved);
  buckets.rejected = sortMrfsNewestFirst(buckets.rejected);
  buckets.completed = sortMrfsNewestFirst(buckets.completed);
  return buckets;
}

export function bucketScdMrfs(mrfs: MRF[]): Record<MrfDashboardBucket, MRF[]> {
  const buckets: Record<MrfDashboardBucket, MRF[]> = {
    pending: [],
    approved: [],
    rejected: [],
    completed: [],
  };
  for (const mrf of mrfs) {
    const bucket = classifyScdMrf(mrf);
    if (bucket) {
      buckets[bucket].push(mrf);
    }
  }
  buckets.pending = sortMrfsOldestFirst(buckets.pending);
  buckets.approved = sortMrfsNewestFirst(buckets.approved);
  buckets.rejected = sortMrfsNewestFirst(buckets.rejected);
  buckets.completed = sortMrfsNewestFirst(buckets.completed);
  return buckets;
}
