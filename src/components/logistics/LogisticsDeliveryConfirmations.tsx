import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCheck, FileText, ClipboardCheck, Eye } from "lucide-react";
import GRNCompletionDialog from "@/components/GRNCompletionDialog";
import { JCCDialog } from "@/components/logistics/JCCDialog";
import { DeliveryConfirmationDetailSheet } from "@/components/logistics/DeliveryConfirmationDetailSheet";
import type { Trip } from "@/types/logistics";
import { getDisplayId } from "@/utils/displayId";

// Loose MRF shape — the Overview hands us context MRFs that don't satisfy the
// strict `MRF` type but carry every field GRNCompletionDialog needs.
type AnyMrf = {
  id: string | number;
  po_number?: string;
  poNumber?: string;
  category?: string;
  grn_url?: string;
  grnUrl?: string;
  items?: unknown;
  [key: string]: unknown;
};

interface Props {
  mrfs: AnyMrf[];
  trips: Trip[];
  onRefresh?: () => void;
}

type DetailItem =
  | { kind: "mrf"; id: string | number; poNumber?: string; category?: string }
  | { kind: "trip"; trip: Trip };

/**
 * "Pending Delivery Confirmations" panel on the Logistics Overview.
 * Surfaces MRFs awaiting a GRN (goods landed but no GRN saved) and
 * trips awaiting a JCC (completed services with no certificate yet),
 * with detail sheet + inline buttons that open the existing dialogs.
 */
export function LogisticsDeliveryConfirmations({ mrfs, trips, onRefresh }: Props) {
  const [grnMrf, setGrnMrf] = useState<AnyMrf | null>(null);
  const [jccTrip, setJccTrip] = useState<Trip | null>(null);
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const pendingGrnMrfs = useMemo(() => {
    return (mrfs ?? [])
      .filter((m) => {
        const hasPo = Boolean(m.po_number || m.poNumber);
        const hasGrn = Boolean((m as { grn_url?: string; grnUrl?: string }).grn_url || (m as { grn_url?: string; grnUrl?: string }).grnUrl);
        return hasPo && !hasGrn;
      })
      .slice(0, 6);
  }, [mrfs]);

  const pendingJccTrips = useMemo(() => {
    return (trips ?? [])
      .filter((t) => t.status === "completed")
      .slice(0, 6);
  }, [trips]);

  const empty = pendingGrnMrfs.length === 0 && pendingJccTrips.length === 0;

  const openMrfDetail = (m: AnyMrf) => {
    setDetailItem({
      kind: "mrf",
      id: m.id,
      poNumber: m.po_number || m.poNumber,
      category: m.category,
    });
    setDetailOpen(true);
  };

  const openTripDetail = (t: Trip) => {
    setDetailItem({ kind: "trip", trip: t });
    setDetailOpen(true);
  };

  return (
    <>
      <Card className="lg:col-span-2 border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-amber-600" />
            Pending Delivery Confirmations
          </CardTitle>
          <CardDescription>
            Review MRF or trip details, then confirm goods receipt (GRN) or service completion (JCC) before Finance pays the vendor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {empty ? (
            <p className="text-sm text-muted-foreground py-2">
              Nothing pending — every active PO has a GRN and every completed trip has a JCC.
            </p>
          ) : null}

          {pendingGrnMrfs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Awaiting GRN (Goods Received)</h4>
                <Badge variant="outline">{pendingGrnMrfs.length}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {pendingGrnMrfs.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-background"
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left flex-1 hover:opacity-80"
                      onClick={() => openMrfDetail(m)}
                    >
                      <p className="text-sm font-medium truncate">{getDisplayId(m)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        PO {m.po_number || m.poNumber} · {m.category || "—"}
                      </p>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openMrfDetail(m)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setGrnMrf(m)}>
                        Generate GRN
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingJccTrips.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Awaiting JCC (Completed Trips)</h4>
                <Badge variant="outline">{pendingJccTrips.length}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {pendingJccTrips.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-background"
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left flex-1 hover:opacity-80"
                      onClick={() => openTripDetail(t)}
                    >
                      <p className="text-sm font-medium truncate">{t.tripNumber || t.route}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.vendorName || t.driverName || "—"}
                      </p>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openTripDetail(t)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setJccTrip(t)}>
                        Generate JCC
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DeliveryConfirmationDetailSheet
        item={detailItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onGenerateGrn={() => {
          if (detailItem?.kind === "mrf") {
            const m = pendingGrnMrfs.find((x) => String(x.id) === String(detailItem.id));
            if (m) {
              setDetailOpen(false);
              setGrnMrf(m);
            }
          }
        }}
        onGenerateJcc={() => {
          if (detailItem?.kind === "trip") {
            setDetailOpen(false);
            setJccTrip(detailItem.trip);
          }
        }}
      />

      {grnMrf && (
        <GRNCompletionDialog
          open={Boolean(grnMrf)}
          onOpenChange={(o) => !o && setGrnMrf(null)}
          mrf={grnMrf as unknown as Parameters<typeof GRNCompletionDialog>[0]["mrf"]}
          onSuccess={() => {
            setGrnMrf(null);
            onRefresh?.();
          }}
        />
      )}
      <JCCDialog
        trip={jccTrip}
        open={Boolean(jccTrip)}
        onOpenChange={(o) => !o && setJccTrip(null)}
      />
    </>
  );
}
