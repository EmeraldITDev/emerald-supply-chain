import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MapPin,
  Satellite,
  Signal,
  Navigation2,
  Radio,
  Clock,
  Truck,
  AlertCircle,
  Settings,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GPSTrackingPlaceholderProps {
  vehicleCount?: number;
}

export const GPSTrackingPlaceholder = ({ vehicleCount = 0 }: GPSTrackingPlaceholderProps) => {
  const mockVehicleLocations = [
    { id: "VEH-001", plate: "ABC-123-XY", name: "Toyota Hilux", status: "moving", lastSeen: "2 min ago" },
    { id: "VEH-002", plate: "DEF-456-XY", name: "Ford Transit", status: "stopped", lastSeen: "5 min ago" },
    { id: "VEH-003", plate: "GHI-789-XY", name: "Mercedes Sprinter", status: "offline", lastSeen: "1 hr ago" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Satellite className="h-5 w-5 text-primary" />
            GPS Tracking
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time vehicle location tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" disabled>
            <Settings className="mr-2 h-4 w-4" />
            Configure
          </Button>
        </div>
      </div>

      {/* Feature Not Available Alert */}
      <Alert className="border-warning/50 bg-warning/5">
        <AlertCircle className="h-4 w-4 text-warning" />
        <AlertDescription className="text-sm">
          <strong>Coming Soon:</strong> GPS tracking integration is currently under development. 
          This feature will enable real-time vehicle location tracking, route history, 
          geofencing alerts, and driver behavior monitoring.
        </AlertDescription>
      </Alert>

      {/* Stats Cards - Disabled */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="opacity-60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GPS-Enabled</CardTitle>
            <Satellite className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">of {vehicleCount} vehicles</p>
          </CardContent>
        </Card>
        <Card className="opacity-60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Moving</CardTitle>
            <Navigation2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">real-time tracking</p>
          </CardContent>
        </Card>
        <Card className="opacity-60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Signal Status</CardTitle>
            <Signal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">device connections</p>
          </CardContent>
        </Card>
        <Card className="opacity-60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">geofence & speed</p>
          </CardContent>
        </Card>
      </div>

      {/* Map Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Live Map View</CardTitle>
          <CardDescription>
            Real-time vehicle locations will be displayed here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative h-[400px] rounded-lg bg-muted/30 border-2 border-dashed flex flex-col items-center justify-center gap-4">
            <div className="absolute inset-0 opacity-10">
              {/* Grid pattern to simulate map */}
              <div className="w-full h-full" style={{
                backgroundImage: `
                  linear-gradient(to right, hsl(var(--muted-foreground)) 1px, transparent 1px),
                  linear-gradient(to bottom, hsl(var(--muted-foreground)) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px'
              }} />
            </div>
            
            {/* Placeholder Markers */}
            <div className="absolute top-1/4 left-1/4">
              <div className="animate-pulse">
                <MapPin className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </div>
            <div className="absolute top-1/2 left-1/2">
              <div className="animate-pulse delay-300">
                <MapPin className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </div>
            <div className="absolute bottom-1/3 right-1/3">
              <div className="animate-pulse delay-700">
                <MapPin className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </div>

            {/* Center Content */}
            <div className="relative z-10 text-center">
              <Satellite className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">GPS Integration Pending</h3>
              <p className="text-sm text-muted-foreground/70 max-w-md">
                Connect GPS devices to vehicles to enable real-time tracking, 
                route optimization, and fleet analytics
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle List - Disabled State */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Tracking Status</CardTitle>
          <CardDescription>
            Overview of GPS device status for fleet vehicles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockVehicleLocations.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-muted">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{vehicle.name}</p>
                    <p className="text-xs text-muted-foreground">{vehicle.plate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      vehicle.status === "moving" && "border-success text-success",
                      vehicle.status === "stopped" && "border-warning text-warning",
                      vehicle.status === "offline" && "border-muted-foreground text-muted-foreground"
                    )}
                  >
                    <Radio className="h-3 w-3 mr-1" />
                    {vehicle.status === "offline" ? "No GPS" : vehicle.status}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {vehicle.lastSeen}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features Coming Soon */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">Upcoming GPS Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Live Tracking</p>
                <p className="text-xs text-muted-foreground">Real-time vehicle positions</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Navigation2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Route History</p>
                <p className="text-xs text-muted-foreground">Historical trip playback</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <AlertCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Geofencing</p>
                <p className="text-xs text-muted-foreground">Zone entry/exit alerts</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Signal className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Speed Monitoring</p>
                <p className="text-xs text-muted-foreground">Driver behavior analytics</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GPSTrackingPlaceholder;
