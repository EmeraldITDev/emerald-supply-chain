import { getScmRole } from './scmRole';
import type { User } from '@/types';

type UserLike = Pick<User, 'supply_chain_role' | 'role'> & { is_admin?: boolean };

/** Roles that may open the Warehouse module at all. */
const WAREHOUSE_VIEW_ROLES = new Set<string>([
  'admin',
  'warehouse_manager',
  'procurement_manager',
  'procurement',
  'supply_chain_director',
  'supply_chain',
  'finance',
  'finance_officer',
  'executive',
  'chairman',
]);

/** Roles that may mutate warehouse structure, receipts, counts and adjustments. */
const WAREHOUSE_MANAGE_ROLES = new Set<string>(['admin', 'warehouse_manager']);

/** Read-only roles — dashboard and reports only. */
const WAREHOUSE_READ_ONLY_ROLES = new Set<string>([
  'executive',
  'chairman',
  'finance',
  'finance_officer',
]);

const role = (user?: UserLike | null) => getScmRole(user) ?? '';

export function canAccessWarehouse(user?: UserLike | null): boolean {
  return !!user?.is_admin || WAREHOUSE_VIEW_ROLES.has(role(user));
}

/** Manage warehouse structure, goods receipt, counts, adjustments approval. */
export function canManageWarehouse(user?: UserLike | null): boolean {
  return !!user?.is_admin || WAREHOUSE_MANAGE_ROLES.has(role(user));
}

/** Procurement can raise MRFs off low-stock alerts. */
export function canRaiseMrfFromWarehouse(user?: UserLike | null): boolean {
  const r = role(user);
  return !!user?.is_admin || r === 'procurement_manager' || r === 'procurement' || r === 'warehouse_manager';
}

/** Finance / Executive style read-only access. */
export function isWarehouseReadOnly(user?: UserLike | null): boolean {
  if (user?.is_admin) return false;
  return WAREHOUSE_READ_ONLY_ROLES.has(role(user));
}

/** Valuation reports and stock ledger visibility. */
export function canViewInventoryValuation(user?: UserLike | null): boolean {
  const r = role(user);
  return (
    !!user?.is_admin ||
    ['admin', 'warehouse_manager', 'finance', 'finance_officer', 'executive', 'chairman'].includes(r)
  );
}