import { Loader2 } from "lucide-react";

/** Shown while lazy-loaded route chunks are downloading. */
export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading page" />
    </div>
  );
}
