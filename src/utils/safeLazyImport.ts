export async function safeLazyImport<T>(loader: () => Promise<T>): Promise<T> {
  try {
    const result = await loader();
    if (typeof window !== "undefined") {
      // Successful load → clear any prior reload guard so future stale chunks can recover.
      sessionStorage.removeItem("__scm_chunk_reload__");
    }
    return result;
  } catch (err) {
    const message = String((err as { message?: string })?.message ?? err);
    const isChunkError =
      /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i.test(
        message,
      );

    if (!isChunkError) {
      throw err;
    }

    try {
      return await loader();
    } catch (retryErr) {
      if (typeof window !== "undefined") {
        // Namespace reload guard per chunk-message so different stale modules can each
        // trigger exactly one hard reload without permanently blocking recovery.
        const chunkKey = message.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
        const reloadKey = `__scm_chunk_reload__:${chunkKey}`;
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, String(Date.now()));
          window.location.reload();
        }
      }
      throw retryErr;
    }
  }
}
