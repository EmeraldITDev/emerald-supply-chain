const RELOAD_PREFIX = "__scm_chunk_reload__";

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module|Unable to preload CSS/i;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Forces the browser to re-download index.html (and therefore the current
 * asset manifest) instead of replaying a cached document that still points at
 * chunk filenames from a previous deployment.
 */
function hardReload() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("__r", String(Date.now()));
  window.location.replace(url.toString());
}

export async function safeLazyImport<T>(loader: () => Promise<T>): Promise<T> {
  try {
    const result = await loader();
    if (typeof window !== "undefined") {
      // Successful load → drop every reload guard so future stale chunks can recover.
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(RELOAD_PREFIX))
        .forEach((k) => sessionStorage.removeItem(k));
    }
    return result;
  } catch (err) {
    const message = String((err as { message?: string })?.message ?? err);

    if (!CHUNK_ERROR_RE.test(message)) {
      throw err;
    }

    // Transient network blips recover on a short retry.
    try {
      await delay(400);
      return await loader();
    } catch (retryErr) {
      if (typeof window !== "undefined") {
        // One hard reload per stale chunk per session, cache-busted so the
        // fresh index.html (with the new hashed filenames) is fetched.
        const chunkKey = message.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
        const reloadKey = `${RELOAD_PREFIX}:${chunkKey}`;
        let alreadyReloaded = true;
        try {
          alreadyReloaded = Boolean(sessionStorage.getItem(reloadKey));
          if (!alreadyReloaded) sessionStorage.setItem(reloadKey, String(Date.now()));
        } catch {
          alreadyReloaded = false;
        }
        if (!alreadyReloaded) {
          hardReload();
          // Keep the boundary from flashing an error while the reload happens.
          await delay(5000);
        }
      }
      throw retryErr;
    }
  }
}