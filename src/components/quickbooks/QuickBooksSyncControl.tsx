import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { MRF } from "@/types";
import { quickbooksApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { getScmRole } from "@/utils/scmRole";
import { getMrfApiId } from "@/utils/displayId";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { invalidateMrfLists, invalidatePoLists } from "@/lib/invalidateScmCache";
import {
  canAccessQuickBooks,
  dash,
  quickBooksErrorMessage,
  syncButtonState,
  syncStatusLabel,
} from "@/components/quickbooks/quickbooksLogic";

export function QuickBooksSyncControl({
  mrf,
  onSynced,
  compact = false,
}: {
  mrf: MRF;
  onSynced?: (patch: Partial<MRF>) => void;
  /** List-row layout: badge + sync button only (details in tooltip). */
  compact?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["quickbooks", "status"],
    queryFn: () => quickbooksApi.status(),
    staleTime: 30_000,
    retry: false,
  });
  const role = getScmRole(user);
  const status = statusQuery.data?.success ? statusQuery.data.data : undefined;
  const signed = Boolean(mrf.signed_po_url || mrf.signedPOUrl);
  const button = syncButtonState({
    role,
    signed,
    connected: status?.connected === true,
    needsReconnect: status?.needs_reconnect === true,
    pending: false,
  });
  const dryRun = status?.dry_run !== false;
  const writesEnabled = status?.writes_enabled === true;
  const syncStatus = mrf.quickbooks_sync_status;
  const syncedAt = mrf.quickbooks_synced_at;

  const sync = useMutation({
    mutationFn: () => quickbooksApi.syncPo(getMrfApiId(mrf)),
    onSuccess: async (response) => {
      const checks = response.data?.results;
      if (!response.success && !checks?.length) {
        toast.error(quickBooksErrorMessage(response.code, response.status));
        return;
      }
      if (response.success) {
        toast.success(response.data?.dry_run ? "Dry-run validation passed." : "Purchase order synced to QuickBooks.");
        await Promise.all([invalidatePoLists(queryClient), invalidateMrfLists(queryClient)]);
        onSynced?.({
          quickbooks_po_id: response.data?.quickbooks_po_id ?? mrf.quickbooks_po_id,
          quickbooks_sync_status: response.data?.quickbooks_sync_status ?? mrf.quickbooks_sync_status,
          quickbooks_synced_at: response.data?.dry_run ? mrf.quickbooks_synced_at : new Date().toISOString(),
        });
      } else {
        toast.error(quickBooksErrorMessage(response.code ?? "QB_VALIDATION_FAILED", response.status));
      }
    },
  });

  if (!canAccessQuickBooks(role)) return null;

  const label = syncStatusLabel(syncStatus);
  const relative = (() => {
    if (!syncedAt) return "—";
    const date = new Date(syncedAt);
    if (Number.isNaN(date.getTime())) return "—";
    return formatDistanceToNow(date, { addSuffix: true });
  })();

  const disabled = !button.visible || button.disabled || sync.isPending || statusQuery.isLoading;
  const reason = statusQuery.isLoading
    ? "Checking QuickBooks connection."
    : !button.visible
      ? null
      : sync.isPending
        ? "Sync is already in progress."
        : button.disabled
          ? button.reason
          : null;

  const detailTooltip = [
    `Status: ${label}`,
    `Synced: ${relative}`,
    `QuickBooks PO ID: ${dash(mrf.quickbooks_po_id)}`,
    reason,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "min-w-0" : ""}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={label === "Failed" ? "destructive" : "outline"}
            className={compact ? "max-w-[11rem] truncate" : undefined}
          >
            {compact ? `QB: ${label}` : `QuickBooks: ${label}`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{detailTooltip}</TooltipContent>
      </Tooltip>
      {!compact && (
        <>
          <span className="text-xs text-muted-foreground">Synced {relative}</span>
          <span className="text-xs text-muted-foreground">
            QuickBooks PO ID {dash(mrf.quickbooks_po_id)}
          </span>
        </>
      )}
      {button.visible && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Sync to QuickBooks"
                disabled={disabled}
                onClick={() => {
                  setConfirmed(false);
                  setOpen(true);
                }}
              >
                {sync.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {compact ? "Sync QB" : "Sync to QuickBooks"}
              </Button>
            </span>
          </TooltipTrigger>
          {(reason || compact) && (
            <TooltipContent>{reason || detailTooltip}</TooltipContent>
          )}
        </Tooltip>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dryRun ? "Validate PO against QuickBooks (dry run)" : "Sync purchase order to QuickBooks"}
            </DialogTitle>
            <DialogDescription>
              {dryRun
                ? "This checks the purchase order and does not send it to QuickBooks."
                : writesEnabled
                  ? "This will create or update a purchase order in your real QuickBooks books."
                  : "QuickBooks writes are disabled, so this purchase order will not be posted."}
            </DialogDescription>
          </DialogHeader>
          {!dryRun && writesEnabled && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="qb-live-confirm"
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(value === true)}
              />
              <Label htmlFor="qb-live-confirm">I understand this posts to the real QuickBooks company.</Label>
            </div>
          )}
          {sync.data?.data?.results && (
            <ul className="max-h-64 space-y-2 overflow-auto text-sm">
              {sync.data.data.results.map((check) => (
                <li key={check.check} className="flex items-start gap-2">
                  {check.passed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden />
                  )}
                  <span>
                    <span className="font-medium">{check.check}</span>
                    <span className="sr-only">{check.passed ? " Passed" : " Failed"}</span>
                    {check.detail ? ` — ${check.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button
              type="button"
              disabled={sync.isPending || (!dryRun && writesEnabled && !confirmed) || (!dryRun && !writesEnabled)}
              onClick={() => sync.mutate()}
            >
              {dryRun ? "Validate" : "Post to QuickBooks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
