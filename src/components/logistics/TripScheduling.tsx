import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  MapPin,
  Calendar,
  Clock,
  Users,
  Truck,
  MoreHorizontal,
  Eye,
  Edit,
  XCircle,
  UserPlus,
  Package,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { tripsApi, logisticsDashboardApi } from "@/services/logisticsApi";
import type { Trip, TripStatus, TripType, TripPassenger, CreateTripData, BulkTripUploadResult } from "@/types/logistics";

interface TripSchedulingProps {
  onViewTrip?: (trip: Trip) => void;
  onEditTrip?: (trip: Trip) => void;
}

const statusColors: Record<TripStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-warning/10 text-warning",
  vendor_assigned: "bg-info/10 text-info",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

// Sample staff list for passenger selection
const staffList = [
  { id: "staff-001", name: "Adaora Nwosu", email: "adaora@emeraldcfze.com", department: "Operations" },
  { id: "staff-002", name: "Chidi Okonkwo", email: "chidi@emeraldcfze.com", department: "Finance" },
  { id: "staff-003", name: "Fatima Bello", email: "fatima@emeraldcfze.com", department: "HR" },
  { id: "staff-004", name: "Emeka Eze", email: "emeka@emeraldcfze.com", department: "Procurement" },
  { id: "staff-005", name: "Ngozi Abubakar", email: "ngozi@emeraldcfze.com", department: "IT" },
  { id: "staff-006", name: "Tunde Adeyemi", email: "tunde@emeraldcfze.com", department: "Marketing" },
  { id: "staff-007", name: "Amina Yusuf", email: "amina@emeraldcfze.com", department: "Supply Chain" },
  { id: "staff-008", name: "Olumide Johnson", email: "olumide@emeraldcfze.com", department: "Warehouse" },
];

export const TripScheduling = ({ onViewTrip, onEditTrip }: TripSchedulingProps) => {
  const { toast } = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  
  // Form states
  const [formData, setFormData] = useState<Partial<CreateTripData>>({
    type: "personnel",
    priority: "normal",
    passengers: [],
  });
  const [selectedPassengers, setSelectedPassengers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<BulkTripUploadResult | null>(null);

  // Fetch trips
  const fetchTrips = async () => {
    setLoading(true);
    try {
      const response = await tripsApi.getAll({
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
      });
      if (response.success && response.data) {
        setTrips(response.data);
      } else {
        // Use mock data for development
        setTrips(getMockTrips());
      }
    } catch (error) {
      console.error("Failed to fetch trips:", error);
      setTrips(getMockTrips());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [statusFilter, typeFilter]);

  const handleCreateTrip = async () => {
    if (!formData.origin || !formData.destination || !formData.scheduledDepartureAt) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build passengers list
      const passengers: Omit<TripPassenger, "id" | "notifiedAt">[] = selectedPassengers.map(staffId => {
        const staff = staffList.find(s => s.id === staffId);
        return {
          staffId,
          name: staff?.name || "",
          email: staff?.email || "",
          department: staff?.department || "",
        };
      });

      const tripData: CreateTripData = {
        type: formData.type || "personnel",
        origin: formData.origin,
        destination: formData.destination,
        route: formData.route,
        scheduledDepartureAt: formData.scheduledDepartureAt,
        scheduledArrivalAt: formData.scheduledArrivalAt,
        purpose: formData.purpose,
        priority: formData.priority || "normal",
        notes: formData.notes,
        cargo: formData.cargo,
        passengers,
      };

      const response = await tripsApi.create(tripData);
      
      if (response.success) {
        toast({
          title: "Trip Scheduled",
          description: `Trip from ${formData.origin} to ${formData.destination} has been scheduled.`,
        });
        setCreateDialogOpen(false);
        resetForm();
        fetchTrips();
      } else {
        // For demo, add to local state
        const newTrip: Trip = {
          id: `TRP-${Date.now()}`,
          tripNumber: `TRP-2025-${String(trips.length + 1).padStart(3, "0")}`,
          type: tripData.type,
          origin: tripData.origin,
          destination: tripData.destination,
          route: tripData.route,
          scheduledDepartureAt: tripData.scheduledDepartureAt,
          scheduledArrivalAt: tripData.scheduledArrivalAt,
          purpose: tripData.purpose,
          priority: tripData.priority || "normal",
          notes: tripData.notes,
          cargo: tripData.cargo,
          status: "scheduled",
          scheduledBy: localStorage.getItem("userName") || "System",
          createdAt: new Date().toISOString(),
          passengers: passengers.map((p, i) => ({ ...p, id: `pass-${i}` })),
        };
        setTrips(prev => [newTrip, ...prev]);
        toast({
          title: "Trip Scheduled (Local)",
          description: `Trip from ${formData.origin} to ${formData.destination} has been scheduled.`,
        });
        setCreateDialogOpen(false);
        resetForm();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create trip",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!uploadFile) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await tripsApi.bulkUpload(uploadFile);
      if (response.success && response.data) {
        setUploadResult(response.data);
        if (response.data.successfulRows > 0) {
          toast({
            title: "Upload Successful",
            description: `${response.data.successfulRows} of ${response.data.totalRows} trips created.`,
          });
          fetchTrips();
        }
      } else {
        toast({
          title: "Upload Failed",
          description: response.error || "Failed to process file",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "An error occurred during upload",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await logisticsDashboardApi.downloadTemplate("trips");
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "trip_upload_template.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Provide a simple CSV template for demo
        const csvContent = "type,origin,destination,scheduled_departure,scheduled_arrival,purpose,priority,notes\npersonnel,Lagos,Abuja,2025-02-10T09:00,2025-02-10T15:00,Staff Transport,normal,";
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "trip_upload_template.csv";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download template",
        variant: "destructive",
      });
    }
  };

  const handleCancelTrip = async (trip: Trip) => {
    try {
      const response = await tripsApi.cancel(trip.id, "Cancelled by user");
      if (response.success) {
        toast({
          title: "Trip Cancelled",
          description: `Trip ${trip.tripNumber} has been cancelled.`,
        });
        fetchTrips();
      } else {
        // Update local state for demo
        setTrips(prev => prev.map(t => 
          t.id === trip.id ? { ...t, status: "cancelled" as TripStatus } : t
        ));
        toast({
          title: "Trip Cancelled",
          description: `Trip ${trip.tripNumber} has been cancelled.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel trip",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      type: "personnel",
      priority: "normal",
      passengers: [],
    });
    setSelectedPassengers([]);
  };

  const togglePassenger = (staffId: string) => {
    setSelectedPassengers(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const filteredTrips = trips.filter(trip => {
    const matchesSearch =
      trip.tripNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.vendorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.driverName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Trip Scheduling</h2>
          <p className="text-sm text-muted-foreground">
            Create, manage, and track scheduled trips
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Trip
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule New Trip</DialogTitle>
                <DialogDescription>
                  Create a new trip for personnel or material movement
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Trip Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trip Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: TripType) =>
                        setFormData(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personnel">Personnel Movement</SelectItem>
                        <SelectItem value="material">Material Movement</SelectItem>
                        <SelectItem value="mixed">Mixed (Personnel + Material)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) =>
                        setFormData(prev => ({ ...prev, priority: value as any }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Origin & Destination */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Origin *</Label>
                    <Input
                      placeholder="e.g., Lagos Head Office"
                      value={formData.origin || ""}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, origin: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Destination *</Label>
                    <Input
                      placeholder="e.g., Abuja Branch"
                      value={formData.destination || ""}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, destination: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Route Description */}
                <div className="space-y-2">
                  <Label>Route Description</Label>
                  <Input
                    placeholder="e.g., Via Lokoja-Abuja Highway"
                    value={formData.route || ""}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, route: e.target.value }))
                    }
                  />
                </div>

                {/* Schedule */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Scheduled Departure *</Label>
                    <Input
                      type="datetime-local"
                      value={formData.scheduledDepartureAt || ""}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, scheduledDepartureAt: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Arrival</Label>
                    <Input
                      type="datetime-local"
                      value={formData.scheduledArrivalAt || ""}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, scheduledArrivalAt: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Purpose */}
                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Input
                    placeholder="e.g., Board Meeting, Equipment Delivery"
                    value={formData.purpose || ""}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, purpose: e.target.value }))
                    }
                  />
                </div>

                {/* Cargo (for material trips) */}
                {(formData.type === "material" || formData.type === "mixed") && (
                  <div className="space-y-2">
                    <Label>Cargo Description</Label>
                    <Textarea
                      placeholder="Describe the materials being transported"
                      value={formData.cargo || ""}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, cargo: e.target.value }))
                      }
                    />
                  </div>
                )}

                {/* Passengers (for personnel trips) */}
                {(formData.type === "personnel" || formData.type === "mixed") && (
                  <div className="space-y-2">
                    <Label>Select Passengers</Label>
                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                      {staffList.map(staff => (
                        <div key={staff.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={staff.id}
                            checked={selectedPassengers.includes(staff.id)}
                            onCheckedChange={() => togglePassenger(staff.id)}
                          />
                          <label
                            htmlFor={staff.id}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {staff.name}{" "}
                            <span className="text-muted-foreground">
                              ({staff.department})
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                    {selectedPassengers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedPassengers.length} passenger(s) selected
                      </p>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Additional instructions or notes"
                    value={formData.notes || ""}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTrip} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Schedule Trip"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trips..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="vendor_assigned">Vendor Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="personnel">Personnel</SelectItem>
                  <SelectItem value="material">Material</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchTrips}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trips Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Trips</CardTitle>
          <CardDescription>
            {filteredTrips.length} trip(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No trips found</p>
              <p className="text-sm">Create a new trip to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Vendor/Driver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell className="font-mono text-sm">
                        {trip.tripNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {trip.type === "personnel" && <Users className="mr-1 h-3 w-3" />}
                          {trip.type === "material" && <Package className="mr-1 h-3 w-3" />}
                          {trip.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">
                            {trip.origin} → {trip.destination}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(trip.scheduledDepartureAt).toLocaleDateString()}
                          <Clock className="h-3 w-3 ml-1 text-muted-foreground" />
                          {new Date(trip.scheduledDepartureAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {trip.vendorName || trip.driverName || (
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(statusColors[trip.status], "capitalize")}>
                          {trip.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(priorityColors[trip.priority], "capitalize")}>
                          {trip.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedTrip(trip);
                              setViewDialogOpen(true);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {trip.status !== "completed" && trip.status !== "cancelled" && (
                              <>
                                <DropdownMenuItem onClick={() => onEditTrip?.(trip)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Trip
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {}}>
                                  <UserPlus className="mr-2 h-4 w-4" />
                                  Assign Vendor
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleCancelTrip(trip)}
                                  className="text-destructive"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Trip
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Trips</DialogTitle>
            <DialogDescription>
              Upload an Excel file with trip data using the provided template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                id="bulk-upload-input"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="bulk-upload-input" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {uploadFile ? uploadFile.name : "Click to select file or drag and drop"}
                </p>
              </label>
            </div>
            {uploadResult && (
              <div className={cn(
                "p-4 rounded-lg",
                uploadResult.failedRows > 0 ? "bg-warning/10" : "bg-success/10"
              )}>
                <p className="font-medium">
                  Upload Result: {uploadResult.successfulRows}/{uploadResult.totalRows} successful
                </p>
                {uploadResult.errors.length > 0 && (
                  <div className="mt-2 text-sm">
                    <p className="font-medium text-destructive">Errors:</p>
                    <ul className="list-disc list-inside">
                      {uploadResult.errors.slice(0, 5).map((error, i) => (
                        <li key={i}>
                          Row {error.row}: {error.field} - {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpload} disabled={!uploadFile || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Trip Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trip Details - {selectedTrip?.tripNumber}</DialogTitle>
          </DialogHeader>
          {selectedTrip && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium capitalize">{selectedTrip.type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={cn(statusColors[selectedTrip.status], "capitalize mt-1")}>
                    {selectedTrip.status.replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Origin</Label>
                  <p className="font-medium">{selectedTrip.origin}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Destination</Label>
                  <p className="font-medium">{selectedTrip.destination}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Scheduled Departure</Label>
                  <p className="font-medium">
                    {new Date(selectedTrip.scheduledDepartureAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <Badge className={cn(priorityColors[selectedTrip.priority], "capitalize mt-1")}>
                    {selectedTrip.priority}
                  </Badge>
                </div>
                {selectedTrip.vendorName && (
                  <div>
                    <Label className="text-muted-foreground">Vendor</Label>
                    <p className="font-medium">{selectedTrip.vendorName}</p>
                  </div>
                )}
                {selectedTrip.driverName && (
                  <div>
                    <Label className="text-muted-foreground">Driver</Label>
                    <p className="font-medium">{selectedTrip.driverName}</p>
                  </div>
                )}
              </div>
              {selectedTrip.passengers && selectedTrip.passengers.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Passengers ({selectedTrip.passengers.length})</Label>
                  <div className="mt-2 space-y-2">
                    {selectedTrip.passengers.map((passenger) => (
                      <div key={passenger.id} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                        <Users className="h-4 w-4" />
                        <span>{passenger.name}</span>
                        <span className="text-muted-foreground">({passenger.department})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedTrip.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1">{selectedTrip.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Mock data for development
function getMockTrips(): Trip[] {
  return [
    {
      id: "trip-001",
      tripNumber: "TRP-2025-001",
      type: "personnel",
      status: "scheduled",
      origin: "Lagos Head Office",
      destination: "Abuja Branch",
      route: "Via Lokoja-Abuja Highway",
      scheduledDepartureAt: "2025-02-10T09:00:00",
      scheduledArrivalAt: "2025-02-10T15:00:00",
      priority: "normal",
      purpose: "Board Meeting",
      scheduledBy: "Admin",
      passengers: [
        { id: "p1", staffId: "staff-001", name: "Adaora Nwosu", email: "adaora@emeraldcfze.com", department: "Operations" },
        { id: "p2", staffId: "staff-002", name: "Chidi Okonkwo", email: "chidi@emeraldcfze.com", department: "Finance" },
      ],
      createdAt: "2025-02-01T10:00:00",
    },
    {
      id: "trip-002",
      tripNumber: "TRP-2025-002",
      type: "material",
      status: "vendor_assigned",
      origin: "Warehouse A",
      destination: "Project Site B",
      scheduledDepartureAt: "2025-02-11T08:00:00",
      priority: "high",
      cargo: "Construction Equipment",
      vendorId: "v-001",
      vendorName: "FastTrack Logistics",
      driverName: "Ibrahim Musa",
      scheduledBy: "Admin",
      createdAt: "2025-02-01T11:00:00",
    },
    {
      id: "trip-003",
      tripNumber: "TRP-2025-003",
      type: "mixed",
      status: "in_progress",
      origin: "Port Harcourt",
      destination: "Lagos",
      scheduledDepartureAt: "2025-02-03T06:00:00",
      actualDepartureAt: "2025-02-03T06:15:00",
      priority: "urgent",
      cargo: "Drilling Equipment + Personnel",
      vendorId: "v-002",
      vendorName: "Oando Transport",
      driverName: "Tunde Bakare",
      scheduledBy: "Admin",
      passengers: [
        { id: "p3", staffId: "staff-007", name: "Amina Yusuf", email: "amina@emeraldcfze.com", department: "Supply Chain" },
      ],
      createdAt: "2025-02-01T09:00:00",
    },
  ];
}

export default TripScheduling;
