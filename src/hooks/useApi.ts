import { useState, useCallback } from 'react';
import type { ApiResponse } from '@/types';

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useApi<T>(
  apiFunction: (...args: any[]) => Promise<ApiResponse<T>>,
  options: UseApiOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: any[]) => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiFunction(...args);

        if (response.success && response.data) {
          setData(response.data);
          options.onSuccess?.(response.data);
          return response.data;
        } else {
          const errorMessage = response.error || 'An error occurred';
          setError(errorMessage);
          options.onError?.(errorMessage);
          return null;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        options.onError?.(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, options]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

// Specialized hook for queries (GET requests)
export function useQuery<T>(
  apiFunction: () => Promise<ApiResponse<T>>,
  options: UseApiOptions & { autoFetch?: boolean } = {}
) {
  const api = useApi(apiFunction, options);

  // Auto-fetch on mount if specified
  useState(() => {
    if (options.autoFetch !== false) {
      api.execute();
    }
  });

  return {
    ...api,
    refetch: api.execute,
  };
}

// Specialized hook for mutations (POST, PUT, DELETE)
export function useMutation<T>(
  apiFunction: (...args: any[]) => Promise<ApiResponse<T>>,
  options: UseApiOptions = {}
) {
  return useApi(apiFunction, options);
}
