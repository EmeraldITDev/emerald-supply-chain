import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, Star } from "lucide-react";
import { tripRequestApi } from "@/services/api";
import type { TripRfq } from "@/types/trip-request";

const SERVICE_LABELS: Record<string, string> = {
  transport: "Transport",
  accommodation: "Accommodation",
  escort: "Escort / Security",
};

function formatMoney(amount: number | null, currency?: string) {
  if (amount == null) return "—";
  const symbol = !currency || currency === "NGN" ? "₦" : `${currency} `;
  return `${symbol}${Number(amount).toLocaleString()}`;
}

interface TripQuotationsPanelProps {
  tripId: string | number;
  /** When set, renders selection checkboxes for SCD vendor approval. */
  selectable?: boolean;
  selectedVendorIds?: number[];
  onToggleVendor?: (rfq: TripRfq, checked: boolean) => void;
}

/** Read-only view of vendor quotations gathered for a trip request. */
export function TripQuotationsPanel({
  tripId,
  selectable = false,
  selectedVendorIds = [],
  onToggleVendor,
}: TripQuotationsPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["trip-request-rfqs", String(tripId)],
    queryFn: async () => {
      const res = await tripRequestApi.getRfqs(tripId);
      return res.success && Array.isArray(res.data) ? res.data : [];
    },
    enabled: Boolean(tripId),
  });

  const rfqs = data ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendor Quotations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (rfqs.length === 0) return null;

  const grouped = rfqs.reduce<Record<string, TripRfq[]>>((acc, rfq) => {
    const key = rfq.service_type || "other";
    (acc[key] ||= []).push(rfq);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vendor Quotations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {Object.entries(grouped).map(([service, items]) => (
          <div key={service} className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {SERVICE_LABELS[service] ?? service.replace(/_/g, " ")}
            </p>
            <div className="space-y-2">
              {items.map((rfq) => {
                const checked = selectedVendorIds.includes(rfq.vendor_id);
                return (
                  <div
                    key={rfq.id}
                    className={`rounded-md border p-3 text-sm ${
                      rfq.is_recommended ? "border-primary/50 bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {selectable && (
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => onToggleVendor?.(rfq, v === true)}
                          aria-label={`Approve ${rfq.vendor_name}`}
                        />
                      )}
                      <span className="font-medium">{rfq.vendor_name}</span>
                      {rfq.is_recommended && (
                        <Badge className="gap-1">
                          <Star className="h-3 w-3" />
                          Recommended
                        </Badge>
                      )}
                      {rfq.scd_approved && <Badge variant="secondary">SCD approved</Badge>}
                      <Badge variant="outline" className="capitalize">
                        {String(rfq.status).replace(/_/g, " ")}
                      </Badge>
                      <span className="ml-auto font-semibold">
                        {formatMoney(rfq.quoted_price, rfq.currency)}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {rfq.vendor_phone && <p>Contact: {rfq.vendor_phone}</p>}
                      {rfq.valid_until && (
                        <p>Valid until: {new Date(rfq.valid_until).toLocaleDateString()}</p>
                      )}
                      {rfq.vendor_notes && <p>Notes: {rfq.vendor_notes}</p>}
                      {rfq.logistics_recommendation_note && (
                        <p className="text-foreground">
                          Logistics note: {rfq.logistics_recommendation_note}
                        </p>
                      )}
                    </div>
                    {rfq.document_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        asChild
                      >
                        <a href={rfq.document_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-3 w-3" />
                          View quotation
                        </a>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default TripQuotationsPanel;