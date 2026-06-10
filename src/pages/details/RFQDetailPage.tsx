import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { rfqApi } from "@/services/api";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";

export default function RFQDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [rfq, setRfq] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    rfqApi
      .getById(id)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setRfq(res.data);
        else setError(res.error || "Failed to load RFQ");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const r = rfq as any;
  return (
    <EntityDetailShell
      title={r?.title || r?.rfq_number || "Request for Quotation"}
      subtitle={r?.rfq_number || r?.rfqNumber || id}
      status={r?.status}
      backTo="/procurement"
      backLabel="Back to Procurement"
      loading={loading}
      error={error}
      notFound={!loading && !error && !rfq}
      notFoundLabel="RFQ not found"
    >
      {rfq && (
        <DetailFields
          fields={[
            { label: "MRF", value: r.mrf_number || r.mrfNumber },
            { label: "Vendors Invited", value: Array.isArray(r.vendors) ? r.vendors.length : r.vendor_count },
            { label: "Deadline", value: r.submission_deadline || r.submissionDeadline },
            { label: "Created", value: r.created_at || r.createdAt },
          ]}
        />
      )}
    </EntityDetailShell>
  );
}