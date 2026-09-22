import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { mrfApi } from "@/services/api";
import type { MRF } from "@/types";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";
import { AttachmentList } from "@/components/attachments/AttachmentList";

function formatDetailDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MRFDetailPage() {
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
        else setError(res.error || "Failed to load MRF");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const m = mrf as
    | (MRF & {
        requester_department?: string;
        mrf_number?: string;
        documents?: unknown;
        attachments?: unknown;
        requesterName?: string;
        requester?: string;
        createdAt?: string;
        linked_po_id?: string;
        linkedPoId?: string;
      })
    | null;

  const requesterName =
    m?.requester_name ||
    m?.requesterName ||
    m?.requester ||
    (m as { created_by_name?: string } | null)?.created_by_name ||
    null;

  const poNumber =
    m?.po_number ||
    m?.poNumber ||
    m?.linked_po_id ||
    m?.linkedPoId ||
    null;

  return (
    <EntityDetailShell
      title={m?.title || m?.description || "Material Requisition"}
      subtitle={m?.formattedId || m?.formatted_id || m?.mrf_number || id}
      status={m?.status}
      backTo="/procurement"
      backLabel="Back to Procurement"
      loading={loading}
      error={error}
      notFound={!loading && !error && !mrf}
      notFoundLabel="MRF not found"
    >
      {mrf && (
        <>
          <DetailFields
            fields={[
              { label: "Department", value: m.department || m.requester_department },
              { label: "Requester", value: requesterName },
              { label: "Contract Type", value: m.contract_type || m.contractType },
              { label: "PO Number", value: poNumber || "Not generated yet" },
              { label: "Workflow", value: m.workflow_state || m.workflowState },
              {
                label: "Created",
                value: formatDetailDate(m.created_at || m.createdAt || m.date),
              },
            ]}
          />
          <div className="mt-6">
            <AttachmentList
              attachments={m.attachments ?? m.documents}
              empty="No documents attached."
            />
          </div>
        </>
      )}
    </EntityDetailShell>
  );
}
