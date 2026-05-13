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
import { Loader2, Plus, CheckCircle2, Pencil, FileText, Trash2, Send } from "lucide-react";
import { fleetApi } from "@/services/logisticsApi";
import { useToast } from "@/hooks/use-toast";
import type { FleetVehicle, MaintenanceSchedule } from "@/types/logistics";
import { MaintenanceSRFDialog } from "./MaintenanceSRFDialog";

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
  const [srfDialogOpen, setSrfDialogOpen] = useState(false);
  const [srfMaintenance, setSrfMaintenance] = useState<MaintenanceSchedule | null>(null);

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
      // Always include records that came back inline on the vehicle object
      // (legacy /maintenance POST writes here as `maintenance_history`).
      const inlineHistory: MaintenanceSchedule[] = ((vehicle as any).maintenanceHistory || []).map(
        (h: any) => ({
          id: (h.id || h.uuid || `inline-${h.performed_at || h.performedAt || Math.random()}`).toString(),
          vehicleId: vehicle.id,
          maintenanceType: h.description || h.maintenance_type || h.maintenanceType || h.type || "Maintenance",
          intervalMonths: 0,
          lastMaintenanceDate: h.performed_at || h.performedAt || h.last_maintenance_date || "",
          nextMaintenanceDate: h.next_scheduled_at || h.nextScheduledAt || h.next_maintenance_date || "",
          status: (h.status as any) || "completed",
          notes: h.notes,
          // @ts-ignore
          documents: h.documents || h.attachments || [],
        }),
      );
      if (res.success && res.data) {
        const arr = Array.isArray(res.data) ? res.data : (res.data as any).records || [];
        const normalized = arr.map((r: any) => normalize(r, vehicle.id));
        // De-dupe by id, prefer schedule entries over inline history
        const byId = new Map<string, MaintenanceSchedule>();
        [...inlineHistory, ...normalized].forEach((it) => byId.set(it.id, it));
        setItems(Array.from(byId.values()));
      } else {
        setItems(inlineHistory);
        if (res.error) setError(res.error);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load maintenance");
    } finally {
      setLoading(false);
    }
  }, [vehicle.id, vehicle]);

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
                <TableHead>Documents</TableHead>
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
                  <TableCell>
                    {((it as any).documents || []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {((it as any).documents || []).map((doc: any, idx: number) => {
                          const docId = doc?.id || doc?.document_id || idx;
                          const url = doc?.url || doc?.file_url || doc?.s3_url;
                          const name = doc?.name || doc?.file_name || `Document ${idx + 1}`;
                          return (
                            <div key={docId} className="flex items-center gap-2 text-xs">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              {url ? (
                                <a href={url} target="_blank" rel="noreferrer" className="truncate max-w-[140px] underline">
                                  {name}
                                </a>
                              ) : (
                                <span className="truncate max-w-[140px]">{name}</span>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5"
                                onClick={() => handleDeleteDocument(it.id, doc)}
                                title="Delete document"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          setSrfMaintenance(it);
                          setSrfDialogOpen(true);
                        }}
                        title="Initiate Service Request Form"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
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

      {/* Maintenance SRF Dialog */}
      {srfMaintenance && (
        <MaintenanceSRFDialog
          open={srfDialogOpen}
          onOpenChange={setSrfDialogOpen}
          maintenance={srfMaintenance}
          vehicle={vehicle}
          onSuccess={() => {
            setSrfMaintenance(null);
            onChanged?.();
          }}
        />
      )}
    </div>
  );
};

export default VehicleMaintenanceTab;