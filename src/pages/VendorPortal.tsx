import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Package, LogOut, CheckCircle, Bell, Clock, TrendingUp, X, Check, ChevronUp, ChevronDown, Send, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";
import logo from "@/assets/emerald-logo.png";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/contexts/AppContext";
import { vendorApi, vendorAuthApi } from "@/services/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EnhancedVendorRegistration } from "@/components/EnhancedVendorRegistration";
import { VendorQuoteSubmission } from "@/components/VendorQuoteSubmission";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Vendor } from "@/types";

interface VendorData extends Vendor {
  companyName?: string;
}

const VendorPortal = () => {
  const { toast } = useToast();
  const { rfqs, quotations, addQuotation, updateQuotation, addVendorRegistration } = useApp();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [currentVendor, setCurrentVendor] = useState<VendorData | null>(null);
  const [currentVendorId, setCurrentVendorId] = useState("");
  const [activeTab, setActiveTab] = useState("rfqs");
  const [selectedRfqForDetails, setSelectedRfqForDetails] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isBottomBarCollapsed, setIsBottomBarCollapsed] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Array<{name: string, status: string, uploaded: string, file?: File}>>([]);
  const [uploadedQuoteDocs, setUploadedQuoteDocs] = useState<File[]>([]);
  const [uploadedRegDocs, setUploadedRegDocs] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quoteDocInputRef = useRef<HTMLInputElement>(null);
  
  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Password change dialog
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPasswordForChange, setCurrentPasswordForChange] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Registration form (legacy)
  const [companyName, setCompanyName] = useState("");
  const [category, setCategory] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactPerson, setContactPerson] = useState("");

  // Quotation form
  const [selectedRfqId, setSelectedRfqId] = useState("");
  const [quotePrice, setQuotePrice] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('vendorAuthToken');
    const storedVendor = localStorage.getItem('vendorData');
    
    if (token && storedVendor) {
      try {
        const vendorData = JSON.parse(storedVendor);
        setCurrentVendor(vendorData);
        setCurrentVendorId(vendorData.id);
        setIsLoggedIn(true);
        
        // Verify token is still valid
        vendorAuthApi.getProfile().then((response) => {
          if (response.success && response.data) {
            setCurrentVendor(response.data);
            localStorage.setItem('vendorData', JSON.stringify(response.data));
          } else {
            // Token invalid, logout
            handleLogout();
          }
        }).catch(() => {
          handleLogout();
        });
      } catch {
        localStorage.removeItem('vendorAuthToken');
        localStorage.removeItem('vendorData');
      }
    }
  }, []);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleLogin = async () => {
    const errors: Record<string, string> = {};
    
    if (!email) errors.email = "Email is required";
    else if (!validateEmail(email)) errors.email = "Invalid email format";
    if (!password) errors.password = "Password is required";
    
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) return;
    
    setIsLoggingIn(true);
    
    try {
      const response = await vendorAuthApi.login(email, password);
      
      if (response.success && response.data) {
        const { vendor, token, requiresPasswordChange } = response.data;
        
        // Store token and vendor data
        localStorage.setItem('vendorAuthToken', token);
        localStorage.setItem('vendorData', JSON.stringify(vendor));
        
        setCurrentVendor(vendor);
        setCurrentVendorId(vendor.id);
        setIsLoggedIn(true);
        setFormErrors({});
        
        if (requiresPasswordChange) {
          setShowPasswordChange(true);
          setCurrentPasswordForChange(password);
          toast({
            title: "Password Change Required",
            description: "Please change your password to continue.",
          });
        } else {
          toast({ title: "Login Successful", description: "Welcome to Vendor Portal" });
        }
      } else {
        setFormErrors({ general: response.error || "Invalid credentials" });
      }
    } catch (error: any) {
      setFormErrors({ general: error.message || "Login failed. Please try again." });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirmation do not match",
        variant: "destructive",
      });
      return;
    }
    
    setIsChangingPassword(true);
    
    try {
      const response = await vendorAuthApi.changePassword(currentPasswordForChange, newPassword);
      
      if (response.success) {
        setShowPasswordChange(false);
        setNewPassword("");
        setConfirmPassword("");
        setCurrentPasswordForChange("");
        toast({
          title: "Password Changed",
          description: "Your password has been updated successfully",
        });
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to change password",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await vendorAuthApi.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem('vendorAuthToken');
      localStorage.removeItem('vendorData');
      setIsLoggedIn(false);
      setCurrentVendor(null);
      setCurrentVendorId("");
      setEmail("");
      setPassword("");
    }
  };

  const handleRegister = async () => {
    const errors: Record<string, string> = {};
    
    if (!companyName) errors.companyName = "Company name is required";
    if (!email) errors.email = "Email is required";
    else if (!validateEmail(email)) errors.email = "Invalid email format";
    if (!category) errors.category = "Category is required";
    if (!phone) errors.phone = "Phone is required";
    if (!address) errors.address = "Address is required";
    if (!taxId) errors.taxId = "Tax ID is required";
    if (!contactPerson) errors.contactPerson = "Contact person is required";
    
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast({ 
        title: "Validation Error", 
        description: "Please fix the errors in the form",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await vendorApi.registerSimple({
        companyName,
        category,
        email,
        phone,
        address,
        taxId,
        contactPerson,
        documents: uploadedRegDocs.length > 0 ? uploadedRegDocs : undefined,
      });

      if (response.success) {
        // Also update local state for immediate UI feedback
        addVendorRegistration({
          companyName,
          category,
          email,
          phone,
          address,
          taxId,
          contactPerson,
        });

        toast({ 
          title: "Registration Submitted", 
          description: "Your application is pending approval. You'll be notified via email."
        });
        
        // Reset form
        setShowRegistration(false);
        setFormErrors({});
        setEmail("");
        setPassword("");
        setCompanyName("");
        setCategory("");
        setPhone("");
        setAddress("");
        setTaxId("");
        setContactPerson("");
        setUploadedRegDocs([]);
      } else {
        // Handle validation errors
        if (response.error) {
          setFormErrors({ general: response.error });
          toast({
            title: "Registration Failed",
            description: response.error,
            variant: "destructive"
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitQuotation = async () => {
    const errors: Record<string, string> = {};
    
    if (!selectedRfqId) errors.rfq = "Please select an RFQ";
    if (!quotePrice || parseFloat(quotePrice) <= 0) errors.price = "Valid price is required";
    if (!deliveryDate) errors.deliveryDate = "Delivery date is required";
    
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) return;

    const selectedRfq = rfqs.find(r => r.id === selectedRfqId);
    if (!selectedRfq) return;

    setIsSubmitting(true);
    
    // Simulate async submission
    await new Promise(resolve => setTimeout(resolve, 800));

    addQuotation({
      rfqId: selectedRfqId,
      vendorId: currentVendorId,
      vendorName: "Steel Works Ltd",
      price: quotePrice,
      deliveryDate,
      notes: quoteNotes,
      status: "Pending",
    });

    toast({
      title: "Quotation Submitted Successfully",
      description: `Your quote for ${selectedRfq.mrfTitle} has been submitted`
    });

    // Reset form and switch to quotations tab
    setSelectedRfqId("");
    setQuotePrice("");
    setDeliveryDate("");
    setQuoteNotes("");
    setUploadedQuoteDocs([]);
    setFormErrors({});
    setIsSubmitting(false);
    setActiveTab("quotations");
  };
  
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newDocs = files.map(file => ({
        name: file.name,
        status: "Pending",
        uploaded: new Date().toISOString().split('T')[0],
        file
      }));
      setUploadedDocs([...uploadedDocs, ...newDocs]);
      toast({ 
        title: "Documents Uploaded", 
        description: `${files.length} document(s) uploaded. Pending review.` 
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleQuoteDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadedQuoteDocs([...uploadedQuoteDocs, ...files]);
      toast({ 
        title: "Document Attached", 
        description: `${files[0].name} added to quotation` 
      });
    }
  };
  
  const removeDoc = (index: number) => {
    const newDocs = [...uploadedDocs];
    newDocs.splice(index, 1);
    setUploadedDocs(newDocs);
    toast({ title: "Document Removed" });
  };
  
  const removeQuoteDoc = (index: number) => {
    const newDocs = [...uploadedQuoteDocs];
    newDocs.splice(index, 1);
    setUploadedQuoteDocs(newDocs);
  };

  const vendorQuotations = quotations.filter(q => q.vendorId === currentVendorId);
  const vendorRfqs = rfqs.filter(r => r.vendorIds.includes(currentVendorId) && r.status === "Open");
  const newRfqCount = vendorRfqs.length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-success/10 text-success border-success/20";
      case "Pending":
        return "bg-warning/10 text-warning border-warning/20";
      case "Rejected":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "Open":
        return "bg-info/10 text-info border-info/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (!isLoggedIn) {
    if (showRegistration) {
      return (
        <EnhancedVendorRegistration 
          onSubmit={(registration) => {
            addVendorRegistration({
              companyName: registration.companyName || '',
              category: registration.categories?.join(', ') || '',
              email: registration.email || '',
              phone: registration.phone || '',
              address: registration.address || '',
              taxId: registration.taxId || '',
              contactPerson: registration.contactPerson || '',
            });
            setShowRegistration(false);
            toast({
              title: "Registration Submitted",
              description: "Your application is pending approval. You'll be notified via email."
            });
          }}
          onCancel={() => setShowRegistration(false)}
        />
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <img src={logo} alt="Emerald Industrial" className="h-16 object-contain" />
            </div>
            <div className="space-y-2 text-center">
              <CardTitle className="text-3xl">Vendor Portal</CardTitle>
              <CardDescription>Sign in to access your account</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formErrors.general && (
              <Alert variant="destructive">
                <AlertDescription>{formErrors.general}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="vendor@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (formErrors.email || formErrors.general) setFormErrors({...formErrors, email: '', general: ''});
                }}
                onKeyDown={(e) => e.key === 'Enter' && !isLoggingIn && handleLogin()}
                className={formErrors.email ? "border-destructive" : ""}
                disabled={isLoggingIn}
              />
              {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (formErrors.password || formErrors.general) setFormErrors({...formErrors, password: '', general: ''});
                }}
                onKeyDown={(e) => e.key === 'Enter' && !isLoggingIn && handleLogin()}
                className={formErrors.password ? "border-destructive" : ""}
                disabled={isLoggingIn}
              />
              {formErrors.password && <p className="text-sm text-destructive">{formErrors.password}</p>}
            </div>
            <Button 
              className="w-full transition-transform hover:scale-105" 
              size="lg" 
              onClick={handleLogin}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button 
                onClick={() => setShowRegistration(true)} 
                className="text-primary hover:underline font-medium"
                disabled={isLoggingIn}
              >
                Register as Vendor
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Password Change Dialog */}
        <Dialog open={showPasswordChange} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Change Your Password</DialogTitle>
              <DialogDescription>
                You must change your temporary password before continuing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handlePasswordChange}
                disabled={isChangingPassword || !newPassword || !confirmPassword}
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Changing...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Emerald Industrial" className="h-10 object-contain" />
            <div className="border-l pl-4">
              <h1 className="font-semibold">Vendor Portal</h1>
              <p className="text-xs text-muted-foreground">{currentVendor?.name || currentVendor?.companyName || 'Vendor'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Popover open={showNotifications} onOpenChange={setShowNotifications}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative transition-transform hover:scale-110">
                  <Bell className="h-5 w-5" />
                  {newRfqCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center animate-pulse">
                      {newRfqCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 border-b">
                  <h3 className="font-semibold">Notifications</h3>
                  <p className="text-sm text-muted-foreground">You have {newRfqCount} new RFQ{newRfqCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {vendorRfqs.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No new notifications
                    </div>
                  ) : (
                    <div className="divide-y">
                      {vendorRfqs.map((rfq) => (
                        <div key={rfq.id} className="p-4 hover:bg-accent cursor-pointer transition-colors" onClick={() => {
                          setSelectedRfqForDetails(rfq.id);
                          setShowNotifications(false);
                        }}>
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{rfq.mrfTitle}</p>
                              <p className="text-xs text-muted-foreground">Deadline: {rfq.deadline}</p>
                              <p className="text-xs text-muted-foreground mt-1">Budget: ₦{parseInt(rfq.estimatedCost).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {newRfqCount > 0 && (
                  <div className="p-3 border-t">
                    <Button 
                      size="sm" 
                      className="w-full" 
                      onClick={() => {
                        setActiveTab("rfqs");
                        setShowNotifications(false);
                      }}
                    >
                      View All RFQs
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={handleLogout} className="gap-2 transition-transform hover:scale-105">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Welcome Back</h2>
            <p className="text-muted-foreground mt-2">Manage your RFQs, quotations, and documents</p>
          </div>
        </div>

        {newRfqCount > 0 && (
          <Alert className="bg-info/10 border-info/20">
            <Bell className="h-4 w-4 text-info" />
            <AlertDescription>
              You have <strong>{newRfqCount} new RFQ{newRfqCount > 1 ? 's' : ''}</strong> awaiting your quotation. Check the RFQs tab to respond.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open RFQs</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vendorRfqs.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting quotation</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submitted Quotes</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vendorQuotations.length}</div>
              <p className="text-xs text-muted-foreground">
                {vendorQuotations.filter(q => q.status === "Pending").length} pending review
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">96%</div>
              <p className="text-xs text-muted-foreground">Quote approval rate</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4.2h</div>
              <p className="text-xs text-muted-foreground">Below 8h target</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="rfqs" className="relative">
              RFQs
              {newRfqCount > 0 && (
                <span className="ml-2 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                  {newRfqCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="submit">Submit Quotation</TabsTrigger>
            <TabsTrigger value="quotations">My Quotations</TabsTrigger>
            <TabsTrigger value="documents">KYC Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="rfqs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Request for Quotations (RFQs)</CardTitle>
                <CardDescription>Review open RFQs and submit your quotations</CardDescription>
              </CardHeader>
              <CardContent>
                {vendorRfqs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No open RFQs at the moment</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vendorRfqs.map((rfq) => (
                      <div key={rfq.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">{rfq.mrfTitle}</span>
                              <Badge className={getStatusColor(rfq.status)}>{rfq.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{rfq.description}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">RFQ ID:</span>
                            <p className="font-medium">{rfq.id}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Quantity:</span>
                            <p className="font-medium">{rfq.quantity} units</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Estimated Budget:</span>
                            <p className="font-medium">₦{parseInt(rfq.estimatedCost).toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Deadline:</span>
                            <p className="font-medium text-warning">{rfq.deadline}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm"
                            onClick={() => {
                              setSelectedRfqId(rfq.id);
                              setActiveTab("submit");
                            }}
                            className="transition-transform hover:scale-105"
                          >
                            Submit Quotation
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedRfqForDetails(rfq.id)}
                            className="transition-transform hover:scale-105"
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submit" className="space-y-4">
            <VendorQuoteSubmission 
              rfqs={rfqs}
              vendorId={currentVendorId}
              vendorName="Steel Works Ltd"
              onSubmit={(quote) => {
                addQuotation({
                  rfqId: quote.rfqId,
                  vendorId: quote.vendorId,
                  vendorName: quote.vendorName,
                  price: quote.price,
                  deliveryDate: quote.deliveryDate,
                  notes: quote.notes,
                  status: "Pending",
                });
                setActiveTab("quotations");
              }}
            />
          </TabsContent>

          <TabsContent value="quotations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Submitted Quotations</CardTitle>
                <CardDescription>Track status of your submitted quotes</CardDescription>
              </CardHeader>
              <CardContent>
                {vendorQuotations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No quotations submitted yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vendorQuotations.map((quotation) => {
                      const rfq = rfqs.find(r => r.id === quotation.rfqId);
                      return (
                        <div key={quotation.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{rfq?.mrfTitle || "Unknown RFQ"}</span>
                                <Badge className={getStatusColor(quotation.status)}>{quotation.status}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">Quotation ID: {quotation.id}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Quote Price:</span>
                              <p className="font-medium">₦{parseInt(quotation.price).toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Delivery Date:</span>
                              <p className="font-medium">{quotation.deliveryDate}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Submitted:</span>
                              <p className="font-medium">{quotation.submittedDate}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">RFQ ID:</span>
                              <p className="font-medium">{quotation.rfqId}</p>
                            </div>
                          </div>
                          {quotation.notes && (
                            <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                              Notes: {quotation.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>KYC Documentation</CardTitle>
                <CardDescription>Upload and manage your verification documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div 
                    className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-all cursor-pointer hover:bg-accent/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium mb-1">Upload KYC Documents</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      CAC Certificate, Tax Clearance, Bank Details, ISO Certificates
                    </p>
                    <Input 
                      ref={fileInputRef}
                      type="file" 
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      multiple
                      onChange={handleDocUpload}
                    />
                    <Button variant="outline" size="sm" className="pointer-events-none">
                      Select Files
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {uploadedDocs.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 border rounded-lg transition-all hover:shadow-md">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{doc.name}</span>
                            <Badge className={getStatusColor(doc.status)}>
                              {doc.status === "Approved" && <Check className="h-3 w-3 mr-1" />}
                              {doc.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">Uploaded: {doc.uploaded}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="transition-transform hover:scale-105">
                            View
                          </Button>
                          {doc.status === "Pending" && (
                            <Button variant="ghost" size="sm" onClick={() => removeDoc(idx)}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* RFQ Details Dialog */}
      <Dialog open={selectedRfqForDetails !== null} onOpenChange={() => setSelectedRfqForDetails(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>RFQ Details</DialogTitle>
            <DialogDescription>Complete information about this request</DialogDescription>
          </DialogHeader>
          {selectedRfqForDetails && (() => {
            const rfq = rfqs.find(r => r.id === selectedRfqForDetails);
            if (!rfq) return null;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">RFQ ID</Label>
                    <p className="font-medium">{rfq.id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={getStatusColor(rfq.status)}>{rfq.status}</Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="font-medium">{rfq.mrfTitle}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Quantity</Label>
                    <p className="font-medium">{rfq.quantity} units</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Estimated Budget</Label>
                    <p className="font-medium">₦{parseInt(rfq.estimatedCost).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Deadline</Label>
                    <p className="font-medium text-warning">{rfq.deadline}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1">{rfq.description}</p>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRfqForDetails(null)}>
              Close
            </Button>
            <Button onClick={() => {
              if (selectedRfqForDetails) {
                setSelectedRfqId(selectedRfqForDetails);
                setActiveTab("submit");
                setSelectedRfqForDetails(null);
              }
            }}>
              Submit Quotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorPortal;
