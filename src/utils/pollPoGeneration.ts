import { mrfApi } from '@/services/api';
import type { MRF } from '@/types';

/**
 * Poll GET /api/mrfs/{id} until an auto-generated PO is ready.
 *
 * Backend accepts `POST /api/mrfs/{id}/generate-po` and (when the queue is
 * async) returns 202 immediately while a worker builds the PDF. The frontend
 * must then poll until either:
 *   - `unsigned_po_url` / `unsignedPOUrl` is populated, OR
 *   - `workflow_state` (or `workflowState`) equals `po_generated`, OR
 *   - `po_generation_error` is set (failure — throws).
 *
 * Resolves with the latest MRF once ready, or `null` if it never resolves
 * inside the timeout window.
 */
export async function pollForGeneratedPO(
  mrfId: string,
  opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<MRF | null> {
  const intervalMs = opts.intervalMs ?? 1500;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (opts.signal?.aborted) return null;
    const res = await mrfApi.getById(mrfId);
    const mrf = res.success ? (res.data as MRF | undefined) : undefined;
    if (mrf) {
      const err =
        (mrf as MRF & { po_generation_error?: string; poGenerationError?: string })
          .po_generation_error ||
        (mrf as MRF & { poGenerationError?: string }).poGenerationError;
      if (err && String(err).trim()) {
        throw new Error(String(err));
      }
      if (isPoReady(mrf)) return mrf;
    }
    await wait(intervalMs, opts.signal);
  }
  return null;
}

/** True when the MRF row already shows a generated (unsigned) PO. */
export function isPoReady(mrf: MRF | Record<string, unknown>): boolean {
  const m = mrf as Record<string, unknown>;
  const unsigned = (m.unsigned_po_url ?? m.unsignedPOUrl) as string | undefined;
  if (unsigned && String(unsigned).trim().length > 0) return true;
  const wf = String(m.workflow_state ?? m.workflowState ?? '').toLowerCase();
  return wf === 'po_generated' || wf === 'awaiting_scd_signature' || wf === 'po_signed';
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(id);
        resolve();
      },
      { once: true },
    );
  });
}