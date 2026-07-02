import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { REPORT_QUERY_OPTIONS } from "@/lib/queryOptions";
import { reportsApi } from "@/services/reportsApi";
import { TableSkeleton } from "@/components/LoadingSkeleton";

interface LineItemRow {
  id: number;
  name: string;
  budgetAmount: number;
  quotedAmount: number;
}

interface ProcurementRecordDetailSheetProps {
  recordId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProcurementRecordDetailSheet = ({
  recordId,
  open,
  onOpenChange,
}: ProcurementRecordDetailSheetProps) => {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reports.procurementRecordDetail(recordId ?? 0),
    queryFn: async () => {
      if (!recordId) throw new Error("No record selected");
      const res = await reportsApi.getProcurementRecordDetail(recordId);
      if (!res.success || !res.data?.record) {
        throw new Error(res.error || "Could not load record detail");
      }
      return res.data.record;
    },
    enabled: open && recordId != null,
    ...REPORT_QUERY_OPTIONS,
  });

  const items = (data?.items ?? []) as LineItemRow[];

  const openInProcurement = () => {
    const linkId = data?.displayId || data?.mrfId;
    if (!linkId) return;
    onOpenChange(false);
    navigate(`/procurement?mrf=${encodeURIComponent(linkId)}`, {
      state: { openMrfId: linkId },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">
            {data?.displayId ?? data?.mrfId ?? "MRF record"}
          </SheetTitle>
          <SheetDescription>
            {data?.title ?? "Procurement report record detail"}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6">
            <TableSkeleton rows={4} />
          </div>
        ) : error ? (
          <p className="mt-6 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load record"}
          </p>
        ) : data ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Department</span>
                <span>{data.department || "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline">{data.workflowState || data.status || "—"}</Badge>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Vendor</span>
                <span>{data.vendorName || "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Est. cost</span>
                <span>₦{data.estimatedCost.toLocaleString()}</span>
              </div>
              {data.createdAt && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(data.createdAt).toLocaleDateString()}</span>
                </div>
              )}
              {data.poSignedAt && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">PO signed</span>
                  <span>{new Date(data.poSignedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Line items (budget vs quoted)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Quoted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs">{item.name}</TableCell>
                        <TableCell className="text-right text-xs">
                          ₦{item.budgetAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          ₦{item.quotedAmount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <Button className="w-full" variant="outline" onClick={openInProcurement}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open full MRF in Procurement
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export default ProcurementRecordDetailSheet;
