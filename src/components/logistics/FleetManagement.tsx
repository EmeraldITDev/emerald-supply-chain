import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Truck,
  Settings,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Wrench,
  MapPin,
  Trash2,
  MoreHorizontal,
  Eye,
  Upload,
  Loader2,
  RefreshCw,
  Clock,
  Fuel,
  Users,
  Package,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { fleetApi } from "@/services/logisticsApi";
import type { FleetVehicle, VehicleDocument, MaintenanceRecord, FleetAlert, VehicleStatus, VehicleOwnership } from "@/types/logistics";

const statusColors: Record<VehicleStatus, string> = {
  available: "bg-success/10 text-success",
  in_use: "bg-primary/10 text-primary",
  maintenance: "bg-warning/10 text-warning",
  out_of_service: "bg-destructive/10 text-destructive",
};

const ownershipColors: Record<VehicleOwnership, string> = {
  owned: "bg-primary/10 text-primary",
  leased: "bg-info/10 text-info",
  vendor: "bg-warning/10 text-warning",
  rental: "bg-muted text-muted-foreground",
};

const documentTypes = [
  { value: "registration", label: "Vehicle Registration" },
  { value: "insurance", label: "Insurance Certificate" },
  { value: "roadworthiness", label: "Roadworthiness Certificate" },
  { value: "license", label: "Vehicle License" },
  { value: "permit", label: "Transport Permit" },
  { value: "other", label: "Other" },
];

export const FleetManagement = () => {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<FleetVehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<FleetVehicle>>({
    ownership: "owned",
    status: "available",
    approvalStatus: "approved",
  });
  const [maintenanceData, setMaintenanceData] = useState<Partial<MaintenanceRecord>>({
    type: "scheduled",
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("registration");
  const [documentExpiry, setDocumentExpiry] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch vehicles and alerts from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, alertsRes] = await Promise.all([
        fleetApi.getAll({
          status: statusFilter !== "all" ? statusFilter : undefined,
          ownership: ownershipFilter !== "all" ? ownershipFilter : undefined,
        }),
        fleetApi.getAlerts(),
      ]);

      if (vehiclesRes.success && vehiclesRes.data) {
        const vehiclesData = Array.isArray(vehiclesRes.data) ? vehiclesRes.data : [];
        setVehicles(vehiclesData);
      } else {
        setVehicles([]);
      }

      if (alertsRes.success && alertsRes.data) {
        const alertsData = Array.isArray(alertsRes.data) ? alertsRes.data : [];
        setAlerts(alertsData);
      } else {
        setAlerts([]);
      }
    } catch (error) {
      console.error("Failed to fetch fleet data:", error);
      setVehicles([]);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, ownershipFilter]);

  const handleCreateVehicle = async () => {
    if (!formData.plate || !formData.name || !formData.type) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fleetApi.create({
        plate: formData.plate!,
        name: formData.name!,
        type: formData.type!,
        make: formData.make,
        model: formData.model,
        year: formData.year,
        color: formData.color,
        ownership: formData.ownership || "owned",
        vendorId: formData.vendorId,
        passengerCapacity: formData.passengerCapacity,
        cargoCapacity: formData.cargoCapacity,
        fuelType: formData.fuelType,
      });

      if (response.success) {
        toast({
          title: "Vehicle Added",
          description: `${formData.name} has been added to the fleet`,
        });
        setCreateDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast({
          title: "Failed to Add Vehicle",
          description: response.error || "Unable to add vehicle. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add vehicle",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMaintenance = async () => {
    if (!selectedVehicle || !maintenanceData.description) {
      toast({
        title: "Validation Error",
        description: "Please provide maintenance details",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fleetApi.addMaintenance(selectedVehicle.id, {
        type: maintenanceData.type as any || "scheduled",
        description: maintenanceData.description!,
        performedAt: maintenanceData.performedAt || new Date().toISOString(),
        performedBy: maintenanceData.performedBy || localStorage.getItem("userName") || "System",
        cost: maintenanceData.cost,
        odometer: maintenanceData.odometer,
        notes: maintenanceData.notes,
        nextScheduledAt: maintenanceData.nextScheduledAt,
      });

      if (response.success) {
        toast({
          title: "Maintenance Recorded",
          description: "Maintenance record has been added",
        });
        setMaintenanceDialogOpen(false);
        fetchData();
      } else {
        toast({
          title: "Failed to Record Maintenance",
          description: response.error || "Unable to add maintenance record. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add maintenance record",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setMaintenanceData({ type: "scheduled" });
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedVehicle || !documentFile) {
      toast({
        title: "Validation Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fleetApi.uploadDocument(
        selectedVehicle.id,
        documentFile,
        documentType,
        documentExpiry || undefined
      );

      if (response.success) {
        toast({
          title: "Document Uploaded",
          description: `${documentFile.name} has been uploaded`,
        });
        setDocumentDialogOpen(false);
        fetchData();
      } else {
        toast({
          title: "Failed to Upload Document",
          description: response.error || "Unable to upload document. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setDocumentFile(null);
      setDocumentType("registration");
      setDocumentExpiry("");
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fleetApi.delete(vehicleToDelete.id);
      if (response.success) {
        setVehicles((prev) => prev.filter((v) => v.id !== vehicleToDelete.id));
        toast({
          title: "Vehicle Deleted",
          description: `${vehicleToDelete.name} has been removed from the fleet`,
        });
      } else {
        toast({
          title: "Failed to Delete Vehicle",
          description: response.error || "Unable to delete vehicle. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete vehicle",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setVehicleToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      ownership: "owned",
      status: "available",
      approvalStatus: "approved",
    });
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (vehicle.vehicleNumber || '').toLowerCase().includes(q) ||
      (vehicle.plate || '').toLowerCase().includes(q) ||
      (vehicle.name || '').toLowerCase().includes(q) ||
      (vehicle.vendorName || '').toLowerCase().includes(q);
    return matchesSearch;
  });

  const criticalAlerts = alerts.filter(a => a.severity === "critical" || a.severity === "high");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Fleet Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage vehicles, maintenance, and documentation
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Vehicle</DialogTitle>
              <DialogDescription>
                Register a new vehicle in the fleet
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle Name *</Label>
                  <Input
                    placeholder="e.g., Toyota Hilux 2023"
                    value={formData.name || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plate Number *</Label>
                  <Input
                    placeholder="e.g., ABC-123-XY"
                    value={formData.plate || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, plate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle Type *</Label>
                  <Select
                    value={formData.type || ""}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sedan">Sedan</SelectItem>
                      <SelectItem value="SUV">SUV</SelectItem>
                      <SelectItem value="Pickup">Pickup Truck</SelectItem>
                      <SelectItem value="Van">Van</SelectItem>
                      <SelectItem value="Bus">Bus</SelectItem>
                      <SelectItem value="Truck">Truck</SelectItem>
                      <SelectItem value="Tanker">Tanker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ownership</Label>
                  <Select
                    value={formData.ownership || "owned"}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, ownership: v as VehicleOwnership }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owned">Company Owned</SelectItem>
                      <SelectItem value="leased">Leased</SelectItem>
                      <SelectItem value="vendor">Vendor Vehicle</SelectItem>
                      <SelectItem value="rental">Rental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Make</Label>
                  <Input
                    placeholder="Toyota"
                    value={formData.make || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, make: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    placeholder="Hilux"
                    value={formData.model || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input
                    type="number"
                    placeholder="2023"
                    value={formData.year || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Passenger Capacity</Label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={formData.passengerCapacity || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, passengerCapacity: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cargo Capacity (kg)</Label>
                  <Input
                    type="number"
                    placeholder="1000"
                    value={formData.cargoCapacity || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, cargoCapacity: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fuel Type</Label>
                  <Select
                    value={formData.fuelType || ""}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, fuelType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Petrol">Petrol</SelectItem>
                      <SelectItem value="Diesel">Diesel</SelectItem>
                      <SelectItem value="Electric">Electric</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  placeholder="White"
                  value={formData.color || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateVehicle} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Vehicle"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts Section */}
      {criticalAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{criticalAlerts.length} critical alert(s):</strong>{" "}
            {criticalAlerts.slice(0, 2).map(a => `${a.vehiclePlate}: ${a.message}`).join("; ")}
            {criticalAlerts.length > 2 && ` and ${criticalAlerts.length - 2} more...`}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vehicles.filter(v => v.status === "available").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vehicles.filter(v => v.status === "maintenance").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Docs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter(a => a.type.includes("document")).length}
            </div>
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
                placeholder="Search vehicles..."
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
                  <SelectItem value="in_use">In Use</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="out_of_service">Out of Service</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Ownership" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ownership</SelectItem>
                  <SelectItem value="owned">Owned</SelectItem>
                  <SelectItem value="leased">Leased</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="rental">Rental</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fleet Vehicles</CardTitle>
          <CardDescription>
            {filteredVehicles.length} vehicle(s) in fleet
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No vehicles found</p>
              <p className="text-sm">Add a vehicle to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Plate</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ownership</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.map((vehicle) => {
                    const expiringDocs = (vehicle.documents || []).filter(d => d.isExpiringSoon || d.isExpired);
                    return (
                      <TableRow key={vehicle.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{vehicle.name}</p>
                            <p className="text-xs text-muted-foreground">{vehicle.vehicleNumber}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{vehicle.plate}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{vehicle.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(statusColors[vehicle.status], "capitalize")}>
                            {vehicle.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(ownershipColors[vehicle.ownership], "capitalize")}>
                            {vehicle.ownership}
                          </Badge>
                          {vehicle.vendorName && (
                            <p className="text-xs text-muted-foreground mt-1">{vehicle.vendorName}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>{(vehicle.documents || []).length}</span>
                            {expiringDocs.length > 0 && (
                              <Badge variant="destructive" className="ml-1 text-xs">
                                {expiringDocs.length} expiring
                              </Badge>
                            )}
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
                                setSelectedVehicle(vehicle);
                                setViewDialogOpen(true);
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedVehicle(vehicle);
                                setDocumentDialogOpen(true);
                              }}>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload Document
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setSelectedVehicle(vehicle);
                                setMaintenanceDialogOpen(true);
                              }}>
                                <Wrench className="mr-2 h-4 w-4" />
                                Add Maintenance
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  setVehicleToDelete(vehicle);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Vehicle
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GPS Placeholder */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            GPS Tracking (Coming Soon)
          </CardTitle>
          <CardDescription>
            Real-time vehicle location tracking will be available in a future update
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>GPS integration placeholder</p>
              <p className="text-sm">Connect external tracking services here</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Vehicle Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedVehicle?.name}</DialogTitle>
            <DialogDescription>{selectedVehicle?.vehicleNumber}</DialogDescription>
          </DialogHeader>
          {selectedVehicle && (
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Plate Number</Label>
                    <p className="font-medium font-mono">{selectedVehicle.plate}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={cn(statusColors[selectedVehicle.status], "capitalize mt-1")}>
                      {selectedVehicle.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p className="font-medium">{selectedVehicle.type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Ownership</Label>
                    <p className="font-medium capitalize">{selectedVehicle.ownership}</p>
                  </div>
                  {selectedVehicle.make && (
                    <div>
                      <Label className="text-muted-foreground">Make/Model</Label>
                      <p className="font-medium">
                        {selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.year && `(${selectedVehicle.year})`}
                      </p>
                    </div>
                  )}
                  {selectedVehicle.color && (
                    <div>
                      <Label className="text-muted-foreground">Color</Label>
                      <p className="font-medium">{selectedVehicle.color}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <Users className="h-5 w-5 mx-auto text-muted-foreground" />
                    <p className="text-2xl font-bold">{selectedVehicle.passengerCapacity || "-"}</p>
                    <p className="text-xs text-muted-foreground">Passengers</p>
                  </div>
                  <div className="text-center">
                    <Package className="h-5 w-5 mx-auto text-muted-foreground" />
                    <p className="text-2xl font-bold">{selectedVehicle.cargoCapacity || "-"}</p>
                    <p className="text-xs text-muted-foreground">Cargo (kg)</p>
                  </div>
                  <div className="text-center">
                    <Fuel className="h-5 w-5 mx-auto text-muted-foreground" />
                    <p className="text-lg font-bold">{selectedVehicle.fuelType || "-"}</p>
                    <p className="text-xs text-muted-foreground">Fuel Type</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-muted-foreground">Total Trips</Label>
                    <p className="font-medium">{selectedVehicle.totalTrips}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Total Distance</Label>
                    <p className="font-medium">{(selectedVehicle.totalDistance ?? 0).toLocaleString()} km</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="documents" className="space-y-4">
                {(selectedVehicle.documents || []).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No documents uploaded</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(selectedVehicle.documents || []).map((doc) => (
                      <div key={doc.id} className={cn(
                        "flex items-center justify-between p-3 border rounded-lg",
                        doc.isExpired && "border-destructive/50 bg-destructive/5",
                        doc.isExpiringSoon && !doc.isExpired && "border-warning/50 bg-warning/5"
                      )}>
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium capitalize">{doc.type.replace("_", " ")}</p>
                            <p className="text-xs text-muted-foreground">{doc.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {doc.expiresAt && (
                            <div className="flex items-center gap-2">
                              {doc.isExpired ? (
                                <Badge variant="destructive">Expired</Badge>
                              ) : doc.isExpiringSoon ? (
                                <Badge className="bg-warning/10 text-warning">Expiring Soon</Badge>
                              ) : (
                                <Badge variant="outline">Valid</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(doc.expiresAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setViewDialogOpen(false);
                    setDocumentDialogOpen(true);
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
              </TabsContent>
              <TabsContent value="maintenance" className="space-y-4">
                {(selectedVehicle.maintenanceHistory || []).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wrench className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No maintenance records</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(selectedVehicle.maintenanceHistory || []).map((record) => (
                      <div key={record.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium capitalize">{record.type}</p>
                            <p className="text-sm">{record.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {new Date(record.performedAt).toLocaleDateString()}
                            </p>
                            {record.cost && (
                              <p className="text-xs text-muted-foreground">
                                ₦{record.cost.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        {record.notes && (
                          <p className="text-xs text-muted-foreground mt-2">{record.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setViewDialogOpen(false);
                    setMaintenanceDialogOpen(true);
                  }}
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  Add Maintenance Record
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Maintenance Dialog */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Maintenance Record</DialogTitle>
            <DialogDescription>
              Record maintenance for {selectedVehicle?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={maintenanceData.type || "scheduled"}
                  onValueChange={(v) => setMaintenanceData(prev => ({ ...prev, type: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="unscheduled">Unscheduled</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={maintenanceData.performedAt?.split("T")[0] || ""}
                  onChange={(e) => setMaintenanceData(prev => ({ ...prev, performedAt: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Describe the maintenance work"
                value={maintenanceData.description || ""}
                onChange={(e) => setMaintenanceData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cost (₦)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={maintenanceData.cost || ""}
                  onChange={(e) => setMaintenanceData(prev => ({ ...prev, cost: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Odometer (km)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={maintenanceData.odometer || ""}
                  onChange={(e) => setMaintenanceData(prev => ({ ...prev, odometer: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Next Scheduled Maintenance</Label>
              <Input
                type="date"
                value={maintenanceData.nextScheduledAt?.split("T")[0] || ""}
                onChange={(e) => setMaintenanceData(prev => ({ ...prev, nextScheduledAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes"
                value={maintenanceData.notes || ""}
                onChange={(e) => setMaintenanceData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMaintenance} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Record"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document for {selectedVehicle?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map(dt => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={documentExpiry}
                onChange={(e) => setDocumentExpiry(e.target.value)}
              />
            </div>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Input
                type="file"
                className="hidden"
                id="document-upload"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="document-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {documentFile ? documentFile.name : "Click to select file"}
                </p>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadDocument} disabled={!documentFile || isSubmitting}>
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

      {/* Delete Vehicle Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{vehicleToDelete?.name}</strong> ({vehicleToDelete?.plate})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteVehicle}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Vehicle"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};


export default FleetManagement;
