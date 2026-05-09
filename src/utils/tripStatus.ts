/**
 * Single source of truth for trip status display.
 * Maps backend snake_case → user-facing labels.
 * If backend returns an unknown value, the helper Title-Cases it
 * and console.warns once per unknown value (dev only).
 * No string literals for trip status should appear in components.
 */

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  pending_approval: "Pending Approval",
  approved: "Approved",
  vendor_assigned: "Vendor Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
};

const warnedUnknown = new Set<string>();

export function formatTripStatus(status?: string | null): string {
  if (!status) return "Unknown";
  const key = String(status).toLowerCase();
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  if (import.meta.env.DEV && !warnedUnknown.has(key)) {
    warnedUnknown.add(key);
    // eslint-disable-next-line no-console
    console.warn(`[formatTripStatus] Unknown status from backend: "${status}"`);
  }
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

/** Semantic Tailwind class for the status badge. */
export function tripStatusBadgeClass(status?: string | null): string {
  const key = String(status ?? "").toLowerCase();
  switch (key) {
    case "draft":
      return "bg-warning/10 text-warning";
    case "scheduled":
      return "bg-warning/10 text-warning";
    case "pending_approval":
      return "bg-info/10 text-info";
    case "approved":
      return "bg-success/10 text-success";
    case "vendor_assigned":
      return "bg-info/10 text-info";
    case "in_progress":
      return "bg-primary/10 text-primary";
    case "completed":
      return "bg-success/10 text-success";
    case "closed":
      return "bg-muted text-muted-foreground";
    case "cancelled":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}