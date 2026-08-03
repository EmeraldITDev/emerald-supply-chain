import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { warehouseInventoryApi } from '@/services/warehouseInventoryApi';
import {
  WAREHOUSE_LOCATION_LEVELS,
  type CreateWarehouseLocationData,
  type WarehouseLocation,
  type WarehouseLocationLevel,
} from '@/types/warehouse-inventory';

const levelLabel = (level: string) => level.charAt(0).toUpperCase() + level.slice(1);

/** Flat list -> tree, tolerant of a backend that already returns nested children. */
function buildTree(locations: WarehouseLocation[]): WarehouseLocation[] {
  if (locations.some((l) => (l.children?.length ?? 0) > 0)) return locations;
  const byId = new Map(locations.map((l) => [l.id, { ...l, children: [] as WarehouseLocation[] }]));
  const roots: WarehouseLocation[] = [];
  byId.forEach((node) => {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children!.push(node);
    else roots.push(node);
  });
  return roots;
}

interface NodeProps {
  node: WarehouseLocation;
  depth: number;
  canManage: boolean;
  onAddChild: (parent: WarehouseLocation) => void;
  onDelete: (node: WarehouseLocation) => void;
}

const LocationNode = ({ node, depth, canManage, onAddChild, onDelete }: NodeProps) => {
  const [open, setOpen] = useState(depth < 1);
  const children = node.children ?? [];
  const utilization = node.utilization_percent
    ?? (node.capacity ? Math.round(((node.occupied ?? 0) / node.capacity) * 100) : null);

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-3 py-2"
        style={{ marginLeft: depth * 16 }}
      >
        <button
          type="button"
          className="text-muted-foreground disabled:opacity-30"
          onClick={() => setOpen((v) => !v)}
          disabled={children.length === 0}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Badge variant="outline">{levelLabel(node.level)}</Badge>
        <span className="font-medium">{node.code}</span>
        <span className="text-sm text-muted-foreground">{node.name}</span>
        {typeof node.item_count === 'number' && (
          <span className="text-xs text-muted-foreground">{node.item_count} items</span>
        )}
        {utilization != null && (
          <div className="ml-auto flex w-40 items-center gap-2">
            <Progress value={Math.min(utilization, 100)} className="h-2" />
            <span className="text-xs text-muted-foreground">{utilization}%</span>
          </div>
        )}
        {canManage && (
          <div className="ml-auto flex gap-1">
            {node.level !== 'bin' && (
              <Button size="sm" variant="ghost" onClick={() => onAddChild(node)}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onDelete(node)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>
      {open &&
        children.map((child) => (
          <LocationNode
            key={child.id}
            node={child}
            depth={depth + 1}
            canManage={canManage}
            onAddChild={onAddChild}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
};

export const WarehouseStructureManager = ({ canManage }: { canManage: boolean }) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parent, setParent] = useState<WarehouseLocation | null>(null);
  const [form, setForm] = useState<CreateWarehouseLocationData>({
    code: '',
    name: '',
    level: 'warehouse',
  });

  const { data: locations = [], isLoading, error } = useQuery({
    queryKey: ['warehouse', 'locations'],
    queryFn: () => warehouseInventoryApi.getLocations(),
  });

  const tree = useMemo(() => buildTree(locations), [locations]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['warehouse'] });

  const createMutation = useMutation({
    mutationFn: (data: CreateWarehouseLocationData) => warehouseInventoryApi.createLocation(data),
    onSuccess: () => {
      toast({ title: 'Location created' });
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Could not create location', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => warehouseInventoryApi.deleteLocation(id),
    onSuccess: () => {
      toast({ title: 'Location deleted' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Could not delete location', description: e.message, variant: 'destructive' }),
  });

  const openCreate = (parentNode: WarehouseLocation | null) => {
    const nextLevelIndex = parentNode
      ? Math.min(WAREHOUSE_LOCATION_LEVELS.indexOf(parentNode.level) + 1, WAREHOUSE_LOCATION_LEVELS.length - 1)
      : 0;
    setParent(parentNode);
    setForm({ code: '', name: '', level: WAREHOUSE_LOCATION_LEVELS[nextLevelIndex], parent_id: parentNode?.id });
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Warehouse Structure</CardTitle>
          <CardDescription>Warehouses, zones, aisles, racks, shelves and bins with occupancy</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => openCreate(null)}>
            <Plus className="mr-2 h-4 w-4" /> Add Warehouse
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <TableSkeleton rows={4} />}
        {!isLoading && error && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Warehouse structure unavailable — {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && tree.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No warehouse locations configured yet.</p>
        )}
        {tree.map((node) => (
          <LocationNode
            key={node.id}
            node={node}
            depth={0}
            canManage={canManage}
            onAddChild={openCreate}
            onDelete={(n) => deleteMutation.mutate(n.id)}
          />
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Storage Location</DialogTitle>
            <DialogDescription>
              {parent ? `Nested under ${parent.code} — ${parent.name}` : 'Top-level warehouse'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loc-level">Level</Label>
              <Select
                value={form.level}
                onValueChange={(v) => setForm((f) => ({ ...f, level: v as WarehouseLocationLevel }))}
              >
                <SelectTrigger id="loc-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_LOCATION_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {levelLabel(l)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-code">Code</Label>
              <Input
                id="loc-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. OBOB-Z1-A2-R3-B04"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-name">Name</Label>
              <Input
                id="loc-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-capacity">Capacity (optional)</Label>
              <Input
                id="loc-capacity"
                type="number"
                min={0}
                value={form.capacity ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, capacity: e.target.value === '' ? null : Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!form.code.trim() || !form.name.trim()) {
                  toast({ title: 'Code and name are required', variant: 'destructive' });
                  return;
                }
                createMutation.mutate(form);
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Saving...' : 'Create Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default WarehouseStructureManager;