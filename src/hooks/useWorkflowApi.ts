import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

// Generic API hook for handling loading, error states
// This hook works with the existing AppContext while being ready for backend integration
function useApiCall<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const execute = useCallback(async (
    apiCall: () => Promise<{ success: boolean; data?: T; error?: string }>,
    options?: {
      successMessage?: string;
      errorMessage?: string;
      onSuccess?: (data: T) => void;
      onError?: (error: string) => void;
    }
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall();

      if (result.success && result.data) {
        if (options?.successMessage) {
          toast({ title: 'Success', description: options.successMessage });
        }
        options?.onSuccess?.(result.data);
        return result.data;
      } else {
        const errorMsg = result.error || 'An error occurred';
        setError(errorMsg);
        toast({ 
          title: 'Error', 
          description: options?.errorMessage || errorMsg,
          variant: 'destructive'
        });
        options?.onError?.(errorMsg);
        return null;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMsg);
      toast({ 
        title: 'Error', 
        description: options?.errorMessage || errorMsg,
        variant: 'destructive'
      });
      options?.onError?.(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { loading, error, execute };
}

// Export the base hook for custom API integrations
export { useApiCall };

// Note: Full workflow hooks will be available after connecting to Laravel backend.
// See LARAVEL_BACKEND_INTEGRATION.md for backend setup instructions.
// The frontend is ready - just update src/services/api.ts with your Laravel endpoints.
