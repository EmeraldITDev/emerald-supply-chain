import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Users, TrendingUp, FileCheck, Plus, Star, Upload, Download, Trash2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { vendorApi } from "@/services/api";
import { VendorRegistration } from "@/types";
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
  const [selectedVendor, setSelectedVendor] = useState<typeof vendors[0] | null>(null);
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
  
  // New vendor form
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorCategory, setNewVendorCategory] = useState("");
  const [newVendorEmail, setNewVendorEmail] = useState("");

  // Fetch vendor registrations
  useEffect(() => {
    const fetchRegistrations = async () => {
      setLoadingRegistrations(true);
      try {
        const response = await vendorApi.getRegistrations();
        if (response.success && response.data) {
          setVendorRegistrations(response.data);
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load vendor registrations",
          variant: "destructive",
        });
      } finally {
        setLoadingRegistrations(false);
      }
    };

    fetchRegistrations();
  }, [toast]);

  // Fetch approved vendors
  useEffect(() => {
    const fetchVendors = async () => {
      setLoadingVendors(true);
      try {
        const response = await vendorApi.getAll();
        if (response.success && response.data) {
          // Transform API vendor data to match frontend format
          const transformedVendors = response.data.map((vendor: any) => ({
            id: vendor.vendor_id || vendor.id,
            name: vendor.name,
            category: vendor.category || 'Unknown',
            status: vendor.status || 'Active',
            kyc: 'Verified', // Assuming approved vendors are verified
            rating: vendor.rating || 0,
            orders: vendor.total_orders || 0,
            documents: [], // TODO: Fetch documents separately if needed
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
      if (response.success) {
        toast({
          title: "Approved",
          description: "Vendor registration has been approved. Credentials have been sent via email.",
        });
        // Refresh registrations
        const refreshResponse = await vendorApi.getRegistrations();
        if (refreshResponse.success && refreshResponse.data) {
          setVendorRegistrations(refreshResponse.data);
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
              <div className="text-2xl font-bold">42</div>
              <p className="text-xs text-muted-foreground">38 active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending KYC</CardTitle>
              <FileCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingKYC.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
              <Star className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4.6</div>
              <p className="text-xs text-muted-foreground">Out of 5.0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">91%</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pending KYC Submissions</CardTitle>
              <CardDescription>Vendors awaiting verification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingKYC.map((vendor) => (
                  <div key={vendor.name} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-semibold truncate">{vendor.name}</p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <span className="whitespace-nowrap">Category: {vendor.category}</span>
                        <span className="whitespace-nowrap">Documents: {vendor.documents}</span>
                        <span className="whitespace-nowrap">Submitted: {vendor.submitted}</span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setReviewingVendor(vendor.registration);
                        setKycReviewOpen(true);
                      }}
                      className="self-start sm:self-center transition-transform hover:scale-105"
                    >
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
              <CardDescription>Highest rated vendors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPerformers.map((vendor) => (
                  <div key={vendor.name} className="space-y-2">
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

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto gap-1">
            <TabsTrigger value="all" className="text-xs sm:text-sm px-2 sm:px-4">All Vendors</TabsTrigger>
            <TabsTrigger value="active" className="text-xs sm:text-sm px-2 sm:px-4">Active</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs sm:text-sm px-2 sm:px-4">Pending</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
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
                          <Badge className={getStatusColor(vendor.status)}>{vendor.status}</Badge>
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
                        onClick={() => {
                          setSelectedVendor(vendor);
                          setVendorDetailsOpen(true);
                        }}
                        className="self-start sm:self-center"
                      >
                        View Profile
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Vendor Details Dialog */}
      <Dialog open={vendorDetailsOpen} onOpenChange={setVendorDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vendor Profile - {selectedVendor?.name}</DialogTitle>
            <DialogDescription>Complete vendor information and performance</DialogDescription>
          </DialogHeader>
          {selectedVendor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Vendor ID</Label>
                  <p className="font-medium">{selectedVendor.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedVendor.status)}>{selectedVendor.status}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{selectedVendor.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">KYC Status</Label>
                  <Badge className={getStatusColor(selectedVendor.kyc)}>{selectedVendor.kyc}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rating</Label>
                  <p className="font-medium flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    {selectedVendor.rating}/5.0
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Orders</Label>
                  <p className="font-medium">{selectedVendor.orders}</p>
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
                
                {selectedVendor.documents.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground border rounded-md border-dashed">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No documents uploaded yet</p>
                    <p className="text-xs mt-1">Upload CAC, certificates, or other documents</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedVendor.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded-md bg-muted/30"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(doc.size / 1024).toFixed(1)} KB • {new Date(doc.uploadDate).toLocaleDateString()}
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

              <div className="flex gap-2 pt-4">
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
                  onClick={() => setContactDialogOpen(true)}
                >
                  Contact Vendor
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
    </DashboardLayout>
  );
};

export default Vendors;
