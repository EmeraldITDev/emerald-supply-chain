import { blobToDataUrl, fetchUrlAsDataUrl } from '@/utils/emeraldPOPdf';

const CACHE_PREFIX = 'scm_user_signature_data_v1_';

export function signatureCacheKey(userId: string | number): string {
  return `${CACHE_PREFIX}${userId}`;
}

export function readCachedUserSignature(userId: string | number): string | null {
  try {
    const raw = localStorage.getItem(signatureCacheKey(userId));
    return raw && raw.startsWith('data:image/') ? raw : null;
  } catch {
    return null;
  }
}

export function writeCachedUserSignature(userId: string | number, dataUrl: string): void {
  try {
    localStorage.setItem(signatureCacheKey(userId), dataUrl);
  } catch {
    /* storage quota — non-fatal */
  }
}

export function clearCachedUserSignature(userId: string | number): void {
  try {
    localStorage.removeItem(signatureCacheKey(userId));
  } catch {
    /* ignore */
  }
}

/**
 * Resolve a user's signature for PDF preview/signing.
 * Order: override file → local cache → GET /users/{id}/signature → presigned URL.
 * Caches successful fetches so presigned URLs expiring does not break signing.
 */
export async function resolveUserSignatureDataUrl(options: {
  userId?: string | number | null;
  signatureUrl?: string | null;
  overrideFile?: File | Blob | null;
}): Promise<string | null> {
  const { userId, signatureUrl, overrideFile } = options;

  if (overrideFile) {
    const data = await blobToDataUrl(overrideFile);
    if (userId != null) writeCachedUserSignature(userId, data);
    return data;
  }

  if (userId != null) {
    const cached = readCachedUserSignature(userId);
    if (cached) return cached;

    const { signatureApi } = await import('@/services/api');
    const fromApi = await signatureApi.downloadImage(String(userId));
    if (fromApi) {
      writeCachedUserSignature(userId, fromApi);
      return fromApi;
    }
  }

  if (signatureUrl) {
    const data = await fetchUrlAsDataUrl(signatureUrl);
    if (data && userId != null) writeCachedUserSignature(userId, data);
    return data;
  }

  return null;
}
