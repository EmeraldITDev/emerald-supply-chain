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
import { Plus, ScanLine, Search } from 'lucide-react';
import { warehouseInventoryApi } from '@/services/warehouseInventoryApi';
import { BarcodeScannerDialog } from './BarcodeScannerDialog';
import { ITEM_TYPES, type CreateCatalogueItemData } from '@/types/warehouse-inventory';
import { DMC_UOM_OPTIONS } from '@/types/warehouse';

const emptyItem: CreateCatalogueItemData = {
  sku: '',
  description: '',
  item_type: 'spare_part',
  uom: 'PCS',
};

export const ItemCatalogue = ({ canManage }: { canManage: boolean }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateCatalogueItemData>(emptyItem);

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['warehouse', 'items', search],
    queryFn: () => warehouseInventoryApi.getItems(search ? { search } : {}),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCatalogueItemData) => warehouseInventoryApi.createItem(data),
    onSuccess: () => {
      toast({ title: 'Item added to catalogue' });
      setDialogOpen(false);
      setForm(emptyItem);
      queryClient.invalidateQueries({ queryKey: ['warehouse'] });
    },
    onError: (e: Error) => toast({ title: 'Could not save item', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Item Catalogue</CardTitle>
            <CardDescription>
              Master item records used by MRF and SRF line items across the platform
            </CardDescription>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Item
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search SKU, description, manufacturer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => setScannerOpen(true)}>
            <ScanLine className="mr-2 h-4 w-4" /> Scan
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <TableSkeleton rows={6} />}
        {!isLoading && error && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Catalogue unavailable — {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No catalogue items yet.</p>
        )}
        {!isLoading && items.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>UoM</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Hazard</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.sku}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{item.description}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ITEM_TYPES.find((t) => t.value === item.item_type)?.label ?? item.item_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.category || '—'}</TableCell>
                    <TableCell>{item.manufacturer || '—'}</TableCell>
                    <TableCell>{item.uom}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.barcode || '—'}</TableCell>
                    <TableCell className="text-sm">{item.hazard_classification || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <BarcodeScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onDetected={(code) => setSearch(code)} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Catalogue Item</DialogTitle>
            <DialogDescription>Core fields — images and datasheets can be attached after creation.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={form.barcode ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="desc">Description</Label>
              <Input
                id="desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Item type</Label>
              <Select value={form.item_type} onValueChange={(v) => setForm((f) => ({ ...f, item_type: v }))}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="uom">Unit of measure</Label>
              <Select value={form.uom} onValueChange={(v) => setForm((f) => ({ ...f, uom: v }))}>
                <SelectTrigger id="uom">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DMC_UOM_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={form.manufacturer ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hs">HS code</Label>
              <Input
                id="hs"
                value={form.hs_code ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, hs_code: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hazard">Hazard classification</Label>
              <Input
                id="hazard"
                value={form.hazard_classification ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, hazard_classification: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createMutation.isPending}
              onClick={() => {
                if (!form.sku.trim() || !form.description.trim()) {
                  toast({ title: 'SKU and description are required', variant: 'destructive' });
                  return;
                }
                createMutation.mutate(form);
              }}
            >
              {createMutation.isPending ? 'Saving...' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ItemCatalogue;