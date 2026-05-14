import type { SRFRequest } from "@/contexts/AppContext";

/** Normalized workflow-ish state for an SRF (prefer explicit workflow, then stage). */
export function getSrfWorkflowState(srf: SRFRequest): string {
  const ws = (srf.workflowState || (srf as { workflow_state?: string }).workflow_state || "")
    .toString()
    .toLowerCase()
    .trim();
  if (ws) return ws;
  return (srf.currentStage || "").toString().toLowerCase().trim();
}

/**
 * True once Supply Chain Director approval is done and Procurement may run RFQ
 * (aligned with common MRF workflow_state values).
 */
export function isSrfPastSupplyChainDirectorForRfq(srf: SRFRequest): boolean {
  const stage = (srf.currentStage || "").toLowerCase().trim();
  const ws = getSrfWorkflowState(srf);
  if (stage === "supply_chain_director_review") return false;
  const status = (srf.status || "").toLowerCase();
  if (status === "rejected" || stage === "rejected") return false;
  if (
    ws === "supply_chain_director_approved" ||
    ws === "procurement_review" ||
    ws === "procurement"
  )
    return true;
  const ready = new Set([
    "procurement_review",
    "procurement",
    "rfq_sent",
    "quotes_received",
    "vendor_selected",
    "final_approval",
    "invoice_received",
    "invoice_approved",
    "pending_po_upload",
    "vendor_approved",
    "po_generated",
  ]);
  if (ready.has(stage) || ready.has(ws)) return true;
  return false;
}
