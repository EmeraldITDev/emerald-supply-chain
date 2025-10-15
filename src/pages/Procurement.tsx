import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, Package, ShoppingCart } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useEffect, useState } from "react";

const Procurement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { mrfRequests, srfRequests, purchaseOrders } = useApp();

  const vendorFromState = (location.state as any)?.vendor as string | undefined;
  const vendorFromQuery = searchParams.get("vendor") || undefined;
  const vendorFilter = vendorFromState || vendorFromQuery || undefined;

  const [tab, setTab] = useState<string>(vendorFilter ? "po" : "mrf");

  useEffect(() => {
    if (vendorFromState && !vendorFromQuery) {
      setSearchParams({ vendor: vendorFromState } as any, { replace: true } as any);
    }
  }, [vendorFromState]);

  useEffect(() => {
    if (vendorFilter) setTab("po");
  }, [vendorFilter]);

  const filteredPOs = purchaseOrders.filter((po) => !vendorFilter || po.vendor === vendorFilter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-primary/10 text-primary";
      case "Completed":
        return "bg-accent text-accent-foreground";
      case "Pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Procurement</h1>
            <p className="text-muted-foreground mt-2">Manage material and service requests</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="mrf">Material Requests (MRF)</TabsTrigger>
            <TabsTrigger value="srf">Service Requests (SRF)</TabsTrigger>
            <TabsTrigger value="po">Purchase Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="mrf" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => navigate("/procurement/mrf/new")}>
                <Plus className="mr-2 h-4 w-4" />
                New MRF
              </Button>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Material Request Forms</CardTitle>
                <CardDescription>List of all material requisition requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mrfRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{request.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {request.id} • {request.requester} • {request.date}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="srf" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => navigate("/procurement/srf/new")}>
                <Plus className="mr-2 h-4 w-4" />
                New SRF
              </Button>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Service Request Forms</CardTitle>
                <CardDescription>List of all service requisition requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {srfRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{request.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {request.id} • {request.requester} • {request.date}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="po" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Orders</CardTitle>
                <CardDescription>List of all purchase orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredPOs.map((po) => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{po.items}</p>
                          <p className="text-sm text-muted-foreground">
                            {po.id} • {po.vendor} • {po.date}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Delivery: {po.deliveryDate} • {po.amount}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(po.status)}`}>
                        {po.status}
                      </span>
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

export default Procurement;
