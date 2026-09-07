import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "pwaInstallDismissedAt";
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayModes = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];
  const matches = displayModes.some(
    (mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches,
  );
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(matches || iosStandalone);
}

function dismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_WINDOW_MS;
  } catch {
    return false;
  }
}

/**
 * Custom install prompt. Only rendered when the browser actually fired
 * beforeinstallprompt, the app is not installed, and the user has not
 * dismissed the prompt within the last 7 days.
 */
export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    if (isStandalone()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (dismissedRecently()) return;
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const handleInstall = async () => {
    const evt = deferred;
    setDeferred(null);
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "dismissed") {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      }
    } catch {
      /* ignore */
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDeferred(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Install the SCM app"
      className="fixed bottom-4 left-1/2 z-[90] w-[min(100%-1.5rem,26rem)] -translate-x-1/2 rounded-lg border bg-card p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Download className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Install the SCM app</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add it to your desktop or home screen for faster access.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={handleInstall}>
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
