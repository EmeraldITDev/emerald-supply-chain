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
import { TripCommentsPanel } from "./TripCommentsPanel";
import { TripLogisticsDetailsPanel } from "./TripLogisticsDetailsPanel";
import { useNavigate } from "react-router-dom";
import { exportToCSV } from "@/utils/exportData";

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
      <span className="text-muted-foreground cursor-help">—</span>
    </TooltipTrigger>
    <TooltipContent>This information has not been provided yet.</TooltipContent>
  </Tooltip>
);

type JourneyPassengerItem = {
  key: string;
  name: string;
  department?: string;
  email?: string;
  phone?: string;
  external?: boolean;
};

function getJourneyPassengerList(trip?: Trip): JourneyPassengerItem[] {
  if (!trip) return [];

  const internalPassengers: JourneyPassengerItem[] = Array.isArray((trip as any).passengers)
    ? (trip as any).passengers.map((p: any, index: number) => ({
        key: `int-${String(p.id ?? p.staffId ?? index)}`,
        name: String(p.name ?? p.fullName ?? p.full_name ?? p.user_name ?? p.email ?? "—"),
        department: String(p.department ?? p.department_name ?? p.departmentName ?? "") || undefined,
        email: String(p.email ?? p.email_address ?? p.emailAddress ?? "") || undefined,
        external: false,
      }))
    : [];

  const passengerUserIds = Array.isArray((trip as any).passengerUserIds)
    ? (trip as any).passengerUserIds
    : Array.isArray((trip as any).passenger_user_ids)
    ? (trip as any).passenger_user_ids
    : [];
  const includedUsers = Array.isArray((trip as any).includedUsers)
    ? (trip as any).includedUsers
    : Array.isArray((trip as any).included_users)
    ? (trip as any).included_users
    : Array.isArray((trip as any).users)
    ? (trip as any).users
    : [];

  const resolvedInternalFromIds = passengerUserIds.map((userId: unknown, index: number) => {
    const user = includedUsers.find(
      (item: any) => String(item.id ?? item.user_id ?? item.userId) === String(userId),
    );
    return {
      key: `int-id-${String(userId)}-${index}`,
      name:
        String(
          user?.name ?? user?.fullName ?? user?.full_name ?? user?.displayName ?? user?.display_name ?? userId,
        ) || String(userId),
      department:
        String(user?.department ?? user?.department_name ?? user?.departmentName ?? "") || undefined,
      email:
        String(user?.email ?? user?.email_address ?? user?.emailAddress ?? "") || undefined,
      external: false,
    };
  });

  const externalPassengers = Array.isArray((trip as any).externalPassengers)
    ? (trip as any).externalPassengers
    : Array.isArray((trip as any).external_passengers)
    ? (trip as any).external_passengers
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

function getJourneyPassengerCount(trip?: Trip): number {
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
  const [updateStatus, setUpdateStatus] = useState<JourneyStatus>("en_route");
  const [currentLocation, setCurrentLocation] = useState("");
  const [checkpointNotes, setCheckpointNotes] = useState("");
  const [incidentType, setIncidentType] = useState<string>("delay");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<string>("low");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<JourneyFeedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

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
          setJourneys([
            {
              ...journeyRes.data,
              linkedTrip: tripRes.success ? tripRes.data : undefined,
            },
          ]);
        } else if (tripRes.success && tripRes.data) {
          setJourneys([
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
          setJourneys([]);
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
        setJourneys(journeysWithTrips);
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
        setJourneys(withJourneys);
      } else {
        setJourneys([]);
      }
    } catch (error) {
      console.error("Failed to fetch journeys:", error);
      setJourneys([]);
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
        currentLocation || undefined
      );
      
      if (response.success) {
        toast({
          title: "Journey Updated",
          description: `Status updated to ${updateStatus.replace("_", " ")}`,
        });
        setUpdateDialogOpen(false);
        fetchJourneys();
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
      });
      
      if (response.success) {
        toast({
          title: "Checkpoint Added",
          description: `Checkpoint at ${currentLocation} recorded`,
        });
        fetchJourneys();
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
        fetchJourneys();
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
    const trip = journey.linkedTrip;
    const matchesSearch =
      (journey.tripNumber || '').toLowerCase().includes(q) ||
      (journey.currentLocation || '').toLowerCase().includes(q) ||
      (trip?.destination || '').toLowerCase().includes(q) ||
      (trip?.driverName || '').toLowerCase().includes(q);
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
                        <span className="font-mono text-sm">{journey.tripNumber}</span>
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
                      {journey.linkedTrip && (
                    <div className="grid gap-1 text-xs text-muted-foreground mt-2">
                      <p>
                        <span className="font-medium">Route:</span> {journey.linkedTrip.origin ?? <MissingValue />} → {journey.linkedTrip.destination ?? <MissingValue />}
                      </p>
                      <p>
                        <span className="font-medium">Purpose:</span> {journey.linkedTrip.purpose ?? <MissingValue />}
                      </p>
                      <p>
                        <span className="font-medium">Departure:</span> {journey.linkedTrip.scheduledDepartureAt ? new Date(journey.linkedTrip.scheduledDepartureAt).toLocaleString() : <MissingValue />}
                      </p>
                      <p>
                        <span className="font-medium">Driver:</span> {journey.linkedTrip.driverName ?? <MissingValue />}
                      </p>
                      <p>
                        <span className="font-medium">Vehicle:</span> {journey.linkedTrip.vehiclePlate ?? journey.linkedTrip.vehicleMake ?? journey.linkedTrip.vehicleType ?? <MissingValue />}
                      </p>
                      <p>
                        <span className="font-medium">Passengers:</span> {getJourneyPassengerCount(journey.linkedTrip)}
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
                              onClick={() => navigate(`/trips/${journey.linkedTrip!.id}`)}
                            >
                              <Navigation className="mr-2 h-4 w-4" />
                              Open trip record
                            </DropdownMenuItem>
                          )}
                          {journey.status !== "arrived" && journey.status !== "closed" && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                setSelectedJourney(journey);
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
                          ? `Departed: ${new Date(journey.departedAt).toLocaleTimeString()}`
                          : "Not departed yet"}
                      </span>
                    </div>
                    {journey.arrivedAt && (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        <span className="text-success">
                          Arrived: {new Date(journey.arrivedAt).toLocaleTimeString()}
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
            <DialogTitle>Journey Details - {selectedJourney?.tripNumber}</DialogTitle>
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
                        Trip code: {selectedJourney.linkedTrip.tripNumber}
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
                  <SummaryField label="Origin" value={fieldValue(selectedJourney.linkedTrip?.origin)} />
                  <SummaryField label="Destination" value={fieldValue(selectedJourney.linkedTrip?.destination)} />
                  <SummaryField label="Purpose" value={fieldValue(selectedJourney.linkedTrip?.purpose)} />
                  <SummaryField
                    label="Scheduled Departure"
                    value={selectedJourney.linkedTrip?.scheduledDepartureAt ? new Date(selectedJourney.linkedTrip.scheduledDepartureAt).toLocaleString() : <MissingValue />}
                  />
                  <SummaryField
                    label="Scheduled Arrival"
                    value={selectedJourney.linkedTrip?.scheduledArrivalAt ? new Date(selectedJourney.linkedTrip.scheduledArrivalAt).toLocaleString() : <MissingValue />}
                  />
                  <SummaryField
                    label="Booking Scope"
                    value={fieldValue(selectedJourney.linkedTrip?.bookingScope ?? (selectedJourney.linkedTrip as any)?.booking_scope)}
                  />
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-3">
                  <p className="text-sm font-semibold">Vehicle & Driver</p>
                  <SummaryField label="Plate" value={fieldValue(selectedJourney.linkedTrip?.vehiclePlate)} />
                  <SummaryField label="Make" value={fieldValue(selectedJourney.linkedTrip?.vehicleMake ?? (selectedJourney.linkedTrip as any)?.vehicle_make)} />
                  <SummaryField label="Model" value={fieldValue(selectedJourney.linkedTrip?.vehicleModel ?? (selectedJourney.linkedTrip as any)?.vehicle_model)} />
                  <SummaryField label="Type" value={fieldValue(selectedJourney.linkedTrip?.vehicleType ?? (selectedJourney.linkedTrip as any)?.vehicle_type)} />
                  <SummaryField label="Driver" value={fieldValue(selectedJourney.linkedTrip?.driverName)} />
                  <SummaryField label="Phone" value={fieldValue(selectedJourney.linkedTrip?.driverPhone)} />
                  <SummaryField
                    label="Source"
                    value={selectedJourney.linkedTrip?.driverName ? (
                      <Badge variant="outline" className="capitalize">
                        {(selectedJourney.linkedTrip as any).driverType ?? (selectedJourney.linkedTrip as any).driver_source ?? (selectedJourney.linkedTrip?.driverId ? "internal" : "external")}
                      </Badge>
                    ) : (
                      <MissingValue />
                    )}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold">Passengers</p>
                {getJourneyPassengerList(selectedJourney.linkedTrip).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No passengers assigned yet.</p>
                ) : (
                  <div className="space-y-2">
                    {getJourneyPassengerList(selectedJourney.linkedTrip).map((p) => (
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
                    value={fieldValue(selectedJourney.linkedTrip?.accommodationRequired ?? (selectedJourney.linkedTrip as any)?.accommodation_required ? "Yes" : "No")}
                  />
                  <SummaryField
                    label="Hotel"
                    value={fieldValue(selectedJourney.linkedTrip?.accommodationName ?? (selectedJourney.linkedTrip as any)?.accommodation_name)}
                  />
                  <SummaryField
                    label="Address"
                    value={fieldValue(selectedJourney.linkedTrip?.accommodationAddress ?? (selectedJourney.linkedTrip as any)?.accommodation_address)}
                  />
                  <SummaryField
                    label="Contact"
                    value={fieldValue(selectedJourney.linkedTrip?.accommodationContact ?? (selectedJourney.linkedTrip as any)?.accommodation_contact)}
                  />
                  <SummaryField
                    label="Estimated Cost"
                    value={fieldValue((selectedJourney.linkedTrip?.accommodationEstimatedCost ?? (selectedJourney.linkedTrip as any)?.accommodation_estimated_cost) ?? null)}
                  />
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-3">
                  <p className="text-sm font-semibold">Escort / Security</p>
                  <SummaryField
                    label="Required"
                    value={fieldValue(selectedJourney.linkedTrip?.escortRequired ?? (selectedJourney.linkedTrip as any)?.escort_required ? "Yes" : "No")}
                  />
                  <SummaryField
                    label="Details"
                    value={fieldValue(selectedJourney.linkedTrip?.escortDescription ?? (selectedJourney.linkedTrip as any)?.escort_description)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Departed</Label>
                  <p className="font-medium">
                    {selectedJourney.departedAt
                      ? new Date(selectedJourney.departedAt).toLocaleString()
                      : "Not yet"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Arrived</Label>
                  <p className="font-medium">
                    {selectedJourney.arrivedAt
                      ? new Date(selectedJourney.arrivedAt).toLocaleString()
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
                      ? new Date(selectedJourney.lastUpdatedAt).toLocaleString()
                      : <MissingValue />}
                  </p>
                </div>
              </div>

              {/* Linked trip context */}
              {selectedJourney.linkedTrip && (
                <div className="rounded-lg border p-4 space-y-2 bg-muted/20">
                  <p className="text-sm font-medium">Trip assignment</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Route</Label>
                      <p className="flex items-center gap-1">
                        {fieldValue(selectedJourney.linkedTrip.origin)} →{" "}
                        {fieldValue(selectedJourney.linkedTrip.destination)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p className="capitalize">
                        {formatJourneyStatus(selectedJourney.linkedTrip.status)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Driver</Label>
                      <p>{fieldValue(selectedJourney.linkedTrip.driverName)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Vehicle</Label>
                      <p>
                        {fieldValue(
                          selectedJourney.linkedTrip.vehiclePlate ??
                            selectedJourney.linkedTrip.vehicleType,
                        )}
                      </p>
                    </div>
                  </div>
                  {selectedJourney.linkedTrip.passengers &&
                    selectedJourney.linkedTrip.passengers.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Passengers</Label>
                        <p className="text-sm">
                          {selectedJourney.linkedTrip.passengers
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
                            Arrived: {new Date(cp.arrivedAt).toLocaleString()}
                            {cp.departedAt && ` • Left: ${new Date(cp.departedAt).toLocaleTimeString()}`}
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
                          Reported: {new Date(incident.reportedAt).toLocaleString()}
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
              <Select value={updateStatus} onValueChange={(v) => setUpdateStatus(v as JourneyStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="departed">Departed</SelectItem>
                  <SelectItem value="en_route">En Route</SelectItem>
                  <SelectItem value="at_checkpoint">At Checkpoint</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
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
