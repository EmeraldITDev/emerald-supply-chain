import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, FileText, Inbox } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripVendorApi } from "@/services/logisticsApi";
import type { Trip, VendorTripResponse } from "@/types/logistics";

const formatNGN = (n?: number) =>
  typeof n === "number"
    ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n)
    : "—";

interface Props {
  trip: Trip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ChainStep = "selectVendor" | "routeToProcurement" | "notifyInvoice";

interface ChainState {
  vendorId: string;
  vendorName: string;
  step: ChainStep | "done";
  error?: { step: ChainStep; message: string };
  warning?: string;
}

export function TripVendorComparison({ trip, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<VendorTripResponse[]>([]);
  const [confirm, setConfirm] = useState<VendorTripResponse | null>(null);
  const [chain, setChain] = useState<ChainState | null>(null);

  const load = async () => {
    if (!trip) return;
    setLoading(true);
    setError(null);
    const res = await tripVendorApi.getResponses(trip.id);
    setLoading(false);
    if (res.success && res.data) {
      setResponses(Array.isArray(res.data) ? res.data : []);
    } else {
      setError(res.error || "Failed to load vendor responses");
    }
  };

  useEffect(() => {
    if (open) load();
    else {
      setChain(null);
      setConfirm(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trip?.id]);

  const runApprovalChain = async (vendor: VendorTripResponse) => {
    if (!trip) return;
    setChain({ vendorId: vendor.vendorId, vendorName: vendor.vendorName, step: "selectVendor" });

    const sel = await tripVendorApi.selectVendor(trip.id, vendor.vendorId);
    if (!sel.success) {
      setChain({ vendorId: vendor.vendorId, vendorName: vendor.vendorName, step: "selectVendor", error: { step: "selectVendor", message: sel.error || "Selection failed" } });
      return;
    }

    setChain((c) => (c ? { ...c, step: "routeToProcurement" } : c));
    const route = await tripVendorApi.routeToProcurement(trip.id);
    if (!route.success) {
      setChain((c) => (c ? { ...c, error: { step: "routeToProcurement", message: route.error || "Routing failed" } } : c));
      return;
    }

    setChain((c) => (c ? { ...c, step: "notifyInvoice" } : c));
    const notify = await tripVendorApi.notifyInvoice(trip.id);
    if (!notify.success) {
      setChain((c) => (c ? { ...c, warning: notify.error || "Invoice notification failed", step: "done" } : c));
      return;
    }

    setChain((c) => (c ? { ...c, step: "done" } : c));
    toast({ title: "Vendor approved", description: `${vendor.vendorName} approved and routed to Procurement.` });
    window.dispatchEvent(new CustomEvent("app:refresh"));
  };

  const retry = async (step: ChainStep) => {
    if (!chain || !trip) return;
    if (step === "routeToProcurement") {
      setChain({ ...chain, step: "routeToProcurement", error: undefined });
      const route = await tripVendorApi.routeToProcurement(trip.id);
      if (!route.success) {
        setChain((c) => (c ? { ...c, error: { step: "routeToProcurement", message: route.error || "Routing failed" } } : c));
        return;
      }
      setChain((c) => (c ? { ...c, step: "notifyInvoice" } : c));
      const notify = await tripVendorApi.notifyInvoice(trip.id);
      if (!notify.success) {
        setChain((c) => (c ? { ...c, warning: notify.error || "Invoice notification failed", step: "done" } : c));
        return;
      }
      setChain((c) => (c ? { ...c, step: "done" } : c));
      window.dispatchEvent(new CustomEvent("app:refresh"));
    } else if (step === "notifyInvoice") {
      setChain({ ...chain, warning: undefined, step: "notifyInvoice" });
      const notify = await tripVendorApi.notifyInvoice(trip.id);
      if (!notify.success) {
        setChain((c) => (c ? { ...c, warning: notify.error || "Invoice notification failed", step: "done" } : c));
        return;
      }
      setChain((c) => (c ? { ...c, step: "done" } : c));
      window.dispatchEvent(new CustomEvent("app:refresh"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Vendor Responses</DialogTitle>
          <DialogDescription>
            {trip ? <>Trip <span className="font-medium">{trip.tripNumber}</span> · {responses.length} invited vendor(s)</> : null}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm flex items-start justify-between gap-2">
            <div className="flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5" /><span>{error}</span></div>
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3 w-3 mr-1" /> Retry</Button>
          </div>
        )}

        {!loading && !error && responses.length === 0 && (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-60" />
            No vendors invited yet. Invite vendors from the trip actions menu.
          </div>
        )}

        {!loading && !error && responses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {responses.map((v) => {
              const responded = v.status === "responded";
              return (
                <div key={v.vendorId} className="rounded-md border p-4 space-y-2 text-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{v.vendorName}</div>
                      {!responded && <Badge variant="outline" className="mt-1">Awaiting response</Badge>}
                      {v.status === "declined" && <Badge variant="destructive" className="mt-1">Declined</Badge>}
                    </div>
                    <span className="font-semibold">{responded ? formatNGN(v.quotedPrice) : "—"}</span>
                  </div>
                  <dl className="text-xs space-y-1">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Vehicle</dt><dd>{responded ? `${v.vehicleMake ?? ""} ${v.vehicleModel ?? ""}`.trim() || "—" : "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Plate</dt><dd>{responded ? v.plateNumber || "—" : "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Driver</dt><dd>{responded ? v.driverName || "—" : "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Documents</dt><dd>{responded ? (v.documents?.length ?? 0) : 0}</dd></div>
                  </dl>
                  {responded && v.documents && v.documents.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {v.documents.map((d) => (
                        <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <FileText className="h-3 w-3" /> {d.fileName}
                        </a>
                      ))}
                    </div>
                  )}
                  {responded && (
                    <Button size="sm" className="w-full" onClick={() => setConfirm(v)} disabled={!!chain && chain.step !== "done"}>
                      Select & Approve
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {chain && chain.step !== "done" && !chain.error && (
          <div className="rounded-md bg-info/10 text-info p-3 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              {chain.step === "selectVendor" && `Selecting ${chain.vendorName}…`}
              {chain.step === "routeToProcurement" && "Routing to Procurement…"}
              {chain.step === "notifyInvoice" && "Notifying vendor for invoice…"}
            </span>
          </div>
        )}

        {chain?.error && (
          <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm flex items-start justify-between gap-2">
            <div className="flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5" /><span>{chain.error.message}</span></div>
            {chain.error.step === "routeToProcurement" && (
              <Button size="sm" variant="ghost" onClick={() => retry("routeToProcurement")}>Retry Routing</Button>
            )}
          </div>
        )}

        {chain?.step === "done" && chain.warning && (
          <div className="rounded-md bg-warning/10 text-warning p-3 text-sm flex items-start justify-between gap-2">
            <div className="flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5" /><span>{chain.warning}</span></div>
            <Button size="sm" variant="ghost" onClick={() => retry("notifyInvoice")}>Retry Notification</Button>
          </div>
        )}

        {chain?.step === "done" && !chain.warning && (
          <div className="rounded-md bg-success/10 text-success p-3 text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{chain.vendorName} approved, trip routed to Procurement, vendor notified for invoice.</span>
          </div>
        )}

        <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm vendor approval</AlertDialogTitle>
              <AlertDialogDescription>
                You are approving <strong>{confirm?.vendorName}</strong> for this trip at {formatNGN(confirm?.quotedPrice)}. This will route the trip to Procurement for PO generation. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const v = confirm;
                  setConfirm(null);
                  if (v) runApprovalChain(v);
                }}
              >
                Approve & Route
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

export default TripVendorComparison;