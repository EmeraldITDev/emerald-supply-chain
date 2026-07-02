/** Roles with read access to Reports & Analytics pages and report APIs. */
export const SCM_REPORT_VIEW_ROLES = [
  "procurement_manager",
  "procurement",
  "supply_chain_director",
  "supply_chain",
  "admin",
  "finance",
  "finance_officer",
  "executive",
  "logistics_manager",
  "logistics_officer",
] as const;

export function canViewScmReports(role?: string | null): boolean {
  return role != null && (SCM_REPORT_VIEW_ROLES as readonly string[]).includes(role);
}
