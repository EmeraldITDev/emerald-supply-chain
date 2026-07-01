import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { financeApReportsApi } from '@/services/financeApReportsApi';
import type { FinanceApSyncEventRow, FinanceApSyncEventsReport } from '@/types/finance-ap-reports';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<string, string> = {
  success: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
  pending: 'bg-warning/10 text-warning',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-warning" />;
}

interface FinanceApSyncDashboardProps {
  className?: string;
}

export function FinanceApSyncDashboard({ className }: FinanceApSyncDashboardProps) {
  const [data, setData] = useState<FinanceApSyncEventsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApReportsApi.getSyncEvents({
        limit: 50,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        event_type: eventTypeFilter !== 'all' ? eventTypeFilter : undefined,
      });
      if (res.success && res.data) {
        setData(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, eventTypeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Finance AP Sync
          </CardTitle>
          <CardDescription>
            Outbound package pushes, inbound webhooks, and vendor ingest events
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Failed events</p>
              <p className="text-2xl font-semibold text-destructive">{summary.failed}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-semibold">{summary.pending}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Vendor sync failures</p>
              <p className="text-2xl font-semibold text-warning">{summary.vendorSyncFailed}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="success">Success</SelectItem>
            </SelectContent>
          </Select>
          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="package_pushed">Package pushed</SelectItem>
              <SelectItem value="vendor_sync">Vendor sync</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="rfi_raised">RFI raised</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading && !data ? (
          <TableSkeleton rows={4} />
        ) : !data?.events?.length ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No sync events match the current filters.
          </div>
        ) : (
          <div className="space-y-2">
            {data.events.map((event: FinanceApSyncEventRow) => (
              <div
                key={event.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <StatusIcon status={event.status} />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {event.eventType}
                      <span className="text-muted-foreground font-normal">
                        {' '}
                        · {event.direction}
                      </span>
                    </p>
                    {event.mrfDisplayId && (
                      <p className="text-muted-foreground truncate">
                        {event.mrfTitle ? `${event.mrfTitle} · ` : ''}
                        <Link
                          to={`/procurement?mrf=${encodeURIComponent(event.mrfDisplayId)}`}
                          className="text-primary hover:underline"
                        >
                          {event.mrfDisplayId}
                        </Link>
                      </p>
                    )}
                    {event.errorMessage && (
                      <p className="text-destructive text-xs mt-1 line-clamp-2">
                        {event.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {event.httpStatus != null && (
                    <Badge variant="outline" className="text-xs">
                      HTTP {event.httpStatus}
                    </Badge>
                  )}
                  <Badge className={cn('capitalize text-xs', STATUS_BADGE[event.status])}>
                    {event.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {event.createdAt
                      ? new Date(event.createdAt).toLocaleString()
                      : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
