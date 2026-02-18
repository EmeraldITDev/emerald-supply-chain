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
  FileCheck,
  Mail,
  Bell,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { tripsApi, logisticsDashboardApi, logisticsVendorsApi } from "@/services/logisticsApi";
import { userApi } from "@/services/api";
import type { Trip, TripStatus, TripType, TripPassenger, CreateTripData, BulkTripUploadResult } from "@/types/logistics";
import { VendorJMPSubmission } from "./VendorJMPSubmission";
import { PassengerNotification } from "./PassengerNotification";

interface TripSchedulingProps {
  onViewTrip?: (trip: Trip) => void;
  onEditTrip?: (trip: Trip) => void;
}

// Vendor and staff lists will be fetched from API

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

// Staff types for API data
interface StaffMember {
  id: string;
  name: string;
  email: string;
  department: string;
}

interface VendorItem {
  id: string;
  name: string;
  contact?: string;
  vehicles?: number;
}

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignVendorDialogOpen, setAssignVendorDialogOpen] = useState(false);
  const [jmpDialogOpen, setJmpDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  
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
  
  // Staff and vendor lists from API
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [vendorList, setVendorList] = useState<VendorItem[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Fetch trips from API
  const fetchTrips = async () => {
    setLoading(true);
    try {
      const response = await tripsApi.getAll({
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
      });
      if (response.success && response.data) {
        const tripsData = Array.isArray(response.data) ? response.data : [];
        setTrips(tripsData);
      } else {
        // No trips available - show empty state
        setTrips([]);
      }
    } catch (error) {
      console.error("Failed to fetch trips:", error);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch staff members from API
  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const response = await userApi.getAll();
      if (response.success && response.data) {
        // Map users to staff format
        const staff: StaffMember[] = response.data.map((user: any) => ({
          id: user.id?.toString() || user.staff_id || user.staffId,
          name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: user.email,
          department: user.department || 'General',
        }));
        setStaffList(staff);
      }
    } catch (error) {
      console.error("Failed to fetch staff:", error);
    } finally {
      setLoadingStaff(false);
    }
  };

  // Fetch vendors from API
  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const response = await logisticsVendorsApi.getAll();
      if (response.success && response.data) {
        const vendors: VendorItem[] = response.data.map((v: any) => ({
          id: v.id?.toString() || v.vendor_id,
          name: v.name || v.company_name,
          contact: v.contact || v.phone,
          vehicles: v.vehicles || v.vehicle_count,
        }));
        setVendorList(vendors);
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
    } finally {
      setLoadingVendors(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [statusFilter, typeFilter]);

  // Fetch staff and vendors on mount
  useEffect(() => {
    fetchStaff();
    fetchVendors();
  }, []);

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

      // Build payload in snake_case as expected by Laravel backend
      const tripPayload = {
        trip_type: formData.type || "personnel",
        origin: formData.origin,
        destination: formData.destination,
        route: formData.route || null,
        scheduled_departure_at: formData.scheduledDepartureAt
          ? new Date(formData.scheduledDepartureAt).toISOString().replace('T', ' ').substring(0, 19)
          : null,
        scheduled_arrival_at: formData.scheduledArrivalAt
          ? new Date(formData.scheduledArrivalAt).toISOString().replace('T', ' ').substring(0, 19)
          : null,
        purpose: formData.purpose || null,
        priority: formData.priority || "normal",
        notes: formData.notes || null,
        cargo: formData.cargo || null,
        passengers: passengers.map(p => ({
          staff_id: p.staffId,
          name: p.name,
          email: p.email,
          department: p.department,
        })),
      };

      const response = await tripsApi.create(tripPayload as any);
      
      if (response.success) {
        toast({
          title: "Trip Scheduled",
          description: `Trip from ${formData.origin} to ${formData.destination} has been scheduled.`,
        });
        setCreateDialogOpen(false);
        resetForm();
        fetchTrips();
      } else {
        toast({
          title: "Failed to Schedule Trip",
          description: response.error || "Unable to create trip. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create trip. Please check your connection.",
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

  const handleDownloadTemplate = async (templateType: 'personnel-trip' | 'journey-management' = 'personnel-trip') => {
    try {
      const blob = await logisticsDashboardApi.downloadTemplate(templateType);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = templateType === 'journey-management' 
          ? "journey_management_template.xlsx" 
          : "personnel_trip_template.xlsx";
        a.click();
        URL.revokeObjectURL(url);
        toast({
          title: "Template Downloaded",
          description: `${templateType === 'journey-management' ? 'Journey Management' : 'Personnel Trip'} template downloaded successfully`,
        });
      } else {
        toast({
          title: "Download Failed",
          description: "Template file not available",
          variant: "destructive",
        });
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
        toast({
          title: "Failed to Cancel Trip",
          description: response.error || "Unable to cancel trip. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel trip. Please check your connection.",
        variant: "destructive",
      });
    }
  };

  const handleEditTrip = async () => {
    if (!selectedTrip || !formData.origin || !formData.destination) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build passengers list from selected
      const passengers: Omit<TripPassenger, "id" | "notifiedAt">[] = selectedPassengers.map(staffId => {
        const staff = staffList.find(s => s.id === staffId);
        return {
          staffId,
          name: staff?.name || "",
          email: staff?.email || "",
          department: staff?.department || "",
        };
      });

      const editPayload = {
        trip_type: formData.type,
        origin: formData.origin,
        destination: formData.destination,
        route: formData.route || null,
        scheduled_departure_at: formData.scheduledDepartureAt
          ? new Date(formData.scheduledDepartureAt).toISOString().replace('T', ' ').substring(0, 19)
          : null,
        scheduled_arrival_at: formData.scheduledArrivalAt
          ? new Date(formData.scheduledArrivalAt).toISOString().replace('T', ' ').substring(0, 19)
          : null,
        purpose: formData.purpose || null,
        priority: formData.priority,
        notes: formData.notes || null,
        cargo: formData.cargo || null,
      };

      const response = await tripsApi.update(selectedTrip.id, editPayload as any);

      if (response.success) {
        toast({
          title: "Trip Updated",
          description: `Trip ${selectedTrip.tripNumber} has been updated.`,
        });
        setEditDialogOpen(false);
        fetchTrips();
      } else {
        toast({
          title: "Failed to Update Trip",
          description: response.error || "Unable to update trip. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update trip. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignVendor = async () => {
    if (!selectedTrip || !selectedVendorId) {
      toast({
        title: "Validation Error",
        description: "Please select a vendor",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const vendor = vendorList.find(v => v.id === selectedVendorId);
      const response = await tripsApi.assignVendor(selectedTrip.id, selectedVendorId);

      if (response.success) {
        toast({
          title: "Vendor Assigned",
          description: `${vendor?.name} has been assigned to ${selectedTrip.tripNumber}.`,
        });
        setAssignVendorDialogOpen(false);
        setSelectedVendorId("");
        fetchTrips();
      } else {
        toast({
          title: "Failed to Assign Vendor",
          description: response.error || "Unable to assign vendor. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign vendor. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (trip: Trip) => {
    setSelectedTrip(trip);
    setFormData({
      type: trip.type,
      origin: trip.origin,
      destination: trip.destination,
      route: trip.route,
      scheduledDepartureAt: trip.scheduledDepartureAt,
      scheduledArrivalAt: trip.scheduledArrivalAt,
      purpose: trip.purpose,
      priority: trip.priority,
      notes: trip.notes,
      cargo: trip.cargo,
    });
    setSelectedPassengers(trip.passengers?.map(p => p.staffId) || []);
    setEditDialogOpen(true);
  };

  const openAssignVendorDialog = (trip: Trip) => {
    setSelectedTrip(trip);
    setSelectedVendorId(trip.vendorId || "");
    setAssignVendorDialogOpen(true);
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
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (trip.tripNumber || '').toLowerCase().includes(q) ||
      (trip.origin || '').toLowerCase().includes(q) ||
      (trip.destination || '').toLowerCase().includes(q) ||
      (trip.vendorName || '').toLowerCase().includes(q) ||
      (trip.driverName || '').toLowerCase().includes(q);
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
                                <DropdownMenuItem onClick={() => openEditDialog(trip)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Trip
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openAssignVendorDialog(trip)}>
                                  <UserPlus className="mr-2 h-4 w-4" />
                                  Assign Vendor
                                </DropdownMenuItem>
                                {trip.vendorId && (
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedTrip(trip);
                                    setJmpDialogOpen(true);
                                  }}>
                                    <FileCheck className="mr-2 h-4 w-4" />
                                    Submit JMP
                                  </DropdownMenuItem>
                                )}
                                {trip.passengers && trip.passengers.length > 0 && (
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedTrip(trip);
                                    setNotificationDialogOpen(true);
                                  }}>
                                    <Bell className="mr-2 h-4 w-4" />
                                    Notify Passengers
                                  </DropdownMenuItem>
                                )}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="space-y-2">
            <DialogTitle>Bulk Upload Trips</DialogTitle>
            <DialogDescription className="text-sm">
              Upload an Excel file with trip data using the provided template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Template Download Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="w-full h-auto py-3 px-4 justify-start gap-3" 
                onClick={() => handleDownloadTemplate('personnel-trip')}
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="text-sm text-left truncate">Personnel Trip Template</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-auto py-3 px-4 justify-start gap-3" 
                onClick={() => handleDownloadTemplate('journey-management')}
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="text-sm text-left truncate">Journey Management Template</span>
              </Button>
            </div>
            
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                id="bulk-upload-input"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="bulk-upload-input" className="cursor-pointer block">
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {uploadFile ? (
                    <span className="text-foreground font-medium">{uploadFile.name}</span>
                  ) : (
                    "Click to select file or drag and drop"
                  )}
                </p>
              </label>
            </div>
            
            {/* Upload Result */}
            {uploadResult && (
              <div className={cn(
                "p-4 rounded-lg",
                uploadResult.failedRows > 0 ? "bg-warning/10" : "bg-success/10"
              )}>
                <p className="font-medium text-sm">
                  Upload Result: {uploadResult.successfulRows}/{uploadResult.totalRows} successful
                </p>
                {uploadResult.errors.length > 0 && (
                  <div className="mt-3 text-sm">
                    <p className="font-medium text-destructive">Errors:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {uploadResult.errors.slice(0, 5).map((error, i) => (
                        <li key={i} className="text-muted-foreground">
                          Row {error.row}: {error.field} - {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
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

      {/* Edit Trip Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Trip - {selectedTrip?.tripNumber}</DialogTitle>
            <DialogDescription>
              Update trip details below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Trip Type & Priority */}
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
                  value={formData.scheduledDepartureAt?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, scheduledDepartureAt: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Arrival</Label>
                <Input
                  type="datetime-local"
                  value={formData.scheduledArrivalAt?.slice(0, 16) || ""}
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
                        id={`edit-${staff.id}`}
                        checked={selectedPassengers.includes(staff.id)}
                        onCheckedChange={() => togglePassenger(staff.id)}
                      />
                      <label
                        htmlFor={`edit-${staff.id}`}
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
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTrip} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Vendor Dialog */}
      <Dialog open={assignVendorDialogOpen} onOpenChange={setAssignVendorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Vendor - {selectedTrip?.tripNumber}</DialogTitle>
            <DialogDescription>
              Select a logistics vendor to handle this trip
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Vendor *</Label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendorList.map(vendor => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      <div className="flex flex-col">
                        <span>{vendor.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {vendor.vehicles} vehicles • {vendor.contact}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedVendorId && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="font-medium text-sm mb-2">Vendor Details</h4>
                {(() => {
                  const vendor = vendorList.find(v => v.id === selectedVendorId);
                  return vendor ? (
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {vendor.name}</p>
                      <p><span className="text-muted-foreground">Contact:</span> {vendor.contact}</p>
                      <p><span className="text-muted-foreground">Fleet Size:</span> {vendor.vehicles} vehicles</p>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setAssignVendorDialogOpen(false);
              setSelectedVendorId("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleAssignVendor} disabled={!selectedVendorId || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign Vendor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JMP Submission Dialog */}
      {selectedTrip && (
        <VendorJMPSubmission
          trip={selectedTrip}
          open={jmpDialogOpen}
          onOpenChange={setJmpDialogOpen}
          onSubmit={async (data) => {
            // Update trip with JMP data
            setTrips(prev => prev.map(t =>
              t.id === selectedTrip.id
                ? {
                    ...t,
                    vehiclePlate: data.vehiclePlate,
                    vehicleType: data.vehicleType,
                    driverName: data.driverName,
                    driverPhone: data.driverPhone,
                    status: "vendor_assigned" as TripStatus,
                  }
                : t
            ));
            toast({
              title: "JMP Submitted",
              description: "Passengers will be automatically notified",
            });
          }}
        />
      )}

      {/* Passenger Notification Dialog */}
      {selectedTrip && (
        <PassengerNotification
          trip={selectedTrip}
          open={notificationDialogOpen}
          onOpenChange={setNotificationDialogOpen}
          onSendNotifications={async () => {
            // Update passengers as notified
            setTrips(prev => prev.map(t =>
              t.id === selectedTrip.id
                ? {
                    ...t,
                    passengers: t.passengers?.map(p => ({
                      ...p,
                      notifiedAt: new Date().toISOString(),
                    })),
                  }
                : t
            ));
          }}
        />
      )}
    </div>
  );
};

// Export for use in other components
export default TripScheduling;
