import type { User } from "@/types";

/** Fields that carry SCM role information from API or auth state. */
export interface ScmRoleFields {
  supply_chain_role?: string | null;
  /** @deprecated Legacy alias — use supply_chain_role */
  role?: string | null;
}

/**
 * SCM permission source of truth.
 * Reads supply_chain_role exclusively; falls back to deprecated role for legacy sessions.
 */
export function getScmRole(user?: ScmRoleFields | null): string | undefined {
  const role = user?.supply_chain_role ?? user?.role;
  return role ?? undefined;
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
