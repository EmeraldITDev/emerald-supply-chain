import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Receipt as ReceiptIcon, ClipboardList } from "lucide-react";
import { GRNModule } from "@/components/GRNModule";
import { DailyMaterialsConsumption } from "@/components/warehouse/DailyMaterialsConsumption";
import { WarehouseDashboardPanel } from "@/components/warehouse/WarehouseDashboardPanel";
import { WarehouseStructureManager } from "@/components/warehouse/WarehouseStructureManager";
import { ItemCatalogue } from "@/components/warehouse/ItemCatalogue";
import { InventoryTable } from "@/components/warehouse/InventoryTable";
import { StockMovements } from "@/components/warehouse/StockMovements";
import { StockCountsPanel } from "@/components/warehouse/StockCountsPanel";
import { LowStockAlerts } from "@/components/warehouse/LowStockAlerts";
import { WarehouseReports } from "@/components/warehouse/WarehouseReports";
import { useAuth } from "@/contexts/AuthContext";
import { getScmRole } from "@/utils/scmRole";
import {
  canAccessWarehouse,
  canManageWarehouse,
  canRaiseMrfFromWarehouse,
  canViewInventoryValuation,
} from "@/utils/warehouseAccess";

const Warehouse = () => {
  const { user } = useAuth();
  const canManage = canManageWarehouse(user);
  const canValuation = canViewInventoryValuation(user);

  if (!canAccessWarehouse(user)) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Management</CardTitle>
            <CardDescription>You do not have access to the warehouse module.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact an administrator if you need warehouse or inventory access.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Warehouse &amp; Inventory</h1>
          <p className="text-muted-foreground mt-2">
            Structure, stock, goods receipt, counting and reporting across every Emerald location
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <div className="overflow-x-auto">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="catalogue">Item Catalogue</TabsTrigger>
              <TabsTrigger value="structure">Structure</TabsTrigger>
              <TabsTrigger value="movements">Movements</TabsTrigger>
              <TabsTrigger value="counts">Counting</TabsTrigger>
              <TabsTrigger value="grn" className="gap-2">
                <ReceiptIcon className="h-4 w-4" />
                Goods Receipt
              </TabsTrigger>
              <TabsTrigger value="consumption" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Consumption
              </TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4">
            <WarehouseDashboardPanel canViewValuation={canValuation} />
            <LowStockAlerts canRaiseMrf={canRaiseMrfFromWarehouse(user)} />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <InventoryTable />
          </TabsContent>

          <TabsContent value="catalogue" className="space-y-4">
            <ItemCatalogue canManage={canManage} />
          </TabsContent>

          <TabsContent value="structure" className="space-y-4">
            <WarehouseStructureManager canManage={canManage} />
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            <StockMovements canManage={canManage} />
          </TabsContent>

          <TabsContent value="counts" className="space-y-4">
            <StockCountsPanel canManage={canManage} />
          </TabsContent>

          <TabsContent value="grn" className="space-y-4">
            <GRNModule userRole={getScmRole(user) || 'employee'} />
          </TabsContent>

          <TabsContent value="consumption" className="space-y-4">
            <DailyMaterialsConsumption />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <WarehouseReports canViewValuation={canValuation} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Warehouse;
