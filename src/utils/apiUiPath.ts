import { apiRequest, type ApiResponse } from '@/services/api';

/** Convert backend path `/api/srfs/...` to client endpoint `/srfs/...` (base URL already includes `/api`). */
export function uiPathToEndpoint(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith('/api/')) return trimmed.slice(4);
  if (trimmed.startsWith('api/')) return `/${trimmed.slice(4)}`;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export async function apiFetchUiPath<T>(
  path: string,
  method: 'GET' | 'DELETE' | 'POST' | 'PUT' = 'GET',
): Promise<ApiResponse<T>> {
  const endpoint = uiPathToEndpoint(path);
  return apiRequest<T>(endpoint, method === 'GET' ? {} : { method });
}
