import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, CheckCircle2, Pencil, FileText, Trash2 } from "lucide-react";
import { fleetApi } from "@/services/logisticsApi";
import { useToast } from "@/hooks/use-toast";
import type { FleetVehicle, MaintenanceSchedule } from "@/types/logistics";

interface Props {
  vehicle: FleetVehicle;
  onChanged?: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-info/10 text-info border-info/20",
  completed: "bg-success/10 text-success border-success/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  overdue: "Overdue",
};

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
};

const addMonths = (isoDate: string, months: number): string => {
  if (!isoDate || !months) return "";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const normalize = (raw: any, vehicleId: string): MaintenanceSchedule => ({
  id: raw.id?.toString(),
  vehicleId: raw.vehicle_id?.toString() ?? vehicleId,
  maintenanceType: raw.maintenance_type || raw.maintenanceType || "",
  intervalMonths: Number(raw.interval_months ?? raw.intervalMonths ?? 0),
  lastMaintenanceDate: raw.last_maintenance_date || raw.lastMaintenanceDate || "",
  nextMaintenanceDate: raw.next_maintenance_date || raw.nextMaintenanceDate || "",
  status: (raw.status as MaintenanceSchedule["status"]) || "scheduled",
  notes: raw.notes,
  // @ts-ignore - documents may come from backend even if not in type
  documents: raw.documents || raw.attachments || [],
});

export const VehicleMaintenanceTab = ({ vehicle, onChanged }: Props) => {
  const { toast } = useToast();
  const [items, setItems] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceSchedule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<MaintenanceSchedule | null>(null);

  const [form, setForm] = useState({
    maintenance_type: "",
    interval_months: 6,
    last_maintenance_date: todayIso(),
    notes: "",
  });

  const nextPreview = useMemo(
    () => addMonths(form.last_maintenance_date, form.interval_months),
    [form.last_maintenance_date, form.interval_months],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fleetApi.listMaintenance(vehicle.id);
      if (res.success && res.data) {
        const arr = Array.isArray(res.data) ? res.data : (res.data as any).records || [];
        setItems(arr.map((r: any) => normalize(r, vehicle.id)));
      } else {
        setItems([]);
        if (res.error) setError(res.error);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load maintenance");
    } finally {
      setLoading(false);
    }
  }, [vehicle.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ maintenance_type: "", interval_months: 6, last_maintenance_date: todayIso(), notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (item: MaintenanceSchedule) => {
    setEditing(item);
    setForm({
      maintenance_type: item.maintenanceType,
      interval_months: item.intervalMonths,
      last_maintenance_date: item.lastMaintenanceDate?.slice(0, 10) || todayIso(),
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.maintenance_type.trim() || !form.interval_months || !form.last_maintenance_date) {
      toast({ title: "Validation", description: "Type, interval, and last date are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        maintenance_type: form.maintenance_type.trim(),
        interval_months: Number(form.interval_months),
        last_maintenance_date: form.last_maintenance_date,
        notes: form.notes || undefined,
      };
      const res = editing
        ? await fleetApi.updateMaintenance(vehicle.id, editing.id, body)
        : await fleetApi.createMaintenance(vehicle.id, body);
      if (res.success) {
        toast({ title: editing ? "Maintenance Updated" : "Maintenance Scheduled" });
        setDialogOpen(false);
        await fetchData();
        onChanged?.();
      } else {
        toast({ title: "Save Failed", description: res.error || "Try again.", variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmComplete = async () => {
    if (!completeTarget) return;
    setSubmitting(true);
    try {
      const res = await fleetApi.updateMaintenance(vehicle.id, completeTarget.id, {
        last_maintenance_date: todayIso(),
        status: "completed",
      });
      if (res.success) {
        toast({ title: "Marked Complete", description: "Last maintenance date set to today." });
        setCompleteTarget(null);
        await fetchData();
        onChanged?.();
      } else {
        toast({ title: "Update Failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDocument = async (recordId: string, doc: any) => {
    const docId = doc?.id || doc?.document_id;
    try {
      const res = await fleetApi.deleteMaintenanceDocument(vehicle.id, recordId, docId);
      if (res.success) {
        toast({ title: "Document Removed" });
        await fetchData();
        onChanged?.();
      } else {
        toast({ title: "Delete Failed", description: res.error || "Unable to delete document.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Delete Failed", description: e?.message || "Unable to delete document.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Maintenance Schedules</h4>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Maintenance
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={fetchData}>Retry</Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No maintenance records yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Last Date</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Interval (mo)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.maintenanceType}</TableCell>
                  <TableCell>{formatDate(it.lastMaintenanceDate)}</TableCell>
                  <TableCell>{formatDate(it.nextMaintenanceDate)}</TableCell>
                  <TableCell>{it.intervalMonths}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE[it.status] || ""}>
                      {STATUS_LABEL[it.status] || it.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(it)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {it.status !== "completed" && (
                        <Button size="sm" variant="ghost" onClick={() => setCompleteTarget(it)}>
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add"} Maintenance</DialogTitle>
            <DialogDescription>Schedule a maintenance entry for this vehicle.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Maintenance Type *</Label>
              <Input
                placeholder="e.g. Oil Change, Full Service"
                value={form.maintenance_type}
                onChange={(e) => setForm((p) => ({ ...p, maintenance_type: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Interval (months) *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.interval_months}
                  onChange={(e) => setForm((p) => ({ ...p, interval_months: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Maintenance Date *</Label>
                <Input
                  type="date"
                  value={form.last_maintenance_date}
                  onChange={(e) => setForm((p) => ({ ...p, last_maintenance_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Next Maintenance Date</Label>
              <Input value={nextPreview ? formatDate(nextPreview) : "—"} readOnly disabled />
              <p className="text-xs text-muted-foreground">Auto-calculated from last date + interval.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Add Maintenance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark complete confirm */}
      <AlertDialog open={!!completeTarget} onOpenChange={(o) => !o && setCompleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Completed?</AlertDialogTitle>
            <AlertDialogDescription>
              Update Last Maintenance Date to today? The Next Due date will be recalculated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmComplete} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VehicleMaintenanceTab;