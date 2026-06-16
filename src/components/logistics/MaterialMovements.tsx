import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Search, MoreHorizontal, Eye, Edit, Truck, CheckCircle2, XCircle,
  Loader2, FileCheck2, Package,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getScmRole } from "@/utils/scmRole";
import { materialsMovementsApi, type MaterialListResponse } from "@/services/logisticsApi";
import type {
  MaterialMovementRecord, MaterialMovementSummary, MaterialMovementStatus,
} from "@/types/logistics";
import {
  formatMaterialStatus, materialStatusBadgeClass,
  formatJCCStatus, jccStatusBadgeClass,
  canManageMovementsRole,
} from "@/utils/materialStatus";
import { cn } from "@/lib/utils";
import { MaterialMovementForm } from "./MaterialMovementForm";
import { MaterialJCCDialog } from "./MaterialJCCDialog";

type SummarySource = "summary" | "list-aggregates" | "unavailable" | "unknown";

const useDebouncedValue = <T,>(value: T, delay = 300) => {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
};

export const MaterialMovements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = getScmRole(user);
  const canManage = canManageMovementsRole(role);

  const [items, setItems] = useState<MaterialMovementRecord[]>([]);
  const [summary, setSummary] = useState<MaterialMovementSummary | null>(null);
  const [summarySource, setSummarySource] = useState<SummarySource>("unknown");
  const summarySourceRef = useRef<SummarySource>("unknown");
  const [loading, setLoading] = useState(true);

  // filters
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [destinationFilter, setDestinationFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MaterialMovementRecord | null>(null);
  const [viewTarget, setViewTarget] = useState<MaterialMovementRecord | null>(null);
  const [jccTarget, setJccTarget] = useState<MaterialMovementRecord | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    kind: "transit" | "delivered" | "cancel"; row: MaterialMovementRecord;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const refreshSummary = useCallback(async () => {
    const src = summarySourceRef.current;
    if (src === "summary") {
      const s = await materialsMovementsApi.getSummary();
      if (s.success && s.data) setSummary(s.data);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await materialsMovementsApi.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
        category: categoryFilter || undefined,
        destination: destinationFilter || undefined,
        search: debouncedSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      if (res.success && res.data) {
        setItems(res.data.items);
        if (summarySourceRef.current === "list-aggregates" && res.data.summary) {
          setSummary(res.data.summary);
        } else if (summarySourceRef.current === "unknown" && res.data.summary) {
          summarySourceRef.current = "list-aggregates";
          setSummarySource("list-aggregates");
          setSummary(res.data.summary);
        }
      } else {
        setItems([]);
        toast({ title: "Failed to load movements", description: res.error, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, destinationFilter, debouncedSearch, dateFrom, dateTo, toast]);

  // One-time summary source resolution on mount
  useEffect(() => {
    let active = true;
    (async () => {
      const s = await materialsMovementsApi.getSummary();
      if (!active) return;
      if (s.success && s.data) {
        summarySourceRef.current = "summary";
        setSummarySource("summary");
        setSummary(s.data);
      } else {
        // Defer: try list aggregates / mark unavailable based on first list response
        summarySourceRef.current = "unknown";
        setSummarySource("unknown");
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  // After first list completes if still unknown, mark unavailable
  useEffect(() => {
    if (!loading && summarySourceRef.current === "unknown") {
      summarySourceRef.current = "unavailable";
      setSummarySource("unavailable");
    }
  }, [loading]);

  // app:refresh global hook
  useEffect(() => {
    const handler = () => { fetchList(); refreshSummary(); };
    window.addEventListener("app:refresh", handler);
    return () => window.removeEventListener("app:refresh", handler);
  }, [fetchList, refreshSummary]);

  const stats = useMemo(() => ({
    total: summary?.total ?? null,
    pending: summary?.pending ?? null,
    in_transit: summary?.in_transit ?? null,
    delivered: summary?.delivered ?? null,
  }), [summary]);

  const renderStatValue = (n: number | null) => {
    if (summarySource === "unavailable") return <Skeleton className="h-7 w-12" />;
    if (n == null) return <Skeleton className="h-7 w-12" />;
    return <div className="text-2xl font-bold">{n}</div>;
  };

  const performAction = async () => {
    if (!confirmAction) return;
    setActionBusy(true);
    try {
      const { kind, row } = confirmAction;
      const res =
        kind === "transit" ? await materialsMovementsApi.markInTransit(row.id) :
        kind === "delivered" ? await materialsMovementsApi.markDelivered(row.id) :
        await materialsMovementsApi.cancel(row.id);
      if (res.success) {
        toast({
          title:
            kind === "transit" ? "Marked in transit" :
            kind === "delivered" ? "Marked delivered" :
            "Movement cancelled",
        });
        setConfirmAction(null);
        fetchList();
        refreshSummary();
      } else {
        toast({ title: "Action failed", description: (res as any).error ?? "Try again", variant: "destructive" });
      }
    } finally {
      setActionBusy(false);
    }
  };

  const openNew = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (m: MaterialMovementRecord) => { setEditTarget(m); setFormOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Material Movements</h2>
          <p className="text-sm text-muted-foreground">
            Goods in transit, certified on delivery via JCC.
          </p>
        </div>
        {canManage && (
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            New Material Movement
          </Button>
        )}
      </div>

      {/* StatCards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total", value: stats.total, icon: Package },
          { label: "Pending", value: stats.pending, icon: Loader2 },
          { label: "In Transit", value: stats.in_transit, icon: Truck },
          { label: "Delivered", value: stats.delivered, icon: CheckCircle2 },
        ].map(s => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>{renderStatValue(s.value)}</CardContent>
          </Card>
        ))}
      </div>
      {summarySource === "unavailable" && (
        <p className="text-xs text-muted-foreground -mt-3">Counts pending backend support</p>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search material / destination / plate…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Category" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} />
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10">
                    <Loader2 className="inline h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No material movements.
                  </TableCell></TableRow>
                ) : (
                  items.map(m => {
                    const editable = m.status === "pending" || m.status === "in_transit";
                    const canMarkDelivered = m.status === "in_transit" && m.jccStatus === "approved";
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.materialName}</TableCell>
                        <TableCell>{m.category}</TableCell>
                        <TableCell>{m.quantity}</TableCell>
                        <TableCell>{m.pickupLocation}</TableCell>
                        <TableCell>{m.destination}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(materialStatusBadgeClass(m.status))}>
                            {formatMaterialStatus(m.status)}
                          </Badge>
                          {m.jccStatus && (
                            <Badge variant="outline" className={cn("ml-2", jccStatusBadgeClass(m.jccStatus))}>
                              JCC {formatJCCStatus(m.jccStatus)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.expectedDeliveryAt
                            ? new Date(m.expectedDeliveryAt).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewTarget(m)}>
                                <Eye className="mr-2 h-4 w-4" /> View
                              </DropdownMenuItem>
                              {canManage && editable && (
                                <DropdownMenuItem onClick={() => openEdit(m)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                              )}
                              {canManage && m.status === "pending" && (
                                <DropdownMenuItem onClick={() => setConfirmAction({ kind: "transit", row: m })}>
                                  <Truck className="mr-2 h-4 w-4" /> Mark In Transit
                                </DropdownMenuItem>
                              )}
                              {canManage && m.status === "in_transit" && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <DropdownMenuItem
                                          disabled={!canMarkDelivered}
                                          onClick={() => canMarkDelivered && setConfirmAction({ kind: "delivered", row: m })}
                                        >
                                          <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Delivered
                                        </DropdownMenuItem>
                                      </span>
                                    </TooltipTrigger>
                                    {!canMarkDelivered && (
                                      <TooltipContent>
                                        Approve the JCC before marking this movement as delivered.
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {canManage && m.status !== "cancelled" && m.status !== "delivered" && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setConfirmAction({ kind: "cancel", row: m })}
                                >
                                  <XCircle className="mr-2 h-4 w-4" /> Cancel
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <MaterialMovementForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editTarget}
        onSaved={() => { fetchList(); refreshSummary(); }}
      />

      {/* JCC Dialog */}
      <MaterialJCCDialog
        movement={jccTarget}
        open={!!jccTarget}
        onOpenChange={o => { if (!o) setJccTarget(null); }}
        onApproved={() => { fetchList(); refreshSummary(); }}
      />

      {/* View drawer */}
      <Sheet open={!!viewTarget} onOpenChange={o => { if (!o) setViewTarget(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Material Movement</SheetTitle>
          </SheetHeader>
          {viewTarget && (
            <div className="space-y-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(materialStatusBadgeClass(viewTarget.status))}>
                  {formatMaterialStatus(viewTarget.status)}
                </Badge>
                {viewTarget.jccStatus && (
                  <Badge variant="outline" className={cn(jccStatusBadgeClass(viewTarget.jccStatus))}>
                    JCC {formatJCCStatus(viewTarget.jccStatus)}
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                <p><strong>Material:</strong> {viewTarget.materialName}</p>
                <p><strong>Category:</strong> {viewTarget.category}</p>
                <p><strong>Quantity:</strong> {viewTarget.quantity}</p>
                <p><strong>Pickup:</strong> {viewTarget.pickupLocation}</p>
                <p><strong>Destination:</strong> {viewTarget.destination}</p>
                <p><strong>Vendor:</strong> {viewTarget.vendorName ?? "—"}</p>
                {viewTarget.vendorAddress && (
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{viewTarget.vendorAddress}</p>
                )}
                <p><strong>Vendor Phone:</strong>{" "}
                  <a href={`tel:${viewTarget.vendorPhone}`} className="text-primary underline">{viewTarget.vendorPhone}</a>
                </p>
                <p><strong>Vehicle:</strong> {viewTarget.vehiclePlate}</p>
                <p><strong>Driver:</strong> {viewTarget.driverName} —{" "}
                  <a href={`tel:${viewTarget.driverPhone}`} className="text-primary underline">{viewTarget.driverPhone}</a>
                </p>
                <p><strong>Pickup ETA:</strong> {viewTarget.expectedPickupAt ? new Date(viewTarget.expectedPickupAt).toLocaleString() : "—"}</p>
                <p><strong>Delivery ETA:</strong> {viewTarget.expectedDeliveryAt ? new Date(viewTarget.expectedDeliveryAt).toLocaleString() : "—"}</p>
                <p><strong>Condition:</strong> {viewTarget.conditionOfGoods}</p>
                {viewTarget.linkedPoNumber && <p><strong>PO:</strong> {viewTarget.linkedPoNumber}</p>}
              </div>
              <div className="flex flex-col gap-2 pt-4 border-t">
                {(viewTarget.status === "in_transit" || viewTarget.status === "delivered") &&
                  (canManage || viewTarget.jccStatus) && (
                    <Button
                      onClick={() => { setJccTarget(viewTarget); setViewTarget(null); }}
                      variant={viewTarget.jccStatus ? "outline" : "default"}
                    >
                      <FileCheck2 className="mr-2 h-4 w-4" />
                      {viewTarget.jccStatus ? "View JCC" : "Close Movement / Issue JCC"}
                    </Button>
                  )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm action */}
      <AlertDialog open={!!confirmAction} onOpenChange={o => { if (!o) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.kind === "transit" && "Mark this movement as In Transit?"}
              {confirmAction?.kind === "delivered" && "Mark this movement as Delivered?"}
              {confirmAction?.kind === "cancel" && "Cancel this movement?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.kind === "cancel"
                ? "This will soft-delete the movement record."
                : "This will update the movement status."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>No</AlertDialogCancel>
            <AlertDialogAction onClick={performAction} disabled={actionBusy}>
              {actionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MaterialMovements;
