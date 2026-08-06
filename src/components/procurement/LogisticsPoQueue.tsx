import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getScmRole } from "@/utils/scmRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Loader2 } from "lucide-react";
import { tripsApi } from "@/services/logisticsApi";
import { TripLogisticsDetailsPanel } from "@/components/logistics/TripLogisticsDetailsPanel";
import type { Trip } from "@/types/logistics";

interface LogisticsPoQueueProps {
  enabled?: boolean;
  /** Fired with the logistics trip id when the user starts a PO. */
  onCreatePo: (tripId: string) => void;
  /** Trip id currently being prepared (shows a spinner on that row). */
  preparingTripId?: string | null;
}

const APPROVED_STATES = ["approved", "scheduled", "director_approved", "converted"];

function hasPo(trip: Trip): boolean {
  const raw = trip as unknown as Record<string, unknown>;
  return Boolean(raw.poNumber ?? raw.po_number ?? raw.purchase_order_id);
}

/** Approved logistics trips awaiting a purchase order. */
export function LogisticsPoQueue({
  enabled = true,
  onCreatePo,
  preparingTripId = null,
}: LogisticsPoQueueProps) {
  const { user } = useAuth();
  const scmRole = getScmRole(user);
  const canCreatePo = scmRole === "admin" || scmRole === "procurement_manager";
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTripForDetails, setSelectedTripForDetails] = useState<Trip | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["logistics-po-queue"],
    queryFn: async () => {
      const res = await tripsApi.list({ page: 1, per_page: 50 });
      return res.success && res.data ? res.data.items : [];
    },
    enabled,
  });

  const trips = (data ?? []).filter((trip) => {
    const status = String(
      (trip as unknown as Record<string, unknown>).status ?? "",
    ).toLowerCase();
    return APPROVED_STATES.some((s) => status.includes(s)) && !hasPo(trip);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Logistics POs
        </CardTitle>
        <CardDescription>
          Approved trips awaiting a purchase order. Creating a PO pre-fills the form
          from the trip&apos;s approved vendor quotations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : trips.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No approved trips are awaiting a purchase order.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => {
                  const raw = trip as unknown as Record<string, unknown>;
                  const id = String(raw.id ?? "");
                  const reference = String(
                    raw.tripCode ?? raw.trip_code ?? raw.tripNumber ?? id,
                  );
                  const departure = raw.departureAt ?? raw.departure_at ?? raw.startDate;
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{reference}</TableCell>
                      <TableCell>{String(raw.destination ?? "—")}</TableCell>
                      <TableCell>
                        {departure
                          ? new Date(String(departure)).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {String(raw.status ?? "").replace(/_/g, " ") || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTripForDetails(trip);
                              setDetailDialogOpen(true);
                            }}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            disabled={preparingTripId === id}
                            onClick={() => onCreatePo(id)}
                          >
                            {preparingTripId === id && (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            )}
                            Create PO
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={detailDialogOpen} onOpenChange={(open) => setDetailDialogOpen(open)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Trip Details{selectedTripForDetails ? ` - ${selectedTripForDetails.tripNumber ?? selectedTripForDetails.id}` : ""}
            </DialogTitle>
          </DialogHeader>

          {selectedTripForDetails ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Trip</Label>
                  <p className="mt-1 text-sm font-medium">
                    {selectedTripForDetails.tripNumber ?? selectedTripForDetails.id}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Destination</Label>
                  <p className="mt-1 text-sm font-medium">
                    {selectedTripForDetails.destination ?? "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Departure</Label>
                  <p className="mt-1 text-sm font-medium">
                    {selectedTripForDetails.scheduledDepartureAt
                      ? new Date(selectedTripForDetails.scheduledDepartureAt).toLocaleString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Status</Label>
                  <p className="mt-1 text-sm font-medium capitalize">
                    {String(selectedTripForDetails.status ?? "").replace(/_/g, " ") || "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Vendor</Label>
                  <p className="mt-1 text-sm font-medium">
                    {selectedTripForDetails.vendorName ?? "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Driver</Label>
                  <p className="mt-1 text-sm font-medium">
                    {selectedTripForDetails.driverName ?? "—"}
                  </p>
                </div>
              </div>

              <Separator />

              <TripLogisticsDetailsPanel trip={selectedTripForDetails} />
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No trip selected.
            </p>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => selectedTripForDetails && onCreatePo(String(selectedTripForDetails.id))}
              disabled={!selectedTripForDetails || preparingTripId === String(selectedTripForDetails?.id) || !canCreatePo}
            >
              {preparingTripId === String(selectedTripForDetails?.id) ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Creating PO...
                </>
              ) : (
                "Create PO"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default LogisticsPoQueue;