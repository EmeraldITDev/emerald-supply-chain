import { buildGrnDisplayModel, type GrnBuildInput, type GrnDisplayModel } from '@/utils/grnDocumentModel';
import { buildGrnPdf } from '@/utils/grnPdf';

export async function openGrnPdfFromModel(
  model: GrnDisplayModel,
  revokeAfterMs = 120_000,
): Promise<void> {
  const blob = await buildGrnPdf(model);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked — allow popups to view the GRN PDF.');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
}

/** Build a GRN PDF directly from the GRN dialog's in-memory state. */
export async function openGrnPdfFromDialogState(input: GrnBuildInput): Promise<void> {
  const model = buildGrnDisplayModel(input);
  await openGrnPdfFromModel(model);
}
