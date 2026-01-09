import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Users, TrendingUp, FileCheck, Plus, Star, Upload, Download, Trash2, FileText, Mail, Phone, MapPin, Building, Globe, Calendar, Loader2 } from "lucide-react";
import VendorRegistrationsList from "@/components/VendorRegistrationsList";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { vendorApi, dashboardApi } from "@/services/api";
import { VendorRegistration, Vendor } from "@/types";
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

const Vendors = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { vendors: contextVendors, addVendorDocument, deleteVendorDocument } = useApp();
  const [vendors, setVendors] = useState(contextVendors);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addVendorDialogOpen, setAddVendorDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [vendorDetailsOpen, setVendorDetailsOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [kycReviewOpen, setKycReviewOpen] = useState(false);
  const [reviewingVendor, setReviewingVendor] = useState<VendorRegistration | null>(null);
  const [contactTo, setContactTo] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [vendorRegistrations, setVendorRegistrations] = useState<VendorRegistration[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [loadingVendorProfile, setLoadingVendorProfile] = useState(false);
  const [deleteVendorDialogOpen, setDeleteVendorDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<any>(null);
  const [isDeletingVendor, setIsDeletingVendor] = useState(false);
  
  // Dashboard stats from API
  const [dashboardStats, setDashboardStats] = useState({
    totalVendors: 0,
    activeVendors: 0,
    pendingRegistrations: 0,
    avgRating: 0,
    onTimeDelivery: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  
  // New vendor form
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorCategory, setNewVendorCategory] = useState("");
  const [newVendorEmail, setNewVendorEmail] = useState("");

  // Credential reset handler
  const handleResetVendorPassword = async (vendorId: string, vendorName: string) => {
    setIsResettingPassword(true);
    try {
      const response = await vendorApi.updateCredentials(vendorId, { resetPassword: true });
      if (response.success && response.data?.temporaryPassword) {
        toast({
          title: "Password Reset Successful",
          description: `New temporary password for ${vendorName}: ${response.data.temporaryPassword}. The vendor has been notified via email.`,
        });
      } else if (response.success) {
        toast({
          title: "Password Reset",
          description: `Password has been reset for ${vendorName}. The vendor has been notified via email.`,
        });
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to reset password",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  // View vendor profile with full details
  const handleViewVendorProfile = async (vendor: any) => {
    setSelectedVendor(vendor);
    setVendorDetailsOpen(true);
    setLoadingVendorProfile(true);
    
    try {
      const response = await vendorApi.getById(vendor.id);
      if (response.success && response.data) {
        const apiData = response.data as any;
        const fullVendor = {
          ...vendor,
          ...apiData,
          id: vendor.id, // Keep original ID
          name: apiData.name || apiData.company_name || vendor.name,
        };
        setSelectedVendor(fullVendor);
      }
    } catch (error) {
      console.error('Failed to fetch full vendor profile:', error);
    } finally {
      setLoadingVendorProfile(false);
    }
  };

  // Refresh dashboard stats
  const refreshDashboardStats = async () => {
    try {
      const response = await dashboardApi.getProcurementManagerDashboard();
      if (response.success && response.data) {
        const stats = response.data.stats;
        setDashboardStats({
          totalVendors: stats?.totalVendors || 0,
          activeVendors: stats?.totalVendors || 0,
          pendingRegistrations: stats?.pendingKYC || response.data.pendingRegistrations?.length || 0,
          avgRating: stats?.avgRating || 0,
          onTimeDelivery: stats?.onTimeDelivery || 0,
        });
      }
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    }
  };

  // Delete vendor handler
  const handleDeleteVendor = async () => {
    if (!vendorToDelete) return;
    
    setIsDeletingVendor(true);
    try {
      const response = await vendorApi.delete(vendorToDelete.id);
      if (response.success) {
        toast({
          title: "Vendor Deleted",
          description: `${vendorToDelete.name} has been removed from the system.`,
        });
        // Remove from local state
        setVendors(prev => prev.filter(v => v.id !== vendorToDelete.id));
        // Update stats immediately (optimistic) and refresh from server
        setDashboardStats(prev => ({
          ...prev,
          totalVendors: Math.max(0, prev.totalVendors - 1),
          activeVendors: Math.max(0, prev.activeVendors - 1),
        }));
        refreshDashboardStats();
        
        setDeleteVendorDialogOpen(false);
        setVendorDetailsOpen(false);
        setVendorToDelete(null);
        setSelectedVendor(null);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to delete vendor",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete vendor",
        variant: "destructive",
      });
    } finally {
      setIsDeletingVendor(false);
    }
  };

  // Open contact dialog with pre-filled vendor email
  const handleOpenContactDialog = () => {
    if (selectedVendor) {
      setContactTo(selectedVendor.email || '');
      setContactSubject(`Inquiry for ${selectedVendor.name}`);
      setContactMessage('');
    }
    setContactDialogOpen(true);
  };

  // Fetch vendor registrations and dashboard stats from API (same source as Dashboard)
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoadingRegistrations(true);
      setLoadingStats(true);
      try {
        const response = await dashboardApi.getProcurementManagerDashboard();
        if (response.success && response.data) {
          // Map pending registrations to VendorRegistration format
          if (response.data.pendingRegistrations) {
            const registrations = response.data.pendingRegistrations.map((reg: any) => ({
              id: reg.id,
              companyName: reg.companyName,
              email: reg.email,
              category: reg.category,
              status: "Pending" as const,
              submittedDate: reg.createdAt,
              contactPerson: reg.contactPerson,
            }));
            setVendorRegistrations(registrations);
          }
          
          // Set dashboard stats from API (nested under 'stats' object)
          const stats = response.data.stats;
          setDashboardStats({
            totalVendors: stats?.totalVendors || 0,
            activeVendors: stats?.totalVendors || 0, // Use totalVendors as active count
            pendingRegistrations: stats?.pendingKYC || response.data.pendingRegistrations?.length || 0,
            avgRating: stats?.avgRating || 0,
            onTimeDelivery: stats?.onTimeDelivery || 0,
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load vendor data",
          variant: "destructive",
        });
      } finally {
        setLoadingRegistrations(false);
        setLoadingStats(false);
      }
    };

    fetchDashboardData();
  }, [toast]);

  // Fetch approved vendors
  useEffect(() => {
    const fetchVendors = async () => {
      setLoadingVendors(true);
      try {
        const response = await vendorApi.getAll();
        if (response.success && response.data) {
          // Transform API vendor data to match frontend Vendor type
          const transformedVendors = response.data.map((vendor: any) => ({
            id: vendor.vendor_id || vendor.id,
            name: vendor.name || vendor.company_name,
            category: vendor.category || 'Unknown',
            status: vendor.status || 'Active',
            kyc: vendor.kyc_status || 'Verified',
            rating: vendor.rating || 0,
            orders: vendor.total_orders || 0,
            email: vendor.email || '',
            phone: vendor.phone || '',
            address: vendor.address || '',
            taxId: vendor.tax_id || vendor.taxId || '',
            contactPerson: vendor.contact_person || vendor.contactPerson || '',
            documents: vendor.documents || [],
          }));
          setVendors(transformedVendors);
        }
      } catch (error) {
        // Fallback to context vendors if API fails
        setVendors(contextVendors);
      } finally {
        setLoadingVendors(false);
      }
    };

    fetchVendors();
  }, [contextVendors]);

  // Handle approval
  const handleApprove = async (registrationId: string) => {
    setIsProcessing(true);
    try {
      const response = await vendorApi.approveRegistration(registrationId);
      if (response.success && response.data) {
        const { temporaryPassword } = response.data;
        toast({
          title: "Vendor Approved Successfully",
          description: temporaryPassword 
            ? `Vendor account created. Temporary password: ${temporaryPassword}. An email has been sent to the vendor with login credentials.`
            : "Vendor registration has been approved. Credentials have been sent via email.",
        });
        // Refresh registrations
        const refreshResponse = await vendorApi.getRegistrations();
        if (refreshResponse.success && refreshResponse.data) {
          setVendorRegistrations(refreshResponse.data);
        }
        // Also refresh vendors list
        const vendorsResponse = await vendorApi.getAll();
        if (vendorsResponse.success && vendorsResponse.data) {
          const transformedVendors = vendorsResponse.data.map((vendor: any) => ({
            id: vendor.vendor_id || vendor.id,
            name: vendor.name || vendor.company_name,
            category: vendor.category || 'Unknown',
            status: vendor.status || 'Active',
            kyc: vendor.kyc_status || 'Verified',
            rating: vendor.rating || 0,
            orders: vendor.total_orders || 0,
            email: vendor.email || '',
            phone: vendor.phone || '',
            address: vendor.address || '',
            taxId: vendor.tax_id || vendor.taxId || '',
            contactPerson: vendor.contact_person || vendor.contactPerson || '',
            documents: vendor.documents || [],
          }));
          setVendors(transformedVendors);
        }
        setKycReviewOpen(false);
        setReviewingVendor(null);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to approve registration",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle rejection
  const handleReject = async (registrationId: string) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await vendorApi.rejectRegistration(registrationId, rejectionReason);
      if (response.success) {
        toast({
          title: "Rejected",
          description: "Vendor registration has been rejected.",
        });
        // Refresh registrations
        const refreshResponse = await vendorApi.getRegistrations();
        if (refreshResponse.success && refreshResponse.data) {
          setVendorRegistrations(refreshResponse.data);
        }
        setKycReviewOpen(false);
        setReviewingVendor(null);
        setRejectionReason("");
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to reject registration",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedVendor) return;

    const file = files[0];
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB",
        variant: "destructive",
      });
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target?.result as string;
      
      addVendorDocument(selectedVendor.id, {
        name: file.name,
        type: file.type,
        size: file.size,
        fileData,
      });

      toast({
        title: "Document uploaded",
        description: `${file.name} has been uploaded successfully`,
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadDocument = (document: any) => {
    const link = window.document.createElement("a");
    link.href = document.fileData;
    link.download = document.name;
    link.click();
  };

  const handleDeleteDocument = (documentId: string) => {
    if (!selectedVendor) return;
    
    deleteVendorDocument(selectedVendor.id, documentId);
    toast({
      title: "Document deleted",
      description: "Document has been removed successfully",
    });
  };

  // Keep selectedVendor in sync with vendors array
  useEffect(() => {
    if (selectedVendor) {
      const updatedVendor = vendors.find(v => v.id === selectedVendor.id);
      if (updatedVendor) {
        setSelectedVendor(updatedVendor);
      }
    }
  }, [vendors]);

  // Filter pending registrations
  const pendingKYC = vendorRegistrations
    .filter(reg => reg.status === 'Pending')
    .map(reg => ({
      id: reg.id,
      name: reg.companyName,
      category: reg.category,
      submitted: new Date(reg.submittedDate).toISOString().split('T')[0],
      documents: 0, // TODO: Get document count from API
      registration: reg,
    }));

  const topPerformers = [
    { name: "Steel Works Ltd", score: 4.8, onTime: 96, quality: 98 },
    { name: "SafetyFirst Co", score: 4.9, onTime: 99, quality: 97 },
    { name: "BuildMart Supplies", score: 4.5, onTime: 92, quality: 94 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
      case "Verified":
        return "bg-success/10 text-success";
      case "Pending":
      case "Under Review":
        return "bg-warning/10 text-warning";
      case "Suspended":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Vendor Management</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage vendor relationships, KYC, and performance</p>
          </div>
          <Dialog open={addVendorDialogOpen} onOpenChange={setAddVendorDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 self-start sm:self-auto">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Vendor</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
                <DialogDescription>Register a new vendor in the system</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input 
                    placeholder="Enter company name"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newVendorCategory} onValueChange={setNewVendorCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                      <SelectItem value="Safety Equipment">Safety Equipment</SelectItem>
                      <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input 
                    type="email" 
                    placeholder="vendor@company.com"
                    value={newVendorEmail}
                    onChange={(e) => setNewVendorEmail(e.target.value)}
                  />
                </div>
                <Button className="w-full transition-transform hover:scale-105" onClick={() => {
                  if (!newVendorName || !newVendorCategory || !newVendorEmail) {
                    toast({ title: "Validation Error", description: "Please fill all fields", variant: "destructive" });
                    return;
                  }
                  
                  toast({ 
                    title: "Vendor Registration Initiated", 
                    description: `${newVendorName} added to vendor directory (Pending KYC)` 
                  });
                  
                  // Reset form
                  setNewVendorName("");
                  setNewVendorCategory("");
                  setNewVendorEmail("");
                  setAddVendorDialogOpen(false);
                }}>
                  Add Vendor
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loadingStats ? "..." : dashboardStats.totalVendors}</div>
              <p className="text-xs text-muted-foreground">{loadingStats ? "Loading..." : `${dashboardStats.activeVendors} active`}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending KYC</CardTitle>
              <FileCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loadingStats ? "..." : dashboardStats.pendingRegistrations}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
              <Star className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loadingStats ? "..." : dashboardStats.avgRating.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Out of 5.0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loadingStats ? "..." : `${dashboardStats.onTimeDelivery}%`}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Vendor Registrations Section */}
        <VendorRegistrationsList 
          showTabs={true} 
          title="Vendor Registrations"
          externalRegistrations={vendorRegistrations}
          externalLoading={loadingRegistrations}
        />

        <div className="grid gap-6 lg:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
              <CardDescription>Highest rated vendors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {topPerformers.map((vendor) => (
                  <div key={vendor.name} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{vendor.name}</p>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        <span className="text-sm font-semibold">{vendor.score}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>On-Time: {vendor.onTime}%</span>
                      <span>Quality: {vendor.quality}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vendor Directory</CardTitle>
            <CardDescription>Complete list of registered vendors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vendors.map((vendor) => (
                <div key={vendor.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold whitespace-nowrap">{vendor.id}</span>
                      <span className="text-sm truncate">{vendor.name}</span>
                      <Badge className={getStatusColor(vendor.kyc)}>{vendor.kyc}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <span className="whitespace-nowrap">Category: {vendor.category}</span>
                      <span className="whitespace-nowrap">Orders: {vendor.orders}</span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        {vendor.rating}
                      </span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewVendorProfile(vendor)}
                    className="self-start sm:self-center"
                  >
                    View Profile
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Details Dialog */}
      <Dialog open={vendorDetailsOpen} onOpenChange={setVendorDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Vendor Profile - {selectedVendor?.name}
            </DialogTitle>
            <DialogDescription>Complete vendor information and performance</DialogDescription>
          </DialogHeader>
          {selectedVendor && (
            <div className="space-y-6">
              {loadingVendorProfile && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading full profile...</span>
                </div>
              )}
              
              {/* Basic Information */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Vendor ID</Label>
                  <p className="font-medium">{selectedVendor.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(selectedVendor.status)}>{selectedVendor.status}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">KYC Status</Label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(selectedVendor.kyc)}>{selectedVendor.kyc}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Category</Label>
                  <p className="font-medium">{selectedVendor.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Rating</Label>
                  <p className="font-medium flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    {selectedVendor.rating}/5.0
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Total Orders</Label>
                  <p className="font-medium">{selectedVendor.orders || selectedVendor.totalOrders || 0}</p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="pt-4 border-t">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <Label className="text-muted-foreground text-xs">Email</Label>
                      <p className="font-medium">{selectedVendor.email || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <Label className="text-muted-foreground text-xs">Phone</Label>
                      <p className="font-medium">{selectedVendor.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <Label className="text-muted-foreground text-xs">Contact Person</Label>
                      <p className="font-medium">{selectedVendor.contactPerson || selectedVendor.contact_person || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <Label className="text-muted-foreground text-xs">Website</Label>
                      <p className="font-medium">{selectedVendor.website || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 md:col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <Label className="text-muted-foreground text-xs">Address</Label>
                      <p className="font-medium">{selectedVendor.address || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Information */}
              <div className="pt-4 border-t">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Business Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Tax ID</Label>
                    <p className="font-medium">{selectedVendor.taxId || selectedVendor.tax_id || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Year Established</Label>
                    <p className="font-medium">{selectedVendor.yearEstablished || selectedVendor.year_established || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Number of Employees</Label>
                    <p className="font-medium">{selectedVendor.numberOfEmployees || selectedVendor.number_of_employees || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Annual Revenue</Label>
                    <p className="font-medium">{selectedVendor.annualRevenue || selectedVendor.annual_revenue || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Registration Date</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {selectedVendor.createdAt || selectedVendor.created_at 
                        ? new Date(selectedVendor.createdAt || selectedVendor.created_at).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Documents Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Documents & KYC</Label>
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                />
                <p className="text-xs text-muted-foreground mb-3">
                  Upload CAC certificates, tax documents, bank details, or other vendor documents (Max 5MB)
                </p>
                
                {(!selectedVendor.documents || selectedVendor.documents.length === 0) ? (
                  <div className="text-center py-6 text-sm text-muted-foreground border rounded-md border-dashed">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No documents uploaded yet</p>
                    <p className="text-xs mt-1">Upload CAC, certificates, or other documents</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedVendor.documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded-md bg-muted/30"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name || doc.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.size ? `${(doc.size / 1024).toFixed(1)} KB • ` : ''}
                              {doc.uploadDate || doc.uploadedAt ? new Date(doc.uploadDate || doc.uploadedAt).toLocaleDateString() : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadDocument(doc)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setVendorDetailsOpen(false);
                    navigate("/procurement", { state: { vendor: selectedVendor?.name } });
                  }}
                >
                  View Orders
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleOpenContactDialog}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Vendor
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={isResettingPassword}
                  onClick={() => selectedVendor && handleResetVendorPassword(selectedVendor.id, selectedVendor.name)}
                >
                  {isResettingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isResettingPassword ? "Resetting..." : "Reset Password"}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setVendorToDelete(selectedVendor);
                    setDeleteVendorDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Vendor
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Contact Vendor Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact {selectedVendor?.name || "Vendor"}</DialogTitle>
            <DialogDescription>Compose a message and send via your email client</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>To</Label>
              <Input value={contactTo} onChange={(e) => setContactTo(e.target.value)} placeholder="vendor@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={contactSubject} onChange={(e) => setContactSubject(e.target.value)} placeholder={`Inquiry for ${selectedVendor?.name || "Vendor"}`} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <textarea
                className="w-full rounded-md border bg-background p-2 text-sm"
                rows={5}
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  const params = new URLSearchParams({
                    subject: contactSubject || `Inquiry for ${selectedVendor?.name || "Vendor"}`,
                    body: contactMessage || "",
                  });
                  const mailto = `mailto:${encodeURIComponent(contactTo || "")}?${params.toString()}`;
                  window.location.href = mailto;
                  setContactDialogOpen(false);
                }}
              >
                Open Email Client
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setContactDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* KYC Review Dialog */}
      <Dialog open={kycReviewOpen} onOpenChange={(open) => {
        setKycReviewOpen(open);
        if (!open) {
          setReviewingVendor(null);
          setRejectionReason("");
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KYC Review - {reviewingVendor?.companyName}</DialogTitle>
            <DialogDescription>Review vendor registration and approve/reject</DialogDescription>
          </DialogHeader>
          {reviewingVendor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-muted-foreground">Company Name</Label>
                  <p className="font-medium">{reviewingVendor.companyName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{reviewingVendor.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{reviewingVendor.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{reviewingVendor.phone || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Contact Person</Label>
                  <p className="font-medium">{reviewingVendor.contactPerson || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tax ID</Label>
                  <p className="font-medium">{reviewingVendor.taxId || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Address</Label>
                  <p className="font-medium">{reviewingVendor.address || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted Date</Label>
                  <p className="font-medium">{new Date(reviewingVendor.submittedDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(reviewingVendor.status)}>{reviewingVendor.status}</Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Rejection Reason (if rejecting)</Label>
                <textarea
                  className="w-full rounded-md border bg-background p-2 text-sm min-h-[100px]"
                  placeholder="Enter reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  className="flex-1 transition-transform hover:scale-105"
                  onClick={() => reviewingVendor.id && handleApprove(reviewingVendor.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Processing..." : "Approve Vendor"}
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1 transition-transform hover:scale-105"
                  onClick={() => reviewingVendor.id && handleReject(reviewingVendor.id)}
                  disabled={isProcessing || !rejectionReason.trim()}
                >
                  {isProcessing ? "Processing..." : "Reject"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Vendor Confirmation Dialog */}
      <AlertDialog open={deleteVendorDialogOpen} onOpenChange={setDeleteVendorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{vendorToDelete?.name}</strong>? This action cannot be undone and will remove all associated data including orders, documents, and history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingVendor}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVendor}
              disabled={isDeletingVendor}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingVendor ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Vendor"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Vendors;
