import { getScmRole } from './scmRole';
import type { User } from '@/types';

/**
 * Roles that can view the procurement documents registry on an MRF/PO.
 * Backend accepts the same list; keep this in sync when new roles are added.
 */
const VIEW_ROLES = new Set<string>([
  'procurement',
  'procurement_manager',
  'supply_chain_director',
  'supply_chain',
  'executive',
  'chairman',
  'finance',
  'finance_officer',
  'logistics',
  'logistics_manager',
  'logistics_officer',
  'admin',
]);

/** Roles whose access to the registry is view-only (no upload UI). */
const READ_ONLY_ROLES = new Set<string>([
  'executive',
  'chairman',
  'logistics',
  'logistics_manager',
  'logistics_officer',
]);

export function canViewProcurementDocuments(user?: Pick<User, 'supply_chain_role' | 'role'> | null): boolean {
  const role = getScmRole(user);
  return !!role && VIEW_ROLES.has(role);
}

export function isProcurementDocumentsReadOnly(user?: Pick<User, 'supply_chain_role' | 'role'> | null): boolean {
  const role = getScmRole(user);
  return !!role && READ_ONLY_ROLES.has(role);
}