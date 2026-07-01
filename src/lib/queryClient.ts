import { QueryClient } from "@tanstack/react-query";

/** Shared React Query defaults — reduce redundant refetches for stable reference data. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Longer cache for rarely-changing config (finance routing, vendor categories, templates). */
export const STABLE_QUERY_OPTIONS = {
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
} as const;
