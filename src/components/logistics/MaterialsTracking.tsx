import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Package,
  MapPin,
  Truck,
  MoreHorizontal,
  Eye,
  Edit,
  Loader2,
  RefreshCw,
  Upload,
  Download,
  AlertTriangle,
  ArrowRight,
  History,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { materialsApi, logisticsDashboardApi } from "@/services/logisticsApi";
import type { Material, MaterialStatus, BulkMaterialUploadResult } from "@/types/logistics";

const statusColors: Record<MaterialStatus, string> = {
  available: "bg-success/10 text-success",
  in_transit: "bg-primary/10 text-primary",
  delivered: "bg-info/10 text-info",
  damaged: "bg-destructive/10 text-destructive",
  lost: "bg-muted text-muted-foreground",
};

const conditionColors: Record<string, string> = {
  new: "bg-success/10 text-success",
  used: "bg-warning/10 text-warning",
  damaged: "bg-destructive/10 text-destructive",
};

export const MaterialsTracking = () => {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<Material>>({
    condition: "new",
    status: "available",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<BulkMaterialUploadResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Categories for filter
  const categories = ["Equipment", "Supplies", "Tools", "Parts", "Electronics", "Furniture"];

  // Fetch materials from API
  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const response = await materialsApi.getAll({
        status: statusFilter !== "all" ? statusFilter : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
      });
      if (response.success && response.data) {
        setMaterials(response.data);
      } else {
        setMaterials([]);
      }
    } catch (error) {
      console.error("Failed to fetch materials:", error);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [statusFilter, categoryFilter]);

  const handleCreateMaterial = async () => {
    if (!formData.name || !formData.category || !formData.quantity) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await materialsApi.create(formData);

      if (response.success) {
        toast({
          title: "Material Added",
          description: `${formData.name} has been added to inventory`,
        });
        setCreateDialogOpen(false);
        resetForm();
        fetchMaterials();
      } else {
        toast({
          title: "Failed to Add Material",
          description: response.error || "Unable to add material. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add material",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!uploadFile) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await materialsApi.bulkUpload(uploadFile);
      if (response.success && response.data) {
        setUploadResult(response.data);
        if (response.data.successfulRows > 0) {
          toast({
            title: "Upload Successful",
            description: `${response.data.successfulRows} of ${response.data.totalRows} materials created.`,
          });
          fetchMaterials();
        }
      } else {
        toast({
          title: "Upload Failed",
          description: response.error || "Failed to process file",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "An error occurred during upload",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await logisticsDashboardApi.downloadTemplate("materials");
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "materials_upload_template.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Provide a simple CSV template for demo
        const csvContent = "name,category,quantity,unit,condition,location,description\nLaptop,Electronics,10,units,new,Main Warehouse,Dell Latitude Laptops";
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "materials_upload_template.csv";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download template",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      condition: "new",
      status: "available",
    });
  };

  const filteredMaterials = materials.filter(material => {
    const matchesSearch =
      material.materialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.currentLocation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const materialsInTransit = materials.filter(m => m.status === "in_transit").length;
  const damagedMaterials = materials.filter(m => m.condition === "damaged" || m.status === "damaged").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Materials Tracking</h2>
          <p className="text-sm text-muted-foreground">
            Track materials, quantities, and movement history
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Material
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Material</DialogTitle>
                <DialogDescription>
                  Register a new material in the inventory
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      placeholder="Material name"
                      value={formData.name || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select
                      value={formData.category || ""}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.quantity || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input
                      placeholder="units"
                      value={formData.unit || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select
                      value={formData.condition || "new"}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, condition: v as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="used">Used</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Current Location</Label>
                  <Input
                    placeholder="e.g., Main Warehouse"
                    value={formData.currentLocation || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, currentLocation: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Additional details"
                    value={formData.description || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateMaterial} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Material"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Materials</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{materials.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Package className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {materials.filter(m => m.status === "available").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{materialsInTransit}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Damaged/Lost</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{damagedMaterials}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search materials..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchMaterials}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Materials Table */}
      <Card>
        <CardHeader>
          <CardTitle>Material Inventory</CardTitle>
          <CardDescription>
            {filteredMaterials.length} material(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No materials found</p>
              <p className="text-sm">Add a material to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-mono text-sm">
                        {material.materialNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{material.name}</p>
                          {material.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {material.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{material.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {material.quantity} {material.unit}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(conditionColors[material.condition], "capitalize")}>
                          {material.condition}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(statusColors[material.status], "capitalize")}>
                          {material.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{material.currentLocation}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedMaterial(material);
                              setViewDialogOpen(true);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <History className="mr-2 h-4 w-4" />
                              Movement History
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Materials</DialogTitle>
            <DialogDescription>
              Upload an Excel file with materials data using the provided template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                id="material-bulk-upload"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="material-bulk-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {uploadFile ? uploadFile.name : "Click to select file or drag and drop"}
                </p>
              </label>
            </div>
            {uploadResult && (
              <div className={cn(
                "p-4 rounded-lg",
                uploadResult.failedRows > 0 ? "bg-warning/10" : "bg-success/10"
              )}>
                <p className="font-medium">
                  Upload Result: {uploadResult.successfulRows}/{uploadResult.totalRows} successful
                </p>
                {uploadResult.errors.length > 0 && (
                  <div className="mt-2 text-sm">
                    <p className="font-medium text-destructive">Errors:</p>
                    <ul className="list-disc list-inside">
                      {uploadResult.errors.slice(0, 5).map((error, i) => (
                        <li key={i}>
                          Row {error.row}: {error.field} - {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpload} disabled={!uploadFile || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Material Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedMaterial?.name}</DialogTitle>
            <DialogDescription>{selectedMaterial?.materialNumber}</DialogDescription>
          </DialogHeader>
          {selectedMaterial && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{selectedMaterial.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={cn(statusColors[selectedMaterial.status], "capitalize mt-1")}>
                    {selectedMaterial.status.replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quantity</Label>
                  <p className="font-medium">{selectedMaterial.quantity} {selectedMaterial.unit}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Condition</Label>
                  <Badge className={cn(conditionColors[selectedMaterial.condition], "capitalize mt-1")}>
                    {selectedMaterial.condition}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Current Location</Label>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {selectedMaterial.currentLocation}
                  </p>
                </div>
              </div>
              {selectedMaterial.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{selectedMaterial.description}</p>
                </div>
              )}
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Movement Count</Label>
                    <p className="font-medium">{selectedMaterial.movementCount}</p>
                  </div>
                  {selectedMaterial.lastMovedAt && (
                    <div>
                      <Label className="text-muted-foreground">Last Moved</Label>
                      <p className="font-medium">
                        {new Date(selectedMaterial.lastMovedAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default MaterialsTracking;
