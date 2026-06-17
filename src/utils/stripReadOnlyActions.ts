import type { AvailableActions } from '@/types';

/** When backend sets readOnly on available-actions, force all mutation flags off. */
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
    canRequestGRN: false,
    canUploadGRN: false,
    canGenerateGRN: false,
    availableActions: (actions.availableActions ?? []).filter((key) =>
      ['view', 'download', 'read'].includes(key),
    ),
  };
}
