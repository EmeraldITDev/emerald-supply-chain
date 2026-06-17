import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { tripRequestApi } from "@/services/api";
import { tripsApi } from "@/services/logisticsApi";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";
import { TripCommentsPanel } from "@/components/logistics/TripCommentsPanel";
import { JourneyManagement } from "@/components/logistics/JourneyManagement";
import { TripRequestApprovalDialog } from "@/components/logistics/TripRequestApprovalDialog";
import { SimpleProgressStepper } from "@/components/progress/SimpleProgressStepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Truck, ExternalLink } from "lucide-react";
import type { StaffTripRequest, TripProgressStep } from "@/types/trip-request";
import type { Trip } from "@/types/logistics";
import { resolveLogisticsTripId, resolveTripViewer } from "@/utils/tripViewer";
import { getScmRole } from "@/utils/scmRole";
import { useAuth } from "@/contexts/AuthContext";

const FALLBACK_STEPS: TripProgressStep[] = [
  { key: "submitted", label: "Submitted", status: "in_progress", step: 1 },
  { key: "logistics_review", label: "Logistics Review", status: "pending", step: 2 },
  { key: "confirmed", label: "Confirmed", status: "pending", step: 3 },
  { key: "completed", label: "Completed", status: "pending", step: 4 },
];

export default function TripRequestDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [trip, setTrip] = useState<StaffTripRequest | null>(null);
  const [logisticsTrip, setLogisticsTrip] = useState<Trip | null>(null);
  const [steps, setSteps] = useState<TripProgressStep[]>(FALLBACK_STEPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [detailRes, progressRes] = await Promise.all([
      tripRequestApi.getById(id),
      tripRequestApi.getProgressTracker(id),
    ]);
    if (!detailRes.success || !detailRes.data?.trip) {
      setError(detailRes.error || "Failed to load trip request");
      setLoading(false);
      return;
    }
    const t = detailRes.data.trip;
    setTrip(t);
    const progressSteps =
      progressRes.data?.steps ?? t.progress?.steps ?? FALLBACK_STEPS;
    setSteps(progressSteps.length ? progressSteps : FALLBACK_STEPS);

    const logisticsId = resolveLogisticsTripId(t);
    if (logisticsId) {
      const ltRes = await tripsApi.getById(logisticsId);
      if (ltRes.success && ltRes.data) setLogisticsTrip(ltRes.data);
    } else {
      setLogisticsTrip(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [id]);

  const viewer = resolveTripViewer(trip);
  const role = getScmRole(user);
  const isLogisticsRole =
    role === "logistics_manager" ||
    role === "logistics_officer" ||
    role === "logistics" ||
    role === "admin";
  const canApprove =
    !viewer.readOnly &&
    (viewer.canManage || isLogisticsRole) &&
    ["submitted", "pending", "trip_request", "logistics_review"].includes(
      (trip?.status ?? "").toLowerCase(),
    );
  const logisticsId = resolveLogisticsTripId(trip);
  const passengers = trip?.passengers ?? [];
  const externalPassengers = trip?.externalPassengers ?? trip?.external_passengers ?? [];

  return (
    <EntityDetailShell
      title={trip?.destination ?? "Trip request"}
      subtitle={trip?.tripCode ?? trip?.trip_code ?? id}
      status={trip?.status}
      backTo="/trips"
      backLabel="Back to All Trips"
      loading={loading}
      error={error}
      notFound={!loading && !error && !trip}
      notFoundLabel="Trip request not found"
    >
      {trip && (
        <div className="space-y-8">
          {viewer.readOnly && (
            <Alert>
              <AlertDescription>
                You are viewing this trip in read-only mode. Approve, assign, and comment actions are hidden unless you are involved in this trip or hold a logistics role.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline">
              {trip.bookingScopeLabel ??
                trip.booking_scope_label ??
                (trip.bookingScope === "outside_state" ? "Outside State" : "Within State")}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {trip.status.replace(/_/g, " ")}
            </Badge>
            {canApprove && (
              <Button size="sm" onClick={() => setApproveOpen(true)}>
                <Truck className="mr-2 h-4 w-4" />
                Approve &amp; assign
              </Button>
            )}
            {logisticsId && (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/trips/${logisticsId}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Logistics trip record
                </Link>
              </Button>
            )}
          </div>

          <DetailFields
            fields={[
              { label: "Requester", value: trip.requesterName ?? trip.requester_name },
              {
                label: "Department",
                value: trip.requesterDepartment ?? trip.requester_department,
              },
              { label: "Origin", value: trip.origin },
              { label: "Destination", value: trip.destination },
              { label: "Purpose", value: trip.purpose },
              {
                label: "Departure",
                value: trip.scheduledDepartureAt ?? trip.scheduled_departure_at
                  ? new Date(
                      String(trip.scheduledDepartureAt ?? trip.scheduled_departure_at),
                    ).toLocaleString()
                  : undefined,
              },
              {
                label: "Return",
                value: trip.scheduledArrivalAt ?? trip.scheduled_arrival_at
                  ? new Date(
                      String(trip.scheduledArrivalAt ?? trip.scheduled_arrival_at),
                    ).toLocaleString()
                  : undefined,
              },
              {
                label: "Driver",
                value:
                  trip.driverName ??
                  trip.driver_name ??
                  logisticsTrip?.driverName ??
                  (logisticsTrip as Trip & { external_driver?: { name?: string } })?.external_driver?.name,
              },
              {
                label: "Vehicle",
                value:
                  trip.vehiclePlate ??
                  trip.vehicle_plate ??
                  logisticsTrip?.vehiclePlate,
              },
            ]}
          />

          {(passengers.length > 0 || externalPassengers.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Passengers</h3>
              <div className="flex flex-wrap gap-2">
                {passengers.map((p, i) => (
                  <Badge key={p.id ?? i} variant="secondary">
                    {p.name}
                    {p.department ? ` (${p.department})` : ""}
                  </Badge>
                ))}
                {externalPassengers.map((p, i) => (
                  <Badge key={`ext-${i}`} variant="outline">
                    {p.name} (external)
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2">Progress</h3>
            <SimpleProgressStepper
              steps={steps.map((s) => ({
                key: s.key,
                label: s.label,
                status: s.status,
                completedAt: s.completedAt,
              }))}
            />
          </div>

          <TripCommentsPanel
            tripRequestId={id}
            logisticsTripId={logisticsId}
            readOnly={viewer.readOnly}
            canComment={trip.canComment ?? viewer.canComment}
          />

          {logisticsId && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Journey tracking</h3>
              <JourneyManagement tripId={logisticsId} />
            </div>
          )}

          <TripRequestApprovalDialog
            request={trip}
            open={approveOpen}
            onOpenChange={setApproveOpen}
            onApproved={() => void load()}
          />
        </div>
      )}
    </EntityDetailShell>
  );
}
