import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { srfApi } from "@/services/api";
import type { SrfLineItemDetailResponse, SrfProgressStep } from "@/types/srf-line-item";
import { SimpleProgressStepper } from "@/components/progress/SimpleProgressStepper";
import { getDisplayId } from "@/utils/displayId";

interface SRFLineItemDetailDialogProps {
  srfId: string | null;
  lineItemId: string | null;
  /** When set, GET this path from `lineItems[].ui.viewDetails.path` */
  fetchPath?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SRFLineItemDetailDialog({
  srfId,
  lineItemId,
  fetchPath,
  open,
  onOpenChange,
}: SRFLineItemDetailDialogProps) {
  const [detail, setDetail] = useState<SrfLineItemDetailResponse | null>(null);
  const [steps, setSteps] = useState<SrfProgressStep[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || (!fetchPath && (!srfId || !lineItemId))) {
      setDetail(null);
      setSteps([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await srfApi.getLineItem(srfId ?? "", lineItemId ?? "", {
        path: fetchPath ?? undefined,
      });
      if (cancelled) return;
      if (res.success && res.data) {
        setDetail(res.data);
        const progress = res.data.progress ?? res.data.steps ?? [];
        setSteps(progress);
      } else {
        setDetail(null);
        setSteps([]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, srfId, lineItemId, fetchPath]);

  const line = detail?.lineItem;
  const srf = detail?.srf;
  const itemName = line?.itemName ?? (line as { item_name?: string })?.item_name ?? "Line item";
  const summary = line?.progressSummary;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{itemName}</DialogTitle>
          <DialogDescription>
            {srf ? getDisplayId(srf) : srfId} — line item workflow
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {summary && (
              <div className="flex flex-wrap gap-2">
                {summary.currentStepLabel && (
                  <Badge variant="outline">{summary.currentStepLabel}</Badge>
                )}
                {summary.srfStatus && (
                  <Badge variant="secondary">{summary.srfStatus}</Badge>
                )}
              </div>
            )}

            {line && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Quantity</p>
                  <p className="font-medium">{line.quantity ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Unit</p>
                  <p className="font-medium">{line.unit ?? "—"}</p>
                </div>
                {(line.budgetAmount ?? (line as { budget_amount?: number }).budget_amount) !=
                  null && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Budget</p>
                    <p className="font-medium">
                      ₦
                      {Number(
                        line.budgetAmount ?? (line as { budget_amount?: number }).budget_amount,
                      ).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Progress
              </p>
              <SimpleProgressStepper
                steps={steps.map((s) => ({
                  key: s.key,
                  label: s.label,
                  status: s.status,
                  completedAt: s.completedAt,
                }))}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SRFLineItemDetailDialog;
