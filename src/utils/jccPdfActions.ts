import { jccApi } from '@/services/logisticsApi';
import type { JCC, JCCLineItem, Trip } from '@/types/logistics';
import { buildJccDisplayModel, type JccDisplayModel } from '@/utils/jccDocumentModel';
import { buildJccPdf } from '@/utils/jccPdf';

/** Open a JCC PDF blob in a new tab. */
export async function openJccPdfFromModel(
  model: JccDisplayModel,
  revokeAfterMs = 120_000,
): Promise<void> {
  const blob = await buildJccPdf(model);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked — allow popups to view the JCC PDF.');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
}

/**
 * Build a JCC PDF from the in-memory dialog state (no network call).
 * Use for the "Preview Draft" button.
 */
export async function openJccPdfFromDialogState(input: {
  trip: Trip | null;
  jcc?: JCC | null;
  referenceNumber?: string;
  dateIssued?: string;
  certificationStatement?: string;
  lineItems?: JCCLineItem[];
  vendorAddress?: string;
  emeraldSignatoryName?: string;
  emeraldSignatoryTitle?: string;
  emeraldSignatureDataUrl?: string | null;
}): Promise<void> {
  const model = buildJccDisplayModel(input);
  await openJccPdfFromModel(model);
}

/**
 * Hydrate the JCC + Trip from the backend and render the client PDF.
 * Server-side `jccApi.downloadPdf` remains the fallback (caller can try this first).
 */
export async function openJccPdfForTrip(trip: Trip): Promise<{ ok: boolean; error?: string }> {
  try {
    const existing = await jccApi.get(trip.id);
    const jcc = existing.success && existing.data ? (existing.data as JCC) : null;
    await openJccPdfFromDialogState({ trip, jcc });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not build JCC PDF.' };
  }
}
