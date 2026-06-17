import type { AvailableActions } from '@/types';

/**
 * Document types that the Logistics Manager is permitted to upload
 * even when the broader procurement overview is read-only.
 */
export const LM_UPLOADABLE_DOC_TYPES = ['jcc', 'waybill'] as const;
export type LmUploadableDocType = (typeof LM_UPLOADABLE_DOC_TYPES)[number];

/**
 * When backend sets readOnly on available-actions, strip all workflow
 * mutation flags except those explicitly granted by the backend:
 *  - canGenerateGRN / canUploadGRN / canRequestGRN are preserved when
 *    the backend returns them as true (LM at correct GRN workflow stage).
 *  - 'jcc' and 'waybill' are kept in availableActions for the same reason.
 *
 * All other mutation flags (approve, reject, PO, payment, price comparison)
 * are forced off.
 */
export function applyReadOnlyAvailableActions(
  actions: AvailableActions,
): AvailableActions {
  if (!actions.readOnly) return actions;
  return {
    ...actions,
    canEdit: false,
    canApprove: false,
    canReject: false,
    canSelectVendors: false,
    canApproveInvoice: false,
    canGeneratePO: false,
    canSignPO: false,
    canProcessPayment: false,
    // GRN flags: keep the backend value — backend only sets these true when
    // the MRF is at the correct stage (payment processed, GRN requested).
    canRequestGRN: actions.canRequestGRN ?? false,
    canUploadGRN: actions.canUploadGRN ?? false,
    canGenerateGRN: actions.canGenerateGRN ?? false,
    availableActions: (actions.availableActions ?? []).filter((key) =>
      ['view', 'download', 'read', 'jcc', 'waybill'].includes(key),
    ),
  };
}
