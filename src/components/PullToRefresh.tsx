import { Loader2 } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { isRefreshing, pullDistance } = usePullToRefresh({ onRefresh });

  const indicatorStyle = {
    transform: `translateY(${Math.min(pullDistance, 80)}px)`,
    opacity: Math.min(pullDistance / 80, 1),
  };

  return (
    <div className="relative">
      {/* Pull indicator */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none transition-transform"
        style={indicatorStyle}
      >
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-full p-3 shadow-lg">
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="h-5 w-5 flex items-center justify-center">
              <div 
                className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                style={{
                  transform: `rotate(${pullDistance * 3}deg)`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
