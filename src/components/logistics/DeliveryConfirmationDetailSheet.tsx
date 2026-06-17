import { useEffect, useState } from "react";
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
import { Loader2, FileCheck, FileText } from "lucide-react";
import { mrfApi, srfApi } from "@/services/api";
import { getDisplayId } from "@/utils/displayId";
import type { Trip } from "@/types/logistics";

type DeliveryItem =
  | { kind: "mrf"; id: string | number; poNumber?: string; category?: string }
  | { kind: "trip"; trip: Trip };

interface DeliveryConfirmationDetailSheetProps {
  item: DeliveryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateGrn?: () => void;
  onGenerateJcc?: () => void;
}

function normalizeLineItems(items: unknown): Array<{
  name: string;
  quantity: number | string;
  unit?: string;
  unitPrice?: number | string;
  total?: number | string;
}> {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw as Record<string, unknown>;
    const qty = item.quantity ?? item.qty ?? "—";
    const price = item.unit_price ?? item.unitPrice ?? item.price;
    const total = item.total ?? item.total_price ?? item.totalPrice;
    return {
      name: String(
        item.item_name ?? item.itemName ?? item.description ?? item.name ?? "—",
      ),
      quantity: qty as number | string,
      unit: String(item.unit ?? item.uom ?? "—"),
      unitPrice: price as number | string | undefined,
      total: total as number | string | undefined,
    };
  });
}

export function DeliveryConfirmationDetailSheet({
  item,
  open,
  onOpenChange,
  onGenerateGrn,
  onGenerateJcc,
}: DeliveryConfirmationDetailSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!open || !item) {
      setDetail(null);
      setError(null);
      return;
    }

    if (item.kind === "trip") {
      setDetail(item.trip as unknown as Record<string, unknown>);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const mrfId = String(item.id);
      const mrfRes = await mrfApi.getById(mrfId);
      if (cancelled) return;
      if (mrfRes.success && mrfRes.data) {
        setDetail(mrfRes.data as unknown as Record<string, unknown>);
        setLoading(false);
        return;
      }

      const srfRes = await srfApi.getById(mrfId);
      if (cancelled) return;
      if (srfRes.success && srfRes.data) {
        setDetail(srfRes.data as unknown as Record<string, unknown>);
      } else {
        setError(mrfRes.error || srfRes.error || "Could not load request details");
        setDetail(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, item]);

  const isMrf = item?.kind === "mrf";
  const isTrip = item?.kind === "trip";
  const lineItems = detail ? normalizeLineItems(detail.items ?? detail.line_items) : [];
  const vendorName =
    (detail?.vendor_name as string) ??
    (detail?.vendorName as string) ??
    (detail?.vendor as Record<string, string>)?.name ??
    (isTrip && item ? (item.trip.vendorName || item.trip.driverName) : undefined);
  const reference = detail ? getDisplayId(detail) : isTrip && item ? item.trip.tripNumber : "—";
  const poNumber =
    (detail?.po_number as string) ??
    (detail?.poNumber as string) ??
    (isMrf && item ? item.poNumber : undefined);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isMrf ? "MRF delivery confirmation" : "Trip service confirmation"}
          </SheetTitle>
          <SheetDescription>
            Review full request details before generating the{" "}
            {isMrf ? "GRN" : "JCC"}.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-6">{error}</p>
        ) : detail ? (
          <div className="space-y-6 mt-6">
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-muted-foreground">Reference</p>
                <p className="font-medium">{reference}</p>
              </div>
              {poNumber && (
                <div>
                  <p className="text-muted-foreground">PO number</p>
                  <p className="font-medium">{poNumber}</p>
                </div>
              )}
              {vendorName && (
                <div>
                  <p className="text-muted-foreground">Vendor / provider</p>
                  <p className="font-medium">{vendorName}</p>
                </div>
              )}
              {(detail.category as string) && (
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p className="font-medium">{String(detail.category)}</p>
                </div>
              )}
              {isTrip && item && (
                <>
                  <div>
                    <p className="text-muted-foreground">Route</p>
                    <p className="font-medium">
                      {item.trip.origin} → {item.trip.destination}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className="capitalize">{item.trip.status.replace(/_/g, " ")}</Badge>
                  </div>
                </>
              )}
              {(detail.justification as string) && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Justification / purpose</p>
                  <p className="font-medium">{String(detail.justification)}</p>
                </div>
              )}
              {(detail.description as string) && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Description</p>
                  <p className="font-medium">{String(detail.description)}</p>
                </div>
              )}
            </div>

            {lineItems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Line items</h4>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((li, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{li.name}</TableCell>
                          <TableCell>{li.unit}</TableCell>
                          <TableCell className="text-right">{li.quantity}</TableCell>
                          <TableCell className="text-right">
                            {li.unitPrice != null ? String(li.unitPrice) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {li.total != null ? String(li.total) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {isMrf && onGenerateGrn && (
                <Button onClick={onGenerateGrn}>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Generate GRN
                </Button>
              )}
              {isTrip && onGenerateJcc && (
                <Button onClick={onGenerateJcc}>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate JCC
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default DeliveryConfirmationDetailSheet;
