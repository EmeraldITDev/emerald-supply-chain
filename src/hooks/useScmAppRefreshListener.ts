import { useEffect, useRef } from 'react';

/** Re-run page data loaders when the header refresh button fires `app:refresh`. */
export function useScmAppRefreshListener(onRefresh: () => void | Promise<void>): void {
  const handlerRef = useRef(onRefresh);
  handlerRef.current = onRefresh;

  useEffect(() => {
    const handler = () => {
      void handlerRef.current();
    };
    window.addEventListener('app:refresh', handler);
    return () => window.removeEventListener('app:refresh', handler);
  }, []);
}
