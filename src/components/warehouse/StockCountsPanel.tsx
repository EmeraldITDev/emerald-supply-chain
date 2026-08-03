import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { ClipboardCheck, Plus } from 'lucide-react';
import { warehouseInventoryApi } from '@/services/warehouseInventoryApi';

const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const StockCountsPanel = ({ canManage }: { canManage: boolean }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ count_type: 'cycle', scheduled_date: '', location_id: '', note: '' });

  const { data: counts = [], isLoading, error } = useQuery({
    queryKey: ['warehouse', 'stock-counts'],
    queryFn: () => warehouseInventoryApi.getStockCounts(),
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['warehouse', 'locations'],
    queryFn: () => warehouseInventoryApi.getLocations(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['warehouse'] });

  const createMutation = useMutation({
    mutationFn: () =>
      warehouseInventoryApi.createStockCount({
        count_type: form.count_type as 'cycle' | 'full',
        scheduled_date: form.scheduled_date,
        location_id: form.location_id || undefined,
        note: form.note || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Stock count scheduled' });
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Could not schedule count', description: e.message, variant: 'destructive' }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => warehouseInventoryApi.approveStockCount(id),
    onSuccess: () => {
      toast({ title: 'Count approved' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Approval failed', description: e.message, variant: 'destructive' }),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => warehouseInventoryApi.postStockCount(id),
    onSuccess: () => {
      toast({ title: 'Variances posted to inventory' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Posting failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Inventory Counting
            </CardTitle>
            <CardDescription>Cycle and full counts with variance review before posting</CardDescription>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Schedule Count
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <TableSkeleton rows={4} />}
        {!isLoading && error && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Counts unavailable — {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && counts.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No stock counts scheduled yet.</p>
        )}
        {!isLoading && counts.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="text-right">Variances</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {counts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.reference}</TableCell>
                    <TableCell>{label(String(c.count_type))}</TableCell>
                    <TableCell className="text-sm">{c.scheduled_date || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.location_path || 'All'}</TableCell>
                    <TableCell className="text-sm">{c.assigned_to_name || '—'}</TableCell>
                    <TableCell className="text-right">{c.variance_count ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{label(String(c.status))}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {c.status === 'pending_review' && (
                          <Button size="sm" variant="outline" onClick={() => approveMutation.mutate(c.id)}>
                            Approve
                          </Button>
                        )}
                        {c.status === 'approved' && (
                          <Button size="sm" onClick={() => postMutation.mutate(c.id)}>
                            Post Variances
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Stock Count</DialogTitle>
            <DialogDescription>Cycle counts target one location; full counts cover the warehouse.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-type">Count type</Label>
              <Select value={form.count_type} onValueChange={(v) => setForm((f) => ({ ...f, count_type: v }))}>
                <SelectTrigger id="c-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cycle">Cycle count</SelectItem>
                  <SelectItem value="full">Full count</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-date">Scheduled date</Label>
              <Input
                id="c-date"
                type="date"
                value={form.scheduled_date}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-loc">Location (optional)</Label>
              <Select value={form.location_id} onValueChange={(v) => setForm((f) => ({ ...f, location_id: v }))}>
                <SelectTrigger id="c-loc">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.code} — {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-note">Note</Label>
              <Input id="c-note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createMutation.isPending}
              onClick={() => {
                if (!form.scheduled_date) {
                  toast({ title: 'A scheduled date is required', variant: 'destructive' });
                  return;
                }
                createMutation.mutate();
              }}
            >
              {createMutation.isPending ? 'Saving...' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default StockCountsPanel;