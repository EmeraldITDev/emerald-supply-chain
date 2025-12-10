import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, CheckCircle, Clock, AlertTriangle, Send, FileText, Truck, Receipt, Eye, Download, ArrowRight } from "lucide-react";
import type { GRN, GRNItem, CreateGRNData } from "@/types/grn";

interface GRNModuleProps {
  userRole: string;
}

export const GRNModule = ({ userRole }: GRNModuleProps) => {
  const { toast } = useToast();
  
  // GRN State - persisted to localStorage
  const [grns, setGrns] = useState<GRN[]>(() => {
    const stored = localStorage.getItem("grns");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored GRNs", e);
      }
    }
    // Demo data
    return [
      {
        id: "GRN-001",
        grnNumber: "GRN-2025-0001",
        poNumber: "PO-2025-001",
        vendorId: "V001",
        vendorName: "Steel Works Ltd",
        receivedDate: "2025-01-10",
        receivedBy: "Warehouse Manager",
        inspectedBy: "Quality Inspector",
        inspectionDate: "2025-01-10",
        items: [
          { id: "1", name: "Steel Pipes", quantityOrdered: 100, quantityReceived: 100, unitPrice: 5000, totalAmount: 500000, condition: "Good" },
          { id: "2", name: "Steel Rods", quantityOrdered: 50, quantityReceived: 48, unitPrice: 3000, totalAmount: 144000, condition: "Partial", remarks: "2 units damaged in transit" },
        ],
        totalAmount: 644000,
        status: "With Finance",
        warehouseLocation: "Zone A",
        deliveryNoteNumber: "DN-12345",
        invoiceNumber: "INV-2025-001",
        invoiceAmount: 644000,
        financeReceivedDate: "2025-01-10",
        createdAt: "2025-01-10T08:00:00Z",
        updatedAt: "2025-01-10T10:00:00Z",
      },
      {
        id: "GRN-002",
        grnNumber: "GRN-2025-0002",
        poNumber: "PO-2025-002",
        vendorId: "V002",
        vendorName: "BuildMart",
        receivedDate: "2025-01-12",
        receivedBy: "Warehouse Staff",
        items: [
          { id: "1", name: "Cement Bags", quantityOrdered: 200, quantityReceived: 200, unitPrice: 4500, totalAmount: 900000, condition: "Good" },
        ],
        totalAmount: 900000,
        status: "Pending Inspection",
        warehouseLocation: "Zone B",
        deliveryNoteNumber: "DN-12346",
        createdAt: "2025-01-12T09:00:00Z",
        updatedAt: "2025-01-12T09:00:00Z",
      },
      {
        id: "GRN-003",
        grnNumber: "GRN-2025-0003",
        poNumber: "PO-2025-003",
        vendorId: "V003",
        vendorName: "SafetyFirst Co",
        receivedDate: "2025-01-14",
        receivedBy: "Warehouse Manager",
        inspectedBy: "Quality Inspector",
        inspectionDate: "2025-01-14",
        items: [
          { id: "1", name: "Safety Helmets", quantityOrdered: 50, quantityReceived: 50, unitPrice: 2500, totalAmount: 125000, condition: "Good" },
          { id: "2", name: "Safety Vests", quantityOrdered: 100, quantityReceived: 100, unitPrice: 1500, totalAmount: 150000, condition: "Good" },
        ],
        totalAmount: 275000,
        status: "Payment Processing",
        warehouseLocation: "Zone C",
        deliveryNoteNumber: "DN-12347",
        invoiceNumber: "INV-2025-003",
        invoiceAmount: 275000,
        financeReceivedDate: "2025-01-14",
        financeProcessedBy: "Finance Manager",
        paymentStatus: "Approved",
        createdAt: "2025-01-14T10:00:00Z",
        updatedAt: "2025-01-14T14:00:00Z",
      },
    ];
  });

  // Persist GRNs to localStorage
  const saveGrns = (newGrns: GRN[]) => {
    setGrns(newGrns);
    localStorage.setItem("grns", JSON.stringify(newGrns));
  };

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Form state for new GRN
  const [newGRN, setNewGRN] = useState<Partial<CreateGRNData>>({
    items: [],
  });
  const [newItem, setNewItem] = useState<Partial<GRNItem>>({});

  // Stats
  const stats = useMemo(() => ({
    pendingInspection: grns.filter(g => g.status === "Pending Inspection").length,
    inspected: grns.filter(g => g.status === "Inspected").length,
    withFinance: grns.filter(g => g.status === "With Finance" || g.status === "Payment Processing").length,
    completed: grns.filter(g => g.status === "Completed").length,
    total: grns.length,
  }), [grns]);

  const filteredGRNs = useMemo(() => {
    if (activeTab === "all") return grns;
    if (activeTab === "pending") return grns.filter(g => g.status === "Pending Inspection");
    if (activeTab === "inspected") return grns.filter(g => g.status === "Inspected" || g.status === "Approved");
    if (activeTab === "finance") return grns.filter(g => g.status === "With Finance" || g.status === "Payment Processing");
    if (activeTab === "completed") return grns.filter(g => g.status === "Completed");
    return grns;
  }, [grns, activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "bg-success/10 text-success";
      case "With Finance": case "Payment Processing": return "bg-info/10 text-info";
      case "Inspected": case "Approved": return "bg-primary/10 text-primary";
      case "Pending Inspection": return "bg-warning/10 text-warning";
      case "Rejected": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const handleCreateGRN = () => {
    if (!newGRN.poNumber || !newGRN.vendorName || !newGRN.items?.length) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields and add at least one item",
        variant: "destructive",
      });
      return;
    }

    const totalAmount = newGRN.items.reduce((sum, item) => sum + item.totalAmount, 0);
    const grnNumber = `GRN-${new Date().getFullYear()}-${String(grns.length + 1).padStart(4, "0")}`;

    const grn: GRN = {
      id: `GRN-${Date.now()}`,
      grnNumber,
      poNumber: newGRN.poNumber,
      vendorId: newGRN.vendorId || "",
      vendorName: newGRN.vendorName,
      receivedDate: new Date().toISOString().split("T")[0],
      receivedBy: localStorage.getItem("userName") || "Warehouse Staff",
      items: newGRN.items.map((item, idx) => ({ ...item, id: String(idx + 1) })),
      totalAmount,
      status: "Pending Inspection",
      warehouseLocation: newGRN.warehouseLocation,
      deliveryNoteNumber: newGRN.deliveryNoteNumber,
      invoiceNumber: newGRN.invoiceNumber,
      invoiceAmount: newGRN.invoiceAmount,
      remarks: newGRN.remarks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveGrns([grn, ...grns]);

    toast({
      title: "GRN Created",
      description: `${grnNumber} has been created and is pending inspection`,
    });

    setCreateDialogOpen(false);
    setNewGRN({ items: [] });
  };

  const handleInspectGRN = (grn: GRN) => {
    const updatedGrns = grns.map(g => {
      if (g.id === grn.id) {
        return {
          ...g,
          status: "Inspected" as const,
          inspectedBy: localStorage.getItem("userName") || "Quality Inspector",
          inspectionDate: new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString(),
        };
      }
      return g;
    });
    saveGrns(updatedGrns);
    toast({
      title: "GRN Inspected",
      description: "The goods have been inspected and approved",
    });
  };

  const handleForwardToFinance = (grn: GRN) => {
    const updatedGrns = grns.map(g => {
      if (g.id === grn.id) {
        return {
          ...g,
          status: "With Finance" as const,
          financeReceivedDate: new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString(),
        };
      }
      return g;
    });
    saveGrns(updatedGrns);
    toast({
      title: "Forwarded to Finance",
      description: "GRN has been automatically sent to Finance for payment processing",
    });
  };

  const handleProcessPayment = (grn: GRN) => {
    const updatedGrns = grns.map(g => {
      if (g.id === grn.id) {
        return {
          ...g,
          status: "Payment Processing" as const,
          financeProcessedBy: localStorage.getItem("userName") || "Finance Manager",
          paymentStatus: "Approved" as const,
          updatedAt: new Date().toISOString(),
        };
      }
      return g;
    });
    saveGrns(updatedGrns);
    toast({
      title: "Payment Processing",
      description: "Payment has been initiated for this GRN",
    });
  };

  const handleCompletePayment = (grn: GRN) => {
    const updatedGrns = grns.map(g => {
      if (g.id === grn.id) {
        return {
          ...g,
          status: "Completed" as const,
          paymentStatus: "Paid" as const,
          updatedAt: new Date().toISOString(),
        };
      }
      return g;
    });
    saveGrns(updatedGrns);
    toast({
      title: "Payment Completed",
      description: "GRN has been fully processed and paid",
    });
  };

  const addItemToGRN = () => {
    if (!newItem.name || !newItem.quantityOrdered || !newItem.unitPrice) {
      toast({
        title: "Validation Error",
        description: "Please fill item name, quantity, and unit price",
        variant: "destructive",
      });
      return;
    }

    const item: GRNItem = {
      id: String(Date.now()),
      name: newItem.name,
      description: newItem.description,
      quantityOrdered: newItem.quantityOrdered,
      quantityReceived: newItem.quantityReceived || newItem.quantityOrdered,
      unitPrice: newItem.unitPrice,
      totalAmount: (newItem.quantityReceived || newItem.quantityOrdered) * newItem.unitPrice,
      condition: newItem.condition || "Good",
      remarks: newItem.remarks,
    };

    setNewGRN(prev => ({
      ...prev,
      items: [...(prev.items || []), item],
    }));
    setNewItem({});
  };

  const canViewFinanceActions = ['finance', 'admin', 'chairman'].includes(userRole);
  const canViewWarehouseActions = ['logistics', 'warehouse', 'admin', 'supply_chain_director', 'procurement'].includes(userRole);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Inspection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pendingInspection}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inspected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.inspected}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">With Finance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{stats.withFinance}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total GRNs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Goods Received Notes</h3>
          <p className="text-sm text-muted-foreground">Track goods receipt and payment processing</p>
        </div>
        {canViewWarehouseActions && (
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New GRN
          </Button>
        )}
      </div>

      {/* GRN List with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending Inspection</TabsTrigger>
          <TabsTrigger value="inspected">Inspected</TabsTrigger>
          <TabsTrigger value="finance">With Finance</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {filteredGRNs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No GRNs found</p>
                  </div>
                ) : (
                  filteredGRNs.map((grn) => (
                    <div key={grn.id} className="p-4 border rounded-lg hover:bg-accent/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono font-semibold">{grn.grnNumber}</span>
                            <Badge className={getStatusColor(grn.status)}>{grn.status}</Badge>
                            {grn.paymentStatus && (
                              <Badge variant="outline">{grn.paymentStatus}</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Vendor</p>
                              <p className="font-medium">{grn.vendorName}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">PO Number</p>
                              <p className="font-medium">{grn.poNumber}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Amount</p>
                              <p className="font-medium">₦{grn.totalAmount.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Received Date</p>
                              <p className="font-medium">{new Date(grn.receivedDate).toLocaleDateString()}</p>
                            </div>
                          </div>

                          {/* Progress Indicator */}
                          <div className="mt-4 flex items-center gap-2">
                            <div className={`flex items-center gap-1 ${grn.status !== 'Pending Inspection' ? 'text-success' : 'text-muted-foreground'}`}>
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">Received</span>
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <div className={`flex items-center gap-1 ${['Inspected', 'Approved', 'With Finance', 'Payment Processing', 'Completed'].includes(grn.status) ? 'text-success' : 'text-muted-foreground'}`}>
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">Inspected</span>
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <div className={`flex items-center gap-1 ${['With Finance', 'Payment Processing', 'Completed'].includes(grn.status) ? 'text-success' : 'text-muted-foreground'}`}>
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">Finance</span>
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <div className={`flex items-center gap-1 ${grn.status === 'Completed' ? 'text-success' : 'text-muted-foreground'}`}>
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">Paid</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedGRN(grn);
                              setDetailsDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          
                          {grn.status === "Pending Inspection" && canViewWarehouseActions && (
                            <Button 
                              size="sm"
                              onClick={() => handleInspectGRN(grn)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Inspect
                            </Button>
                          )}

                          {grn.status === "Inspected" && canViewWarehouseActions && (
                            <Button 
                              size="sm"
                              onClick={() => handleForwardToFinance(grn)}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              To Finance
                            </Button>
                          )}

                          {grn.status === "With Finance" && canViewFinanceActions && (
                            <Button 
                              size="sm"
                              onClick={() => handleProcessPayment(grn)}
                            >
                              <Receipt className="h-4 w-4 mr-1" />
                              Process
                            </Button>
                          )}

                          {grn.status === "Payment Processing" && canViewFinanceActions && (
                            <Button 
                              size="sm"
                              className="bg-success hover:bg-success/90"
                              onClick={() => handleCompletePayment(grn)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create GRN Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Goods Received Note</DialogTitle>
            <DialogDescription>Record incoming goods from vendor delivery</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PO Number *</Label>
                <Input 
                  placeholder="PO-2025-XXX"
                  value={newGRN.poNumber || ""}
                  onChange={(e) => setNewGRN(prev => ({ ...prev, poNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor Name *</Label>
                <Input 
                  placeholder="Vendor name"
                  value={newGRN.vendorName || ""}
                  onChange={(e) => setNewGRN(prev => ({ ...prev, vendorName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery Note Number</Label>
                <Input 
                  placeholder="DN-XXXXX"
                  value={newGRN.deliveryNoteNumber || ""}
                  onChange={(e) => setNewGRN(prev => ({ ...prev, deliveryNoteNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Warehouse Location</Label>
                <Select 
                  value={newGRN.warehouseLocation || ""} 
                  onValueChange={(val) => setNewGRN(prev => ({ ...prev, warehouseLocation: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Zone A">Zone A - Heavy Materials</SelectItem>
                    <SelectItem value="Zone B">Zone B - Raw Materials</SelectItem>
                    <SelectItem value="Zone C">Zone C - Safety Equipment</SelectItem>
                    <SelectItem value="Zone D">Zone D - General Storage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input 
                  placeholder="INV-XXXXX"
                  value={newGRN.invoiceNumber || ""}
                  onChange={(e) => setNewGRN(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Amount</Label>
                <Input 
                  type="number"
                  placeholder="0"
                  value={newGRN.invoiceAmount || ""}
                  onChange={(e) => setNewGRN(prev => ({ ...prev, invoiceAmount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Add Items */}
            <div className="space-y-4">
              <h4 className="font-semibold">Items Received</h4>
              
              <div className="grid grid-cols-6 gap-2 items-end">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Item Name *</Label>
                  <Input 
                    placeholder="Item name"
                    value={newItem.name || ""}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Qty Ordered *</Label>
                  <Input 
                    type="number"
                    placeholder="0"
                    value={newItem.quantityOrdered || ""}
                    onChange={(e) => setNewItem(prev => ({ ...prev, quantityOrdered: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Qty Received</Label>
                  <Input 
                    type="number"
                    placeholder="0"
                    value={newItem.quantityReceived || ""}
                    onChange={(e) => setNewItem(prev => ({ ...prev, quantityReceived: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit Price (₦) *</Label>
                  <Input 
                    type="number"
                    placeholder="0"
                    value={newItem.unitPrice || ""}
                    onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <Button onClick={addItemToGRN}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Items List */}
              {newGRN.items && newGRN.items.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newGRN.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.quantityOrdered}</TableCell>
                        <TableCell>{item.quantityReceived}</TableCell>
                        <TableCell>₦{item.unitPrice.toLocaleString()}</TableCell>
                        <TableCell>₦{item.totalAmount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-semibold">Total</TableCell>
                      <TableCell className="font-semibold">
                        ₦{newGRN.items.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea 
                placeholder="Any additional notes or observations..."
                value={newGRN.remarks || ""}
                onChange={(e) => setNewGRN(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateGRN}>Create GRN</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GRN Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>GRN Details - {selectedGRN?.grnNumber}</DialogTitle>
            <DialogDescription>Complete goods received note information</DialogDescription>
          </DialogHeader>

          {selectedGRN && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(selectedGRN.status)}>{selectedGRN.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PO Number</p>
                  <p className="font-medium">{selectedGRN.poNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-medium">{selectedGRN.vendorName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Received Date</p>
                  <p className="font-medium">{new Date(selectedGRN.receivedDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Received By</p>
                  <p className="font-medium">{selectedGRN.receivedBy}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Warehouse Location</p>
                  <p className="font-medium">{selectedGRN.warehouseLocation || "N/A"}</p>
                </div>
                {selectedGRN.inspectedBy && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Inspected By</p>
                      <p className="font-medium">{selectedGRN.inspectedBy}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Inspection Date</p>
                      <p className="font-medium">{selectedGRN.inspectionDate}</p>
                    </div>
                  </>
                )}
                {selectedGRN.financeReceivedDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Finance Received</p>
                    <p className="font-medium">{selectedGRN.financeReceivedDate}</p>
                  </div>
                )}
                {selectedGRN.financeProcessedBy && (
                  <div>
                    <p className="text-sm text-muted-foreground">Processed By</p>
                    <p className="font-medium">{selectedGRN.financeProcessedBy}</p>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-semibold mb-3">Items</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGRN.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.quantityOrdered}</TableCell>
                        <TableCell>{item.quantityReceived}</TableCell>
                        <TableCell>
                          <Badge variant={item.condition === "Good" ? "default" : "destructive"}>
                            {item.condition}
                          </Badge>
                        </TableCell>
                        <TableCell>₦{item.unitPrice.toLocaleString()}</TableCell>
                        <TableCell>₦{item.totalAmount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={5} className="text-right font-semibold">Total Amount</TableCell>
                      <TableCell className="font-semibold">₦{selectedGRN.totalAmount.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {selectedGRN.remarks && (
                <div>
                  <p className="text-sm text-muted-foreground">Remarks</p>
                  <p className="mt-1">{selectedGRN.remarks}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
