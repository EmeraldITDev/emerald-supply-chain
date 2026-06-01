import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Landmark,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { procurementApi } from "@/services/procurementApi";
import type {
  FinanceSyncEvent,
  FinanceSyncResponse,
} from "@/types/finance-sync";

interface FinanceSyncPanelProps {
  mrfId: string;
  /** Bumping forces a re-fetch. */
  refreshKey?: number;
  className?: string;
  /** Hide panel entirely when MRF is not Finance AP routed. */
  hideWhenLegacy?: boolean;
}

const prettyStatus = (s?: string | null) =>
  s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

const formatTime = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const EventRow = ({ event }: { event?: FinanceSyncEvent | null }) => {
  if (!event) return <p className="text-xs text-muted-foreground pl-6">No events yet.</p>;
  const isOutbound = event.direction === "outbound";
  return (
    <div className="pl-6 text-xs space-y-0.5">
      <div className="flex items-center gap-2 flex-wrap">
        {isOutbound ? (
          <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
        ) : (
          <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
        )}
        <span className="font-medium">{event.eventType ?? "event"}</span>
        {event.status && (
          <Badge variant="outline" className="text-[10px] capitalize">
            {prettyStatus(event.status)}
          </Badge>
        )}
        <span className="text-muted-foreground ml-auto">{formatTime(event.createdAt)}</span>
      </div>
      {event.message && (
        <p className="text-muted-foreground line-clamp-2">{event.message}</p>
      )}
    </div>
  );
};

export const FinanceSyncPanel = ({
  mrfId,
  refreshKey = 0,
  className,
  hideWhenLegacy = false,
}: FinanceSyncPanelProps) => {
  const [sync, setSync] = useState<FinanceSyncResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSync = useCallback(async () => {
    if (!mrfId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await procurementApi.getFinanceSync(mrfId);
      if (res.success && res.data) {
        setSync(res.data);
      } else {
        setError(res.error || "Failed to load finance sync status");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load finance sync status");
    } finally {
      setLoading(false);
    }
  }, [mrfId]);

  useEffect(() => {
    fetchSync();
  }, [fetchSync, refreshKey]);

  useEffect(() => {
    const handler = () => fetchSync();
    window.addEventListener("app:refresh", handler);
    return () => window.removeEventListener("app:refresh", handler);
  }, [fetchSync]);

  if (loading && !sync) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !sync) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-sm text-muted-foreground flex items-center justify-between gap-3">
          <span>{error ?? "No finance sync data."}</span>
          <Button size="sm" variant="outline" onClick={fetchSync}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (hideWhenLegacy && !sync.usesFinanceAp) return null;

  const {
    usesFinanceAp,
    financeApCaseId,
    financeApStatus,
    packagePushed,
    integrationConfigured,
    financeApBaseUrl,
    financeApCaseUrl,
    lastOutbound,
    lastInbound,
    recentEvents,
  } = sync;

  const caseUrl =
    financeApCaseUrl ||
    (financeApBaseUrl && financeApCaseId
      ? `${financeApBaseUrl.replace(/\/+$/, "")}/scm-cases/${financeApCaseId}`
      : null);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4" />
              Finance AP Sync
              {usesFinanceAp ? (
                <Badge variant="secondary" className="text-[10px]">Routed</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Legacy</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {usesFinanceAp
                ? "Payment processing handled by Finance AP."
                : "Payments processed internally — Finance AP not used for this MRF."}
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={fetchSync} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {usesFinanceAp && !integrationConfigured && (
          <Alert variant="default" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xs">Integration not configured</AlertTitle>
            <AlertDescription className="text-xs">
              SCM is missing FINANCE_AP_BASE_URL / FINANCE_AP_API_KEY. Package
              push is paused until configuration is restored.
            </AlertDescription>
          </Alert>
        )}

        <section className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Case ID</div>
            <div className="font-medium flex items-center gap-2">
              {financeApCaseId ? (
                <span className="font-mono text-xs">{financeApCaseId}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
              {caseUrl && (
                <a
                  href={caseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center text-xs hover:underline"
                >
                  Open <ExternalLink className="h-3 w-3 ml-0.5" />
                </a>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">FA Status</div>
            <div className="font-medium">{prettyStatus(financeApStatus)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Package Push</div>
            <div className="font-medium flex items-center gap-1.5">
              {packagePushed ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Pushed
                </>
              ) : (
                <span className="text-muted-foreground">Pending</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Integration</div>
            <div className="font-medium">
              {integrationConfigured ? "Configured" : "Missing"}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
            Latest sync
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> Outbound
              </div>
              <EventRow event={lastOutbound} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <ArrowDownLeft className="h-3.5 w-3.5 text-success" /> Inbound
              </div>
              <EventRow event={lastInbound} />
            </div>
          </div>
        </section>

        {(recentEvents?.length ?? 0) > 0 && (
          <section className="space-y-1.5">
            <div className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
              Recent events ({recentEvents!.length})
            </div>
            <div className="max-h-48 overflow-y-auto pr-1 space-y-2 border-l pl-2 ml-1">
              {recentEvents!.map((evt, i) => (
                <EventRow key={evt.id ?? i} event={evt} />
              ))}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
};

export default FinanceSyncPanel;