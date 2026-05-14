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
