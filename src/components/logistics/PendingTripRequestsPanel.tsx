import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bell, Calendar, Eye, Loader2, MapPin, RefreshCw, Truck } from "lucide-react";
import { tripRequestApi } from "@/services/api";
import { TripRequestDetailDialog } from "./TripRequestDetailDialog";
import { TripRequestApprovalDialog } from "./TripRequestApprovalDialog";
import type { StaffTripRequest } from "@/types/trip-request";

interface PendingTripRequestsPanelProps {
  isActive?: boolean;
  onApproved?: () => void;
  compact?: boolean;
}

export function PendingTripRequestsPanel({
  isActive = true,
  onApproved,
  compact = false,
}: PendingTripRequestsPanelProps) {
  const [requests, setRequests] = useState<StaffTripRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [approveRequest, setApproveRequest] = useState<StaffTripRequest | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tripRequestApi.listPendingForLogistics();
      if (res.success && res.data?.trips) {
        setRequests(res.data.trips);
      } else {
        setRequests([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) void fetchRequests();
  }, [isActive, fetchRequests]);

  const content = (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No pending trip requests — new submissions will appear here for review.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => {
                const departure = req.scheduledDepartureAt ?? req.scheduled_departure_at;
                return (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-xs">
                      {req.tripCode ?? req.trip_code ?? `TR-${req.id}`}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                        {req.origin ?? "—"} → {req.destination}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {departure ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(departure).toLocaleString()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {req.requesterName ?? req.requester_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {(req.workflowStage ?? req.workflow_stage ?? req.status).replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDetailId(String(req.id));
                          setDetailOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setApproveRequest(req);
                          setApproveOpen(true);
                        }}
                      >
                        <Truck className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TripRequestDetailDialog
        tripId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDeleted={fetchRequests}
      />
      <TripRequestApprovalDialog
        request={approveRequest}
        open={approveOpen}
        onOpenChange={setApproveOpen}
        onApproved={() => {
          void fetchRequests();
          onApproved?.();
        }}
      />
    </>
  );

  if (compact) return <div>{content}</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Pending Trip Requests
            {requests.length > 0 && (
              <Badge variant="destructive">{requests.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Review incoming staff trip requests, approve them, and assign vehicle and driver.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

export default PendingTripRequestsPanel;
