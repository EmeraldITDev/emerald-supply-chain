import type { AvailableActions } from "@/types";
import { getWorkflowStageLabel } from "@/utils/workflowStageLabels";

type GrnMrfFields = {
  workflow_state?: string;
  workflowState?: string;
  status?: string;
  grn_requested?: boolean;
  grnRequested?: boolean;
  grn_completed?: boolean;
  grnCompleted?: boolean;
  po_number?: string;
  poNumber?: string;
  grn_url?: string;
  grnUrl?: string;
};

export function getMrfWorkflowState(mrf: GrnMrfFields): string {
  return (mrf.workflow_state || mrf.workflowState || "").toLowerCase();
}

/** PO issued but no GRN document yet — loose filter used before checking permissions. */
export function mrfHasPoWithoutGrn(mrf: GrnMrfFields): boolean {
  const hasPo = Boolean(mrf.po_number || mrf.poNumber);
  const hasGrn = Boolean(
    mrf.grn_url || mrf.grnUrl || mrf.grn_completed || mrf.grnCompleted,
  );
  return hasPo && !hasGrn;
}

/** Matches Procurement overview: GRN queue when workflow is explicitly at grn_requested. */
export function isGrnWorkflowHeuristic(mrf: GrnMrfFields): boolean {
  const workflowState = getMrfWorkflowState(mrf);
  const grnRequested = mrf.grn_requested || mrf.grnRequested;
  const grnCompleted = mrf.grn_completed || mrf.grnCompleted;
  return workflowState === "grn_requested" && Boolean(grnRequested) && !grnCompleted;
}

export function isGrnActionable(actions: AvailableActions | null | undefined): boolean {
  return Boolean(actions?.canGenerateGRN || actions?.canUploadGRN);
}

/** User-facing explanation when GRN tabs are disabled (backend is authoritative). */
export function describeGrnUnavailable(
  mrf: GrnMrfFields,
  actions: AvailableActions | null | undefined,
): { title: string; details: string[] } {
  const workflowState = getMrfWorkflowState(mrf);
  const stageLabel = getWorkflowStageLabel(workflowState || mrf.status);
  const grnRequested = Boolean(mrf.grn_requested || mrf.grnRequested);
  const details: string[] = [];

  details.push(
    `Current workflow stage: ${stageLabel}${
      workflowState ? ` (${workflowState.replace(/_/g, " ")})` : ""
    }`,
  );

  if (!grnRequested) {
    details.push(
      "Procurement has not requested a GRN for this MRF yet. GRN is only enabled after payment is processed and Procurement requests goods receipt confirmation.",
    );
  } else if (workflowState !== "grn_requested") {
    details.push(
      "GRN was requested, but the workflow has not reached the grn_requested stage. Procurement may need to advance the MRF.",
    );
  }

  if (actions?.canRequestGRN) {
    details.push(
      "Your role can request GRN from the Procurement MRF view — use Request GRN when payment has been processed.",
    );
  }

  if (!isGrnActionable(actions)) {
    if (workflowState === "grn_requested" && grnRequested) {
      details.push(
        "The server did not grant GRN generate/upload permission for your role. If goods were received, contact Procurement or an administrator.",
      );
    } else if (!actions?.canRequestGRN) {
      details.push(
        "Wait for Procurement to complete payment processing and request GRN, or contact them if delivery already occurred.",
      );
    }
  }

  return {
    title: "GRN is not available for this MRF yet",
    details,
  };
}
