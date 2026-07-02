import type { QueryClient } from '@tanstack/react-query';
import { invalidateScmListCaches } from '@/lib/invalidateScmCache';

/**
 * Header refresh: invalidate active React Query caches, then notify legacy/local-state pages.
 * AppContext listens for `app:refresh` and refreshes RFQ/SRF bootstrap data with correct quotation chaining.
 */
export async function refreshScmApplicationData(queryClient: QueryClient): Promise<void> {
  await invalidateScmListCaches(queryClient);
  window.dispatchEvent(new CustomEvent('app:refresh'));
}
