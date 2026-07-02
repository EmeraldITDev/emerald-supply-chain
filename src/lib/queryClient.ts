import { QueryClient, keepPreviousData } from "@tanstack/react-query";
import { LIST_QUERY_OPTIONS } from "@/lib/queryOptions";

/** Skip retrying obvious client-side errors (4xx). Keep 5xx/network under the outer retry. */
function isClientError(err: unknown): boolean {
  const status =
    (err as { status?: number })?.status ??
    (err as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

/** Shared React Query defaults — lists use LIST preset; override per query as needed. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: LIST_QUERY_OPTIONS.staleTime,
      gcTime: LIST_QUERY_OPTIONS.gcTime,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Keep previously fetched data visible during background refetches / pagination —
      // eliminates the full-skeleton flicker when navigating filters or pages.
      placeholderData: keepPreviousData,
      retry: (failureCount, err) => !isClientError(err) && failureCount < 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Re-export stable preset for config endpoints (finance routing, categories, templates). */
export { STABLE_QUERY_OPTIONS } from "@/lib/queryOptions";
