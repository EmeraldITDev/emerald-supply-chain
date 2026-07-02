export async function safeLazyImport<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
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
        const reloadKey = "__scm_chunk_reload__";
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
        }
      }
      throw retryErr;
    }
  }
}
