import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { toast } from '@/hooks/use-toast';
import { ArrowLeftRight, SlidersHorizontal } from 'lucide-react';
import { warehouseInventoryApi } from '@/services/warehouseInventoryApi';
import { STOCK_ADJUSTMENT_REASONS } from '@/types/warehouse-inventory';

const reasonLabel = (r: string) => r.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const StockMovements = ({ canManage }: { canManage: boolean }) => {
  const queryClient = useQueryClient();
  const [transferOpen, setTransferOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transfer, setTransfer] = useState({ item_id: '', quantity: '', from_location_id: '', to_location_id: '', note: '' });
  const [adjust, setAdjust] = useState({ item_id: '', location_id: '', quantity_delta: '', reason_code: 'damage', reason_note: '' });

  const { data: movements = [], isLoading, error } = useQuery({
    queryKey: ['warehouse', 'movements'],
    queryFn: () => warehouseInventoryApi.getMovements(),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['warehouse', 'locations'],
    queryFn: () => warehouseInventoryApi.getLocations(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['warehouse'] });

  const transferMutation = useMutation({
    mutationFn: () =>
      warehouseInventoryApi.createTransfer({
        item_id: transfer.item_id,
        quantity: Number(transfer.quantity),
        from_location_id: transfer.from_location_id,
        to_location_id: transfer.to_location_id,
        note: transfer.note || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Stock transfer recorded' });
      setTransferOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Transfer failed', description: e.message, variant: 'destructive' }),
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      warehouseInventoryApi.createAdjustment({
        item_id: adjust.item_id,
        location_id: adjust.location_id,
        quantity_delta: Number(adjust.quantity_delta),
        reason_code: adjust.reason_code,
        reason_note: adjust.reason_note,
      }),
    onSuccess: () => {
      toast({ title: 'Adjustment submitted', description: 'Adjustments above threshold await approval.' });
      setAdjustOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Adjustment failed', description: e.message, variant: 'destructive' }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => warehouseInventoryApi.approveAdjustment(id),
    onSuccess: () => {
      toast({ title: 'Adjustment approved' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Approval failed', description: e.message, variant: 'destructive' }),
  });

  const LocationSelect = ({
    value,
    onChange,
    id,
  }: {
    value: string;
    onChange: (v: string) => void;
    id: string;
  }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Select location" />
      </SelectTrigger>
      <SelectContent>
        {locations.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {l.code} — {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Stock Movements</CardTitle>
            <CardDescription>Transfers, adjustments, quarantine and vendor returns with full audit trail</CardDescription>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
                <ArrowLeftRight className="mr-2 h-4 w-4" /> Transfer
              </Button>
              <Button size="sm" onClick={() => setAdjustOpen(true)}>
                <SlidersHorizontal className="mr-2 h-4 w-4" /> Adjust
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <TableSkeleton rows={6} />}
        {!isLoading && error && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Movements unavailable — {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && movements.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No stock movements recorded yet.</p>
        )}
        {!isLoading && movements.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">{new Date(m.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{reasonLabel(String(m.movement_type))}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{m.sku}</TableCell>
                    <TableCell className="text-right">{m.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.from_location_path || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.to_location_path || '—'}</TableCell>
                    <TableCell className="text-sm">{m.reason_code ? reasonLabel(m.reason_code) : '—'}</TableCell>
                    <TableCell className="text-sm">{m.performed_by_name || '—'}</TableCell>
                    <TableCell>
                      {m.approval_status === 'pending' ? (
                        canManage ? (
                          <Button size="sm" variant="outline" onClick={() => approveMutation.mutate(m.id)}>
                            Approve
                          </Button>
                        ) : (
                          <Badge variant="outline">Pending approval</Badge>
                        )
                      ) : (
                        <Badge variant="secondary">{m.approval_status ? reasonLabel(m.approval_status) : 'Posted'}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Internal Stock Transfer</DialogTitle>
            <DialogDescription>Move stock between warehouses, zones or bins.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="t-item">Item ID / SKU</Label>
              <Input
                id="t-item"
                value={transfer.item_id}
                onChange={(e) => setTransfer((t) => ({ ...t, item_id: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-qty">Quantity</Label>
              <Input
                id="t-qty"
                type="number"
                min={1}
                value={transfer.quantity}
                onChange={(e) => setTransfer((t) => ({ ...t, quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-from">From location</Label>
              <LocationSelect
                id="t-from"
                value={transfer.from_location_id}
                onChange={(v) => setTransfer((t) => ({ ...t, from_location_id: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-to">To location</Label>
              <LocationSelect
                id="t-to"
                value={transfer.to_location_id}
                onChange={(v) => setTransfer((t) => ({ ...t, to_location_id: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-note">Note</Label>
              <Textarea
                id="t-note"
                value={transfer.note}
                onChange={(e) => setTransfer((t) => ({ ...t, note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={transferMutation.isPending}
              onClick={() => {
                if (!transfer.item_id || !transfer.quantity || !transfer.from_location_id || !transfer.to_location_id) {
                  toast({ title: 'Item, quantity and both locations are required', variant: 'destructive' });
                  return;
                }
                transferMutation.mutate();
              }}
            >
              {transferMutation.isPending ? 'Saving...' : 'Record Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock Adjustment</DialogTitle>
            <DialogDescription>
              Reason code is mandatory. Adjustments above the configured threshold require approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="a-item">Item ID / SKU</Label>
              <Input
                id="a-item"
                value={adjust.item_id}
                onChange={(e) => setAdjust((a) => ({ ...a, item_id: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-loc">Location</Label>
              <LocationSelect
                id="a-loc"
                value={adjust.location_id}
                onChange={(v) => setAdjust((a) => ({ ...a, location_id: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-qty">Quantity change (negative to decrease)</Label>
              <Input
                id="a-qty"
                type="number"
                value={adjust.quantity_delta}
                onChange={(e) => setAdjust((a) => ({ ...a, quantity_delta: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-reason">Reason code</Label>
              <Select value={adjust.reason_code} onValueChange={(v) => setAdjust((a) => ({ ...a, reason_code: v }))}>
                <SelectTrigger id="a-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_ADJUSTMENT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {reasonLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-note">Reason note</Label>
              <Textarea
                id="a-note"
                value={adjust.reason_note}
                onChange={(e) => setAdjust((a) => ({ ...a, reason_note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={adjustMutation.isPending}
              onClick={() => {
                if (!adjust.item_id || !adjust.location_id || !adjust.quantity_delta || !adjust.reason_note.trim()) {
                  toast({ title: 'Item, location, quantity and reason note are required', variant: 'destructive' });
                  return;
                }
                adjustMutation.mutate();
              }}
            >
              {adjustMutation.isPending ? 'Saving...' : 'Submit Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default StockMovements;