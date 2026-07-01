import { useCallback, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';

const RFQ_POLL_MS = 30_000;

/**
 * Keeps RFQs and quotations in AppContext fresh while a view is mounted.
 * Listens for the global header refresh (`app:refresh`) and polls when the tab is visible.
 */
export function useRfqDataRefresh(enabled = true) {
  const { refreshRFQs, refreshQuotations } = useApp();

  const refresh = useCallback(async () => {
    const list = await refreshRFQs();
    await refreshQuotations(list ?? []);
  }, [refreshRFQs, refreshQuotations]);

  useEffect(() => {
    if (!enabled) return;

    void refresh();

    const onAppRefresh = () => {
      void refresh();
    };

    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, RFQ_POLL_MS);

    window.addEventListener('app:refresh', onAppRefresh);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener('app:refresh', onAppRefresh);
    };
  }, [enabled, refresh]);

  return { refresh };
}
