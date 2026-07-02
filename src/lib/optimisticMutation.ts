import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Optimistic-update helpers for list-shaped React Query caches.
 *
 * They cover the 3 common CRUD shapes:
 *   - remove a row by id
 *   - patch a row in-place
 *   - prepend a new row
 *
 * Each helper snapshots the previous cache value so callers can roll back on error:
 *
 * ```ts
 * const mutation = useMutation({
 *   mutationFn: deleteMrf,
 *   onMutate: async (id) => optimisticListRemove(queryClient, queryKeys.mrf.all(), id),
 *   onError: (_e, _v, ctx) => ctx?.rollback?.(),
 *   onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.mrf.all() }),
 * });
 * ```
 */

export type OptimisticContext = {
  rollback: () => void;
};

type ListLike<T> = T[] | { items?: T[]; data?: T[] } | undefined | null;

function readListSnapshot<T>(client: QueryClient, key: QueryKey): Array<[QueryKey, ListLike<T>]> {
  return client.getQueriesData<ListLike<T>>({ queryKey: key });
}

function writeMutated<T>(
  client: QueryClient,
  key: QueryKey,
  mutate: (items: T[]) => T[],
) {
  client.setQueriesData<ListLike<T>>({ queryKey: key }, (prev) => {
    if (!prev) return prev;
    if (Array.isArray(prev)) return mutate(prev) as ListLike<T>;
    if (Array.isArray(prev.items)) return { ...prev, items: mutate(prev.items) };
    if (Array.isArray(prev.data)) return { ...prev, data: mutate(prev.data) };
    return prev;
  });
}

function restoreSnapshot<T>(
  client: QueryClient,
  snapshot: Array<[QueryKey, ListLike<T>]>,
) {
  snapshot.forEach(([key, data]) => client.setQueryData(key, data));
}

export async function optimisticListRemove<T extends { id: string | number }>(
  client: QueryClient,
  key: QueryKey,
  id: string | number,
): Promise<OptimisticContext> {
  await client.cancelQueries({ queryKey: key });
  const snapshot = readListSnapshot<T>(client, key);
  writeMutated<T>(client, key, (items) => items.filter((item) => item.id !== id));
  return { rollback: () => restoreSnapshot(client, snapshot) };
}

export async function optimisticListUpdate<T extends { id: string | number }>(
  client: QueryClient,
  key: QueryKey,
  id: string | number,
  patch: Partial<T>,
): Promise<OptimisticContext> {
  await client.cancelQueries({ queryKey: key });
  const snapshot = readListSnapshot<T>(client, key);
  writeMutated<T>(client, key, (items) =>
    items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  );
  return { rollback: () => restoreSnapshot(client, snapshot) };
}

export async function optimisticListInsert<T>(
  client: QueryClient,
  key: QueryKey,
  row: T,
  position: "start" | "end" = "start",
): Promise<OptimisticContext> {
  await client.cancelQueries({ queryKey: key });
  const snapshot = readListSnapshot<T>(client, key);
  writeMutated<T>(client, key, (items) =>
    position === "start" ? [row, ...items] : [...items, row],
  );
  return { rollback: () => restoreSnapshot(client, snapshot) };
}