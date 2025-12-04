import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Truck, Users, Calendar, MapPin, Plus, Clock, CheckCircle, XCircle, FileText, Shield, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PullToRefresh } from "@/components/PullToRefresh";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useApp } from "@/contexts/AppContext";
import type { Trip, Vehicle, StaffDriver, TripPassenger } from "@/contexts/AppContext";

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

const Logistics = () => {
  const { toast } = useToast();
  const { 
    trips, 
    vehicles, 
    staffDrivers,
    addTrip,
    approveVehicle,
    rejectVehicle,
    addStaffDriver,
    updateStaffDriver,
    removeStaffDriver,
  } = useApp();
  
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<StaffDriver | null>(null);
  const [tripDetailsOpen, setTripDetailsOpen] = useState(false);
  const [vehicleDetailsOpen, setVehicleDetailsOpen] = useState(false);
  const [driverDetailsOpen, setDriverDetailsOpen] = useState(false);
  const [vehicleApprovalOpen, setVehicleApprovalOpen] = useState(false);
  const [designateDriverOpen, setDesignateDriverOpen] = useState(false);

  // New trip form
  const [newDestination, setNewDestination] = useState("");
  const [newVehicle, setNewVehicle] = useState("");
  const [newDriver, setNewDriver] = useState("");
  const [newCargo, setNewCargo] = useState("");
  const [newDeparture, setNewDeparture] = useState("");
  const [newPickupLocation, setNewPickupLocation] = useState("");
  const [selectedPassengers, setSelectedPassengers] = useState<string[]>([]);

  // Vehicle approval form
  const [approvalNotes, setApprovalNotes] = useState("");

  // Designate driver form
  const [driverStaffId, setDriverStaffId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverDepartment, setDriverDepartment] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [driverLicenseExpiry, setDriverLicenseExpiry] = useState("");

  // Filter approved vehicles for trip scheduling
  const approvedVehicles = vehicles.filter(v => 
    v.status === "Active" && (!v.approvalStatus || v.approvalStatus === "approved")
  );
  
  // Vehicles pending approval (from vendor registrations)
  const pendingVehicles = vehicles.filter(v => v.approvalStatus === "pending");
  
  // Available drivers
  const availableDrivers = staffDrivers.filter(d => d.status === "available");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
      case "Available":
      case "available":
      case "Completed":
      case "approved":
        return "bg-success/10 text-success";
      case "In Transit":
      case "on-trip":
      case "On Trip":
        return "bg-info/10 text-info";
      case "Scheduled":
      case "pending":
      case "Pending Approval":
        return "bg-warning/10 text-warning";
      case "Maintenance":
      case "off-duty":
        return "bg-muted text-muted-foreground";
      case "rejected":
      case "Rejected":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleViewTripDetails = (trip: Trip) => {
    setSelectedTrip(trip);
    setTripDetailsOpen(true);
  };

  const handleViewVehicleDetails = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    if (vehicle.approvalStatus === "pending") {
      setVehicleApprovalOpen(true);
    } else {
      setVehicleDetailsOpen(true);
    }
  };

  const handleScheduleTrip = () => {
    if (!newDestination || !newVehicle || !newDriver) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill all required fields", 
        variant: "destructive" 
      });
      return;
    }

    const selectedVehicleData = vehicles.find(v => v.id === newVehicle);
    const selectedDriverData = staffDrivers.find(d => d.id === newDriver);

    if (!selectedVehicleData || !selectedDriverData) {
      toast({ 
        title: "Error", 
        description: "Invalid vehicle or driver selection", 
        variant: "destructive" 
      });
      return;
    }

    // Build passengers list
    const passengers: TripPassenger[] = selectedPassengers.map(staffId => {
      const staff = staffList.find(s => s.id === staffId);
      return {
        id: staffId,
        name: staff?.name || "",
        email: staff?.email || "",
        department: staff?.department || "",
        pickupLocation: newPickupLocation,
      };
    });

    const departureTime = newDeparture 
      ? new Date(newDeparture).toLocaleString()
      : new Date().toLocaleString();

    addTrip({
      route: newDestination,
      vehicle: selectedVehicleData.id,
      vehiclePlate: selectedVehicleData.plate,
      vehicleType: selectedVehicleData.type,
      driver: selectedDriverData.name,
      driverEmail: selectedDriverData.email,
      status: "Scheduled",
      departure: newDeparture || new Date().toISOString(),
      arrival: "",
      cargo: newCargo || "Staff Transport",
      passengers,
      pickupLocation: newPickupLocation,
      destination: newDestination,
      scheduledBy: localStorage.getItem("userName") || "Logistics Coordinator",
      scheduledDate: new Date().toISOString(),
    });

    // Update driver status
    updateStaffDriver(selectedDriverData.id, { status: "on-trip" });

    // Show success toast with notification info
    toast({
      title: "Trip Scheduled Successfully",
      description: `Trip to ${newDestination} assigned to ${selectedDriverData.name}. ${passengers.length} passenger(s) notified.`,
    });

    // Simulate driver notification toast
    toast({
      title: "Driver Notified",
      description: `${selectedDriverData.name} has been notified of the trip assignment`,
    });

    // Simulate passenger notifications
    if (passengers.length > 0) {
      toast({
        title: "Passengers Notified",
        description: `${passengers.length} passenger(s) have been notified with trip details`,
      });
    }

    // Reset form
    setNewDestination("");
    setNewVehicle("");
    setNewDriver("");
    setNewCargo("");
    setNewDeparture("");
    setNewPickupLocation("");
    setSelectedPassengers([]);
    setScheduleDialogOpen(false);
  };

  const handleTogglePassenger = (staffId: string) => {
    setSelectedPassengers(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const handleApproveVehicle = () => {
    if (!selectedVehicle) return;

    approveVehicle(selectedVehicle.id, "Logistics Coordinator", approvalNotes);

    toast({
      title: "Vehicle Approved",
      description: `${selectedVehicle.name} has been approved for operations`,
    });

    setApprovalNotes("");
    setVehicleApprovalOpen(false);
    setSelectedVehicle(null);
  };

  const handleRejectVehicle = () => {
    if (!selectedVehicle) return;

    if (!approvalNotes) {
      toast({
        title: "Notes Required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    rejectVehicle(selectedVehicle.id, "Logistics Coordinator", approvalNotes);

    toast({
      title: "Vehicle Rejected",
      description: `${selectedVehicle.name} has been rejected`,
      variant: "destructive",
    });

    setApprovalNotes("");
    setVehicleApprovalOpen(false);
    setSelectedVehicle(null);
  };

  const handleDesignateDriver = () => {
    if (!driverStaffId || !driverName || !driverEmail || !driverLicense || !driverLicenseExpiry) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    addStaffDriver({
      staffId: driverStaffId,
      name: driverName,
      email: driverEmail,
      department: driverDepartment || "Operations",
      licenseNumber: driverLicense,
      licenseExpiry: driverLicenseExpiry,
      status: "available",
      designatedBy: localStorage.getItem("userName") || "Logistics Manager",
    });

    toast({
      title: "Driver Designated Successfully",
      description: `${driverName} has been designated as a driver`,
    });

    // Reset form
    setDriverStaffId("");
    setDriverName("");
    setDriverEmail("");
    setDriverDepartment("");
    setDriverLicense("");
    setDriverLicenseExpiry("");
    setDesignateDriverOpen(false);
  };

  const handleRemoveDriver = (driverId: string) => {
    const driver = staffDrivers.find(d => d.id === driverId);
    if (!driver) return;

    removeStaffDriver(driverId);
    toast({
      title: "Driver Removed",
      description: `${driver.name} has been removed from driver roster`,
    });
    setDriverDetailsOpen(false);
    setSelectedDriver(null);
  };

  const handleRefresh = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <DashboardLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Logistics Management</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                Manage trips, vendor vehicles, and designated staff drivers
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={designateDriverOpen} onOpenChange={setDesignateDriverOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Designate Driver</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Designate Staff as Driver</DialogTitle>
                    <DialogDescription>
                      Assign driver responsibilities to a staff member
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Staff ID *</Label>
                        <Input
                          placeholder="EMP-XXX"
                          value={driverStaffId}
                          onChange={(e) => setDriverStaffId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Full Name *</Label>
                        <Input
                          placeholder="Staff name"
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        placeholder="staff@emeraldcfze.com"
                        value={driverEmail}
                        onChange={(e) => setDriverEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select value={driverDepartment} onValueChange={setDriverDepartment}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Operations">Operations</SelectItem>
                          <SelectItem value="Warehouse">Warehouse</SelectItem>
                          <SelectItem value="Logistics">Logistics</SelectItem>
                          <SelectItem value="Transport">Transport</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>License Number *</Label>
                        <Input
                          placeholder="ABC123456"
                          value={driverLicense}
                          onChange={(e) => setDriverLicense(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>License Expiry *</Label>
                        <Input
                          type="date"
                          value={driverLicenseExpiry}
                          onChange={(e) => setDriverLicenseExpiry(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button className="w-full" onClick={handleDesignateDriver}>
                      Designate as Driver
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Schedule Trip
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule New Trip</DialogTitle>
                    <DialogDescription>
                      Create a new logistics trip (only approved vehicles available)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Destination / Route *</Label>
                      <Input
                        placeholder="e.g., Lagos - Abuja"
                        value={newDestination}
                        onChange={(e) => setNewDestination(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Vehicle *</Label>
                      <Select value={newVehicle} onValueChange={setNewVehicle}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select approved vehicle" />
                        </SelectTrigger>
                        <SelectContent>
                          {approvedVehicles.length === 0 ? (
                            <SelectItem value="none" disabled>No approved vehicles available</SelectItem>
                          ) : (
                            approvedVehicles.map(v => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name} ({v.plate}) {v.vendorName && `- ${v.vendorName}`}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Driver *</Label>
                      <Select value={newDriver} onValueChange={setNewDriver}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select available driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDrivers.length === 0 ? (
                            <SelectItem value="none" disabled>No available drivers</SelectItem>
                          ) : (
                            availableDrivers.map(d => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name} - {d.department}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Pickup Location</Label>
                      <Input
                        placeholder="e.g., Head Office, Gate 2"
                        value={newPickupLocation}
                        onChange={(e) => setNewPickupLocation(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo/Purpose</Label>
                      <Input
                        placeholder="e.g., Staff Transport, Office Supplies"
                        value={newCargo}
                        onChange={(e) => setNewCargo(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Departure Date/Time *</Label>
                      <Input
                        type="datetime-local"
                        value={newDeparture}
                        onChange={(e) => setNewDeparture(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Select Passengers</Label>
                      <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                        {staffList.map(staff => (
                          <div key={staff.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={staff.id}
                              checked={selectedPassengers.includes(staff.id)}
                              onCheckedChange={() => handleTogglePassenger(staff.id)}
                            />
                            <label 
                              htmlFor={staff.id} 
                              className="text-sm cursor-pointer flex-1"
                            >
                              {staff.name} <span className="text-muted-foreground">({staff.department})</span>
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
                    <Button className="w-full" onClick={handleScheduleTrip}>
                      Schedule Trip & Notify All
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
                <Truck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{trips.filter(t => t.status === "In Transit").length}</div>
                <p className="text-xs text-muted-foreground">{trips.length} total trips</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved Vehicles</CardTitle>
                <Truck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{approvedVehicles.length}</div>
                <p className="text-xs text-muted-foreground">
                  {pendingVehicles.length} pending approval
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Staff Drivers</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{staffDrivers.length}</div>
                <p className="text-xs text-muted-foreground">
                  {availableDrivers.length} available
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
                <Clock className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">94%</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          {/* Pending Vehicle Approvals Alert */}
          {pendingVehicles.length > 0 && (
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader>
                <CardTitle className="text-warning flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Vehicles Pending Approval ({pendingVehicles.length})
                </CardTitle>
                <CardDescription>
                  Review and approve vehicles registered by vendors before they can be used for trips
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingVehicles.map((vehicle) => (
                    <div key={vehicle.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg bg-background">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{vehicle.name}</span>
                          <Badge className={getStatusColor(vehicle.approvalStatus || "pending")}>
                            Pending Approval
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>Type: {vehicle.type}</span>
                          <span>Plate: {vehicle.plate}</span>
                          {vehicle.vendorName && <span>Vendor: {vehicle.vendorName}</span>}
                        </div>
                      </div>
                      <Button 
                        onClick={() => handleViewVehicleDetails(vehicle)}
                        className="self-start sm:self-center"
                      >
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="trips" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="trips" className="text-xs sm:text-sm">Trip Schedule</TabsTrigger>
              <TabsTrigger value="vehicles" className="text-xs sm:text-sm">Vehicle Fleet</TabsTrigger>
              <TabsTrigger value="drivers" className="text-xs sm:text-sm">Staff Drivers</TabsTrigger>
            </TabsList>

            <TabsContent value="trips" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Scheduled Trips</CardTitle>
                  <CardDescription>Track and manage material/personnel movement</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {trips.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No trips scheduled</p>
                    ) : (
                      trips.map((trip) => (
                        <div key={trip.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg">
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold whitespace-nowrap">{trip.id}</span>
                              <Badge className={getStatusColor(trip.status)}>{trip.status}</Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <MapPin className="h-3 w-3" />
                                {trip.route}
                              </span>
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <Users className="h-3 w-3" />
                                {trip.driver}
                              </span>
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <Truck className="h-3 w-3" />
                                {trip.vehicle}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <p className="text-xs sm:text-sm font-medium whitespace-nowrap">
                              Departs: {trip.departure}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewTripDetails(trip)}
                              className="self-start sm:self-center"
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vehicles" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Fleet</CardTitle>
                  <CardDescription>
                    Approved vehicles from vendor registrations and company fleet
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {vehicles.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No vehicles registered</p>
                    ) : (
                      vehicles.map((vehicle) => (
                        <div key={vehicle.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg">
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold truncate">{vehicle.name} ({vehicle.id})</span>
                              <Badge className={getStatusColor(vehicle.status)}>{vehicle.status}</Badge>
                              {vehicle.vendorName && (
                                <Badge variant="outline">{vehicle.vendorName}</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                              <span className="whitespace-nowrap">{vehicle.type}</span>
                              <span className="whitespace-nowrap">Plate: {vehicle.plate}</span>
                              {vehicle.driver && <span className="whitespace-nowrap">Driver: {vehicle.driver}</span>}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewVehicleDetails(vehicle)}
                            className="self-start sm:self-center"
                          >
                            {vehicle.approvalStatus === "pending" ? "Review" : "Manage"}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="drivers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Staff Drivers</CardTitle>
                  <CardDescription>
                    Staff members designated as drivers by Logistics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {staffDrivers.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No staff drivers designated. Use "Designate Driver" to assign driver responsibilities to staff members.
                      </p>
                    ) : (
                      staffDrivers.map((driver) => (
                        <div key={driver.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg">
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold truncate">{driver.name}</span>
                              <Badge className={getStatusColor(driver.status)}>
                                {driver.status === "available" ? "Available" : 
                                 driver.status === "on-trip" ? "On Trip" : "Off Duty"}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                              <span className="whitespace-nowrap">ID: {driver.staffId}</span>
                              <span className="whitespace-nowrap">License: {driver.licenseNumber}</span>
                              <span className="whitespace-nowrap">Trips: {driver.totalTrips}</span>
                              <span className="whitespace-nowrap">Rating: {driver.rating}/5.0</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDriver(driver);
                              setDriverDetailsOpen(true);
                            }}
                            className="self-start sm:self-center"
                          >
                            View Profile
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </PullToRefresh>

      {/* Trip Details Dialog */}
      <Dialog open={tripDetailsOpen} onOpenChange={setTripDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trip Details - {selectedTrip?.id}</DialogTitle>
            <DialogDescription>Complete trip information and tracking</DialogDescription>
          </DialogHeader>
          {selectedTrip && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Route / Destination</Label>
                  <p className="font-medium">{selectedTrip.destination || selectedTrip.route}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedTrip.status)}>{selectedTrip.status}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vehicle</Label>
                  <p className="font-medium">
                    {selectedTrip.vehicle}
                    {selectedTrip.vehiclePlate && ` (${selectedTrip.vehiclePlate})`}
                  </p>
                  {selectedTrip.vehicleType && (
                    <p className="text-xs text-muted-foreground">{selectedTrip.vehicleType}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Driver</Label>
                  <p className="font-medium">{selectedTrip.driver}</p>
                  {selectedTrip.driverEmail && (
                    <p className="text-xs text-muted-foreground">{selectedTrip.driverEmail}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Pickup Location</Label>
                  <p className="font-medium">{selectedTrip.pickupLocation || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Departure</Label>
                  <p className="font-medium">
                    {selectedTrip.departure 
                      ? new Date(selectedTrip.departure).toLocaleString() 
                      : "TBD"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Arrival (ETA)</Label>
                  <p className="font-medium">
                    {selectedTrip.arrival 
                      ? new Date(selectedTrip.arrival).toLocaleString() 
                      : "TBD"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Purpose/Cargo</Label>
                  <p className="font-medium">{selectedTrip.cargo}</p>
                </div>
              </div>

              {/* Passengers Section */}
              {selectedTrip.passengers && selectedTrip.passengers.length > 0 && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground mb-2 block">
                    Passengers ({selectedTrip.passengers.length})
                  </Label>
                  <div className="space-y-2">
                    {selectedTrip.passengers.map((passenger) => (
                      <div key={passenger.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                        <div>
                          <p className="font-medium text-sm">{passenger.name}</p>
                          <p className="text-xs text-muted-foreground">{passenger.department}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{passenger.email}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scheduling Info */}
              {selectedTrip.scheduledBy && (
                <div className="border-t pt-4 text-xs text-muted-foreground">
                  <p>Scheduled by: {selectedTrip.scheduledBy}</p>
                  {selectedTrip.scheduledDate && (
                    <p>Scheduled on: {new Date(selectedTrip.scheduledDate).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Vehicle Details Dialog (Approved) */}
      <Dialog open={vehicleDetailsOpen} onOpenChange={setVehicleDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vehicle Details - {selectedVehicle?.name}</DialogTitle>
            <DialogDescription>Vehicle information and status</DialogDescription>
          </DialogHeader>
          {selectedVehicle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Vehicle ID</Label>
                  <p className="font-medium">{selectedVehicle.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedVehicle.status)}>{selectedVehicle.status}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{selectedVehicle.type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">License Plate</Label>
                  <p className="font-medium">{selectedVehicle.plate}</p>
                </div>
                {selectedVehicle.vendorName && (
                  <>
                    <div>
                      <Label className="text-muted-foreground">Vendor</Label>
                      <p className="font-medium">{selectedVehicle.vendorName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Approved By</Label>
                      <p className="font-medium">{selectedVehicle.approvedBy || "N/A"}</p>
                    </div>
                  </>
                )}
                <div>
                  <Label className="text-muted-foreground">Last Maintenance</Label>
                  <p className="font-medium">{selectedVehicle.lastMaintenance || "Not recorded"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Vehicle Approval Dialog */}
      <Dialog open={vehicleApprovalOpen} onOpenChange={setVehicleApprovalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Vehicle - {selectedVehicle?.name}</DialogTitle>
            <DialogDescription>
              Review vendor-registered vehicle documents and approve for operations
            </DialogDescription>
          </DialogHeader>
          {selectedVehicle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Vehicle Name</Label>
                  <p className="font-medium">{selectedVehicle.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{selectedVehicle.type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">License Plate</Label>
                  <p className="font-medium">{selectedVehicle.plate}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p className="font-medium">{selectedVehicle.vendorName || "N/A"}</p>
                </div>
              </div>

              {/* Documents Section */}
              {selectedVehicle.documents && selectedVehicle.documents.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Uploaded Documents</Label>
                  <div className="space-y-2">
                    {selectedVehicle.documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm flex-1">{doc.name}</span>
                        <Badge variant="outline">{doc.documentType}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Approval Notes</Label>
                <Textarea
                  placeholder="Add notes about this vehicle approval..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                />
              </div>

              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button
                  variant="destructive"
                  onClick={handleRejectVehicle}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={handleApproveVehicle}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve Vehicle
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Driver Details Dialog */}
      <Dialog open={driverDetailsOpen} onOpenChange={setDriverDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Driver Profile - {selectedDriver?.name}</DialogTitle>
            <DialogDescription>Staff driver information and performance</DialogDescription>
          </DialogHeader>
          {selectedDriver && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Staff ID</Label>
                  <p className="font-medium">{selectedDriver.staffId}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedDriver.status)}>
                    {selectedDriver.status === "available" ? "Available" : 
                     selectedDriver.status === "on-trip" ? "On Trip" : "Off Duty"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedDriver.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Department</Label>
                  <p className="font-medium">{selectedDriver.department}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">License Number</Label>
                  <p className="font-medium">{selectedDriver.licenseNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">License Expiry</Label>
                  <p className="font-medium">{selectedDriver.licenseExpiry}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Trips</Label>
                  <p className="font-medium">{selectedDriver.totalTrips}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rating</Label>
                  <p className="font-medium">{selectedDriver.rating}/5.0</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Designated By</Label>
                  <p className="font-medium">{selectedDriver.designatedBy}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Designated Date</Label>
                  <p className="font-medium">{selectedDriver.designatedDate}</p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    updateStaffDriver(selectedDriver.id, {
                      status: selectedDriver.status === "available" ? "off-duty" : "available"
                    });
                    setSelectedDriver({
                      ...selectedDriver,
                      status: selectedDriver.status === "available" ? "off-duty" : "available"
                    });
                  }}
                >
                  Toggle Status
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleRemoveDriver(selectedDriver.id)}
                >
                  Remove Driver Role
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Logistics;
