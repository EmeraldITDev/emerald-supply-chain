import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { tripRequestApi } from "@/services/api";
import { tripsApi } from "@/services/logisticsApi";
import { EntityDetailShell, DetailFields } from "./EntityDetailShell";
import { TripCommentsPanel } from "@/components/logistics/TripCommentsPanel";
import { JourneyManagement } from "@/components/logistics/JourneyManagement";
import { TripRequestWorkflowActions } from "@/components/logistics/TripRequestWorkflowActions";
import { SimpleProgressStepper } from "@/components/progress/SimpleProgressStepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Edit, Info } from "lucide-react";
import type { StaffTripRequest, TripProgressStep } from "@/types/trip-request";
import type { Trip } from "@/types/logistics";
import { resolveLogisticsTripId, resolveTripViewer } from "@/utils/tripViewer";
import { getScmRole } from "@/utils/scmRole";
import { useAuth } from "@/contexts/AuthContext";
import { EditTripRequestDialog } from "@/components/logistics/EditTripRequestDialog";
import {
  formatRequesterEditTimeRemaining,
  resolveRequesterEditAccess,
} from "@/utils/requesterEditWindow";
import { resolveTripBookingScopeLabel } from "@/utils/tripBookingValidation";

const FALLBACK_STEPS: TripProgressStep[] = [
  { key: "submitted", label: "Submitted", status: "in_progress", step: 1 },
  { key: "logistics_review", label: "Logistics Manager Review", status: "pending", step: 2 },
  { key: "director_approval", label: "Supervising Director Approval", status: "pending", step: 3 },
  { key: "converted", label: "Logistics Request", status: "pending", step: 4 },
];

function bookingScopeLabel(trip: StaffTripRequest): string {
  return resolveTripBookingScopeLabel(
    trip.bookingScope ?? trip.booking_scope,
    trip.bookingScopeLabel ?? trip.booking_scope_label,
  );
}

export default function TripRequestDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [trip, setTrip] = useState<StaffTripRequest | null>(null);
  const [logisticsTrip, setLogisticsTrip] = useState<Trip | null>(null);
  const [steps, setSteps] = useState<TripProgressStep[]>(FALLBACK_STEPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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
  const isDirectorRole =
    role === "supply_chain_director" ||
    role === "supply_chain" ||
    role === "supervising_director" ||
    role === "director" ||
    role === "admin";
  const stageStr = String(
    trip?.workflowStage ?? trip?.workflow_stage ?? trip?.status ?? "",
  ).toLowerCase();
  const isDirectorStage = stageStr.includes("director") || stageStr === "forwarded";
  const showWorkflowActions =
    !!trip &&
    (isLogisticsRole || isDirectorRole) &&
    ((trip.availableActions?.length ?? 0) > 0 || (isDirectorRole && isDirectorStage));

  // Debug log to verify the role/status strings coming through
  if (trip && typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.debug("[TripRequestDetailPage]", {
      role,
      status: trip.status,
      workflowStage: trip.workflowStage ?? trip.workflow_stage,
      availableActions: trip.availableActions,
      isDirectorRole,
      isDirectorStage,
      showWorkflowActions,
      readOnly: viewer.readOnly,
    });
  }
  const logisticsId = resolveLogisticsTripId(trip);
  const passengers = trip?.passengers ?? [];
  const externalPassengers = trip?.externalPassengers ?? trip?.external_passengers ?? [];
  const editAccess = trip ? resolveRequesterEditAccess(trip, user) : { canEdit: false, expiresAt: null };
  const editTimeLeft = formatRequesterEditTimeRemaining(editAccess.expiresAt);

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
                You are viewing this trip in read-only mode. Workflow actions and comments are hidden unless you are involved in this trip or hold a logistics or supervising director role.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline">{bookingScopeLabel(trip)}</Badge>
            <Badge variant="secondary" className="capitalize">
              {(trip.workflowStage ?? trip.workflow_stage ?? trip.status).replace(/_/g, " ")}
            </Badge>
            {(trip.approvalStatus ?? trip.approval_status) && (
              <Badge variant="outline" className="capitalize">
                Approval: {String(trip.approvalStatus ?? trip.approval_status).replace(/_/g, " ")}
              </Badge>
            )}
            {showWorkflowActions && (
              <TripRequestWorkflowActions trip={trip} onUpdated={() => void load()} />
            )}
            {editAccess.canEdit && (
              <Button
                size="sm"
                variant="outline"
                title={editTimeLeft ?? undefined}
                onClick={() => setEditOpen(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit request
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

          {(trip.bookingRules?.scopes?.length ?? 0) > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">Booking guidance</span>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {trip.bookingRules!.scopes.map((r) => (
                    <li key={r.value}>
                      <span className="font-medium">{r.label}:</span> book at least{" "}
                      {r.minimumLeadDays} day{r.minimumLeadDays === 1 ? "" : "s"} in advance.
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

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
              ...(trip.tripType ?? trip.trip_type
                ? [{ label: "Trip Type", value: String(trip.tripType ?? trip.trip_type).replace(/_/g, " ") }]
                : []),
              ...(trip.internationalTransportMode ?? trip.international_transport_mode
                ? [
                    {
                      label: "Transport Mode",
                      value:
                        (trip.internationalTransportMode ?? trip.international_transport_mode) ===
                        "flight"
                          ? "By Flight"
                          : "By Road",
                    },
                  ]
                : []),
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

          {(trip.accommodationRequired ?? trip.accommodation_required) && (
            <div className="rounded-md border p-3 space-y-2">
              <h3 className="text-sm font-semibold">Accommodation</h3>
              <DetailFields
                fields={[
                  { label: "Hotel / Venue", value: trip.accommodationName ?? trip.accommodation_name },
                  { label: "Address", value: trip.accommodationAddress ?? trip.accommodation_address },
                  { label: "Contact", value: trip.accommodationContact ?? trip.accommodation_contact },
                  {
                    label: "Estimated cost (₦)",
                    value:
                      (trip.accommodationEstimatedCost ?? trip.accommodation_estimated_cost) != null
                        ? Number(
                            trip.accommodationEstimatedCost ?? trip.accommodation_estimated_cost,
                          ).toLocaleString()
                        : undefined,
                  },
                  { label: "Details", value: trip.accommodationDetails ?? trip.accommodation_details },
                ]}
              />
            </div>
          )}

          {(trip.escortRequired ?? trip.escort_required) && (
            <div className="rounded-md border p-3 space-y-2">
              <h3 className="text-sm font-semibold">Escort / Security</h3>
              <p className="text-sm text-muted-foreground">
                {trip.escortDescription ?? trip.escort_description ?? "—"}
              </p>
            </div>
          )}

          {(() => {
            const trail = trip.auditTrail ?? trip.audit_trail ?? [];
            if (!trail.length) return null;
            return (
              <div>
                <h3 className="text-sm font-semibold mb-2">Audit trail</h3>
                <ol className="border rounded-md divide-y">
                  {trail.map((entry, i) => {
                    const field = entry.fieldName ?? entry.field_name;
                    const original = entry.originalValue ?? entry.original_value;
                    const next = entry.newValue ?? entry.new_value;
                    const editor = entry.editorName ?? entry.editor_name;
                    const when = entry.createdAt ?? entry.created_at;
                    return (
                      <li key={entry.id ?? i} className="p-3 text-xs space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{field ?? "Update"}</span>
                          <span className="text-muted-foreground">
                            {editor ?? "System"}
                            {when ? ` · ${new Date(when).toLocaleString()}` : ""}
                          </span>
                        </div>
                        {(original != null || next != null) && (
                          <div className="text-muted-foreground">
                            {String(original ?? "—")} → <span className="text-foreground">{String(next ?? "—")}</span>
                          </div>
                        )}
                        {entry.reason && (
                          <div className="italic">Reason: {entry.reason}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })()}

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

          <EditTripRequestDialog
            trip={trip}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSaved={() => void load()}
          />
        </div>
      )}
    </EntityDetailShell>
  );
}
