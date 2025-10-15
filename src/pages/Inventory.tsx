import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Package, AlertTriangle, TrendingUp, Plus, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const Inventory = () => {
  const items = [
    { code: "MAT-001", name: "Steel Rods", category: "Raw Material", stock: 850, reorderPoint: 500, unit: "kg", value: 425000, status: "Good" },
    { code: "MAT-002", name: "Cement Bags", category: "Construction", stock: 120, reorderPoint: 200, unit: "bags", value: 48000, status: "Low Stock" },
    { code: "MAT-003", name: "Electrical Cable", category: "Equipment", stock: 45, reorderPoint: 100, unit: "meters", value: 67500, status: "Critical" },
    { code: "MAT-004", name: "Safety Helmets", category: "Safety", stock: 300, reorderPoint: 100, unit: "pcs", value: 150000, status: "Good" },
  ];

  const recentTransactions = [
    { id: "TR-001", type: "Issue", item: "Steel Rods", quantity: 50, department: "Production", date: "2024-01-15" },
    { id: "TR-002", type: "Receipt", item: "Cement Bags", quantity: 100, department: "Warehouse", date: "2024-01-15" },
    { id: "TR-003", type: "Issue", item: "Safety Helmets", quantity: 20, department: "Site A", date: "2024-01-14" },
  ];

  const lowStockAlerts = [
    { item: "Cement Bags", current: 120, reorder: 200, urgency: "Medium" },
    { item: "Electrical Cable", current: 45, reorder: 100, urgency: "High" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Good":
        return "bg-success/10 text-success";
      case "Low Stock":
        return "bg-warning/10 text-warning";
      case "Critical":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStockPercentage = (current: number, reorder: number) => {
    return Math.min((current / (reorder * 2)) * 100, 100);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
            <p className="text-muted-foreground mt-2">Track stock levels, issuance, and reordering</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">248</div>
              <p className="text-xs text-muted-foreground">Across 12 categories</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦12.5M</div>
              <p className="text-xs text-muted-foreground">Total stock value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">Require reordering</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">156</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Low Stock Alerts</CardTitle>
              <CardDescription>Items requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lowStockAlerts.map((alert) => (
                  <div key={alert.item} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{alert.item}</p>
                        <p className="text-sm text-muted-foreground">
                          Current: {alert.current} | Reorder Point: {alert.reorder}
                        </p>
                      </div>
                      <Badge className={alert.urgency === "High" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}>
                        {alert.urgency}
                      </Badge>
                    </div>
                    <Progress value={(alert.current / alert.reorder) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest stock movements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTransactions.map((txn) => (
                  <div key={txn.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{txn.item}</span>
                      <Badge variant={txn.type === "Receipt" ? "default" : "outline"}>
                        {txn.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {txn.quantity} units • {txn.department}
                    </p>
                    <p className="text-xs text-muted-foreground">{txn.date}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Items</TabsTrigger>
            <TabsTrigger value="raw">Raw Materials</TabsTrigger>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
            <TabsTrigger value="safety">Safety</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Items</CardTitle>
                <CardDescription>Complete list of all stock items</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.code} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{item.code}</span>
                          <span className="text-sm">{item.name}</span>
                          <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Category: {item.category}</span>
                          <span>Stock: {item.stock} {item.unit}</span>
                          <span>Value: ₦{item.value.toLocaleString()}</span>
                        </div>
                        <div className="mt-2">
                          <Progress value={getStockPercentage(item.stock, item.reorderPoint)} className="h-1.5" />
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Manage</Button>
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

export default Inventory;
