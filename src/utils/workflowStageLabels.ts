/**
 * Human-readable workflow stage (MRF/SRF share many slug values).
 */
export function getWorkflowStageLabel(stage?: string | null): string {
  const raw = (stage ?? "").toString();
  const s = raw.toLowerCase().trim();
  if (!s) return "N/A";
  if (s === "draft") return "Draft";
  if (s === "submitted") return "Submitted";
  if (s === "executive_review" || s === "executive")
    return "Executive approval";
  if (s === "director_review") return "Director review";
  if (s === "awaiting_scd_signature" || s === "awaiting-scd-signature")
    return "SCD signature pending";
  if (s === "supply_chain_director_review" || s === "supply_chain")
    return "Supply Chain Director approval";
  if (s === "supply_chain_director_approved")
    return "Supply Chain Director approved";
  if (s === "procurement_review" || s === "procurement")
    return "Procurement review";
  if (s === "rfq_sent") return "RFQ sent to vendors";
  if (s === "quotes_received") return "Quotes received";
  if (s === "vendor_selected") return "Vendor selected";
  if (s === "final_approval") return "Final approval";
  if (s === "po_generated") return "PO generated";
  if (s === "pending_po_upload") return "PO upload pending";
  if (s === "vendor_approved") return "Vendor approved";
  if (s === "invoice_received" || s === "invoice_approved")
    return "Invoice / payment stage";
  if (s === "chairman_review" || s === "chairman_payment")
    return "Chairman review";
  if (s === "completed" || s.includes("grn_complete")) return "Completed";
  if (s === "rejected" || s.includes("reject")) return "Rejected";
  return raw
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
