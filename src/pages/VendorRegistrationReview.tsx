import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { vendorApi } from "@/services/api";
import { VendorRegistration } from "@/types";
import { VENDOR_DOCUMENT_REQUIREMENTS, VendorDocument } from "@/types/vendor-registration";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Globe,
  Calendar,
  Users,
  DollarSign,
  FileCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react";
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

const VendorRegistrationReview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [registration, setRegistration] = useState<VendorRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  useEffect(() => {
    const fetchRegistration = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        // Fetch the specific registration by ID
        const response = await vendorApi.getRegistration(id);
        console.log('Full API Response:', JSON.stringify(response, null, 2));
        if (response.success && response.data) {
          // apiRequest now extracts the data property from backend responses
          const registrationData = response.data;
          console.log('Registration Data Object:', registrationData);
          console.log('Company Name:', registrationData?.companyName);
          console.log('Email:', registrationData?.email);
          console.log('Phone:', registrationData?.phone);
          console.log('Address:', registrationData?.address);
          console.log('Contact Person:', registrationData?.contactPerson);
          console.log('Tax ID:', registrationData?.taxId);
          console.log('Category:', registrationData?.category);
          console.log('Documents:', registrationData?.documents);
          
          // Ensure we have the actual registration object
          if (registrationData && typeof registrationData === 'object' && 'companyName' in registrationData) {
            setRegistration(registrationData as VendorRegistration);
          } else {
            console.error('Invalid registration data structure:', registrationData);
            toast({
              title: "Error",
              description: "Invalid data format received from server",
              variant: "destructive",
            });
          }
        } else {
          console.error('Registration fetch failed:', response.error);
          toast({
            title: "Not Found",
            description: response.error || "Vendor registration not found",
            variant: "destructive",
          });
          navigate("/vendors");
        }
      } catch (error) {
        console.error('Registration fetch error:', error);
        toast({
          title: "Error",
          description: "Failed to load registration details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRegistration();
  }, [id, navigate, toast]);

  const handleApprove = async () => {
    if (!registration) return;
    
    setIsProcessing(true);
    try {
      const response = await vendorApi.approveRegistration(registration.id);
      // Check if the approval was successful - response.success being true means it worked
      if (response.success) {
        const temporaryPassword = response.data?.temporaryPassword;
        toast({
          title: "Vendor Approved",
          description: temporaryPassword
            ? `Account created. Temporary password: ${temporaryPassword}`
            : "Vendor has been approved and credentials have been sent via email.",
        });
        navigate("/vendors");
      } else {
        toast({
          title: "Server Error",
          description: response.error || "Backend server error. Please check the server logs or try again later.",
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
      setShowApproveDialog(false);
    }
  };

  const handleReject = async () => {
    if (!registration || !rejectionReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    try {
      const response = await vendorApi.rejectRegistration(registration.id, rejectionReason);
      if (response.success) {
        toast({
          title: "Registration Rejected",
          description: "The vendor has been notified.",
        });
        navigate("/vendors");
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
      setShowRejectDialog(false);
    }
  };

  const handleDownloadDocument = (document: VendorDocument) => {
    // Support both fileData (base64 or URL) and fileUrl
    const downloadUrl = document.fileData || (document as any).fileUrl;
    
    if (downloadUrl) {
      // If it's a URL (starts with http), open in new tab, otherwise download
      if (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')) {
        window.open(downloadUrl, '_blank');
        toast({
          title: "Opening Document",
          description: `Opening ${document.fileName || document.name}...`,
        });
      } else {
        // Base64 data URL
        const link = window.document.createElement("a");
        link.href = downloadUrl;
        link.download = document.fileName || document.name || 'document';
        link.click();
        toast({
          title: "Downloading",
          description: `Downloading ${document.fileName || document.name}...`,
        });
      }
    } else {
      toast({
        title: "Download Error",
        description: "Document data not available",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <Badge className="bg-warning/10 text-warning"><Clock className="h-3 w-3 mr-1" /> Pending Review</Badge>;
      case "Approved":
        return <Badge className="bg-success/10 text-success"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
      case "Rejected":
        return <Badge className="bg-destructive/10 text-destructive"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      case "Under Review":
        return <Badge className="bg-info/10 text-info"><FileCheck className="h-3 w-3 mr-1" /> Under Review</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDocumentLabel = (type: string) => {
    const req = VENDOR_DOCUMENT_REQUIREMENTS.find(r => r.type === type);
    return req?.label || type;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!registration) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold">Registration Not Found</h2>
          <Button className="mt-4" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Vendors
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Type assertion for enhanced registration data
  const enhancedReg = registration as any;
  const documents: VendorDocument[] = (registration?.documents || enhancedReg?.documents || []) as VendorDocument[];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{registration?.companyName || "Vendor Registration"}</h1>
              <p className="text-sm text-muted-foreground">Vendor Registration Review</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(registration?.status || "Pending")}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Company Name</Label>
                  <p className="font-medium">{registration?.companyName || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{registration?.category || enhancedReg?.categories?.join(", ") || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tax ID</Label>
                  <p className="font-medium">{registration?.taxId || "N/A"}</p>
                </div>
                {enhancedReg.yearEstablished && (
                  <div>
                    <Label className="text-muted-foreground">Year Established</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-4 w-4" /> {enhancedReg.yearEstablished}
                    </p>
                  </div>
                )}
                {enhancedReg.numberOfEmployees && (
                  <div>
                    <Label className="text-muted-foreground">Number of Employees</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Users className="h-4 w-4" /> {enhancedReg.numberOfEmployees}
                    </p>
                  </div>
                )}
                {enhancedReg.annualRevenue && (
                  <div>
                    <Label className="text-muted-foreground">Annual Revenue</Label>
                    <p className="font-medium flex items-center gap-1">
                      <DollarSign className="h-4 w-4" /> {enhancedReg.annualRevenue}
                    </p>
                  </div>
                )}
                {enhancedReg.website && (
                  <div className="sm:col-span-2">
                    <Label className="text-muted-foreground">Website</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Globe className="h-4 w-4" />
                      <a href={enhancedReg.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {enhancedReg.website}
                      </a>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Contact Person</Label>
                  <p className="font-medium">{registration?.contactPerson || "N/A"}</p>
                </div>
                {enhancedReg?.contactPersonTitle && (
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="font-medium">{enhancedReg.contactPersonTitle}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium flex items-center gap-1">
                    <Mail className="h-4 w-4" /> {registration?.email || "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium flex items-center gap-1">
                    <Phone className="h-4 w-4" /> {registration?.phone || "N/A"}
                  </p>
                </div>
                {enhancedReg.alternatePhone && (
                  <div>
                    <Label className="text-muted-foreground">Alternate Phone</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Phone className="h-4 w-4" /> {enhancedReg.alternatePhone}
                    </p>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Label className="text-muted-foreground">Address</Label>
                  <p className="font-medium flex items-start gap-1">
                    <MapPin className="h-4 w-4 mt-1" />
                    <span>
                      {registration?.address || "N/A"}
                      {enhancedReg?.city && `, ${enhancedReg.city}`}
                      {enhancedReg?.state && `, ${enhancedReg.state}`}
                      {enhancedReg?.country && `, ${enhancedReg.country}`}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Uploaded Documents
                </CardTitle>
                <CardDescription>
                  {documents.length} document{documents.length !== 1 ? "s" : ""} uploaded
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No documents uploaded</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc, index) => (
                      <div
                        key={doc.id || index}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-8 w-8 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{getDocumentLabel(doc.type)}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {doc.fileName || doc.name} • {formatFileSize(doc.fileSize)}
                            </p>
                            {doc.expiryDate && (
                              <p className="text-xs text-warning flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadDocument(doc)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Actions & Status */}
          <div className="space-y-6">
            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle>Registration Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(registration.status)}</div>
                </div>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">Submitted Date</Label>
                  <p className="font-medium">
                    {registration.createdAt
                      ? new Date(registration.createdAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                {enhancedReg.reviewedDate && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-muted-foreground">Reviewed Date</Label>
                      <p className="font-medium">{new Date(enhancedReg.reviewedDate).toLocaleDateString()}</p>
                    </div>
                    {enhancedReg.reviewedBy && (
                      <div>
                        <Label className="text-muted-foreground">Reviewed By</Label>
                        <p className="font-medium">{enhancedReg.reviewedBy}</p>
                      </div>
                    )}
                  </>
                )}
                {enhancedReg.reviewNotes && (
                  <div>
                    <Label className="text-muted-foreground">Review Notes</Label>
                    <p className="text-sm">{enhancedReg.reviewNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            {registration.status === "Pending" && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                  <CardDescription>Review and take action on this registration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={() => setShowApproveDialog(true)}
                    disabled={isProcessing}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Registration
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={isProcessing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Registration
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Vendor Registration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve {registration?.companyName}? A vendor account will be created and login credentials will be sent to their email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Vendor Registration</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this registration. The vendor will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isProcessing || !rejectionReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default VendorRegistrationReview;
