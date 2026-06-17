/** Roles with full procurement dashboard access (create, approve, PO, RFQ). */
export const PROCUREMENT_FULL_ACCESS_ROLES = [
  "procurement",
  "procurement_manager",
  "executive",
  "chairman",
  "supply_chain_director",
  "supply_chain",
] as const;

/** Logistics Manager — read-only Procurement Overview at /procurement */
export const PROCUREMENT_OVERVIEW_ROLES = ["logistics_manager"] as const;

export function canAccessProcurementPage(role?: string | null): boolean {
  if (!role) return false;
  return (
    (PROCUREMENT_FULL_ACCESS_ROLES as readonly string[]).includes(role) ||
    (PROCUREMENT_OVERVIEW_ROLES as readonly string[]).includes(role)
  );
}

export function isProcurementOverviewOnly(role?: string | null): boolean {
  return role === "logistics_manager";
}
