import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Truck, Users, Calendar, MapPin, Plus, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import type { Trip, Vehicle } from "@/contexts/AppContext";

const Logistics = () => {
  const { toast } = useToast();
  const { trips, vehicles } = useApp();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [tripDetailsOpen, setTripDetailsOpen] = useState(false);
  const [vehicleDetailsOpen, setVehicleDetailsOpen] = useState(false);

  const drivers = [
    { name: "John Doe", license: "ABC123456", trips: 45, rating: 4.8, status: "On Trip" },
    { name: "Jane Smith", license: "DEF789012", trips: 38, rating: 4.9, status: "Available" },
    { name: "Mike Johnson", license: "GHI345678", trips: 52, rating: 4.7, status: "Available" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
      case "Available":
      case "Completed":
        return "bg-success/10 text-success";
      case "In Transit":
      case "On Trip":
        return "bg-info/10 text-info";
      case "Scheduled":
        return "bg-warning/10 text-warning";
      case "Maintenance":
        return "bg-muted text-muted-foreground";
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
    setVehicleDetailsOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Logistics Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Manage trips, vehicles, and driver operations</p>
          </div>
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
                <DialogDescription>Create a new logistics trip assignment</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Input placeholder="Enter destination" />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.id} - {v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Driver</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.filter(d => d.status === "Available").map(d => (
                        <SelectItem key={d.license} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => {
                  toast({ title: "Trip Scheduled", description: "New trip has been added to the schedule" });
                  setScheduleDialogOpen(false);
                }}>
                  Schedule Trip
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
              <CardTitle className="text-sm font-medium">Fleet Status</CardTitle>
              <Truck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vehicles.filter(v => v.status === "Active").length}/{vehicles.length}</div>
              <p className="text-xs text-muted-foreground">Operational vehicles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Drivers</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{drivers.length}</div>
              <p className="text-xs text-muted-foreground">{drivers.filter(d => d.status === "Available").length} available</p>
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

        <Tabs defaultValue="trips" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="trips" className="text-xs sm:text-sm">Trip Schedule</TabsTrigger>
            <TabsTrigger value="vehicles" className="text-xs sm:text-sm">Vehicle Fleet</TabsTrigger>
            <TabsTrigger value="drivers" className="text-xs sm:text-sm">Drivers</TabsTrigger>
          </TabsList>

          <TabsContent value="trips" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Trips</CardTitle>
                <CardDescription>Track and manage material/personnel movement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trips.map((trip) => (
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
                        <p className="text-xs sm:text-sm font-medium whitespace-nowrap">Departs: {trip.departure}</p>
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
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vehicles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Fleet</CardTitle>
                <CardDescription>Monitor vehicle status, licensing, and maintenance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold truncate">{vehicle.name} ({vehicle.id})</span>
                          <Badge className={getStatusColor(vehicle.status)}>{vehicle.status}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                          <span className="whitespace-nowrap">{vehicle.type}</span>
                          <span className="whitespace-nowrap">Plate: {vehicle.plate}</span>
                          <span className="whitespace-nowrap">Driver: {vehicle.driver}</span>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewVehicleDetails(vehicle)}
                        className="self-start sm:self-center"
                      >
                        Manage
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Driver Management</CardTitle>
                <CardDescription>Track driver assignments and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {drivers.map((driver) => (
                    <div key={driver.license} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold truncate">{driver.name}</span>
                          <Badge className={getStatusColor(driver.status)}>{driver.status}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                          <span className="whitespace-nowrap">License: {driver.license}</span>
                          <span className="whitespace-nowrap">Trips: {driver.trips}</span>
                          <span className="whitespace-nowrap">Rating: {driver.rating}/5.0</span>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toast({ 
                          title: "Driver Profile", 
                          description: `${driver.name} - ${driver.trips} completed trips with ${driver.rating}/5.0 rating` 
                        })}
                        className="self-start sm:self-center"
                      >
                        View Profile
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Trip Details Dialog */}
      <Dialog open={tripDetailsOpen} onOpenChange={setTripDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trip Details - {selectedTrip?.id}</DialogTitle>
            <DialogDescription>Complete trip information and tracking</DialogDescription>
          </DialogHeader>
          {selectedTrip && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Route</Label>
                  <p className="font-medium">{selectedTrip.route}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedTrip.status)}>{selectedTrip.status}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vehicle</Label>
                  <p className="font-medium">{selectedTrip.vehicle}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Driver</Label>
                  <p className="font-medium">{selectedTrip.driver}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Departure</Label>
                  <p className="font-medium">{selectedTrip.departure}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Arrival (ETA)</Label>
                  <p className="font-medium">{selectedTrip.arrival}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Cargo Details</Label>
                  <p className="font-medium">{selectedTrip.cargo}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Vehicle Details Dialog */}
      <Dialog open={vehicleDetailsOpen} onOpenChange={setVehicleDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vehicle Management - {selectedVehicle?.name}</DialogTitle>
            <DialogDescription>Vehicle details and maintenance records</DialogDescription>
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
                  <Label className="text-muted-foreground">Plate Number</Label>
                  <p className="font-medium">{selectedVehicle.plate}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Assigned Driver</Label>
                  <p className="font-medium">{selectedVehicle.driver}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Maintenance</Label>
                  <p className="font-medium">{selectedVehicle.lastMaintenance}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1">Schedule Maintenance</Button>
                <Button variant="outline" className="flex-1">Update Status</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Logistics;
