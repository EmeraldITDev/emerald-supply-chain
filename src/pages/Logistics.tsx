import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { 
  Truck, 
  Users, 
  Calendar, 
  MapPin, 
  Clock, 
  Package,
  Navigation,
  FileText,
  UserPlus,
  Settings,
  BarChart3,
  Satellite,
  Loader2,
} from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import { logisticsDashboardApi, tripsApi, fleetApi } from "@/services/logisticsApi";
import type { LogisticsDashboardStats, Trip as LogisticsTrip, FleetVehicle } from "@/types/logistics";

// Import new modular logistics components
import { TripScheduling } from "@/components/logistics/TripScheduling";
import { JourneyManagement } from "@/components/logistics/JourneyManagement";
import { FleetManagement } from "@/components/logistics/FleetManagement";
import { MaterialsTracking } from "@/components/logistics/MaterialsTracking";
import { ReportingCompliance } from "@/components/logistics/ReportingCompliance";
import { GPSTrackingPlaceholder } from "@/components/logistics/GPSTrackingPlaceholder";

const Logistics = () => {
  const { toast } = useToast();
  const { 
    staffDrivers,
    addStaffDriver,
  } = useApp();
  
  const [designateDriverOpen, setDesignateDriverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  // Designate driver form
  const [driverStaffId, setDriverStaffId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverDepartment, setDriverDepartment] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [driverLicenseExpiry, setDriverLicenseExpiry] = useState("");

  // Dashboard stats from API
  const [stats, setStats] = useState<LogisticsDashboardStats | null>(null);
  const [recentTrips, setRecentTrips] = useState<LogisticsTrip[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);

  // Fetch dashboard data from API
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, tripsRes, vehiclesRes] = await Promise.all([
        logisticsDashboardApi.getStats(),
        tripsApi.getAll(),
        fleetApi.getAll(),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
      if (tripsRes.success && tripsRes.data) {
        const tripsData = Array.isArray(tripsRes.data) ? tripsRes.data : (tripsRes.data as any)?.data || (tripsRes.data as any)?.trips || [];
        setRecentTrips(tripsData.slice(0, 5));
      }
      if (vehiclesRes.success && vehiclesRes.data) {
        const vehiclesData = Array.isArray(vehiclesRes.data) ? vehiclesRes.data : (vehiclesRes.data as any)?.data || (vehiclesRes.data as any)?.vehicles || [];
        setVehicles(vehiclesData);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Computed stats - use API data or fallback to 0
  const activeTrips = stats?.activeTrips ?? 0;
  const scheduledTrips = stats?.scheduledTrips ?? 0;
  const approvedVehicles = stats?.availableVehicles ?? vehicles.filter(v => v.status === "available" && v.approvalStatus === "approved").length;
  const pendingVehicles = stats?.vehiclesPendingApproval ?? vehicles.filter(v => v.approvalStatus === "pending").length;
  const totalVehicles = stats?.totalVehicles ?? vehicles.length;
  const availableDrivers = stats?.availableDrivers ?? staffDrivers.filter(d => d.status === "available").length;
  const totalDrivers = stats?.totalDrivers ?? staffDrivers.length;
  const onTimeRate = stats?.onTimeRate ?? 0;
  const totalDistance = stats?.totalDistance ?? 0;

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

  const handleRefresh = async () => {
    await fetchDashboardData();
  };

  return (
    <DashboardLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Logistics Management</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                Comprehensive logistics, fleet, and journey management
              </p>
            </div>
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
          </div>

          {/* Overview Stats - Always visible */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
                <Truck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{activeTrips}</div>
                    <p className="text-xs text-muted-foreground">{scheduledTrips} scheduled</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fleet Vehicles</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{totalVehicles}</div>
                    <p className="text-xs text-muted-foreground">
                      {pendingVehicles > 0 ? `${pendingVehicles} pending approval` : `${approvedVehicles} available`}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Staff Drivers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{totalDrivers}</div>
                    <p className="text-xs text-muted-foreground">
                      {availableDrivers} available
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{onTimeRate > 0 ? `${onTimeRate}%` : "—"}</div>
                    <p className="text-xs text-muted-foreground">{onTimeRate > 0 ? "This month" : "No data"}</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {totalDistance > 0 
                        ? totalDistance >= 1000 
                          ? `${(totalDistance / 1000).toFixed(1)}K` 
                          : totalDistance
                        : "—"}
                    </div>
                    <p className="text-xs text-muted-foreground">{totalDistance > 0 ? "km this month" : "No data"}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Module Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 h-auto">
              <TabsTrigger value="overview" className="text-xs sm:text-sm gap-1">
                <BarChart3 className="h-4 w-4 hidden sm:block" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="trips" className="text-xs sm:text-sm gap-1">
                <Calendar className="h-4 w-4 hidden sm:block" />
                Trips
              </TabsTrigger>
              <TabsTrigger value="journeys" className="text-xs sm:text-sm gap-1">
                <Navigation className="h-4 w-4 hidden sm:block" />
                Journeys
              </TabsTrigger>
              <TabsTrigger value="fleet" className="text-xs sm:text-sm gap-1">
                <Truck className="h-4 w-4 hidden sm:block" />
                Fleet
              </TabsTrigger>
              <TabsTrigger value="gps" className="text-xs sm:text-sm gap-1">
                <Satellite className="h-4 w-4 hidden sm:block" />
                GPS
              </TabsTrigger>
              <TabsTrigger value="materials" className="text-xs sm:text-sm gap-1">
                <Package className="h-4 w-4 hidden sm:block" />
                Materials
              </TabsTrigger>
              <TabsTrigger value="reports" className="text-xs sm:text-sm gap-1">
                <FileText className="h-4 w-4 hidden sm:block" />
                Reports
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Trips */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Recent Trips
                    </CardTitle>
                    <CardDescription>Latest scheduled and active trips</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : recentTrips.length === 0 ? (
                      <p className="text-center text-muted-foreground py-6">No trips scheduled</p>
                    ) : (
                      <div className="space-y-3">
                        {recentTrips.map((trip) => (
                          <div key={trip.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{trip.route || `${trip.origin} → ${trip.destination}`}</p>
                              <p className="text-xs text-muted-foreground">{trip.driverName || "No driver assigned"}</p>
                            </div>
                            <Badge variant={
                              trip.status === "completed" ? "default" :
                              trip.status === "in_progress" ? "secondary" : "outline"
                            }>
                              {trip.status.replace("_", " ")}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button 
                      variant="link" 
                      className="w-full mt-4"
                      onClick={() => setActiveTab("trips")}
                    >
                      View All Trips →
                    </Button>
                  </CardContent>
                </Card>

                {/* Available Drivers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Available Drivers
                    </CardTitle>
                    <CardDescription>Staff drivers ready for assignment</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {staffDrivers.filter(d => d.status === "available").length === 0 ? (
                      <p className="text-center text-muted-foreground py-6">No available drivers</p>
                    ) : (
                      <div className="space-y-3">
                        {staffDrivers.filter(d => d.status === "available").slice(0, 5).map((driver) => (
                          <div key={driver.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{driver.name}</p>
                              <p className="text-xs text-muted-foreground">{driver.department}</p>
                            </div>
                            <Badge className="bg-success/10 text-success">Available</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button 
                      variant="link" 
                      className="w-full mt-4"
                      onClick={() => setDesignateDriverOpen(true)}
                    >
                      Designate New Driver →
                    </Button>
                  </CardContent>
                </Card>

                {/* Pending Approvals */}
                {pendingVehicles > 0 && (
                  <Card className="lg:col-span-2 border-warning/50 bg-warning/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-warning">
                        <Settings className="h-5 w-5" />
                        Pending Vehicle Approvals ({pendingVehicles})
                      </CardTitle>
                      <CardDescription>
                        Vehicles awaiting review before operational use
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {vehicles.filter(v => v.approvalStatus === "pending").slice(0, 6).map((vehicle) => (
                          <div key={vehicle.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                            <div>
                              <p className="font-medium text-sm">{vehicle.name}</p>
                              <p className="text-xs text-muted-foreground">{vehicle.plate}</p>
                            </div>
                            <Badge className="bg-warning/10 text-warning">Pending</Badge>
                          </div>
                        ))}
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full mt-4"
                        onClick={() => setActiveTab("fleet")}
                      >
                        Review All Vehicles →
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Quick Actions */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex-col gap-2"
                        onClick={() => setActiveTab("trips")}
                      >
                        <Calendar className="h-5 w-5" />
                        <span className="text-sm">Schedule Trip</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex-col gap-2"
                        onClick={() => setActiveTab("journeys")}
                      >
                        <Navigation className="h-5 w-5" />
                        <span className="text-sm">Track Journeys</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex-col gap-2"
                        onClick={() => setActiveTab("fleet")}
                      >
                        <Truck className="h-5 w-5" />
                        <span className="text-sm">Manage Fleet</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex-col gap-2"
                        onClick={() => setActiveTab("materials")}
                      >
                        <Package className="h-5 w-5" />
                        <span className="text-sm">Track Materials</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Trip Scheduling Tab */}
            <TabsContent value="trips">
              <TripScheduling />
            </TabsContent>

            {/* Journey Management Tab */}
            <TabsContent value="journeys">
              <JourneyManagement />
            </TabsContent>

            {/* Fleet Management Tab */}
            <TabsContent value="fleet">
              <FleetManagement />
            </TabsContent>

            {/* GPS Tracking Tab */}
            <TabsContent value="gps">
              <GPSTrackingPlaceholder vehicleCount={totalVehicles} />
            </TabsContent>

            {/* Materials Tracking Tab */}
            <TabsContent value="materials">
              <MaterialsTracking />
            </TabsContent>

            {/* Reporting & Compliance Tab */}
            <TabsContent value="reports">
              <ReportingCompliance />
            </TabsContent>
          </Tabs>
        </div>
      </PullToRefresh>
    </DashboardLayout>
  );
};

export default Logistics;
