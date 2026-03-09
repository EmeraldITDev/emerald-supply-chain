import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Warehouse as WarehouseIcon, Package, CheckCircle, MapPin, Receipt as ReceiptIcon, ClipboardList } from "lucide-react";
import { GRNModule } from "@/components/GRNModule";
import { DailyMaterialsConsumption } from "@/components/warehouse/DailyMaterialsConsumption";
import { useAuth } from "@/contexts/AuthContext";

const Warehouse = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Warehouse Management</h1>
            <p className="text-muted-foreground mt-2">Manage storage, receipts, dispatch, and EHS compliance</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Locations</CardTitle>
              <MapPin className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">No locations configured</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacity Used</CardTitle>
              <WarehouseIcon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0%</div>
              <p className="text-xs text-muted-foreground">Total capacity</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Receipts</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Awaiting processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">EHS Compliance</CardTitle>
              <CheckCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground">No records yet</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="grn" className="space-y-4">
          <TabsList>
            <TabsTrigger value="grn" className="gap-2">
              <ReceiptIcon className="h-4 w-4" />
              GRN Management
            </TabsTrigger>
            <TabsTrigger value="consumption" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Materials Consumption
            </TabsTrigger>
            <TabsTrigger value="locations">Storage Locations</TabsTrigger>
            <TabsTrigger value="dispatch">Goods Dispatch</TabsTrigger>
            <TabsTrigger value="ehs">EHS Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="grn" className="space-y-4">
            <GRNModule userRole={user?.role || 'employee'} />
          </TabsContent>

          <TabsContent value="consumption" className="space-y-4">
            <DailyMaterialsConsumption />
          </TabsContent>

          <TabsContent value="locations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Storage Locations</CardTitle>
                <CardDescription>Warehouse space and capacity management</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">No storage locations configured yet.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dispatch" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Goods Dispatch</CardTitle>
                <CardDescription>Outgoing material movements and tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">No dispatch records yet.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ehs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>EHS Compliance</CardTitle>
                <CardDescription>Environment, Health & Safety records</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">No EHS records yet.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Warehouse;
