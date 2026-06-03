/** Status badge classes for SRF rows and detail dialogs (aligned with Procurement). */
export function getSrfStatusBadgeClass(status: string): string {
  switch (status) {
    case "Approved":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
    case "Completed":
      return "bg-accent text-accent-foreground";
    case "Pending":
    case "Submitted":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "Procurement Approved":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "Finance Approved":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "Rejected":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

/**
 * Centralised human-readable labels for raw SRF status / workflow strings.
 * Use everywhere we render an SRF status — never display the raw key.
 */
export const SRF_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting Initial Review",
  submitted: "Awaiting Initial Review",
  draft: "Draft — Not Submitted",
  sc_director: "Awaiting Supply Chain Director Approval",
  awaiting_scd: "Awaiting Supply Chain Director Approval",
  supply_chain_director_review: "Awaiting Supply Chain Director Approval",
  supply_chain_director_approved: "Approved and Being Processed",
  scd_approved: "Approved and Being Processed",
  procurement: "With Procurement Team",
  procurement_review: "With Procurement Team",
  rfq_sent: "With Procurement Team",
  quotes_received: "Vendor Quotes Received",
  vendor_selected: "Vendor Selected",
  approved: "Approved and Being Processed",
  rejected: "Returned for Revision",
  po_generated: "Purchase Order Created",
  pending_po_upload: "Purchase Order Pending Upload",
  finance: "Submitted to Finance for Payment",
  processing_payment: "Submitted to Finance for Payment",
  payment_completed: "Payment Completed",
  complete: "Completed",
  completed: "Completed",
  "in progress": "In Progress",
  in_progress: "In Progress",
};

/** Return a friendly label for any raw SRF status string. Falls back to title-cased input. */
export function getSrfStatusLabel(status: string | undefined | null): string {
  if (!status) return "Awaiting Initial Review";
  const key = String(status).trim().toLowerCase().replace(/\s+/g, "_");
  const direct = SRF_STATUS_LABELS[key] ?? SRF_STATUS_LABELS[String(status).trim().toLowerCase()];
  if (direct) return direct;
  return String(status)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
