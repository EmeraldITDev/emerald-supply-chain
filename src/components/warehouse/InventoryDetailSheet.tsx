import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ProcurementDocumentsPanel from '@/components/procurement/ProcurementDocumentsPanel';
import type { InventoryRecord } from '@/types/warehouse-inventory';

const fmtQty = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('en-NG').format(v);

const fmtMoney = (v: number | null | undefined) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(v);

interface InventoryDetailSheetProps {
  record: InventoryRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InventoryDetailSheet = ({ record, open, onOpenChange }: InventoryDetailSheetProps) => {
  const mrfId = record?.mrf_id ?? null;
  const lineItems = record?.line_items ?? [];
  const isProcurement = Boolean(mrfId) || record?.source === 'completed_procurement';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-2 text-left">
          <SheetTitle className="pr-6">
            {record?.po_number || record?.sku || 'Inventory item'}
          </SheetTitle>
          <SheetDescription className="space-y-2">
            <span className="block">{record?.title || record?.description || '—'}</span>
            <span className="flex flex-wrap gap-2 pt-1">
              {record?.force_closed ? (
                <Badge variant="outline">Force closed</Badge>
              ) : record?.status ? (
                <Badge variant="secondary">{record.status}</Badge>
              ) : null}
              {record?.vendor_name ? (
                <Badge variant="outline">{record.vendor_name}</Badge>
              ) : null}
              {mrfId ? <Badge variant="outline">MRF {mrfId}</Badge> : null}
            </span>
            {record?.force_close_reason ? (
              <span className="block text-xs text-muted-foreground pt-1">
                Force-close reason: {record.force_close_reason}
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Line items</h3>
            {lineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isProcurement
                  ? 'No line items were stored on this purchase order.'
                  : 'No line-item breakdown for this stock record.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="text-right">Unit</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, idx) => (
                      <TableRow key={String(item.id ?? idx)}>
                        <TableCell className="max-w-[180px]">
                          <div className="font-medium truncate">{item.item_name}</div>
                          {item.description && item.description !== item.item_name ? (
                            <div className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">{fmtQty(item.quantity)}</TableCell>
                        <TableCell>{item.unit || 'EA'}</TableCell>
                        <TableCell className="text-right">{fmtMoney(item.unit_price)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(item.total_price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {mrfId ? (
            <section className="space-y-2">
              <ProcurementDocumentsPanel
                mrfId={mrfId}
                defaultUploadType="waybill"
                allowedUploadTypes={['waybill']}
                title="Waybill"
                className="border shadow-none"
              />
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              Waybill management is available for completed purchase-order inventory only.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InventoryDetailSheet;
