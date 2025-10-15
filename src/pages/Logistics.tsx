import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Truck, Users, Calendar, MapPin, Plus, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Logistics = () => {
  const trips = [
    { id: "T001", destination: "Lagos", driver: "John Doe", vehicle: "TRK-001", status: "In Transit", eta: "2 hours" },
    { id: "T002", destination: "Abuja", driver: "Jane Smith", vehicle: "TRK-002", status: "Scheduled", eta: "Tomorrow" },
    { id: "T003", destination: "Port Harcourt", driver: "Mike Johnson", vehicle: "TRK-003", status: "Completed", eta: "-" },
  ];

  const vehicles = [
    { id: "TRK-001", type: "Heavy Truck", status: "Active", maintenance: "Due in 2 weeks", driver: "John Doe" },
    { id: "TRK-002", type: "Van", status: "Active", maintenance: "Up to date", driver: "Jane Smith" },
    { id: "TRK-003", type: "Heavy Truck", status: "Maintenance", maintenance: "In progress", driver: "-" },
  ];

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Logistics Management</h1>
            <p className="text-muted-foreground mt-2">Manage trips, vehicles, and driver operations</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Schedule Trip
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
              <Truck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">2 completing today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fleet Status</CardTitle>
              <Truck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">15/18</div>
              <p className="text-xs text-muted-foreground">Operational vehicles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Drivers</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">22</div>
              <p className="text-xs text-muted-foreground">18 available</p>
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
          <TabsList>
            <TabsTrigger value="trips">Trip Schedule</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicle Fleet</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
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
                    <div key={trip.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{trip.id}</span>
                          <Badge className={getStatusColor(trip.status)}>{trip.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {trip.destination}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {trip.driver}
                          </span>
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            {trip.vehicle}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">ETA: {trip.eta}</p>
                        <Button variant="outline" size="sm" className="mt-2">View Details</Button>
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
                    <div key={vehicle.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{vehicle.id}</span>
                          <Badge className={getStatusColor(vehicle.status)}>{vehicle.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{vehicle.type}</span>
                          <span>Maintenance: {vehicle.maintenance}</span>
                          <span>Driver: {vehicle.driver}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Manage</Button>
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
                    <div key={driver.license} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{driver.name}</span>
                          <Badge className={getStatusColor(driver.status)}>{driver.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>License: {driver.license}</span>
                          <span>Trips: {driver.trips}</span>
                          <span>Rating: {driver.rating}/5.0</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">View Profile</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Logistics;
