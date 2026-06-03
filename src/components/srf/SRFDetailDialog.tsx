import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye } from "lucide-react";
import { srfApi } from "@/services/api";
import type { SrfDetailPayload } from "@/types/srf-ui";
import {
  lineItemsFromSrf,
  srfUiActionVisible,
} from "@/types/srf-ui";
import { getDisplayId } from "@/utils/displayId";
import { getSrfStatusBadgeClass, getSrfStatusLabel } from "@/utils/srfStatusBadge";
import { SimpleProgressStepper } from "@/components/progress/SimpleProgressStepper";
import type { SrfProgressStep } from "@/types/srf-line-item";

interface SRFDetailDialogProps {
  srfId: string | null;
  fetchPath?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewLineItem?: (srfId: string, lineItemId: string, lineItemPath?: string) => void;
}

export function SRFDetailDialog({
  srfId,
  fetchPath,
  open,
  onOpenChange,
  onViewLineItem,
}: SRFDetailDialogProps) {
  const [detail, setDetail] = useState<SrfDetailPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || (!srfId && !fetchPath)) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = fetchPath
        ? await srfApi.getById(srfId ?? "", { path: fetchPath })
        : await srfApi.getById(srfId!);
      if (!cancelled) {
        if (res.success && res.data) setDetail(res.data);
        else setDetail(null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, srfId, fetchPath]);

  const lineItems = detail ? lineItemsFromSrf(detail) : [];
  const srfProgress: SrfProgressStep[] =
    detail?.progress ?? detail?.steps ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{detail?.title ?? "SRF Details"}</DialogTitle>
          <DialogDescription>
            {detail ? getDisplayId(detail) : srfId}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !detail ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Could not load SRF.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={getSrfStatusBadgeClass(detail.status)}>{getSrfStatusLabel(detail.status)}</Badge>
              {detail.duration && (
                <Badge variant="outline">Duration: {detail.duration}</Badge>
              )}
            </div>

            {detail.description && (
              <p className="text-sm text-muted-foreground">{detail.description}</p>
            )}

            {srfProgress.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  SRF progress
                </p>
                <SimpleProgressStepper
                  steps={srfProgress.map((s) => ({
                    key: s.key,
                    label: s.label,
                    status: s.status,
                    completedAt: s.completedAt,
                  }))}
                />
              </div>
            )}

            {lineItems.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Line items ({detail.lineItemCount ?? lineItems.length})
                </p>
                {lineItems.map((item) => {
                  const name = item.itemName ?? item.item_name ?? "Item";
                  const action = item.ui?.viewDetails;
                  const showBtn = srfUiActionVisible(action);
                  return (
                    <div
                      key={String(item.id)}
                      className="flex items-center justify-between gap-2 text-sm border rounded-lg p-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{name}</p>
                        {item.progressSummary?.currentStepLabel && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.progressSummary.currentStepLabel}
                          </p>
                        )}
                      </div>
                      {showBtn && onViewLineItem && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onViewLineItem(
                              String(detail.id),
                              String(item.id),
                              action!.path,
                            )
                          }
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          {action?.label ?? "View Details"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SRFDetailDialog;
