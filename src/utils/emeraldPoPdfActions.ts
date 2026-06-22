import { mrfApi, vendorApi } from '@/services/api';
import { procurementApi } from '@/services/procurementApi';
import type { MRF } from '@/types';
import { getMrfApiId } from '@/utils/displayId';
import {
  buildEmeraldPoDisplayModel,
  coercePOTermsMode,
  userClausesFromStoredCustomTerms,
  type EmeraldPoDisplayModel,
} from '@/utils/emeraldPoDocumentModel';
import { buildEmeraldPurchaseOrderPdf } from '@/utils/emeraldPOPdf';

/** Open a tab with the Emerald-layout PO PDF built from the given display model. */
export async function openEmeraldPurchaseOrderPdfInNewTab(
  model: EmeraldPoDisplayModel,
  revokeAfterMs = 120_000,
): Promise<void> {
  const blob = await buildEmeraldPurchaseOrderPdf(model);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked — allow popups to view the PO PDF.');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
}

/** Trigger a browser download of the Emerald-layout PO PDF for the given model. */
export async function downloadEmeraldPurchaseOrderPdf(
  model: EmeraldPoDisplayModel,
  fileName = 'purchase-order.pdf',
): Promise<void> {
  const blob = await buildEmeraldPurchaseOrderPdf(model);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Load MRF + price comparison + vendors from the API, build the Emerald PO model, and open it.
 * Use for “View / Open PO” anywhere the server stores a generated PO but the canonical layout is Emerald.
 */
export type OpenEmeraldPoForMrfResult = { ok: boolean; error?: string };

async function buildEmeraldModelForMrf(
  mrf: MRF,
  options?: { includeSignature?: boolean; signatureDataUrl?: string | null },
): Promise<{ model: EmeraldPoDisplayModel; fullMrf: MRF } | { error: string }> {
  const mrfId = getMrfApiId(mrf) || mrf.id;
  if (!mrfId) return { error: 'Missing MRF identifier.' };

  const fullRes = await mrfApi.getById(mrfId);
  if (!fullRes.success || !fullRes.data) {
    return { error: fullRes.error || 'Could not load MRF.' };
  }
  const fullMrf = fullRes.data;

  const pcRes = await procurementApi.getPriceComparison(mrfId);
  const rows = pcRes.success && pcRes.data ? pcRes.data : [];

  const vendorsRes = await vendorApi.getAll();
  const vendors =
    vendorsRes.success && Array.isArray(vendorsRes.data) ? vendorsRes.data : [];

  const poType = String(
    (fullMrf as { po_type?: string }).po_type || 'goods',
  ) as 'goods' | 'services' | 'logistics';
  let standardTermsBody: string | undefined;
  const termsRes = await procurementApi.getPOTermsTemplate(poType);
  if (termsRes.success && termsRes.data) {
    standardTermsBody =
      termsRes.data.content || termsRes.data.standard_terms || undefined;
  }

  const model = buildEmeraldPoDisplayModel({
    mrf: fullMrf,
    rows,
    vendors,
    standardTermsBody,
    terms_mode: coercePOTermsMode(
      (fullMrf as { terms_mode?: string; termsMode?: string }).terms_mode ??
        (fullMrf as { terms_mode?: string; termsMode?: string }).termsMode,
    ),
    user_terms_text: userClausesFromStoredCustomTerms(
      (fullMrf as { custom_terms?: string; customTerms?: string }).custom_terms ??
        (fullMrf as { custom_terms?: string; customTerms?: string }).customTerms,
    ),
    includeSignature: Boolean(options?.includeSignature),
    signatureDataUrl: options?.signatureDataUrl,
  });

  return { model, fullMrf };
}

export async function openEmeraldPurchaseOrderForMrf(
  mrf: MRF,
  options?: {
    includeSignature?: boolean;
    signatureDataUrl?: string | null;
  },
): Promise<OpenEmeraldPoForMrfResult> {
  try {
    const built = await buildEmeraldModelForMrf(mrf, options);
    if ('error' in built) return { ok: false, error: built.error };
    await openEmeraldPurchaseOrderPdfInNewTab(built.model);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not build PO PDF.',
    };
  }
}

/**
 * Build the Emerald PO PDF for an MRF and trigger a download. Used by the PO
 * detail view so the SCD can download the signed PO immediately after signing.
 */
export async function downloadEmeraldPurchaseOrderForMrf(
  mrf: MRF,
  options?: {
    includeSignature?: boolean;
    signatureDataUrl?: string | null;
    fileName?: string;
  },
): Promise<OpenEmeraldPoForMrfResult> {
  try {
    const built = await buildEmeraldModelForMrf(mrf, options);
    if ('error' in built) return { ok: false, error: built.error };
    const poNum =
      (built.fullMrf as { po_number?: string; poNumber?: string }).po_number ||
      (built.fullMrf as { poNumber?: string }).poNumber ||
      'purchase-order';
    const fileName =
      options?.fileName ||
      `${poNum}${options?.includeSignature ? '-signed' : ''}.pdf`;
    await downloadEmeraldPurchaseOrderPdf(built.model, fileName);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not build PO PDF.',
    };
  }
}
