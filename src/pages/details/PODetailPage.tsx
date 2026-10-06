import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { mrfApi, poApi } from "@/services/api";
import type { MRF } from "@/types";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Pencil, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getDashboardPath, getScmRole } from "@/utils/scmRole";
import {
  canUnlockSignedPo,
  getEffectivePoNumber,
  isPoPendingRevision,
  isPoSignedLocked,
} from "@/utils/poHelpers";
import { UnlockSignedPoDialog } from "@/components/procurement/UnlockSignedPoDialog";
import { PoRevisionSummary } from "@/components/procurement/PoRevisionSummary";
import { CreatePOForm } from "@/components/procurement/CreatePOForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMrfApiId } from "@/utils/displayId";

const CONFIRM_DELIVERY_ROLES = [
  "procurement_manager",
  "procurement",
  "supply_chain_director",
  "supply_chain",
  "admin",
];

/**
 * PO detail view. The PO is a derivative of its MRF, so we hydrate via mrfApi.
 * The `:id` param accepts either the MRF id or the PO number — the backend
 * resolves either through /mrfs/{id}.
 */
export default function PODetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const dashboardPath = getDashboardPath(user);
  const [searchParams] = useSearchParams();
  const [mrf, setMrf] = useState<MRF | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeliveryOpen, setConfirmDeliveryOpen] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  const reload = async () => {
    const res = await mrfApi.getById(id);
    if (res.success && res.data) setMrf(res.data as MRF);
    return res;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    mrfApi
      .getById(id)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setMrf(res.data as MRF);
        else setError(res.error || "Failed to load PO");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const m = mrf as any;
  const signed = m?.signed_po_url || m?.signedPOUrl;
  const justSigned = searchParams.get("signed") === "1";
  const poStatus = String(m?.po_status || m?.poStatus || m?.status || "")
    .toLowerCase();
  const pendingRevision = isPoPendingRevision(mrf);
  const isSigned =
    !pendingRevision &&
    (Boolean(signed) || justSigned || poStatus.includes("signed"));
  const canEditSigned = canUnlockSignedPo(getScmRole(user), user);
  const showEditButton = Boolean(mrf) && canEditSigned && (isSigned || pendingRevision);
  const apiId = mrf ? getMrfApiId(mrf) || String(mrf.id || id) : id;

  const workflowState = String(
    m?.workflow_state || m?.workflowState || "",
  ).toLowerCase();
  const scmRole = getScmRole(user);
  const canConfirmDelivery =
    workflowState === "delivery_confirmation_pending" &&
    CONFIRM_DELIVERY_ROLES.includes(scmRole ?? "");

  const handleDownloadPdf = async () => {
    if (!mrf) return;
    setDownloading(true);
    try {
      const { downloadMrfPurchaseOrderPdf } = await import(
        "@/utils/downloadMrfPurchaseOrderPdf"
      );
      const res = await downloadMrfPurchaseOrderPdf(mrf, {
        preferSigned: isSigned,
      });
      if (!res.success) {
        toast.error(res.error || "Could not download the PO PDF.");
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleUnlock = async (reason: string) => {
    setUnlocking(true);
    try {
      const res = await poApi.unlockForEdit(apiId, reason);
      if (!res.success) {
        toast.error(res.error || "Could not unlock this PO for editing.");
        return;
      }
      if (res.data) setMrf(res.data as MRF);
      else await reload();
      setUnlockOpen(false);
      setEditOpen(true);
    } finally {
      setUnlocking(false);
    }
  };

  const handleConfirmDelivery = async () => {
    setConfirmingDelivery(true);
    try {
      const res = await mrfApi.confirmDelivery(apiId, {
        delivery_notes: deliveryNotes.trim() || undefined,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to confirm delivery.");
        return;
      }
      toast.success("Delivery confirmed. Request closed out successfully.");
      setConfirmDeliveryOpen(false);
      setDeliveryNotes("");
      await reload();
      window.dispatchEvent(new CustomEvent("app:refresh"));
    } finally {
      setConfirmingDelivery(false);
    }
  };

  return (
    <EntityDetailShell
      title={m?.po_number || m?.poNumber || "Purchase Order"}
      subtitle={m?.title || m?.description}
      status={m?.po_status || m?.poStatus || m?.status}
      backTo={dashboardPath}
      backLabel="Back to Dashboard"
      loading={loading}
      error={error}
      notFound={!loading && !error && !mrf}
      notFoundLabel="Purchase Order not found"
    >
      {mrf && (
        <div className="space-y-4">
          {isPoPendingRevision(mrf) && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              This PO is unlocked for revision. Save your edits to notify the
              Supply Chain Director for a new signature.
            </div>
          )}
          <PoRevisionSummary mrf={mrf} />
          <DetailFields
            fields={[
              { label: "Vendor", value: m.vendor_name || m.vendorName },
              { label: "MRF", value: m.formattedId || m.formatted_id || m.id },
              { label: "Total", value: m.po_total || m.poTotal },
              {
                label: "Created",
                value: m.po_created_at || m.poCreatedAt || m.created_at,
              },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleDownloadPdf} disabled={downloading} size="sm">
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isSigned ? "Download signed PO (PDF)" : "Download PO (PDF)"}
            </Button>
            {showEditButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isPoSignedLocked(mrf)) setUnlockOpen(true);
                  else setEditOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit PO
              </Button>
            )}
            {canConfirmDelivery && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setConfirmDeliveryOpen(true)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Delivery & Close Out
              </Button>
            )}
          </div>
        </div>
      )}

      <UnlockSignedPoDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        poNumber={getEffectivePoNumber(mrf)}
        submitting={unlocking}
        onConfirm={handleUnlock}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="flex w-[95vw] max-w-5xl max-h-[85vh] flex-col gap-4 overflow-hidden p-6">
          <DialogHeader className="flex-shrink-0 pr-8">
            <DialogTitle>Edit purchase order</DialogTitle>
          </DialogHeader>
          {editOpen && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CreatePOForm
                mrfId={apiId}
                revisionMode
                initialEditMode
                onFinalised={async (updated) => {
                  setMrf((prev) => (prev ? { ...prev, ...updated } : updated));
                  setEditOpen(false);
                  await reload();
                }}
                onRequestClose={() => setEditOpen(false)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeliveryOpen} onOpenChange={setConfirmDeliveryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delivery</DialogTitle>
            <DialogDescription>
              Confirming delivery will close out this request and notify Finance
              that payment can proceed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="po-delivery-notes">Delivery Notes (optional)</Label>
            <Textarea
              id="po-delivery-notes"
              placeholder="e.g. All items received in good condition on 30 Sep 2026"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeliveryOpen(false)}
              disabled={confirmingDelivery}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleConfirmDelivery}
              disabled={confirmingDelivery}
            >
              {confirmingDelivery ? "Confirming..." : "Confirm Delivery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityDetailShell>
  );
}
