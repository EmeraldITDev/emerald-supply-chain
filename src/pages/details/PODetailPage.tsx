import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { mrfApi } from "@/services/api";
import type { MRF } from "@/types";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * PO detail view. The PO is a derivative of its MRF, so we hydrate via mrfApi.
 * The `:id` param accepts either the MRF id or the PO number — the backend
 * resolves either through /mrfs/{id}.
 */
export default function PODetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [mrf, setMrf] = useState<MRF | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

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
  const unsigned = m?.unsigned_po_url || m?.unsignedPOUrl;
  // Treat as signed when arriving straight from the signing flow, or when the
  // backend already exposes a signed PO URL / signed status.
  const justSigned = searchParams.get("signed") === "1";
  const poStatus = String(m?.po_status || m?.poStatus || m?.status || "")
    .toLowerCase();
  const isSigned = Boolean(signed) || justSigned || poStatus.includes("signed");

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

  return (
    <EntityDetailShell
      title={m?.po_number || m?.poNumber || "Purchase Order"}
      subtitle={m?.title || m?.description}
      status={m?.po_status || m?.poStatus || m?.status}
      backTo="/procurement"
      backLabel="Back to Procurement"
      loading={loading}
      error={error}
      notFound={!loading && !error && !mrf}
      notFoundLabel="Purchase Order not found"
    >
      {mrf && (
        <div className="space-y-4">
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
          </div>
        </div>
      )}
    </EntityDetailShell>
  );
}
