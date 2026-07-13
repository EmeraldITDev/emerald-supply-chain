import { mrfApi } from '@/services/api';
import type { MRF } from '@/types';

function mrfApiId(mrf: Pick<MRF, 'id'> & { mrf_id?: string; formatted_id?: string }): string {
  const anyMrf = mrf as MRF & { mrf_id?: string; formattedId?: string; formatted_id?: string };
  return String(anyMrf.formatted_id || anyMrf.formattedId || anyMrf.mrf_id || anyMrf.id || '');
}

/**
 * Download unsigned/signed PO via authenticated API stream (Emerald layout).
 * Prefer this over client jsPDF rebuilds or opening cached S3 pre-signed URLs.
 */
export async function downloadMrfPurchaseOrderPdf(
  mrf: MRF,
  opts?: { preferSigned?: boolean },
): Promise<{ success: boolean; error?: string }> {
  const id = mrfApiId(mrf);
  if (!id) {
    return { success: false, error: 'MRF id missing' };
  }

  const hasSigned = Boolean(
    mrf.signed_po_url ||
      mrf.signedPOUrl ||
      (mrf as MRF & { signed_po_share_url?: string }).signed_po_share_url ||
      (mrf as MRF & { signedPOShareUrl?: string }).signedPOShareUrl,
  );
  const poType = opts?.preferSigned !== false && hasSigned ? 'signed' : 'unsigned';

  return mrfApi.downloadPO(id, poType);
}
