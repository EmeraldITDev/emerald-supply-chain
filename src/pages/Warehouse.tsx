import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Warehouse as WarehouseIcon, Package, AlertCircle, CheckCircle, Plus, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Warehouse = () => {
  const locations = [
    { id: "A1", zone: "Zone A", capacity: 1000, occupied: 750, items: 45, type: "Heavy Materials" },
    { id: "A2", zone: "Zone A", capacity: 800, occupied: 320, items: 28, type: "Equipment" },
    { id: "B1", zone: "Zone B", capacity: 1200, occupied: 1100, items: 67, type: "Raw Materials" },
    { id: "C1", zone: "Zone C", capacity: 500, occupied: 150, items: 12, type: "Safety Equipment" },
  ];

  const receipts = [
    { id: "GR-001", supplier: "Steel Works Ltd", items: 5, date: "2024-01-15", status: "Completed", inspector: "John Doe" },
    { id: "GR-002", supplier: "BuildMart", items: 8, date: "2024-01-15", status: "In Progress", inspector: "Jane Smith" },
    { id: "GR-003", supplier: "SafetyFirst Co", items: 3, date: "2024-01-14", status: "Pending", inspector: "-" },
  ];

  const dispatches = [
    { id: "GD-001", destination: "Site A", items: 12, date: "2024-01-15", status: "Dispatched", driver: "Mike Johnson" },
    { id: "GD-002", destination: "Production", items: 6, date: "2024-01-15", status: "Loading", driver: "Tom Brown" },
  ];

  const ehsRecords = [
    { type: "Fire Safety Drill", date: "2024-01-10", status: "Completed", nextDue: "2024-02-10" },
    { type: "Equipment Inspection", date: "2024-01-12", status: "Completed", nextDue: "2024-01-19" },
    { type: "Hazmat Training", date: "2024-01-05", status: "Overdue", nextDue: "2024-01-15" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
      case "Dispatched":
        return "bg-success/10 text-success";
      case "In Progress":
      case "Loading":
        return "bg-info/10 text-info";
      case "Pending":
        return "bg-warning/10 text-warning";
      case "Overdue":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getOccupancyColor = (percentage: number) => {
    if (percentage > 90) return "text-destructive";
    if (percentage > 75) return "text-warning";
    return "text-success";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Warehouse Management</h1>
            <p className="text-muted-foreground mt-2">Manage storage, receipts, dispatch, and EHS compliance</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Receipt
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Locations</CardTitle>
              <MapPin className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground">Across 4 zones</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacity Used</CardTitle>
              <WarehouseIcon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">68%</div>
              <p className="text-xs text-muted-foreground">3,400 / 5,000 sqm</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Receipts</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">5 pending inspection</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">EHS Status</CardTitle>
              <AlertCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1</div>
              <p className="text-xs text-muted-foreground">Action required</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="locations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="locations">Storage Locations</TabsTrigger>
            <TabsTrigger value="receipts">Goods Receipt</TabsTrigger>
            <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
            <TabsTrigger value="ehs">EHS Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="locations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Storage Location Management</CardTitle>
                <CardDescription>Monitor warehouse space utilization and organization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {locations.map((location) => {
                    const occupancyPercentage = (location.occupied / location.capacity) * 100;
                    return (
                      <div key={location.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{location.id}</h3>
                            <p className="text-sm text-muted-foreground">{location.zone}</p>
                          </div>
                          <Badge>{location.type}</Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Capacity</span>
                            <span className={getOccupancyColor(occupancyPercentage)}>
                              {location.occupied} / {location.capacity} sqm ({occupancyPercentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Items Stored</span>
                            <span>{location.items}</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="w-full">View Details</Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Goods Receipt Records</CardTitle>
                <CardDescription>Track incoming materials and inspection status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {receipts.map((receipt) => (
                    <div key={receipt.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{receipt.id}</span>
                          <Badge className={getStatusColor(receipt.status)}>{receipt.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Supplier: {receipt.supplier}</span>
                          <span>Items: {receipt.items}</span>
                          <span>Inspector: {receipt.inspector}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{receipt.date}</p>
                      </div>
                      <Button variant="outline" size="sm">Inspect</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dispatch" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Dispatch Operations</CardTitle>
                <CardDescription>Manage outgoing materials and deliveries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dispatches.map((dispatch) => (
                    <div key={dispatch.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{dispatch.id}</span>
                          <Badge className={getStatusColor(dispatch.status)}>{dispatch.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>To: {dispatch.destination}</span>
                          <span>Items: {dispatch.items}</span>
                          <span>Driver: {dispatch.driver}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{dispatch.date}</p>
                      </div>
                      <Button variant="outline" size="sm">Track</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ehs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>EHS Compliance Records</CardTitle>
                <CardDescription>Environment, Health, and Safety monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ehsRecords.map((record, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{record.type}</span>
                          <Badge className={getStatusColor(record.status)}>{record.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Last Done: {record.date}</span>
                          <span>Next Due: {record.nextDue}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Update</Button>
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

export default Warehouse;
