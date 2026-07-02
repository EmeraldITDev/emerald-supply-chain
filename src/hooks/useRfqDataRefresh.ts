import { useCallback, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';

/**
 * Keeps RFQs and quotations in AppContext fresh while a view is mounted.
 * Refreshes on mount and when the global header refresh (`app:refresh`) fires.
 * Polling was removed — it caused redundant API storms across the app.
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

    window.addEventListener('app:refresh', onAppRefresh);

    return () => {
      window.removeEventListener('app:refresh', onAppRefresh);
    };
  }, [enabled, refresh]);

  return { refresh };
}
