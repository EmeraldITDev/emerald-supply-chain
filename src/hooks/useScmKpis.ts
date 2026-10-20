import { useQuery } from "@tanstack/react-query";
import { analyticsApi, type ScmKpiPayload } from "@/services/api";
import { useMemo } from "react";

const STALE_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Fetch the unified SCM KPI payload from the backend.
 * The payload includes the baseline config, SLA constants, and all
 * performance / operational metrics for the command-centre dashboards.
 *
 * Use `from` / `to` ISO strings to scope the performance period.
 * Omit both to use the server default (last 30 days).
 */
export function useScmKpis(params?: { from?: string; to?: string }) {
  const queryKey = ["scm-kpis", params?.from ?? "", params?.to ?? ""];

  const query = useQuery<ScmKpiPayload | null>({
    queryKey,
    queryFn: async () => {
      const res = await analyticsApi.getKpis(params);
      if (!res.success || !res.data) return null;
      // Backend wraps in { success, data }; apiRequest unwraps one level
      const payload = (res.data as unknown as { data?: ScmKpiPayload }).data ?? (res.data as unknown as ScmKpiPayload);
      return payload ?? null;
    },
    staleTime: STALE_MS,
    retry: 1,
  });

  const baseline = query.data?.baseline ?? null;
  const slaConstants = query.data?.sla_constants ?? null;
  const baselineEffectiveAt = baseline?.effective_at
    ? new Date(baseline.effective_at)
    : null;

  const baselineLabel = useMemo(() => {
    if (!baselineEffectiveAt) return null;
    return baselineEffectiveAt.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [baselineEffectiveAt]);

  return {
    kpis: query.data,
    baseline,
    baselineLabel,
    slaConstants,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Fetch only the baseline config (lightweight, accessible to all roles).
 */
export function useAnalyticsBaseline() {
  return useQuery({
    queryKey: ["analytics-baseline"],
    queryFn: async () => {
      const res = await analyticsApi.getBaseline();
      if (!res.success || !res.data) return null;
      return (res.data as unknown as { baseline: ScmKpiPayload["baseline"] }).baseline ?? null;
    },
    staleTime: 10 * 60 * 1000, // 10 min — baseline changes rarely
    retry: 1,
  });
}
