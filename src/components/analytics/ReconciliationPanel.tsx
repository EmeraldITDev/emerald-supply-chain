import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { analyticsApi, type LegacyMrf } from "@/services/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, CheckCircle2, History } from "lucide-react";
import { toast } from "sonner";

const CLASS_LABELS: Record<string, { label: string; color: string }> = {
  new_period: { label: "New period", color: "bg-emerald-500/20 text-emerald-700" },
  verified_historical: { label: "Verified historical", color: "bg-blue-500/20 text-blue-700" },
  unreconciled_legacy: { label: "Unreconciled legacy", color: "bg-amber-500/20 text-amber-700" },
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Reconciled",
  pending: "Pending",
  in_progress: "In progress",
  flagged: "Flagged",
};

interface RowEditState {
  analytics_class: "new_period" | "verified_historical" | "unreconciled_legacy";
  original_business_date: string;
  handled_offline: boolean;
  reconciliation_notes: string;
}

function MrfRow({
  mrf,
  onSaved,
}: {
  mrf: LegacyMrf;
  onSaved: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RowEditState>({
    analytics_class: "unreconciled_legacy",
    original_business_date: mrf.original_business_date ?? "",
    handled_offline: mrf.handled_offline ?? false,
    reconciliation_notes: mrf.reconciliation_notes ?? "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      analyticsApi.classifyMrf(mrf.mrf_id, {
        analytics_class: form.analytics_class,
        original_business_date: form.original_business_date || undefined,
        handled_offline: form.handled_offline,
        reconciliation_notes: form.reconciliation_notes || undefined,
      }),
    onSuccess: () => {
      toast.success(`${mrf.formatted_id ?? mrf.mrf_id} classified successfully.`);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["analytics-legacy"] });
      onSaved(mrf.mrf_id);
    },
    onError: () => {
      toast.error("Failed to save classification. Please try again.");
    },
  });

  const classInfo = mrf.analytics_class ? CLASS_LABELS[mrf.analytics_class] : null;

  return (
    <div className="border rounded-md p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold">
              {mrf.formatted_id ?? mrf.mrf_id}
            </span>
            {classInfo ? (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classInfo.color}`}>
                {classInfo.label}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                Unclassified
              </span>
            )}
            {mrf.reconciliation_status && (
              <span className="text-xs text-muted-foreground">
                {STATUS_LABELS[mrf.reconciliation_status] ?? mrf.reconciliation_status}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">{mrf.title}</p>
          <p className="text-xs text-muted-foreground">
            State: <span className="font-medium">{mrf.workflow_state}</span> · Created:{" "}
            {new Date(mrf.created_at).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing((v) => !v)}
          className="shrink-0"
        >
          {editing ? "Cancel" : "Classify"}
        </Button>
      </div>

      {editing && (
        <div className="space-y-3 pt-2 border-t">
          <div className="space-y-1">
            <Label className="text-xs">Classification</Label>
            <Select
              value={form.analytics_class}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  analytics_class: v as RowEditState["analytics_class"],
                }))
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_period">New period — counts in new-baseline metrics</SelectItem>
                <SelectItem value="verified_historical">
                  Verified historical — completed offline/before baseline
                </SelectItem>
                <SelectItem value="unreconciled_legacy">
                  Unreconciled legacy — exclude from performance, keep in queues
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Original business date (optional)</Label>
            <input
              type="date"
              className="w-full h-8 text-sm border rounded-md px-2 bg-background"
              value={form.original_business_date}
              onChange={(e) => setForm((f) => ({ ...f, original_business_date: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id={`offline-${mrf.mrf_id}`}
              checked={form.handled_offline}
              onCheckedChange={(v) => setForm((f) => ({ ...f, handled_offline: v }))}
            />
            <Label htmlFor={`offline-${mrf.mrf_id}`} className="text-sm font-normal">
              Handled offline / outside SCM
            </Label>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reconciliation notes (optional)</Label>
            <Textarea
              placeholder="Brief explanation of the activity or evidence…"
              rows={2}
              value={form.reconciliation_notes}
              onChange={(e) => setForm((f) => ({ ...f, reconciliation_notes: e.target.value }))}
              className="text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save classification"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Minimal reconciliation panel for admin / SCD users.
 * Lists unreconciled legacy MRFs and allows one-by-one classification.
 * Original timestamps are never overwritten; every change is audit-logged by the backend.
 */
export function ReconciliationPanel() {
  const [page, setPage] = useState(1);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics-legacy", page],
    queryFn: async () => {
      const res = await analyticsApi.getLegacyList({ page, per_page: 25 });
      if (!res.success || !res.data) throw new Error("Failed to load legacy records");
      return res.data;
    },
    staleTime: 60_000,
  });

  const items = (data?.data ?? []) as LegacyMrf[];
  const pagination = data?.pagination as
    | { current_page: number; last_page: number; total: number }
    | undefined;

  const handleSaved = (mrfId: string) => {
    setSaved((prev) => new Set(prev).add(mrfId));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" />
          <CardTitle>Legacy Record Reconciliation</CardTitle>
        </div>
        <CardDescription>
          Pre-baseline records excluded from new-period metrics. Classify each record to confirm
          its status. Original timestamps and history are preserved — only the analytics
          classification is updated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading legacy records…
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertCircle className="h-4 w-4" />
            Failed to load legacy records.
            <Button variant="ghost" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            All legacy records have been classified.
          </div>
        )}

        <div className="space-y-3">
          {items.map((mrf) => (
            <MrfRow key={mrf.mrf_id} mrf={mrf} onSaved={handleSaved} />
          ))}
        </div>

        {pagination && pagination.last_page > 1 && (
          <div className="flex items-center justify-between text-sm pt-2">
            <span className="text-muted-foreground">
              Page {pagination.current_page} of {pagination.last_page} ·{" "}
              {pagination.total} record(s) total
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.current_page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.current_page >= pagination.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground border-t pt-3">
          • Classifying a record as "Unreconciled legacy" keeps it in all operational queues but
          excludes it from new-period performance averages.
          <br />
          • "Verified historical" records are available for historical reporting only.
          <br />
          • Every change is recorded in the audit log.
        </p>
      </CardContent>
    </Card>
  );
}
