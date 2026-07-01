import { apiRequest } from '@/services/api';

export interface FinanceRoutingConfig {
  cutoverDate: string | null;
  routingConfigured: boolean;
  description: string;
}

let cachedConfig: FinanceRoutingConfig | null = null;
let loadPromise: Promise<FinanceRoutingConfig> | null = null;

const UNCONFIGURED: FinanceRoutingConfig = {
  cutoverDate: null,
  routingConfigured: false,
  description: 'FINANCE_AP_CUTOVER_DATE is not set on the server.',
};

export async function fetchFinanceRoutingConfig(force = false): Promise<FinanceRoutingConfig> {
  if (cachedConfig && !force) {
    return cachedConfig;
  }

  if (loadPromise && !force) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const res = await apiRequest<FinanceRoutingConfig>('/config/finance-routing');
    if (res.success && res.data) {
      cachedConfig = {
        cutoverDate: res.data.cutoverDate ?? null,
        routingConfigured: Boolean(res.data.routingConfigured),
        description: res.data.description ?? '',
      };
      return cachedConfig;
    }
    cachedConfig = UNCONFIGURED;
    return cachedConfig;
  })();

  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

export function getCachedFinanceRoutingConfig(): FinanceRoutingConfig | null {
  return cachedConfig;
}

export function clearFinanceRoutingConfigCache(): void {
  cachedConfig = null;
  loadPromise = null;
}

/** Prefer server config; VITE_FINANCE_AP_CUTOVER_DATE is only a dev mirror when API has not loaded yet. */
export function resolveFinanceAPCutoverDate(): string | null {
  if (cachedConfig?.cutoverDate) {
    return cachedConfig.cutoverDate;
  }

  const envDate = import.meta.env.VITE_FINANCE_AP_CUTOVER_DATE;
  if (envDate && String(envDate).trim()) {
    return String(envDate).trim();
  }

  return null;
}

export function isFinanceAPRoutingConfiguredFromServer(): boolean {
  if (cachedConfig) {
    return cachedConfig.routingConfigured;
  }

  const cutover = resolveFinanceAPCutoverDate();
  if (!cutover) return false;

  const parsed = Date.parse(cutover);
  return !Number.isNaN(parsed);
}
