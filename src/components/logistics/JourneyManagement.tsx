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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { journeysApi } from "@/services/logisticsApi";
import type { Journey, JourneyStatus, JourneyCheckpoint, JourneyIncident } from "@/types/logistics";

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

export const JourneyManagement = ({ tripId }: JourneyManagementProps) => {
  const { toast } = useToast();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  
  // Form states
  const [updateStatus, setUpdateStatus] = useState<JourneyStatus>("en_route");
  const [currentLocation, setCurrentLocation] = useState("");
  const [checkpointNotes, setCheckpointNotes] = useState("");
  const [incidentType, setIncidentType] = useState<string>("delay");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<string>("low");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch journeys from API
  const fetchJourneys = async () => {
    setLoading(true);
    try {
      if (tripId) {
        const response = await journeysApi.getByTripId(tripId);
        if (response.success && response.data) {
          setJourneys([response.data]);
        } else {
          setJourneys([]);
        }
      } else {
        // No mock data - show empty state until API provides data
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
    const matchesSearch =
      (journey.tripNumber || '').toLowerCase().includes(q) ||
      (journey.currentLocation || '').toLowerCase().includes(q);
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
                        <Badge className={cn(statusColors[journey.status], "capitalize")}>
                          {statusIcons[journey.status]}
                          <span className="ml-1">{journey.status.replace("_", " ")}</span>
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
                  {journey.checkpoints.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">
                        Checkpoints ({journey.checkpoints.length})
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {journey.checkpoints.map((cp, idx) => (
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
              {/* Status & Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={cn(statusColors[selectedJourney.status], "capitalize")}>
                    {statusIcons[selectedJourney.status]}
                    <span className="ml-1">{selectedJourney.status.replace("_", " ")}</span>
                  </Badge>
                  <span className="text-sm">{getJourneyProgress(selectedJourney)}% Complete</span>
                </div>
                <Progress value={getJourneyProgress(selectedJourney)} className="h-2" />
              </div>

              {/* Timeline Info */}
              <div className="grid grid-cols-2 gap-4">
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
                    {selectedJourney.currentLocation || "Unknown"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Updated</Label>
                  <p className="font-medium">
                    {selectedJourney.lastUpdatedAt
                      ? new Date(selectedJourney.lastUpdatedAt).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Checkpoints */}
              {selectedJourney.checkpoints.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Checkpoints</Label>
                  <div className="mt-2 space-y-2">
                    {selectedJourney.checkpoints.map((cp, idx) => (
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

              {/* Metrics */}
              {(selectedJourney.totalDistance || selectedJourney.totalDuration) && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-muted-foreground">Total Distance</Label>
                    <p className="font-medium">{selectedJourney.totalDistance || "N/A"} km</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Total Duration</Label>
                    <p className="font-medium">{selectedJourney.totalDuration || "N/A"}</p>
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
