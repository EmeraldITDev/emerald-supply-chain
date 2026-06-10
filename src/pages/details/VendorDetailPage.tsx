import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { vendorApi } from "@/services/api";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";

export default function VendorDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [vendor, setVendor] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    vendorApi
      .getById(id)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setVendor(res.data);
        else setError(res.error || "Failed to load vendor");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const v = vendor as any;
  return (
    <EntityDetailShell
      title={v?.company_name || v?.companyName || v?.name || "Vendor"}
      subtitle={v?.vendor_code || v?.vendorCode || id}
      status={v?.status}
      backTo="/vendors"
      backLabel="Back to Vendors"
      loading={loading}
      error={error}
      notFound={!loading && !error && !vendor}
      notFoundLabel="Vendor not found"
    >
      {vendor && (
        <DetailFields
          fields={[
            { label: "Company", value: v.company_name || v.companyName },
            { label: "Contact", value: v.contact_person || v.contactPerson },
            { label: "Email", value: v.email },
            { label: "Phone", value: v.phone || v.phone_number },
            { label: "Category", value: Array.isArray(v.categories) ? v.categories.join(", ") : v.category },
            { label: "Country", value: v.country },
          ]}
        />
      )}
    </EntityDetailShell>
  );
}