import { QueryClient } from "@tanstack/react-query";
import { LIST_QUERY_OPTIONS } from "@/lib/queryOptions";

/** Shared React Query defaults — lists use LIST preset; override per query as needed. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: LIST_QUERY_OPTIONS.staleTime,
      gcTime: LIST_QUERY_OPTIONS.gcTime,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Re-export stable preset for config endpoints (finance routing, categories, templates). */
export { STABLE_QUERY_OPTIONS } from "@/lib/queryOptions";
