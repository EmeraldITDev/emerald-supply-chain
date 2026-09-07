import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDisplayId } from "@/utils/displayId";
import { getWorkflowStageLabel } from "@/utils/workflowStageLabels";
import type { MRF } from "@/types";
import { daysSince, mrfCost, mrfDate, mrfState } from "@/utils/executiveIntelligence";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  records: MRF[];
}

const getApiId = (mrf: MRF) =>
  String((mrf as unknown as Record<string, unknown>).mrf_id ?? mrf.id);

export const ExecDrilldownSheet = ({ open, onOpenChange, title, description, records }: Props) => {
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {description ?? `${records.length} record${records.length === 1 ? "" : "s"}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2 pb-8">
          {records.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No records in this view.
            </p>
          ) : (
            records.map((mrf) => {
              const cost = mrfCost(mrf);
              return (
                <div key={String(mrf.id)} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{mrf.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {getDisplayId(mrf)} • {mrf.department || "—"} •{" "}
                        {cost > 0 ? `₦${cost.toLocaleString()}` : "-"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {daysSince(mrfDate(mrf))} day(s) in current state
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {getWorkflowStageLabel(mrfState(mrf))}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/mrfs/${getApiId(mrf)}`);
                    }}
                  >
                    Open record
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
