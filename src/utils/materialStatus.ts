import type { MaterialMovementStatus, MaterialJCCStatus } from '@/types/logistics';

const titleCase = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const formatMaterialStatus = (status?: string | null): string => {
  switch (status) {
    case 'pending': return 'Pending';
    case 'in_transit': return 'In Transit';
    case 'delivered': return 'Delivered';
    case 'cancelled': return 'Cancelled';
    default:
      if (status && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[materialStatus] Unknown status: ${status}`);
      }
      return status ? titleCase(status) : '—';
  }
};

export const materialStatusBadgeClass = (status?: string | null): string => {
  switch (status) {
    case 'pending': return 'bg-muted text-muted-foreground';
    case 'in_transit': return 'bg-warning/10 text-warning border-warning/30';
    case 'delivered': return 'bg-success/10 text-success border-success/30';
    case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/30';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const formatJCCStatus = (status?: string | null): string => {
  switch (status) {
    case 'draft': return 'Draft';
    case 'submitted': return 'Submitted';
    case 'approved': return 'Approved';
    default: return status ? titleCase(status) : '—';
  }
};

export const jccStatusBadgeClass = (status?: string | null): string => {
  switch (status) {
    case 'draft': return 'bg-muted text-muted-foreground';
    case 'submitted': return 'bg-info/10 text-info border-info/30';
    case 'approved': return 'bg-success/10 text-success border-success/30';
    default: return 'bg-muted text-muted-foreground';
  }
};

export type RoleLike = string | undefined | null;

const MANAGE_ROLES = new Set([
  'logistics_officer',
  'logistics_manager',
  'logistics',
  'admin',
]);

export const canManageMovementsRole = (role: RoleLike): boolean =>
  !!role && MANAGE_ROLES.has(role);

export const canApproveMaterialJCCRole = (role: RoleLike): boolean =>
  role === 'supply_chain_director';

export type StatusValue = MaterialMovementStatus | MaterialJCCStatus;
