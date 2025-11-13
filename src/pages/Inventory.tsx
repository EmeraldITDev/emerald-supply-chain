import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Package, AlertTriangle, TrendingUp, Plus, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

interface InventoryItem {
  code: string;
  name: string;
  category: string;
  stock: number;
  reorderPoint: number;
  unit: string;
  value: number;
  status: string;
}

const Inventory = () => {
  const { toast } = useToast();
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemDetailsOpen, setItemDetailsOpen] = useState(false);
  const [createPODialogOpen, setCreatePODialogOpen] = useState(false);
  
  // Form states
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemStock, setNewItemStock] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  
  const [items, setItems] = useState<InventoryItem[]>([
    { code: "MAT-001", name: "Steel Rods", category: "Raw Material", stock: 850, reorderPoint: 500, unit: "kg", value: 425000, status: "Good" },
    { code: "MAT-002", name: "Cement Bags", category: "Construction", stock: 120, reorderPoint: 200, unit: "bags", value: 48000, status: "Low Stock" },
    { code: "MAT-003", name: "Electrical Cable", category: "Equipment", stock: 45, reorderPoint: 100, unit: "meters", value: 67500, status: "Critical" },
    { code: "MAT-004", name: "Safety Helmets", category: "Safety", stock: 300, reorderPoint: 100, unit: "pcs", value: 150000, status: "Good" },
  ]);
  
  const handleAddItem = () => {
    if (!newItemName || !newItemCategory || !newItemStock || !newItemUnit) {
      toast({ title: "Validation Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }
    
    const newItem: InventoryItem = {
      code: `MAT-${String(items.length + 1).padStart(3, '0')}`,
      name: newItemName,
      category: newItemCategory,
      stock: parseInt(newItemStock),
      reorderPoint: Math.floor(parseInt(newItemStock) * 0.5),
      unit: newItemUnit,
      value: parseInt(newItemStock) * 100,
      status: "Good"
    };
    
    setItems([...items, newItem]);
    toast({ title: "Item Added", description: `${newItemName} has been added to inventory` });
    
    // Reset form
    setNewItemName("");
    setNewItemCategory("");
    setNewItemStock("");
    setNewItemUnit("");
    setAddItemDialogOpen(false);
  };

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

  const handleViewDetails = (item: InventoryItem) => {
    setSelectedItem(item);
    setItemDetailsOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Inventory Management</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">Track stock levels, issuance, and reordering</p>
          </div>
          <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 self-start sm:self-auto">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Item</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Item</DialogTitle>
                <DialogDescription>Add a new item to inventory</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Input 
                    placeholder="Enter item name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Raw Material">Raw Material</SelectItem>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                      <SelectItem value="Safety">Safety</SelectItem>
                      <SelectItem value="Construction">Construction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stock Quantity</Label>
                    <Input 
                      type="number" 
                      placeholder="0"
                      value={newItemStock}
                      onChange={(e) => setNewItemStock(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input 
                      placeholder="kg, pcs, etc"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="w-full transition-transform hover:scale-105" onClick={handleAddItem}>
                  Add Item
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{items.length}</div>
              <p className="text-xs text-muted-foreground">Across 12 categories</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{(items.reduce((sum, item) => sum + item.value, 0) / 1000000).toFixed(1)}M</div>
              <p className="text-xs text-muted-foreground">Total stock value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockAlerts.length}</div>
              <p className="text-xs text-muted-foreground">Require reordering</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions Today</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recentTransactions.length}</div>
              <p className="text-xs text-muted-foreground">Issues and receipts</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto gap-1">
            <TabsTrigger value="all" className="text-xs sm:text-sm px-2 sm:px-4">All Items</TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs sm:text-sm px-2 sm:px-4">Transactions</TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs sm:text-sm px-2 sm:px-4">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Items</CardTitle>
                <CardDescription>Complete list of items in stock</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.code} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{item.name}</span>
                          <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{item.code}</span>
                          <span>{item.category}</span>
                          <span>₦{item.value.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={getStockPercentage(item.stock, item.reorderPoint)} 
                            className="h-2 flex-1 max-w-xs"
                          />
                          <span className="text-sm text-muted-foreground">
                            {item.stock} {item.unit}
                          </span>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewDetails(item)}
                      >
                        View Details
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Issues and receipts history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{transaction.id}</span>
                          <Badge variant={transaction.type === "Receipt" ? "default" : "secondary"}>
                            {transaction.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{transaction.item}</span>
                          <span>{transaction.quantity} units</span>
                          <span>{transaction.department}</span>
                          <span>{transaction.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Low Stock Alerts</CardTitle>
                <CardDescription>Items requiring reordering attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lowStockAlerts.map((alert, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border rounded-lg border-warning">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <span className="font-semibold">{alert.item}</span>
                          <Badge className="bg-warning/10 text-warning">{alert.urgency} Priority</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Current: {alert.current} | Reorder Point: {alert.reorder}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setCreatePODialogOpen(true);
                        }}
                      >
                        Create PO
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Item Details Dialog */}
      <Dialog open={itemDetailsOpen} onOpenChange={setItemDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Item Details - {selectedItem?.code}</DialogTitle>
            <DialogDescription>Complete inventory item information</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Item Name</Label>
                  <p className="font-medium">{selectedItem.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Item Code</Label>
                  <p className="font-medium">{selectedItem.code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{selectedItem.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedItem.status)}>{selectedItem.status}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Current Stock</Label>
                  <p className="font-medium">{selectedItem.stock} {selectedItem.unit}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Reorder Point</Label>
                  <p className="font-medium">{selectedItem.reorderPoint} {selectedItem.unit}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Stock Value</Label>
                  <p className="font-medium">₦{selectedItem.value.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Unit of Measure</Label>
                  <p className="font-medium">{selectedItem.unit}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  className="flex-1"
                  onClick={() => {
                    if (selectedItem) {
                      const updatedItems = items.map(item => 
                        item.code === selectedItem.code 
                          ? { ...item, stock: Math.max(0, item.stock - 10) }
                          : item
                      );
                      setItems(updatedItems);
                      toast({ title: "Stock Issued", description: `10 ${selectedItem.unit} issued from ${selectedItem.name}` });
                      setItemDetailsOpen(false);
                    }
                  }}
                >
                  Issue Stock
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    if (selectedItem) {
                      const adjustment = prompt(`Enter stock adjustment for ${selectedItem.name} (positive to add, negative to remove):`);
                      if (adjustment) {
                        const value = parseInt(adjustment);
                        const updatedItems = items.map(item => 
                          item.code === selectedItem.code 
                            ? { ...item, stock: Math.max(0, item.stock + value) }
                            : item
                        );
                        setItems(updatedItems);
                        toast({ title: "Stock Adjusted", description: `Stock updated by ${adjustment} ${selectedItem.unit}` });
                        setItemDetailsOpen(false);
                      }
                    }
                  }}
                >
                  Adjust Stock
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setItemDetailsOpen(false);
                    setCreatePODialogOpen(true);
                  }}
                >
                  Create PO
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create PO Dialog */}
      <Dialog open={createPODialogOpen} onOpenChange={setCreatePODialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>Generate PO for low stock items</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Item</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Choose item" />
                </SelectTrigger>
                <SelectContent>
                  {items.filter(i => i.status !== "Good").map(item => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.name} (Current: {item.stock} {item.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity to Order</Label>
              <Input type="number" placeholder="Enter quantity" />
            </div>
            <Button 
              className="w-full transition-transform hover:scale-105" 
              onClick={() => {
                toast({ 
                  title: "PO Created", 
                  description: "Purchase order generated and sent to procurement" 
                });
                setCreatePODialogOpen(false);
              }}
            >
              Generate Purchase Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Inventory;
