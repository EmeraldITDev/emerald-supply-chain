import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 30_000;

interface VersionPayload {
  buildId?: string;
}

/**
 * Polls /version.json and prompts the user when a new frontend build is deployed.
 * Never auto-refreshes — user must click Refresh.
 */
export function AppUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const loadedBuildId = useRef<string>(
    typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev-local",
  );

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as VersionPayload;
        if (data.buildId && data.buildId !== loadedBuildId.current) {
          setUpdateAvailable(true);
        }
      } catch {
        // Offline or static host without version.json — ignore
      }
    };

    const initial = window.setTimeout(() => void check(), INITIAL_DELAY_MS);
    const interval = window.setInterval(() => void check(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[100] flex w-[min(100%,28rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg"
    >
      <p className="text-sm">A new update is available. Click to refresh.</p>
      <Button size="sm" onClick={() => window.location.reload()}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );
}
