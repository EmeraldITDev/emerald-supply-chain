import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, ExternalLink, Loader2 } from "lucide-react";
import { tripsApi } from "@/services/logisticsApi";
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
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/trips/${id}`}>
                              <ExternalLink className="mr-2 h-3 w-3" />
                              View
                            </Link>
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
    </Card>
  );
}

export default LogisticsPoQueue;