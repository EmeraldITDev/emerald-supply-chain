import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { mrfApi } from "@/services/api";
import type { MRF } from "@/types";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

/**
 * PO detail view. The PO is a derivative of its MRF, so we hydrate via mrfApi.
 * The `:id` param accepts either the MRF id or the PO number — the backend
 * resolves either through /mrfs/{id}.
 */
export default function PODetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [mrf, setMrf] = useState<MRF | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              { label: "Created", value: m.po_created_at || m.poCreatedAt || m.created_at },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {signed && (
              <Button asChild variant="outline" size="sm">
                <a href={signed} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Signed PO
                </a>
              </Button>
            )}
            {unsigned && (
              <Button asChild variant="outline" size="sm">
                <a href={unsigned} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Unsigned PO
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </EntityDetailShell>
  );
}