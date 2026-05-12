import type { POProjection, POStatusKey } from '@/types/procurement';

const norm = (s: unknown) =>
  String(s ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '_');

/**
 * Map an MRF projection to a PO status badge key.
 * Priority: signed > rejected > draft > status-based.
 */
export function formatPOStatus(input: POProjection): { key: POStatusKey; label: string } {
  const status = norm(input.status);
  const wf = norm(input.workflow_state ?? input.workflowState);
  const signedUrl = input.signed_po_url ?? input.signedPOUrl;
  const unsignedUrl = input.unsigned_po_url ?? input.unsignedPOUrl;
  const isDraft = Boolean(input.is_po_draft ?? input.isPODraft);

  if (signedUrl || wf === 'po_signed' || status === 'po_signed') {
    return { key: 'signed', label: 'Signed' };
  }
  if (status === 'po_rejected') {
    return { key: 'rejected', label: 'Rejected' };
  }
  if (isDraft && !unsignedUrl) {
    return { key: 'draft', label: 'Draft PO' };
  }
  if (status === 'pending_po_upload') {
    return { key: 'awaiting_po', label: 'Awaiting PO' };
  }
  if (status === 'awaiting_scd_signature') {
    return { key: 'pending_signature', label: 'Pending Signature' };
  }
  if (status === 'supply_chain') {
    return { key: 'with_supply_chain', label: 'With Supply Chain' };
  }
  if (status === 'finance') {
    return { key: 'with_finance', label: 'With Finance' };
  }
  return { key: 'unknown', label: input.status ? String(input.status) : '—' };
}

/** Tailwind class string for the badge — uses semantic tokens only. */
export function poStatusBadgeClass(key: POStatusKey): string {
  switch (key) {
    case 'signed':
      return 'bg-success/10 text-success border-success/30';
    case 'rejected':
      return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'pending_signature':
      return 'bg-warning/10 text-warning-foreground border-warning/30';
    case 'with_finance':
      return 'bg-primary/10 text-primary border-primary/30';
    case 'draft':
    case 'awaiting_po':
    case 'with_supply_chain':
    case 'unknown':
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

/** Friendly mapping for known backend error codes. */
export const PO_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested record could not be found.',
  RFQ_NOT_APPROVED:
    'The RFQ for this MRF must be approved by the Supply Chain Director before a PO can be generated.',
  INVALID_STATUS: 'This MRF is not in a stage that allows PO generation.',
  DUPLICATE_PO_NUMBER: 'A PO with that number already exists.',
  PO_ALREADY_SIGNED:
    'This PO has already been signed and can no longer be edited.',
  VALIDATION_ERROR: 'Some fields are invalid. Please review and try again.',
};

export function describeBackendError(raw: unknown, fallback = 'Something went wrong.'): string {
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const code = typeof r.code === 'string' ? r.code : undefined;
  if (code && PO_ERROR_MESSAGES[code]) return PO_ERROR_MESSAGES[code];
  if (typeof r.message === 'string' && r.message.trim()) return r.message;
  if (typeof r.error === 'string' && r.error.trim()) return r.error;
  return fallback;
}