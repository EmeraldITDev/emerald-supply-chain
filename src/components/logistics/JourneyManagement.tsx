import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  MapPin,
  Clock,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw,
  Eye,
  Flag,
  PlayCircle,
  StopCircle,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { journeysApi, tripsApi } from "@/services/logisticsApi";
import type {
  Journey,
  JourneyStatus,
  JourneyCheckpoint,
  JourneyIncident,
  Trip,
  JourneyFeedback,
} from "@/types/logistics";

const ALLOWED_TRANSITIONS: Record<JourneyStatus, JourneyStatus[]> = {
  not_started: ["departed"],
  departed: ["at_checkpoint", "en_route", "arrived"],
  at_checkpoint: ["en_route", "arrived"],
  en_route: ["arrived"],
  arrived: ["closed"],
  closed: [],
};
import { TripCommentsPanel } from "./TripCommentsPanel";
import { TripLogisticsDetailsPanel } from "./TripLogisticsDetailsPanel";
import { JCCDialog } from "./JCCDialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { exportToCSV } from "@/utils/exportData";
import { formatLagosDateTime, formatLagosTime } from "@/utils/dateUtils";

interface JourneyWithTrip extends Journey {
  linkedTrip?: Trip;
}

interface JourneyManagementProps {
  tripId?: string;
}

const statusColors: Record<JourneyStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  departed: "bg-info/10 text-info",
  en_route: "bg-primary/10 text-primary",
  at_checkpoint: "bg-warning/10 text-warning",
  arrived: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

const statusIcons: Record<JourneyStatus, React.ReactNode> = {
  not_started: <Circle className="h-4 w-4" />,
  departed: <PlayCircle className="h-4 w-4" />,
  en_route: <Navigation className="h-4 w-4" />,
  at_checkpoint: <Flag className="h-4 w-4" />,
  arrived: <CheckCircle2 className="h-4 w-4" />,
  closed: <StopCircle className="h-4 w-4" />,
};

const severityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/10 text-warning",
  high: "bg-destructive/10 text-destructive",
  critical: "bg-destructive text-destructive-foreground",
};

function formatJourneyStatus(status?: string | null): string {
  if (!status) return "unknown";
  return status.replace(/_/g, " ");
}

function journeyStatusKey(status?: string | null): JourneyStatus {
  if (status && status in statusColors) {
    return status as JourneyStatus;
  }
  return "not_started";
}

/**
 * Missing data is *not* an error — render a muted dash with an explanatory
 * tooltip rather than a red state.
 */
const MissingValue = () => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="text-muted-foreground italic cursor-help">Not provided</span>
    </TooltipTrigger>
    <TooltipContent>This information has not been provided yet.</TooltipContent>
  </Tooltip>
);

/** A journey is finished when it has arrived at destination or been closed. */
function isJourneyCompleted(status?: string | null): boolean {
  return status === "arrived" || status === "closed" || status === "completed";
}

type JourneyPassengerItem = {
  key: string;
  name: string;
  department?: string;
  email?: string;
  phone?: string;
  external?: boolean;
};

function getJourneyPassengerList(trip?: Trip | Journey | JourneyWithTrip): JourneyPassengerItem[] {
  if (!trip) return [];

  const root = trip as any;
  const linkedTrip = root.linkedTrip as any | undefined;
  const passengersSource = Array.isArray(root.passengers)
    ? root.passengers
    : Array.isArray(linkedTrip?.passengers)
    ? linkedTrip.passengers
    : [];

  const internalPassengers: JourneyPassengerItem[] = Array.isArray(passengersSource)
    ? passengersSource.map((p: any, index: number) => ({
        key: `int-${String(p.id ?? p.staffId ?? index)}`,
        name: (() => {
          const raw = p.name ?? p.fullName ?? p.full_name ?? p.user_name ?? p.email ?? null;
          return raw == null || String(raw).trim() === "" ? String(p.id ?? p.staffId ?? index) : String(raw);
        })(),
        department: (() => {
          const raw = p.department ?? p.department_name ?? p.departmentName ?? null;
          return raw == null ? undefined : String(raw);
        })(),
        email: (() => {
          const raw = p.email ?? p.email_address ?? p.emailAddress ?? null;
          return raw == null ? undefined : String(raw);
        })(),
        external: false,
      }))
    : [];

  const passengerUserIds = Array.isArray(root.passengerUserIds)
    ? root.passengerUserIds
    : Array.isArray(root.passenger_user_ids)
    ? root.passenger_user_ids
    : [];
  const includedUsers = Array.isArray(root.includedUsers)
    ? root.includedUsers
    : Array.isArray(root.included_users)
    ? root.included_users
    : Array.isArray(root.users)
    ? root.users
    : Array.isArray(linkedTrip?.includedUsers)
    ? linkedTrip.includedUsers
    : Array.isArray(linkedTrip?.included_users)
    ? linkedTrip.included_users
    : Array.isArray(linkedTrip?.users)
    ? linkedTrip.users
    : [];

  const userMatchesId = (item: any, userId: unknown): boolean => {
    if (!item || typeof item !== "object") return false;
    const idValues = [item.id, item.user_id, item.userId, item.staffId, item.staff_id];
    return idValues.some((candidate) => String(candidate) === String(userId));
  };

  const resolveUserById = (userId: unknown): any => {
    return (
      includedUsers.find((item: any) => userMatchesId(item, userId)) ??
      passengersSource.find((item: any) => userMatchesId(item, userId))
    );
  };

  const resolvedInternalFromIds = passengerUserIds.map((userId: unknown, index: number) => {
    const user = resolveUserById(userId);
    const nameRaw = user?.name ?? user?.fullName ?? user?.full_name ?? user?.displayName ?? user?.display_name ?? null;
    const name = nameRaw == null || String(nameRaw).trim() === "" ? String(userId) : String(nameRaw);
    const deptRaw = user?.department ?? user?.department_name ?? user?.departmentName ?? null;
    const department = deptRaw == null ? undefined : String(deptRaw);
    const emailRaw = user?.email ?? user?.email_address ?? user?.emailAddress ?? null;
    const email = emailRaw == null ? undefined : String(emailRaw);
    return {
      key: `int-id-${String(userId)}-${index}`,
      name,
      department,
      email,
      external: false,
    };
  });

  const externalPassengers = Array.isArray(root.externalPassengers)
    ? root.externalPassengers
    : Array.isArray(root.external_passengers)
    ? root.external_passengers
    : [];
  const resolvedExternalPassengers = externalPassengers.map((p: any, index: number) => ({
    key: `ext-${index}`,
    name: String(p.name ?? p.fullName ?? p.full_name ?? "—"),
    phone: String(p.phone ?? "") || undefined,
    email: String(p.email ?? "") || undefined,
    external: true,
  }));

  return [...internalPassengers, ...resolvedInternalFromIds, ...resolvedExternalPassengers].filter(
    (item) => Boolean(item.name),
  );
}

function getJourneyPassengerCount(trip?: Trip | Journey | JourneyWithTrip): number {
  return getJourneyPassengerList(trip).length;
}

function SummaryField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span>{value ?? <MissingValue />}</span>
    </div>
  );
}

/** Renders a value or the grey dash placeholder when it is genuinely absent. */
function fieldValue(value: unknown): React.ReactNode {
  if (value == null) return <MissingValue />;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "n/a") return <MissingValue />;
  return s;
}

export const JourneyManagement = ({ tripId }: JourneyManagementProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [journeys, setJourneys] = useState<JourneyWithTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [selectedJourney, setSelectedJourney] = useState<JourneyWithTrip | null>(null);
  
  // Form states
  const [updateStatus, setUpdateStatus] = useState<JourneyStatus>("not_started");
  const [currentLocation, setCurrentLocation] = useState("");
  const [checkpointNotes, setCheckpointNotes] = useState("");
  const [incidentType, setIncidentType] = useState<string>("delay");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<string>("low");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<JourneyFeedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [jccOpen, setJccOpen] = useState(false);
  const [jccTrip, setJccTrip] = useState<Trip | null>(null);

  // Passenger feedback for the journey currently open in the detail dialog.
  useEffect(() => {
    if (!viewDialogOpen || !selectedJourney?.id) {
      setFeedback([]);
      return;
    }
    let cancelled = false;
    setFeedbackLoading(true);
    void (async () => {
      const res = await journeysApi.listFeedback(selectedJourney.id);
      if (cancelled) return;
      setFeedback(res.success && Array.isArray(res.data) ? res.data : []);
      setFeedbackLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewDialogOpen, selectedJourney?.id]);

  /**
   * Commit a freshly fetched journey list AND re-sync the record currently open
   * in the detail dialog. Without this the dialog kept rendering the stale
   * snapshot captured when it was opened, so checkpoints/status never appeared.
   */
  const applyJourneys = (next: JourneyWithTrip[]) => {
    setJourneys(next);
    setSelectedJourney((current) => {
      if (!current) return current;
      const fresh = next.find((j) => String(j.id) === String(current.id));
      return fresh ? { ...current, ...fresh } : current;
    });
  };

  // Fetch journeys from API — tied to the same trip records created at request/approval
  const fetchJourneys = async () => {
    setLoading(true);
    try {
      if (tripId) {
        const [journeyRes, tripRes] = await Promise.all([
          journeysApi.getByTripId(tripId),
          tripsApi.getById(tripId),
        ]);
        if (journeyRes.success && journeyRes.data) {
          applyJourneys([
            {
              ...journeyRes.data,
              linkedTrip: tripRes.success ? tripRes.data : undefined,
            },
          ]);
        } else if (tripRes.success && tripRes.data) {
          applyJourneys([
            {
              id: tripId,
              tripId,
              tripNumber: tripRes.data.tripNumber,
              status: tripRes.data.status === "in_progress" ? "en_route" : "not_started",
              checkpoints: [],
              incidents: [],
              linkedTrip: tripRes.data,
            } as JourneyWithTrip,
          ]);
        } else {
          applyJourneys([]);
        }
        return;
      }

      const listRes = await journeysApi.list();
      if (listRes.success && listRes.data && listRes.data.length > 0) {
        const journeysWithTrips = await Promise.all(
          listRes.data.map(async (j) => {
            if (j.tripId) {
              const tripRes = await tripsApi.getById(String(j.tripId));
              return { ...j, linkedTrip: tripRes.success ? tripRes.data : undefined } as JourneyWithTrip;
            }
            return j as JourneyWithTrip;
          }),
        );
        applyJourneys(journeysWithTrips);
        return;
      }

      const tripsRes = await tripsApi.getAll();
      if (tripsRes.success && tripsRes.data) {
        const trackable = tripsRes.data.filter((t) =>
          ["scheduled", "vendor_assigned", "in_progress", "approved", "completed"].includes(
            t.status,
          ),
        );
        const withJourneys = await Promise.all(
          trackable.map(async (trip) => {
            const jRes = await journeysApi.getByTripId(String(trip.id));
            if (jRes.success && jRes.data) {
              return { ...jRes.data, linkedTrip: trip } as JourneyWithTrip;
            }
            return {
              id: String(trip.id),
              tripId: String(trip.id),
              tripNumber: trip.tripNumber,
              status:
                trip.status === "in_progress"
                  ? ("en_route" as JourneyStatus)
                  : trip.status === "completed"
                    ? ("arrived" as JourneyStatus)
                    : ("not_started" as JourneyStatus),
              checkpoints: [],
              incidents: [],
              linkedTrip: trip,
            } as JourneyWithTrip;
          }),
        );
        applyJourneys(withJourneys);
      } else {
        applyJourneys([]);
      }
    } catch (error) {
      console.error("Failed to fetch journeys:", error);
      applyJourneys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJourneys();
  }, [tripId, statusFilter]);

  const handleUpdateStatus = async () => {
    if (!selectedJourney || !updateStatus) return;

    setIsSubmitting(true);
    try {
      const response = await journeysApi.updateStatus(
        selectedJourney.id,
        updateStatus,
        currentLocation || undefined,
        new Date().toISOString()
      );
      
      if (response.success) {
        toast({
          title: "Journey Updated",
          description: `Status updated to ${updateStatus.replace("_", " ")}`,
        });
        setUpdateDialogOpen(false);
        if (response.data) {
          const updated = response.data as JourneyWithTrip;
          setSelectedJourney((cur) => (cur ? { ...cur, ...updated } : cur));
        }
        await fetchJourneys();
      } else {
        toast({
          title: "Failed to Update Journey",
          description: response.error || "Unable to update journey. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update journey",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setCurrentLocation("");
    }
  };

  const handleAddCheckpoint = async () => {
    if (!selectedJourney || !currentLocation) return;

    setIsSubmitting(true);
    try {
      const response = await journeysApi.addCheckpoint(selectedJourney.id, {
        location: currentLocation,
        notes: checkpointNotes || undefined,
        timestamp: new Date().toISOString(),
      });
      
      if (response.success) {
        toast({
          title: "Checkpoint Added",
          description: `Checkpoint at ${currentLocation} recorded`,
        });
        if (response.data) {
          const updated = response.data as JourneyWithTrip;
          setSelectedJourney((cur) => (cur ? { ...cur, ...updated } : cur));
        }
        await fetchJourneys();
      } else {
        toast({
          title: "Failed to Add Checkpoint",
          description: response.error || "Unable to add checkpoint. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add checkpoint",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setCurrentLocation("");
      setCheckpointNotes("");
    }
  };

  const handleReportIncident = async () => {
    if (!selectedJourney || !incidentDescription) return;

    setIsSubmitting(true);
    try {
      const response = await journeysApi.reportIncident(selectedJourney.id, {
        type: incidentType,
        description: incidentDescription,
        location: currentLocation || undefined,
        severity: incidentSeverity,
      });
      
      if (response.success) {
        toast({
          title: "Incident Reported",
          description: "The incident has been logged and relevant parties notified",
        });
        setIncidentDialogOpen(false);
        if (response.data) {
          const updated = response.data as JourneyWithTrip;
          setSelectedJourney((cur) => (cur ? { ...cur, ...updated } : cur));
        }
        await fetchJourneys();
      } else {
        toast({
          title: "Failed to Report Incident",
          description: response.error || "Unable to report incident. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to report incident",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIncidentType("delay");
      setIncidentDescription("");
      setIncidentSeverity("low");
      setCurrentLocation("");
    }
  };

  const getJourneyProgress = (journey: Journey): number => {
    const statusProgress: Record<JourneyStatus, number> = {
      not_started: 0,
      departed: 25,
      en_route: 50,
      at_checkpoint: 65,
      arrived: 100,
      closed: 100,
    };
    return statusProgress[journey.status] || 0;
  };

  const filteredJourneys = journeys.filter(journey => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (journey.tripNumber || '').toLowerCase().includes(q) ||
      (journey.currentLocation || '').toLowerCase().includes(q) ||
      ((journey.destination ?? journey.linkedTrip?.destination) || '').toLowerCase().includes(q) ||
      ((journey.driverName ?? journey.linkedTrip?.driverName) || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || journey.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Journey Management</h2>
          <p className="text-sm text-muted-foreground">
            Track real-time journey progress and updates
          </p>
        </div>
        <Button variant="outline" onClick={fetchJourneys}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search journeys..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="departed">Departed</SelectItem>
                <SelectItem value="en_route">En Route</SelectItem>
                <SelectItem value="at_checkpoint">At Checkpoint</SelectItem>
                <SelectItem value="arrived">Arrived</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Journeys List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Journeys</CardTitle>
          <CardDescription>
            {filteredJourneys.length} journey(s) being tracked
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredJourneys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No journeys found</p>
              <p className="text-sm">Journeys will appear when trips are in progress</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJourneys.map((journey) => (
                <div key={journey.id} className="border rounded-lg p-4 space-y-4">
                  {/* Journey Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{journey.tripNumber || journey.linkedTrip?.tripNumber}</span>
                        <Badge className={cn(statusColors[journeyStatusKey(journey.status)], "capitalize")}>
                          {statusIcons[journeyStatusKey(journey.status)]}
                          <span className="ml-1">{formatJourneyStatus(journey.status)}</span>
                        </Badge>
                        {journey.incidents && journey.incidents.length > 0 && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {journey.incidents.length} Incident(s)
                          </Badge>
                        )}
                      </div>
                      {journey.currentLocation && (
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Current: {journey.currentLocation}
                        </p>
                      )}
                      {((journey.origin ?? journey.destination ?? journey.purpose ?? journey.vehiclePlate ?? journey.vehicleMake ?? journey.vehicleType) || journey.linkedTrip) && (
                    <div className="grid gap-1 text-xs text-muted-foreground mt-2">
                      <p>
                        <span className="font-medium">Route:</span> {(journey.origin ?? journey.linkedTrip?.origin) ?? <MissingValue />} → {(journey.destination ?? journey.linkedTrip?.destination) ?? <MissingValue />}
                      </p>
                      <p>
                        <span className="font-medium">Purpose:</span> {(journey.purpose ?? journey.linkedTrip?.purpose) ?? <MissingValue />}
                      </p>
                      <p>
                        <span className="font-medium">Departure:</span> {(journey.scheduledDepartureAt ?? journey.linkedTrip?.scheduledDepartureAt) ? formatLagosDateTime(journey.scheduledDepartureAt ?? journey.linkedTrip?.scheduledDepartureAt) : <MissingValue />}
                      </p>
                      <p>
                        <span className="font-medium">Driver:</span> {(journey.driverName ?? journey.linkedTrip?.driverName) ?? <MissingValue />}
                      </p>
                      <p>
                        <span className="font-medium">Vehicle:</span> {(journey.vehiclePlate ?? journey.linkedTrip?.vehiclePlate ?? journey.vehicleMake ?? journey.linkedTrip?.vehicleMake ?? journey.vehicleType ?? journey.linkedTrip?.vehicleType) ?? <MissingValue />}
                      </p>
                      <p>
                        <span className="font-medium">Passengers:</span> {getJourneyPassengerCount(journey)}
                      </p>
                    </div>
                  )}
                    </div>
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedJourney(journey);
                            setViewDialogOpen(true);
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {journey.linkedTrip && (
                            <DropdownMenuItem
                              onClick={() => navigate(`/logistics?tab=trips&trip=${journey.linkedTrip!.id}`)}
                            >
                              <Navigation className="mr-2 h-4 w-4" />
                              Open trip record
                            </DropdownMenuItem>
                          )}
                          {journey.status !== "arrived" && journey.status !== "closed" && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                setSelectedJourney(journey);
                                const nextStatuses = ALLOWED_TRANSITIONS[journey.status] ?? [];
                                setUpdateStatus(nextStatuses[0] ?? journey.status);
                                setUpdateDialogOpen(true);
                              }}>
                                <Navigation className="mr-2 h-4 w-4" />
                                Update Status
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedJourney(journey);
                                setIncidentDialogOpen(true);
                              }}>
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Report Incident
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{getJourneyProgress(journey)}%</span>
                    </div>
                    <Progress value={getJourneyProgress(journey)} className="h-2" />
                  </div>

                  {/* Timeline */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {journey.departedAt
                          ? `Departed: ${formatLagosTime(journey.departedAt)}`
                          : "Not departed yet"}
                      </span>
                    </div>
                    {journey.arrivedAt && (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        <span className="text-success">
                          Arrived: {formatLagosTime(journey.arrivedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Checkpoints Preview */}
                  {(journey.checkpoints?.length ?? 0) > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">
                        Checkpoints ({journey.checkpoints?.length ?? 0})
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {(journey.checkpoints ?? []).map((cp, idx) => (
                          <Badge key={cp.id} variant="outline" className="shrink-0">
                            <Flag className="h-3 w-3 mr-1" />
                            {idx + 1}. {cp.location}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Journey Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Journey Details - {selectedJourney?.tripNumber ?? selectedJourney?.linkedTrip?.tripNumber}</DialogTitle>
          </DialogHeader>
          {selectedJourney && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      Journey Details — {selectedJourney.tripNumber}
                    </p>
                    {selectedJourney.linkedTrip?.tripNumber && (
                      <p className="text-xs text-muted-foreground">
                        Trip code: {selectedJourney.linkedTrip?.tripNumber ?? selectedJourney.tripNumber}
                      </p>
                    )}
                  </div>
                  <Badge className={cn(statusColors[journeyStatusKey(selectedJourney.status)], "capitalize")}>
                    {statusIcons[journeyStatusKey(selectedJourney.status)]}
                    <span className="ml-1">{formatJourneyStatus(selectedJourney.status)}</span>
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm">{getJourneyProgress(selectedJourney)}% Complete</span>
                  <Progress value={getJourneyProgress(selectedJourney)} className="h-2 flex-1" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-3">
                  <p className="text-sm font-semibold">Trip Summary</p>
                  <SummaryField label="Origin" value={fieldValue(selectedJourney.origin ?? selectedJourney.linkedTrip?.origin)} />
                  <SummaryField label="Destination" value={fieldValue(selectedJourney.destination ?? selectedJourney.linkedTrip?.destination)} />
                  <SummaryField label="Purpose" value={fieldValue(selectedJourney.purpose ?? selectedJourney.linkedTrip?.purpose)} />
                  <SummaryField
                    label="Scheduled Departure"
                    value={(selectedJourney.scheduledDepartureAt ?? selectedJourney.linkedTrip?.scheduledDepartureAt) ? formatLagosDateTime(selectedJourney.scheduledDepartureAt ?? selectedJourney.linkedTrip?.scheduledDepartureAt) : <MissingValue />}
                  />
                  <SummaryField
                    label="Scheduled Arrival"
                    value={(selectedJourney.scheduledArrivalAt ?? selectedJourney.linkedTrip?.scheduledArrivalAt) ? formatLagosDateTime(selectedJourney.scheduledArrivalAt ?? selectedJourney.linkedTrip?.scheduledArrivalAt) : <MissingValue />}
                  />
                  <SummaryField
                    label="Booking Scope"
                    value={fieldValue(selectedJourney.bookingScope ?? selectedJourney.linkedTrip?.bookingScope ?? (selectedJourney.linkedTrip as any)?.booking_scope)}
                  />
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-3">
                  <p className="text-sm font-semibold">Vehicle & Driver</p>
                  <SummaryField label="Plate" value={fieldValue(selectedJourney.vehiclePlate ?? selectedJourney.linkedTrip?.vehiclePlate)} />
                  <SummaryField label="Make" value={fieldValue(selectedJourney.vehicleMake ?? selectedJourney.linkedTrip?.vehicleMake ?? selectedJourney.linkedTrip?.vehicle_make)} />
                  <SummaryField label="Model" value={fieldValue(selectedJourney.vehicleModel ?? selectedJourney.linkedTrip?.vehicleModel ?? selectedJourney.linkedTrip?.vehicle_model)} />
                  <SummaryField label="Type" value={fieldValue(selectedJourney.vehicleType ?? selectedJourney.linkedTrip?.vehicleType ?? selectedJourney.linkedTrip?.vehicle_type)} />
                  <SummaryField label="Driver" value={fieldValue(selectedJourney.driverName ?? selectedJourney.linkedTrip?.driverName)} />
                  <SummaryField label="Phone" value={fieldValue(selectedJourney.driverPhone ?? selectedJourney.linkedTrip?.driverPhone)} />
                  <SummaryField
                    label="Source"
                    value={(selectedJourney.driverName ?? selectedJourney.linkedTrip?.driverName) ? (
                      <Badge variant="outline" className="capitalize">
                        {selectedJourney.driverType ?? (selectedJourney.linkedTrip as any).driverType ?? (selectedJourney.linkedTrip as any).driver_source ?? (selectedJourney.linkedTrip?.driverId ? "internal" : "external")}
                      </Badge>
                    ) : (
                      <MissingValue />
                    )}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold">Passengers</p>
                {getJourneyPassengerList(selectedJourney).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No passengers assigned yet.</p>
                ) : (
                  <div className="space-y-2">
                    {getJourneyPassengerList(selectedJourney).map((p) => (
                      <div key={p.key} className="flex flex-wrap items-center gap-2 rounded border border-border/40 bg-muted/30 px-3 py-2 text-sm">
                        <span className="font-medium">{p.name}</span>
                        {p.external ? (
                          <Badge variant="outline" className="text-[10px]">
                            External
                          </Badge>
                        ) : (
                          p.department ? (
                            <span className="text-xs text-muted-foreground">{p.department}</span>
                          ) : null
                        )}
                        {p.phone ? <span className="text-xs text-muted-foreground">{p.phone}</span> : null}
                        {p.email ? <span className="text-xs text-muted-foreground">{p.email}</span> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-3">
                  <p className="text-sm font-semibold">Accommodation</p>
                  <SummaryField
                    label="Required"
                    value={fieldValue((selectedJourney.accommodationRequired ?? selectedJourney.linkedTrip?.accommodationRequired ?? (selectedJourney.linkedTrip as any)?.accommodation_required) ? "Yes" : "No")}
                  />
                  <SummaryField
                    label="Hotel"
                    value={fieldValue(selectedJourney.accommodationName ?? selectedJourney.linkedTrip?.accommodationName ?? (selectedJourney.linkedTrip as any)?.accommodation_name)}
                  />
                  <SummaryField
                    label="Address"
                    value={fieldValue(selectedJourney.accommodationAddress ?? selectedJourney.linkedTrip?.accommodationAddress ?? (selectedJourney.linkedTrip as any)?.accommodation_address)}
                  />
                  <SummaryField
                    label="Contact"
                    value={fieldValue(selectedJourney.accommodationContact ?? selectedJourney.linkedTrip?.accommodationContact ?? (selectedJourney.linkedTrip as any)?.accommodation_contact)}
                  />
                  <SummaryField
                    label="Estimated Cost"
                    value={fieldValue((selectedJourney.accommodationEstimatedCost ?? selectedJourney.linkedTrip?.accommodationEstimatedCost ?? (selectedJourney.linkedTrip as any)?.accommodation_estimated_cost) ?? null)}
                  />
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-3">
                  <p className="text-sm font-semibold">Escort / Security</p>
                  <SummaryField
                    label="Required"
                    value={fieldValue((selectedJourney.escortRequired ?? selectedJourney.linkedTrip?.escortRequired ?? (selectedJourney.linkedTrip as any)?.escort_required) ? "Yes" : "No")}
                  />
                  <SummaryField
                    label="Details"
                    value={fieldValue(selectedJourney.escortDescription ?? selectedJourney.linkedTrip?.escortDescription ?? (selectedJourney.linkedTrip as any)?.escort_description)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Departed</Label>
                  <p className="font-medium">
                    {selectedJourney.departedAt
                      ? formatLagosDateTime(selectedJourney.departedAt)
                      : "Not yet"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Arrived</Label>
                  <p className="font-medium">
                    {selectedJourney.arrivedAt
                      ? formatLagosDateTime(selectedJourney.arrivedAt)
                      : "In progress"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Current Location</Label>
                  <p className="font-medium">
                    {fieldValue(selectedJourney.currentLocation)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Updated</Label>
                  <p className="font-medium">
                    {selectedJourney.lastUpdatedAt
                      ? formatLagosDateTime(selectedJourney.lastUpdatedAt)
                      : <MissingValue />}
                  </p>
                </div>
              </div>

              {/* Linked trip context */}
              {(selectedJourney.linkedTrip || selectedJourney.origin || selectedJourney.destination || selectedJourney.driverName || selectedJourney.vehiclePlate || selectedJourney.vehicleType) && (
                <div className="rounded-lg border p-4 space-y-2 bg-muted/20">
                  <p className="text-sm font-medium">Trip assignment</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Route</Label>
                      <p className="flex items-center gap-1">
                        {fieldValue(selectedJourney.origin ?? selectedJourney.linkedTrip?.origin)} →{" "}
                        {fieldValue(selectedJourney.destination ?? selectedJourney.linkedTrip?.destination)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p className="capitalize">
                        {formatJourneyStatus(selectedJourney.status)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Driver</Label>
                      <p>{fieldValue(selectedJourney.driverName ?? selectedJourney.linkedTrip?.driverName)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Vehicle</Label>
                      <p>
                        {fieldValue(
                          selectedJourney.vehiclePlate ?? selectedJourney.linkedTrip?.vehiclePlate ??
                            selectedJourney.vehicleType ?? selectedJourney.linkedTrip?.vehicleType,
                        )}
                      </p>
                    </div>
                  </div>
                  {getJourneyPassengerList(selectedJourney).length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Passengers</Label>
                        <p className="text-sm">
                          {getJourneyPassengerList(selectedJourney)
                            .map((p) => p.name)
                            .join(", ")}
                        </p>
                      </div>
                    )}
                </div>
              )}

              <TripCommentsPanel
                logisticsTripId={
                  selectedJourney.linkedTrip
                    ? String(selectedJourney.linkedTrip.id)
                    : selectedJourney.tripId
                      ? String(selectedJourney.tripId)
                      : null
                }
              />

              {/* Checkpoints */}
              {(selectedJourney.checkpoints?.length ?? 0) > 0 && (
                <div>
                  <Label className="text-muted-foreground">Checkpoints</Label>
                  <div className="mt-2 space-y-2">
                    {(selectedJourney.checkpoints ?? []).map((cp, idx) => (
                      <div key={cp.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{cp.location}</p>
                          <p className="text-xs text-muted-foreground">
                            Arrived: {formatLagosDateTime(cp.arrivedAt)}
                            {cp.departedAt && ` • Left: ${formatLagosTime(cp.departedAt)}`}
                          </p>
                          {cp.notes && <p className="text-sm mt-1">{cp.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Incidents */}
              {selectedJourney.incidents && selectedJourney.incidents.length > 0 && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Incidents
                  </Label>
                  <div className="mt-2 space-y-2">
                    {selectedJourney.incidents.map((incident) => (
                      <div key={incident.id} className="p-3 border border-destructive/20 bg-destructive/5 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge className={cn(severityColors[incident.severity], "capitalize")}>
                            {incident.severity}
                          </Badge>
                          <span className="font-medium capitalize">{incident.type}</span>
                        </div>
                        <p className="text-sm mt-1">{incident.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Reported: {formatLagosDateTime(incident.reportedAt)}
                          {incident.location && ` • Location: ${incident.location}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Passenger feedback */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-muted-foreground">Passenger feedback</Label>
                  {feedback.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        exportToCSV(
                          feedback.map((f) => ({
                            passenger: f.passengerName ?? f.passenger_name ?? "",
                            rating: f.rating ?? "",
                            status: String(f.status ?? "").replace(/_/g, " "),
                            comments: f.comments ?? "",
                            submitted_at: f.createdAt ?? f.created_at ?? "",
                          })),
                          `journey-${selectedJourney.id}-feedback`,
                        )
                      }
                    >
                      Export CSV
                    </Button>
                  )}
                </div>
                {feedbackLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : feedback.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No passenger feedback submitted yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {feedback.map((f, i) => (
                      <div key={f.id ?? i} className="rounded-lg border p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {fieldValue(f.passengerName ?? f.passenger_name)}
                          </span>
                          <span className="text-muted-foreground capitalize">
                            {f.rating != null ? `${f.rating}/5` : "—"}
                            {f.status ? ` · ${String(f.status).replace(/_/g, " ")}` : ""}
                          </span>
                        </div>
                        {f.comments && <p className="mt-1">{f.comments}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Metrics */}
              {(selectedJourney.totalDistance || selectedJourney.totalDuration) && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-muted-foreground">Total Distance</Label>
                    <p className="font-medium">
                      {selectedJourney.totalDistance ? `${selectedJourney.totalDistance} km` : <MissingValue />}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Total Duration</Label>
                    <p className="font-medium">{fieldValue(selectedJourney.totalDuration)}</p>
                  </div>
                </div>
              )}

              {/* Completion actions — JCC + jump to the linked trip record */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {selectedJourney.linkedTrip && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewDialogOpen(false);
                      navigate(`/logistics?tab=trips&trip=${selectedJourney.linkedTrip!.id}`);
                    }}
                  >
                    <Navigation className="mr-2 h-4 w-4" />
                    Open trip record
                  </Button>
                )}
                {isJourneyCompleted(selectedJourney.status) && selectedJourney.linkedTrip && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setJccTrip(selectedJourney.linkedTrip as Trip);
                      setJccOpen(true);
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Generate JCC
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Journey Status</DialogTitle>
            <DialogDescription>
              Update the status and location for {selectedJourney?.tripNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select
                value={updateStatus}
                onValueChange={(v) => setUpdateStatus(v as JourneyStatus)}
                disabled={
                  !selectedJourney ||
                  (ALLOWED_TRANSITIONS[selectedJourney.status] ?? []).length === 0
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedJourney && (ALLOWED_TRANSITIONS[selectedJourney.status] ?? []).length > 0 ? (
                    (ALLOWED_TRANSITIONS[selectedJourney.status] ?? []).map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatJourneyStatus(status)}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={selectedJourney?.status ?? "not_started"} disabled>
                      No further transitions available.
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Current Location</Label>
              <Input
                placeholder="Enter current location"
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
              />
            </div>
            {updateStatus === "at_checkpoint" && (
              <div className="space-y-2">
                <Label>Checkpoint Notes</Label>
                <Textarea
                  placeholder="Any notes about this checkpoint"
                  value={checkpointNotes}
                  onChange={(e) => setCheckpointNotes(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={updateStatus === "at_checkpoint" ? handleAddCheckpoint : handleUpdateStatus}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Incident Dialog */}
      <Dialog open={incidentDialogOpen} onOpenChange={setIncidentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Incident</DialogTitle>
            <DialogDescription>
              Report an incident for {selectedJourney?.tripNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Incident Type</Label>
                <Select value={incidentType} onValueChange={setIncidentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delay">Delay</SelectItem>
                    <SelectItem value="breakdown">Vehicle Breakdown</SelectItem>
                    <SelectItem value="accident">Accident</SelectItem>
                    <SelectItem value="weather">Weather Issue</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                placeholder="Where did this occur?"
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Describe the incident in detail"
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncidentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReportIncident}
              disabled={!incidentDescription || isSubmitting}
              variant="destructive"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Report Incident
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default JourneyManagement;
