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
export const PROCUREMENT_OVERVIEW_ROLES = ["logistics_manager", "logistics"] as const;

export function canAccessProcurementPage(role?: string | null): boolean {
  if (!role) return false;
  return (
    (PROCUREMENT_FULL_ACCESS_ROLES as readonly string[]).includes(role) ||
    (PROCUREMENT_OVERVIEW_ROLES as readonly string[]).includes(role)
  );
}

/** Client-side fallback when dashboard flags are not yet loaded. */
export function isProcurementOverviewOnly(role?: string | null): boolean {
  return role === "logistics_manager" || role === "logistics";
}

/** Prefer API flags from GET /dashboard/procurement-manager when present. */
export function resolveProcurementOverviewMode(
  role: string | undefined | null,
  api?: {
    isProcurementOverviewOnly?: boolean;
    readOnly?: boolean;
    canManageProcurement?: boolean;
  } | null,
): {
  isOverviewOnly: boolean;
  readOnly: boolean;
  canManageProcurement: boolean;
} {
  if (api?.isProcurementOverviewOnly !== undefined || api?.readOnly !== undefined) {
    const isOverviewOnly = Boolean(
      api.isProcurementOverviewOnly ?? api.readOnly ?? isProcurementOverviewOnly(role),
    );
    return {
      isOverviewOnly,
      readOnly: Boolean(api.readOnly ?? isOverviewOnly),
      canManageProcurement: Boolean(
        api.canManageProcurement ?? !isOverviewOnly,
      ),
    };
  }
  const isOverviewOnly = isProcurementOverviewOnly(role);
  return {
    isOverviewOnly,
    readOnly: isOverviewOnly,
    canManageProcurement: !isOverviewOnly,
  };
}
