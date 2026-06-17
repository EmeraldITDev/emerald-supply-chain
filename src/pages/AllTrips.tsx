import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Eye, Loader2, MapPin, RefreshCw, Search } from "lucide-react";
import { tripRequestApi } from "@/services/api";
import type { StaffTripRequest } from "@/types/trip-request";

export default function AllTripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<StaffTripRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tripRequestApi.listAll({
        q: search.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 100,
      });
      if (res.success && res.data?.trips) {
        setTrips(res.data.trips);
      } else {
        setTrips([]);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => void fetchTrips(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchTrips, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">All Trips</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organization-wide trip requests — browse every department&apos;s travel plans (read-only).
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Trip directory
              </CardTitle>
              <CardDescription>
                Separate from the Logistics Manager approval queue. Click a row to view full details.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchTrips} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search destination, origin, purpose, or trip code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : trips.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                No trips found. Try adjusting your search or filters.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Departure</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trips.map((trip) => {
                      const departure = trip.scheduledDepartureAt ?? trip.scheduled_departure_at;
                      return (
                        <TableRow
                          key={trip.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/trip-requests/${trip.id}`)}
                        >
                          <TableCell className="font-mono text-xs">
                            {trip.tripCode ?? trip.trip_code ?? `TR-${trip.id}`}
                          </TableCell>
                          <TableCell className="text-sm">
                            {trip.requesterName ?? trip.requester_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {trip.requesterDepartment ?? trip.requester_department ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {trip.origin ?? "—"} → {trip.destination}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {departure ? (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {new Date(departure).toLocaleString()}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {trip.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/trip-requests/${trip.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
      </div>
    </DashboardLayout>
  );
}
