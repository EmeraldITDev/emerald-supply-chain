import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Warehouse as WarehouseIcon, Package, AlertCircle, CheckCircle, Plus, MapPin, Receipt as ReceiptIcon } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { GRNModule } from "@/components/GRNModule";
import { useAuth } from "@/contexts/AuthContext";

interface Receipt {
  id: string;
  supplier: string;
  items: number;
  date: string;
  status: string;
  inspector: string;
  poNumber?: string;
}

const Warehouse = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [receiptDetailsOpen, setReceiptDetailsOpen] = useState(false);
  
  // New receipt form
  const [newSupplier, setNewSupplier] = useState("");
  const [newPO, setNewPO] = useState("");
  const [newInspector, setNewInspector] = useState("");
  
  const locations = [
    { id: "A1", zone: "Zone A", capacity: 1000, occupied: 750, items: 45, type: "Heavy Materials" },
    { id: "A2", zone: "Zone A", capacity: 800, occupied: 320, items: 28, type: "Equipment" },
    { id: "B1", zone: "Zone B", capacity: 1200, occupied: 1100, items: 67, type: "Raw Materials" },
    { id: "C1", zone: "Zone C", capacity: 500, occupied: 150, items: 12, type: "Safety Equipment" },
  ];

  const [receipts, setReceipts] = useState<Receipt[]>([
    { id: "GR-001", supplier: "Steel Works Ltd", items: 5, date: "2024-01-15", status: "Completed", inspector: "John Doe", poNumber: "PO-2025-001" },
    { id: "GR-002", supplier: "BuildMart", items: 8, date: "2024-01-15", status: "In Progress", inspector: "Jane Smith", poNumber: "PO-2025-002" },
    { id: "GR-003", supplier: "SafetyFirst Co", items: 3, date: "2024-01-14", status: "Pending", inspector: "-" },
  ]);

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

  const handleViewReceipt = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setReceiptDetailsOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Warehouse Management</h1>
            <p className="text-muted-foreground mt-2">Manage storage, receipts, dispatch, and EHS compliance</p>
          </div>
          <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Receipt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Goods Receipt</DialogTitle>
                <DialogDescription>Record incoming materials</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select value={newSupplier} onValueChange={setNewSupplier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Steel Works Ltd">Steel Works Ltd</SelectItem>
                      <SelectItem value="BuildMart">BuildMart</SelectItem>
                      <SelectItem value="SafetyFirst Co">SafetyFirst Co</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>PO Number</Label>
                  <Input 
                    placeholder="Enter PO number"
                    value={newPO}
                    onChange={(e) => setNewPO(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Inspector</Label>
                  <Select value={newInspector} onValueChange={setNewInspector}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign inspector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="John Doe">John Doe</SelectItem>
                      <SelectItem value="Jane Smith">Jane Smith</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full transition-transform hover:scale-105" onClick={() => {
                  if (!newSupplier || !newInspector) {
                    toast({ title: "Validation Error", description: "Please fill required fields", variant: "destructive" });
                    return;
                  }
                  
                  const newReceipt: Receipt = {
                    id: `GR-${String(receipts.length + 1).padStart(3, '0')}`,
                    supplier: newSupplier,
                    items: 0,
                    date: new Date().toISOString().split('T')[0],
                    status: "Pending",
                    inspector: newInspector,
                    poNumber: newPO || undefined
                  };
                  
                  setReceipts([newReceipt, ...receipts]);
                  toast({ title: "Receipt Created", description: `${newReceipt.id} has been created` });
                  
                  // Reset form
                  setNewSupplier("");
                  setNewPO("");
                  setNewInspector("");
                  setReceiptDialogOpen(false);
                }}>
                  Create Receipt
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Locations</CardTitle>
              <MapPin className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{locations.length}</div>
              <p className="text-xs text-muted-foreground">Across 4 zones</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacity Used</CardTitle>
              <WarehouseIcon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round((locations.reduce((sum, loc) => sum + loc.occupied, 0) / locations.reduce((sum, loc) => sum + loc.capacity, 0)) * 100)}%
              </div>
              <p className="text-xs text-muted-foreground">Total capacity</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Receipts</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{receipts.filter(r => r.status === "Pending").length}</div>
              <p className="text-xs text-muted-foreground">Awaiting processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">EHS Compliance</CardTitle>
              <CheckCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round((ehsRecords.filter(r => r.status === "Completed").length / ehsRecords.length) * 100)}%
              </div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="grn" className="space-y-4">
          <TabsList>
            <TabsTrigger value="grn" className="gap-2">
              <ReceiptIcon className="h-4 w-4" />
              GRN Management
            </TabsTrigger>
            <TabsTrigger value="locations">Storage Locations</TabsTrigger>
            <TabsTrigger value="receipts">Legacy Receipts</TabsTrigger>
            <TabsTrigger value="dispatch">Goods Dispatch</TabsTrigger>
            <TabsTrigger value="ehs">EHS Compliance</TabsTrigger>
          </TabsList>

          {/* GRN Module - New Tab */}
          <TabsContent value="grn" className="space-y-4">
            <GRNModule userRole={user?.role || 'employee'} />
          </TabsContent>

          <TabsContent value="locations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Storage Locations</CardTitle>
                <CardDescription>Warehouse space and capacity management</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {locations.map((location) => {
                    const occupancy = (location.occupied / location.capacity) * 100;
                    return (
                      <div key={location.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{location.id} - {location.zone}</span>
                          </div>
                          <span className={`text-sm font-medium ${getOccupancyColor(occupancy)}`}>
                            {occupancy.toFixed(0)}% occupied
                          </span>
                        </div>
                        <div className="space-y-2">
                          <Progress value={occupancy} className="h-2" />
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{location.type}</span>
                            <span>{location.items} items</span>
                            <span>{location.occupied}/{location.capacity} sq.m</span>
                          </div>
                        </div>
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
                <CardTitle>Goods Receipts</CardTitle>
                <CardDescription>Incoming material receipts and inspection</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {receipts.map((receipt) => (
                    <div key={receipt.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{receipt.id}</span>
                          <Badge className={getStatusColor(receipt.status)}>{receipt.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{receipt.supplier}</span>
                          <span>{receipt.items} items</span>
                          <span>Inspector: {receipt.inspector}</span>
                          <span>{receipt.date}</span>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewReceipt(receipt)}
                      >
                        View Details
                      </Button>
                    </div>
                  ))}
                </div>
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
                <div className="space-y-3">
                  {dispatches.map((dispatch) => (
                    <div key={dispatch.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{dispatch.id}</span>
                          <Badge className={getStatusColor(dispatch.status)}>{dispatch.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>To: {dispatch.destination}</span>
                          <span>{dispatch.items} items</span>
                          <span>Driver: {dispatch.driver}</span>
                          <span>{dispatch.date}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Track
                      </Button>
                    </div>
                  ))}
                </div>
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
                <div className="space-y-3">
                  {ehsRecords.map((record, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {record.status === "Completed" ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="font-semibold">{record.type}</span>
                          <Badge className={getStatusColor(record.status)}>{record.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Last: {record.date}</span>
                          <span>Next Due: {record.nextDue}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Update
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Receipt Details Dialog */}
      <Dialog open={receiptDetailsOpen} onOpenChange={setReceiptDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receipt Details - {selectedReceipt?.id}</DialogTitle>
            <DialogDescription>Complete goods receipt information</DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Receipt ID</Label>
                  <p className="font-medium">{selectedReceipt.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedReceipt.status)}>{selectedReceipt.status}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Supplier</Label>
                  <p className="font-medium">{selectedReceipt.supplier}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">PO Number</Label>
                  <p className="font-medium">{selectedReceipt.poNumber || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-medium">{selectedReceipt.date}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Items Count</Label>
                  <p className="font-medium">{selectedReceipt.items} items</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Inspector</Label>
                  <p className="font-medium">{selectedReceipt.inspector}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  className="flex-1"
                  onClick={() => {
                    if (selectedReceipt && selectedReceipt.status !== "Completed") {
                      const updatedReceipts = receipts.map(r => 
                        r.id === selectedReceipt.id 
                          ? { ...r, status: "Completed" }
                          : r
                      );
                      setReceipts(updatedReceipts);
                      toast({ title: "Inspection Complete", description: `${selectedReceipt.id} marked as completed` });
                      setReceiptDetailsOpen(false);
                    }
                  }}
                  disabled={selectedReceipt?.status === "Completed"}
                >
                  {selectedReceipt?.status === "Completed" ? "Already Completed" : "Complete Inspection"}
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 transition-transform hover:scale-105"
                  onClick={() => {
                    window.print();
                  }}
                >
                  Print Receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Warehouse;
