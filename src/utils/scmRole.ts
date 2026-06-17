import type { User } from "@/types";

/** Fields that carry SCM role information from API or auth state. */
export interface ScmRoleFields {
  supply_chain_role?: string | null;
  /** @deprecated Legacy alias — use supply_chain_role */
  role?: string | null;
}

/**
 * Canonical SCM role identifiers.
 * Any value not in this set (including all HRIS roles) resolves to "employee".
 * Legacy aliases (logistics, procurement, supply_chain, finance_officer) are kept
 * so existing users retain access, but are not offered in the role picker.
 */
export const CANONICAL_SCM_ROLES = new Set([
  "employee",
  "executive",
  "procurement_manager",
  "procurement",         // legacy alias
  "supply_chain_director",
  "supply_chain",        // legacy alias
  "finance",
  "finance_officer",     // legacy alias
  "chairman",
  "admin",
  "vendor",
  "logistics_manager",
  "logistics_officer",
  "logistics",           // legacy: kept working, hidden from picker
]);

/**
 * Normalizes a raw role string to a canonical SCM role.
 * HRIS roles (line_manager, finance_manager, power_user, contract_employee,
 * general_employee, etc.) and any unknown value all resolve to "employee".
 */
export function normalizeScmRole(role?: string | null): string | undefined {
  if (role == null || typeof role !== "string") return undefined;
  const r = role.trim().toLowerCase();
  if (!r) return undefined;
  return CANONICAL_SCM_ROLES.has(r) ? r : "employee";
}

/**
 * SCM permission source of truth.
 * Returns a normalized canonical SCM role; HRIS or unknown values become "employee".
 */
export function getScmRole(user?: ScmRoleFields | null): string | undefined {
  return normalizeScmRole(user?.supply_chain_role ?? user?.role);
}

export function formatScmRoleLabel(role?: string | null): string {
  if (role == null || typeof role !== "string") return "";
  const normalized = role.trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replace(/_/g, " ");
}

/** Resolve SCM role from a User API record; never returns null. */
export function getUserScmRole(user: Pick<User, "supply_chain_role" | "role">): string | undefined {
  const role = user.supply_chain_role ?? user.role;
  if (role == null || typeof role !== "string") return undefined;
  const normalized = role.trim();
  return normalized || undefined;
}

/** SCM role for forms/selects — falls back to employee when unset. */
export function getUserScmRoleOrDefault(
  user: Pick<User, "supply_chain_role" | "role">,
  fallback = "employee",
): string {
  return getUserScmRole(user) ?? fallback;
}
