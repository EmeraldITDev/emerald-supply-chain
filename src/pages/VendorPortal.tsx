import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Package, LogOut, CheckCircle, Bell, Clock, TrendingUp, X, Check, ChevronUp, ChevronDown, Send, Loader2, Building, Mail, Phone, MapPin, Globe, Calendar, Star, User, Download, AlertTriangle, Edit, Save, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/emerald-logo.png";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/contexts/AppContext";
import { vendorApi, vendorAuthApi, vendorPortalApi, quotationApi } from "@/services/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EnhancedVendorRegistration } from "@/components/EnhancedVendorRegistration";
import { VendorQuoteSubmission } from "@/components/VendorQuoteSubmission";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatMRFDate } from "@/utils/dateUtils";
import type { Vendor } from "@/types";

interface VendorData extends Vendor {
  companyName?: string;
}

const VendorPortal = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { rfqs, quotations, addVendorRegistration, refreshRFQs } = useApp();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [currentVendor, setCurrentVendor] = useState<VendorData | null>(null);
  const [currentVendorId, setCurrentVendorId] = useState("");
  const [activeTab, setActiveTab] = useState("rfqs");
  const [vendorRfqs, setVendorRfqs] = useState<Array<{
    id: string;
    title: string;
    description: string;
    deadline: string;
    status: string;
    estimated_cost?: string | number;
    estimatedCost?: string | number;
    budget?: string | number;
    payment_terms?: string;
    paymentTerms?: string;
    category?: string;
    items: Array<{
      id: string;
      item_name: string;
      quantity: number;
      unit: string;
      specifications: string;
    }>;
    sent_at: string;
    viewed_at: string | null;
    responded: boolean;
    has_submitted_quote: boolean;
  }>>([]);
  const [loadingVendorRfqs, setLoadingVendorRfqs] = useState(false);
  const [vendorQuotationsList, setVendorQuotationsList] = useState<any[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<any | null>(null);
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
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] = useState(false);
  
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

  // Vendor stats from API
  const [vendorStats, setVendorStats] = useState({
    successRate: 0,
    avgResponseTime: "N/A",
    totalOrders: 0,
    rating: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState({
    contactPerson: "",
    phone: "",
    address: "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Quote submission success state
  const [showQuoteSuccess, setShowQuoteSuccess] = useState(false);
  const [submittedQuote, setSubmittedQuote] = useState<any>(null);

  // Expiring documents calculation
  const getExpiringDocuments = () => {
    if (!currentVendor || !(currentVendor as any)?.documents) return [];
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    return ((currentVendor as any).documents || []).filter((doc: any) => {
      if (!doc.expiry_date && !doc.expiryDate) return false;
      const expiryDate = new Date(doc.expiry_date || doc.expiryDate);
      return expiryDate <= thirtyDaysFromNow && expiryDate >= new Date();
    });
  };

  const handleStartEditProfile = () => {
    setEditProfileData({
      contactPerson: (currentVendor as any)?.contact_person || (currentVendor as any)?.contactPerson || "",
      phone: (currentVendor as any)?.phone || "",
      address: (currentVendor as any)?.address || "",
    });
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const response = await vendorAuthApi.updateProfile({
        contact_person: editProfileData.contactPerson,
        phone: editProfileData.phone,
        address: editProfileData.address,
      });

      if (response.success && response.data) {
        setCurrentVendor((prev: any) => ({
          ...prev,
          contact_person: editProfileData.contactPerson,
          contactPerson: editProfileData.contactPerson,
          phone: editProfileData.phone,
          address: editProfileData.address,
        }));
        localStorage.setItem('vendorData', JSON.stringify({
          ...currentVendor,
          contact_person: editProfileData.contactPerson,
          phone: editProfileData.phone,
          address: editProfileData.address,
        }));
        toast({
          title: "Profile Updated",
          description: "Your profile information has been saved successfully",
        });
        setIsEditingProfile(false);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to update profile",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Fetch vendor-specific RFQs
  const fetchVendorRFQs = async () => {
    if (!isLoggedIn || !currentVendorId) return;
    
    setLoadingVendorRfqs(true);
    try {
      const response = await vendorPortalApi.getAssignedRFQs();
      if (response.success && response.data) {
        setVendorRfqs(response.data);
      } else {
        console.error('Failed to fetch vendor RFQs:', response.error);
        // Fallback: if API fails, try to use general rfqs (though vendorIds may be empty)
        console.warn('Using fallback RFQ list - vendorIds may not be populated correctly');
        setVendorRfqs([]);
      }
    } catch (error) {
      console.error('Error fetching vendor RFQs:', error);
      toast({
        title: "Error",
        description: "Failed to load RFQs. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoadingVendorRfqs(false);
    }
  };

  // Load drafts from localStorage
  const loadDrafts = () => {
    if (!currentVendorId) return [];
    
    const drafts: any[] = [];
    try {
      // Get all localStorage keys for this vendor's drafts
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`rfq_draft_`) && key.includes(`_${currentVendorId}`)) {
          const draftData = JSON.parse(localStorage.getItem(key) || '{}');
          if (draftData.rfqId) {
            // Calculate total price from line items
            const totalPrice = draftData.lineItems?.reduce((sum: number, item: any) => 
              sum + (item.quantity * item.unitPrice), 0) || 0;
            
            drafts.push({
              id: `DRAFT-${draftData.rfqId}-${currentVendorId}`,
              rfqId: draftData.rfqId,
              vendorId: currentVendorId,
              vendorName: currentVendor?.name || "Vendor",
              price: totalPrice.toString(),
              deliveryDate: draftData.deliveryDate || '',
              submittedDate: draftData.savedAt ? new Date(draftData.savedAt).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }) : 'Draft',
              status: "Draft",
              notes: draftData.notes || '',
              paymentTerms: draftData.paymentTerms || '',
              validityPeriod: draftData.validityPeriod || '30',
              warrantyPeriod: draftData.warrantyPeriod || '',
              lineItems: draftData.lineItems || [],
              isDraft: true,
              savedAt: draftData.savedAt,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading drafts:', error);
    }
    return drafts;
  };

  // Fetch vendor quotations
  const fetchVendorQuotations = async () => {
    if (!isLoggedIn || !currentVendorId) return;
    
    setLoadingQuotations(true);
    try {
      // Try using vendor-specific endpoint /api/vendors/quotations
      // Note: If backend hasn't implemented this endpoint yet, it will 404
      const response = await vendorPortalApi.getMyQuotations();
      
      let serverQuotations: any[] = [];
      if (response.success && response.data) {
        serverQuotations = response.data;
      } else {
        // If endpoint doesn't exist (404), use fallback to context quotations
        // Backend needs to implement GET /api/vendors/quotations endpoint
        // Check for 404 in error message or use fallback if error exists
        console.warn('Vendor quotations endpoint issue:', response.error);
        // Use fallback data from context if available
        serverQuotations = quotations.filter(q => q.vendorId === currentVendorId);
      }
      
      // Load drafts and combine with server quotations
      const drafts = loadDrafts();
      const allQuotations = [...serverQuotations, ...drafts];
      
      // Remove duplicates (in case a draft was submitted and now exists on server)
      const uniqueQuotations = allQuotations.filter((q, index, self) =>
        index === self.findIndex((t) => (
          t.id === q.id || 
          (t.isDraft && q.isDraft && t.rfqId === q.rfqId)
        ))
      );
      
      setVendorQuotationsList(uniqueQuotations);
    } catch (error) {
      console.error('Error fetching vendor quotations:', error);
      // Fallback to context quotations + drafts if API fails
      const drafts = loadDrafts();
      setVendorQuotationsList([...quotations.filter(q => q.vendorId === currentVendorId), ...drafts]);
    } finally {
      setLoadingQuotations(false);
    }
  };

  // Delete quotation function
  const [deletingQuotationId, setDeletingQuotationId] = useState<string | null>(null);
  const handleDeleteQuotation = async (quotationId: string) => {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this quotation? This action cannot be undone.')) {
      return;
    }

    setDeletingQuotationId(quotationId);
    try {
      // Use vendorPortalApi.deleteQuotation which handles authentication properly
      const response = await vendorPortalApi.deleteQuotation(quotationId);

      if (response.success) {
        // Remove from list immediately (both drafts and server quotations)
        setVendorQuotationsList(prev => prev.filter(q => q.id !== quotationId));
        
        // Also remove from local storage if it's a draft
        const drafts = loadDrafts();
        const updatedDrafts = drafts.filter((d: any) => d.id !== quotationId);
        if (updatedDrafts.length !== drafts.length) {
          localStorage.setItem(`vendor_quotations_drafts_${currentVendorId}`, JSON.stringify(updatedDrafts));
        }
        
        toast({
          title: "Quotation Deleted",
          description: "The quotation has been successfully removed.",
        });
        
        // Refresh quotations list from server
        await fetchVendorQuotations();
      } else {
        toast({
          title: "Delete Failed",
          description: response.error || "Failed to delete quotation. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error deleting quotation:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred while deleting the quotation.",
        variant: "destructive",
      });
    } finally {
      setDeletingQuotationId(null);
    }
  };

  // Refresh function to reload all data - preserves vendor session
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Only refresh vendor-specific data - do NOT call refreshRFQs() as it uses regular auth
      // and might interfere with vendor session
      await Promise.all([
        fetchVendorRFQs(),
        fetchVendorQuotations(),
      ]);
      
      toast({
        title: "Refreshed",
        description: "All data has been refreshed",
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

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
        
        // Verify token is still valid and fetch full profile
        vendorAuthApi.getProfile().then((response) => {
          if (response.success && response.data) {
            const fullVendor = response.data as any;
            setCurrentVendor(fullVendor);
            localStorage.setItem('vendorData', JSON.stringify(fullVendor));
            
            // Calculate stats from vendor data
            const approvedQuotes = quotations.filter(q => q.vendorId === vendorData.id && q.status === 'Approved').length;
            const totalQuotes = quotations.filter(q => q.vendorId === vendorData.id).length;
            const successRate = totalQuotes > 0 ? Math.round((approvedQuotes / totalQuotes) * 100) : 0;
            
            setVendorStats({
              successRate,
              avgResponseTime: fullVendor.avg_response_time || fullVendor.avgResponseTime || "N/A",
              totalOrders: fullVendor.total_orders || fullVendor.totalOrders || fullVendor.orders || 0,
              rating: fullVendor.rating || 0,
            });
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
  }, [quotations]);

  // Fetch vendor RFQs and quotations when logged in
  useEffect(() => {
    if (isLoggedIn && currentVendorId) {
      fetchVendorRFQs();
      fetchVendorQuotations();
    }
  }, [isLoggedIn, currentVendorId]);

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
        const { vendor, token } = response.data;
        
        // Store token and vendor data
        localStorage.setItem('vendorAuthToken', token);
        localStorage.setItem('vendorData', JSON.stringify(vendor));
        
        setCurrentVendor(vendor);
        setCurrentVendorId(vendor.id);
        setIsLoggedIn(true);
        setFormErrors({});
        
          toast({ title: "Login Successful", description: "Welcome to Vendor Portal" });
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

  const handleRequestPasswordReset = async () => {
    setIsRequestingPasswordReset(true);
    try {
      const response = await vendorAuthApi.requestPasswordReset();
      if (response.success) {
        toast({
          title: "Password Reset Requested",
          description: "Your password reset request has been sent to the Procurement Manager. They will contact you to help reset your password.",
        });
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to request password reset",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request password reset",
        variant: "destructive",
      });
    } finally {
      setIsRequestingPasswordReset(false);
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
    
    // TODO: This is a demo function - actual quotation submission should use quotationApi.submit()
    // For now, show success message and refresh RFQs
    await new Promise(resolve => setTimeout(resolve, 800));

    toast({
      title: "Quotation Submitted Successfully",
      description: `Your quote for ${selectedRfq.mrfTitle} has been submitted`,
    });
    
    // Refresh RFQs to get updated data from API
    await refreshRFQs();

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

  // Use fetched vendor quotations, fallback to context quotations if empty
  const vendorQuotations = vendorQuotationsList.length > 0 
    ? vendorQuotationsList 
    : quotations.filter(q => q.vendorId === currentVendorId);
  // Use vendor-specific RFQs fetched from API, filter to only show Open ones
  // Also include RFQs that don't have a status set (assume they're open)
  const openVendorRfqs = vendorRfqs.filter(r => 
    !r.status || 
    r.status === "Open" || 
    r.status === "open" || 
    r.status.toLowerCase() === "open" ||
    (!r.has_submitted_quote && !r.responded) // If vendor hasn't responded, it's still open
  );
  const newRfqCount = openVendorRfqs.filter(r => !r.viewed_at || !r.responded).length;

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
          onSubmit={async (registration) => {
            // Prevent double submission
            if (isSubmitting) {
              console.log('Registration already in progress, ignoring duplicate submission');
              return;
            }
            
            setIsSubmitting(true);
            try {
              // Convert documents from base64 to File objects for API
              const documentFiles: File[] = [];
              if (registration.documents && registration.documents.length > 0) {
                registration.documents.forEach((doc) => {
                  if (doc.fileData && doc.fileName) {
                    try {
                      // Extract base64 data and MIME type
                      const base64Data = doc.fileData.includes(',') 
                        ? doc.fileData.split(',')[1] 
                        : doc.fileData;
                      const mimeMatch = doc.fileData.match(/data:([^;]+);/);
                      const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
                      
                      // Convert base64 to File
                      const byteCharacters = atob(base64Data);
                      const byteNumbers = new Array(byteCharacters.length);
                      for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                      }
                      const byteArray = new Uint8Array(byteNumbers);
                      const blob = new Blob([byteArray], { type: mimeType });
                      const file = new File([blob], doc.fileName, { type: mimeType });
                      documentFiles.push(file);
                    } catch (error) {
                      console.error('Error converting document:', doc.fileName, error);
                    }
                  }
                });
              }

              // Ensure category is a non-empty string
              // EnhancedVendorRegistration sends categories as array, backend expects single string
              let categoryValue = '';
              if (registration.categories && Array.isArray(registration.categories) && registration.categories.length > 0) {
                // Join multiple categories with comma
                categoryValue = registration.categories.join(', ');
              } else if ((registration as any).category && typeof (registration as any).category === 'string') {
                categoryValue = (registration as any).category;
              } else {
                // This should not happen if validation worked, but provide fallback
                console.error('No category provided in registration:', registration);
                toast({
                  title: "Validation Error",
                  description: "Please select at least one business category",
                  variant: "destructive"
                });
                setIsSubmitting(false);
                return;
              }

              // Validate required fields before sending
              if (!registration.companyName || !categoryValue || !registration.email) {
                toast({
                  title: "Validation Error",
                  description: "Please fill in all required fields (Company Name, Category, Email)",
                  variant: "destructive"
                });
                setIsSubmitting(false);
                return;
              }

              // Build full address string from components
              const fullAddress = [
                registration.address,
                registration.city,
                registration.state,
                registration.country,
                registration.postalCode
              ].filter(Boolean).join(', ');

              // Log the data being sent for debugging
              console.log('Sending registration data:', {
                companyName: registration.companyName,
                category: categoryValue,
                email: registration.email,
                phone: registration.phone || registration.alternatePhone || '',
                address: fullAddress || registration.address || '',
                taxId: registration.taxId || '',
                contactPerson: registration.contactPerson || '',
                documentsCount: documentFiles.length,
              });

              // Use registerSimple which handles FormData for file uploads
              // Backend only accepts: companyName, category, email, phone, address, taxId, contactPerson, documents
              const registrationPayload = {
                companyName: registration.companyName?.trim() || '',
                category: categoryValue.trim(),
                email: registration.email?.trim() || '',
                phone: (registration.phone || registration.alternatePhone)?.trim() || undefined,
                address: (fullAddress || registration.address)?.trim() || undefined,
                taxId: registration.taxId?.trim() || undefined,
                contactPerson: registration.contactPerson?.trim() || undefined,
                documents: documentFiles.length > 0 ? documentFiles : undefined,
              };

              // Final validation - ensure required fields are not empty
              if (!registrationPayload.companyName || !registrationPayload.category || !registrationPayload.email) {
                toast({
                  title: "Validation Error",
                  description: "Company Name, Category, and Email are required fields",
                  variant: "destructive"
                });
                setIsSubmitting(false);
                return;
              }

              const response = await vendorApi.registerSimple(registrationPayload);

              if (response.success) {
                // Only add to local state if it's a new registration (201) or if we have registration data
                if (response.data) {
                  addVendorRegistration({
                    companyName: registration.companyName || '',
                    category: registration.categories?.join(', ') || '',
                    email: registration.email || '',
                    phone: registration.phone || '',
                    address: registration.address || '',
                    taxId: registration.taxId || '',
                    contactPerson: registration.contactPerson || '',
                  });
                }
                
                setShowRegistration(false);
                toast({
                  title: "Registration Submitted",
                  description: (response.data as any)?.message || "Your application is pending approval. You'll be notified via email."
                });
              } else {
                // Display detailed error message
                const errorMessage = response.error || "An error occurred. Please try again.";
                
                console.error('Registration failed:', {
                  error: response.error,
                  fullResponse: response
                });
                
                toast({
                  title: "Registration Failed",
                  description: errorMessage,
                  variant: "destructive"
                });
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
              <PasswordInput 
                id="password" 
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
                  {openVendorRfqs.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No new notifications
                    </div>
                  ) : (
                    <div className="divide-y">
                      {openVendorRfqs.map((rfq) => (
                        <div key={rfq.id} className="p-4 hover:bg-accent cursor-pointer transition-colors" onClick={() => {
                          setSelectedRfqForDetails(rfq.id);
                          setShowNotifications(false);
                        }}>
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{rfq.title}</p>
                              <p className="text-xs text-muted-foreground">Deadline: {new Date(rfq.deadline).toLocaleDateString()}</p>
                              <p className="text-xs text-muted-foreground mt-1">{rfq.items?.length || 0} item(s)</p>
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
            <Button 
              variant="outline" 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              className="gap-2 transition-transform hover:scale-105"
              title="Refresh data"
            >
              <RotateCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
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
              <div className="text-2xl font-bold">{openVendorRfqs.length}</div>
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
              <div className="text-2xl font-bold">
                {vendorQuotations.length > 0 
                  ? `${Math.round((vendorQuotations.filter(q => q.status === "Approved").length / vendorQuotations.length) * 100)}%`
                  : "0%"}
              </div>
              <p className="text-xs text-muted-foreground">Quote approval rate</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rating</CardTitle>
              <Star className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-1">
                {(currentVendor as any)?.rating || vendorStats.rating || 0}
                <span className="text-sm font-normal text-muted-foreground">/5</span>
              </div>
              <p className="text-xs text-muted-foreground">Performance rating</p>
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
            <TabsTrigger value="profile">My Profile</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="rfqs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Request for Quotations (RFQs)</CardTitle>
                <CardDescription>Review open RFQs and submit your quotations</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingVendorRfqs ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-12 w-12 mx-auto mb-3 animate-spin opacity-20" />
                    <p>Loading RFQs...</p>
                  </div>
                ) : openVendorRfqs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No open RFQs at the moment</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {openVendorRfqs.map((rfq) => (
                      <div key={rfq.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">{rfq.title}</span>
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
                            <span className="text-muted-foreground">Items:</span>
                            <p className="font-medium">{rfq.items?.length || 0} item(s)</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Sent At:</span>
                            <p className="font-medium">
                              {formatMRFDate(rfq.sent_at || (rfq as any).created_at || (rfq as any).createdAt)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Deadline:</span>
                            <p className="font-medium text-warning">{new Date(rfq.deadline).toLocaleDateString()}</p>
                          </div>
                          {(rfq.payment_terms || rfq.paymentTerms) && (
                            <div className="md:col-span-2">
                              <span className="text-muted-foreground">Proposed Payment Terms:</span>
                              <p className="font-medium">{rfq.payment_terms || rfq.paymentTerms}</p>
                            </div>
                          )}
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
              draftToLoad={selectedDraft}
              rfqs={(() => {
                // Use vendorRfqs as the source of truth for vendor-specific RFQs
                // Convert vendorRfqs format to RFQ format expected by VendorQuoteSubmission
                return vendorRfqs
                  .filter(rfq => rfq.status === "Open" || rfq.status === "open")
                  .map(vendorRfq => ({
                    id: vendorRfq.id,
                    mrfId: vendorRfq.id, // Use RFQ ID as MRF ID if not available
                    mrfTitle: vendorRfq.title,
                    description: vendorRfq.description,
                    quantity: '1', // Default if not available
                    estimatedCost: String(vendorRfq.estimated_cost || vendorRfq.estimatedCost || vendorRfq.budget || '0'),
                    deadline: vendorRfq.deadline,
                    status: vendorRfq.status,
                    category: vendorRfq.category || '',
                    paymentTerms: vendorRfq.payment_terms || vendorRfq.paymentTerms || '',
                    createdDate: vendorRfq.sent_at || new Date().toISOString(),
                    vendorIds: [], // Not needed for vendor quote submission
                  } as any)); // Type assertion to avoid strict type checking
              })()}
              vendorId={currentVendorId}
              vendorName={currentVendor?.name || "Vendor"}
              onSave={async (draft) => {
                // Save draft to localStorage and add to quotations list
                try {
                  const draftKey = `rfq_draft_${draft.rfqId}_${currentVendorId}`;
                  const draftData = {
                    ...draft,
                    savedAt: new Date().toISOString(),
                  };
                  localStorage.setItem(draftKey, JSON.stringify(draftData));
                  
                  // Calculate total price from line items
                  const totalPrice = draft.lineItems?.reduce((sum, item) => 
                    sum + (item.quantity * item.unitPrice), 0) || 0;
                  
                  // Create draft quotation object
                  const draftQuotation = {
                    id: `DRAFT-${draft.rfqId}-${currentVendorId}`,
                    rfqId: draft.rfqId,
                    vendorId: currentVendorId,
                    vendorName: currentVendor?.name || "Vendor",
                    price: totalPrice.toString(),
                    deliveryDate: draft.deliveryDate || '',
                    submittedDate: new Date().toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }),
                    status: "Draft",
                    notes: draft.notes || '',
                    paymentTerms: draft.paymentTerms || '',
                    validityPeriod: draft.validityPeriod || '30',
                    warrantyPeriod: draft.warrantyPeriod || '',
                    lineItems: draft.lineItems || [],
                    isDraft: true,
                    savedAt: draftData.savedAt,
                  };
                  
                  // Update quotations list - remove existing draft for this RFQ if any, then add new one
                  setVendorQuotationsList(prev => {
                    const filtered = prev.filter(q => !(q.isDraft && q.rfqId === draft.rfqId));
                    return [draftQuotation, ...filtered];
                  });
                  
                  toast({
                    title: "Draft Saved",
                    description: "Your quotation draft has been saved. You can continue later from My Quotations.",
                  });
                } catch (error) {
                  console.error('Error saving draft:', error);
                  toast({
                    title: "Save Failed",
                    description: "Failed to save draft. Please try again.",
                    variant: "destructive",
                  });
                }
              }}
              onIgnore={async (rfqId) => {
                // Mark RFQ as ignored (optional - could be stored locally or sent to backend)
                try {
                  const ignoredKey = `ignored_rfqs_${currentVendorId}`;
                  const ignored = JSON.parse(localStorage.getItem(ignoredKey) || '[]');
                  if (!ignored.includes(rfqId)) {
                    ignored.push(rfqId);
                    localStorage.setItem(ignoredKey, JSON.stringify(ignored));
                  }
                  // Optionally call backend to mark as ignored
                  // await vendorPortalApi.ignoreRFQ(rfqId);
                } catch (error) {
                  console.error('Error ignoring RFQ:', error);
                }
              }}
              onSubmit={async (quote) => {
                try {
                  // Check authentication token before submission
                  const token = localStorage.getItem('vendorAuthToken') || sessionStorage.getItem('vendorAuthToken');
                  if (!token) {
                    toast({
                      title: "Authentication Required",
                      description: "Your session has expired. Please log in again.",
                      variant: "destructive",
                    });
                    // Optionally redirect to login
                    handleLogout();
                    return;
                  }
                  
                  // Validate required fields before submission
                  if (!quote.rfqId) {
                    toast({
                      title: "Validation Error",
                      description: "Please select an RFQ to quote.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (!quote.deliveryDate) {
                    toast({
                      title: "Validation Error",
                      description: "Please provide a delivery date.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (!quote.lineItems || quote.lineItems.length === 0) {
                    toast({
                      title: "Validation Error",
                      description: "Please add at least one line item to your quotation.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (quote.lineItems.some(item => !item.description.trim() || item.unitPrice <= 0)) {
                    toast({
                      title: "Validation Error",
                      description: "All line items must have a description and valid unit price.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (!quote.paymentTerms) {
                    toast({
                      title: "Validation Error",
                      description: "Please select payment terms.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Validate total amount
                  const totalAmount = parseFloat(quote.price) || 0;
                  if (totalAmount <= 0) {
                    toast({
                      title: "Validation Error",
                      description: "Total quotation amount must be greater than zero.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Prepare quotation data with ALL fields from the form
                  const quotationData = {
                    total_amount: totalAmount,
                    delivery_date: quote.deliveryDate,
                    payment_terms: quote.paymentTerms || '',
                    validity_days: parseInt(quote.validityPeriod || '30'),
                    warranty_period: quote.warrantyPeriod || '',
                    notes: quote.notes || '',
                    items: quote.lineItems.map(item => ({
                      item_name: item.description.trim(),
                      quantity: item.quantity,
                      unit: 'unit', // Default unit, should come from RFQ item if available
                      unit_price: item.unitPrice,
                      specifications: item.description.trim() // Use description as specifications if needed
                    }))
                  };
                  
                  // Use vendorPortalApi.submitQuotation which handles authentication properly
                  const response = await vendorPortalApi.submitQuotation(
                    quote.rfqId,
                    quotationData,
                    quote.attachments && quote.attachments.length > 0 ? quote.attachments : undefined
                  );
                  
                  if (response.success && response.data) {
                    // Remove draft from localStorage if it was a draft
                    const draftKey = `rfq_draft_${quote.rfqId}_${currentVendorId}`;
                    localStorage.removeItem(draftKey);
                    
                    // Create quote object for immediate display
                    const submittedQuoteData = {
                      id: response.data.id || `QUOTE-${Date.now()}`,
                  rfqId: quote.rfqId,
                      vendorId: currentVendorId,
                      vendorName: currentVendor?.name || "Vendor",
                  price: quote.price,
                  deliveryDate: quote.deliveryDate,
                      submittedDate: new Date().toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      }),
                  status: "Pending",
                      notes: quote.notes,
                      paymentTerms: quote.paymentTerms,
                      validityPeriod: quote.validityPeriod,
                      warrantyPeriod: quote.warrantyPeriod,
                      lineItems: quote.lineItems,
                      ...(response.data || {})
                    };
                    
                    // Remove draft from list and add submitted quotation
                    setVendorQuotationsList(prev => {
                      const filtered = prev.filter(q => !(q.isDraft && q.rfqId === quote.rfqId));
                      return [submittedQuoteData, ...filtered];
                    });
                    
                    // Clear selected draft if it matches the submitted quote
                    if (selectedDraft && selectedDraft.rfqId === quote.rfqId) {
                      setSelectedDraft(null);
                    }
                    
                    // Show success dialog
                    setSubmittedQuote(submittedQuoteData);
                    setShowQuoteSuccess(true);
                    
                    // Switch to quotations tab
                setActiveTab("quotations");
                    
                    // Refresh data in background
                    await fetchVendorQuotations();
                    await fetchVendorRFQs();
                    
                    toast({
                      title: "Quotation Submitted Successfully",
                      description: "Your quotation has been sent to the Procurement Manager.",
                    });
                  } else {
                    // Handle specific error types
                    let errorTitle = "Submission Failed";
                    let errorDescription = response.error || "Failed to submit quotation. Please check all required fields and try again.";
                    
                    // Check if it's an authentication error
                    if (response.error && (response.error.includes('Authentication') || response.error.includes('401') || response.error.includes('Unauthorized'))) {
                      errorTitle = "Authentication Error";
                      errorDescription = "Your session has expired. Please log in again.";
                      // Clear tokens and redirect to login
                      setTimeout(() => {
                        handleLogout();
                      }, 2000);
                    } else if (response.error && (response.error.includes('422') || response.error.includes('Validation'))) {
                      errorTitle = "Validation Error";
                      // Error description already contains validation details
                    }
                    
                    toast({
                      title: errorTitle,
                      description: errorDescription,
                      variant: "destructive",
                    });
                  }
                } catch (error: any) {
                  console.error('Error submitting quotation:', error);
                  
                  // Check if it's a network error or authentication error
                  let errorTitle = "Submission Error";
                  let errorDescription = error.message || "An error occurred while submitting your quotation. Please try again.";
                  
                  if (error.message && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
                    errorTitle = "Authentication Error";
                    errorDescription = "Your session has expired. Please log in again.";
                    setTimeout(() => {
                      handleLogout();
                    }, 2000);
                  }
                  
                  toast({
                    title: errorTitle,
                    description: errorDescription,
                    variant: "destructive",
                  });
                }
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
                      // Use rfqTitle from quotation object if available (from backend), otherwise fallback to rfq.mrfTitle or "Unknown RFQ"
                      const rfqTitle = quotation.rfqTitle || rfq?.mrfTitle || "Unknown RFQ";
                      return (
                        <div key={quotation.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{rfqTitle}</span>
                                <Badge className={getStatusColor(quotation.status)}>{quotation.status}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">Quotation ID: {quotation.id}</p>
                            </div>
                            <div className="flex gap-2">
                              {quotation.isDraft && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // Load draft and switch to submit tab
                                    setSelectedDraft({
                                      rfqId: quotation.rfqId,
                                      lineItems: quotation.lineItems || [],
                                      deliveryDate: quotation.deliveryDate || '',
                                      notes: quotation.notes || '',
                                      validityPeriod: quotation.validityPeriod || '30',
                                      paymentTerms: quotation.paymentTerms || '',
                                      warrantyPeriod: quotation.warrantyPeriod || '',
                                    });
                                    setActiveTab("submit");
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Continue Editing
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteQuotation(quotation.id)}
                                disabled={deletingQuotationId === quotation.id}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                {deletingQuotationId === quotation.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
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

          {/* My Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            {/* Document Expiry Warning Banner */}
            {getExpiringDocuments().length > 0 && (
              <Alert className="border-warning bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription>
                  <div className="font-semibold text-warning mb-1">
                    Compliance Documents Expiring Soon
                  </div>
                  <div className="text-sm">
                    {getExpiringDocuments().length} document(s) will expire within 30 days:
                    <ul className="mt-1 list-disc list-inside">
                      {getExpiringDocuments().slice(0, 3).map((doc: any, idx: number) => (
                        <li key={idx}>
                          {doc.type || doc.name || `Document ${idx + 1}`} - expires{' '}
                          {new Date(doc.expiry_date || doc.expiryDate).toLocaleDateString()}
                        </li>
                      ))}
                      {getExpiringDocuments().length > 3 && (
                        <li>...and {getExpiringDocuments().length - 3} more</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Company Profile
                    </CardTitle>
                    <CardDescription>Your registered company information and documents</CardDescription>
                  </div>
                  {!isEditingProfile && (
                    <Button variant="outline" size="sm" onClick={handleStartEditProfile} className="gap-2">
                      <Edit className="h-4 w-4" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Company Name</Label>
                      <p className="font-medium">{currentVendor?.name || (currentVendor as any)?.company_name || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Vendor ID</Label>
                      <p className="font-medium">{(currentVendor as any)?.vendor_id || currentVendor?.id || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Status</Label>
                      <Badge className={getStatusColor((currentVendor as any)?.status || 'Active')}>
                        {(currentVendor as any)?.status || 'Active'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Category</Label>
                      <p className="font-medium">{(currentVendor as any)?.category || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Rating</Label>
                      <p className="font-medium flex items-center gap-1">
                        <Star className="h-4 w-4 fill-primary text-primary" />
                        {(currentVendor as any)?.rating || 0}/5.0
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Total Orders</Label>
                      <p className="font-medium">{(currentVendor as any)?.total_orders || (currentVendor as any)?.totalOrders || vendorStats.totalOrders || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Contact Information - Editable */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Contact Information
                    </h4>
                    {isEditingProfile && (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsEditingProfile(false)}
                          disabled={isSavingProfile}
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleSaveProfile}
                          disabled={isSavingProfile}
                          className="gap-2"
                        >
                          {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save Changes
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {isEditingProfile ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground mt-3" />
                        <div className="flex-1">
                          <Label className="text-muted-foreground text-xs">Email (read-only)</Label>
                          <Input value={(currentVendor as any)?.email || ''} disabled className="bg-muted" />
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground mt-3" />
                        <div className="flex-1">
                          <Label className="text-muted-foreground text-xs">Phone</Label>
                          <Input 
                            value={editProfileData.phone} 
                            onChange={(e) => setEditProfileData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="Enter phone number"
                          />
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-muted-foreground mt-3" />
                        <div className="flex-1">
                          <Label className="text-muted-foreground text-xs">Contact Person</Label>
                          <Input 
                            value={editProfileData.contactPerson} 
                            onChange={(e) => setEditProfileData(prev => ({ ...prev, contactPerson: e.target.value }))}
                            placeholder="Enter contact person name"
                          />
                        </div>
                      </div>
                      <div className="flex items-start gap-2 md:col-span-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-3" />
                        <div className="flex-1">
                          <Label className="text-muted-foreground text-xs">Address</Label>
                          <Textarea 
                            value={editProfileData.address} 
                            onChange={(e) => setEditProfileData(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="Enter company address"
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <Label className="text-muted-foreground text-xs">Email</Label>
                          <p className="font-medium">{(currentVendor as any)?.email || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <Label className="text-muted-foreground text-xs">Phone</Label>
                          <p className="font-medium">{(currentVendor as any)?.phone || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <Label className="text-muted-foreground text-xs">Contact Person</Label>
                          <p className="font-medium">{(currentVendor as any)?.contact_person || (currentVendor as any)?.contactPerson || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <Label className="text-muted-foreground text-xs">Website</Label>
                          <p className="font-medium">{(currentVendor as any)?.website || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 md:col-span-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <Label className="text-muted-foreground text-xs">Address</Label>
                          <p className="font-medium">{(currentVendor as any)?.address || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  )}
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
                      <p className="font-medium">{(currentVendor as any)?.tax_id || (currentVendor as any)?.taxId || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Year Established</Label>
                      <p className="font-medium">{(currentVendor as any)?.year_established || (currentVendor as any)?.yearEstablished || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Number of Employees</Label>
                      <p className="font-medium">{(currentVendor as any)?.number_of_employees || (currentVendor as any)?.numberOfEmployees || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Annual Revenue</Label>
                      <p className="font-medium">{(currentVendor as any)?.annual_revenue || (currentVendor as any)?.annualRevenue || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Registration Date</Label>
                      <p className="font-medium flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {(currentVendor as any)?.created_at || (currentVendor as any)?.createdAt
                          ? new Date((currentVendor as any)?.created_at || (currentVendor as any)?.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Registration Documents */}
                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Registration Documents
                  </h4>
                  {(currentVendor as any)?.documents && (currentVendor as any).documents.length > 0 ? (
                    <div className="space-y-2">
                      {(currentVendor as any).documents.map((doc: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <div>
                              <p className="text-sm font-medium">{doc.type || doc.name || doc.fileName || `Document ${idx + 1}`}</p>
                              <p className="text-xs text-muted-foreground">
                                {doc.file_name || doc.fileName || ''}
                                {doc.expiry_date && ` • Expires: ${new Date(doc.expiry_date).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>
                          {(doc.file_url || doc.file_path) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(doc.file_url || doc.file_path, '_blank')}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              View
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-muted-foreground border rounded-md border-dashed">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No registration documents available</p>
                      <p className="text-xs mt-1">Documents submitted during registration will appear here</p>
                    </div>
                  )}
                </div>

                {/* Account Settings */}
                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Account Settings
                  </h4>
                  <div className="space-y-3">
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Password Reset Request</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Request assistance from Procurement Manager to reset your password
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRequestPasswordReset}
                          disabled={isRequestingPasswordReset}
                          className="gap-2"
                        >
                          {isRequestingPasswordReset ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Requesting...
                            </>
                          ) : (
                            <>
                              <Mail className="h-4 w-4" />
                              Request Reset
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Stats */}
                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Performance Statistics
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 border rounded-md bg-muted/30 text-center">
                      <p className="text-2xl font-bold text-primary">
                        {vendorQuotations.length > 0 
                          ? `${Math.round((vendorQuotations.filter(q => q.status === "Approved").length / vendorQuotations.length) * 100)}%`
                          : "0%"}
                      </p>
                      <p className="text-xs text-muted-foreground">Success Rate</p>
                    </div>
                    <div className="p-3 border rounded-md bg-muted/30 text-center">
                      <p className="text-2xl font-bold text-primary">{vendorQuotations.length}</p>
                      <p className="text-xs text-muted-foreground">Total Quotes</p>
                    </div>
                    <div className="p-3 border rounded-md bg-muted/30 text-center">
                      <p className="text-2xl font-bold text-primary">{vendorQuotations.filter(q => q.status === "Approved").length}</p>
                      <p className="text-xs text-muted-foreground">Approved</p>
                    </div>
                    <div className="p-3 border rounded-md bg-muted/30 text-center">
                      <p className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                        <Star className="h-4 w-4 fill-primary" />
                        {(currentVendor as any)?.rating || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Settings
                </CardTitle>
                <CardDescription>Manage your account preferences and security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Password Reset Request */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">Password Reset Request</h4>
                      <p className="text-sm text-muted-foreground">
                        If you need to reset your password, you can request assistance from the Procurement Manager. 
                        They will help you set up a new password.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleRequestPasswordReset}
                    disabled={isRequestingPasswordReset}
                    className="gap-2 mt-4"
                  >
                    {isRequestingPasswordReset ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Request Password Reset
                      </>
                    )}
                  </Button>
                </div>

                {/* Account Information */}
                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-sm mb-3">Account Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Email</Label>
                      <p className="font-medium">{(currentVendor as any)?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Vendor ID</Label>
                      <p className="font-medium">{(currentVendor as any)?.vendor_id || currentVendor?.id || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Company Name</Label>
                      <p className="font-medium">{currentVendor?.name || (currentVendor as any)?.company_name || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Account Status</Label>
                      <Badge className={getStatusColor((currentVendor as any)?.status || 'Active')}>
                        {(currentVendor as any)?.status || 'Active'}
                      </Badge>
                    </div>
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
            const rfq = vendorRfqs.find(r => r.id === selectedRfqForDetails);
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
                    <p className="font-medium">{rfq.title}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Items</Label>
                    <p className="font-medium">{rfq.items?.length || 0} item(s)</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Sent At</Label>
                    <p className="font-medium">
                      {formatMRFDate(rfq.sent_at || (rfq as any).created_at || (rfq as any).createdAt)}
                    </p>
                  </div>
                  {(rfq.payment_terms || rfq.paymentTerms) && (
                    <div>
                      <Label className="text-muted-foreground">Proposed Payment Terms</Label>
                      <p className="font-medium">{rfq.payment_terms || rfq.paymentTerms}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Deadline</Label>
                    <p className="font-medium text-warning">{new Date(rfq.deadline).toLocaleDateString()}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1">{rfq.description}</p>
                </div>
                {rfq.items && rfq.items.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Items</Label>
                    <div className="mt-2 space-y-2">
                      {rfq.items.map((item, idx) => (
                        <div key={idx} className="p-2 border rounded">
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Quantity: {item.quantity} {item.unit}
                            {item.specifications && ` • ${item.specifications}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

      {/* Quote Submission Success Dialog */}
      <Dialog open={showQuoteSuccess} onOpenChange={setShowQuoteSuccess}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Quote Submitted Successfully!</DialogTitle>
                <DialogDescription className="text-base mt-1">
                  Your quotation has been sent to the Procurement Manager
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {submittedQuote && (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Quotation ID:</span>
                    <p className="font-medium font-mono">{submittedQuote.id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">RFQ ID:</span>
                    <p className="font-medium font-mono">{submittedQuote.rfqId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Amount:</span>
                    <p className="font-medium text-lg text-primary">
                      ₦{parseFloat(submittedQuote.price || '0').toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Delivery Date:</span>
                    <p className="font-medium">{submittedQuote.deliveryDate}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payment Terms:</span>
                    <p className="font-medium">{submittedQuote.paymentTerms || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className={getStatusColor(submittedQuote.status)}>
                      {submittedQuote.status}
                    </Badge>
                  </div>
                </div>
                
                {submittedQuote.lineItems && submittedQuote.lineItems.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <Label className="text-sm font-semibold mb-2 block">Line Items:</Label>
                    <div className="space-y-2">
                      {submittedQuote.lineItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm p-2 bg-background rounded">
                          <span>{item.description}</span>
                          <span className="font-medium">
                            {item.quantity} × ₦{item.unitPrice.toLocaleString()} = ₦{(item.quantity * item.unitPrice).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {submittedQuote.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <Label className="text-sm font-semibold mb-2 block">Notes:</Label>
                    <p className="text-sm text-muted-foreground">{submittedQuote.notes}</p>
                  </div>
                )}
              </div>
              
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Your quotation is now visible under "My Quotations" and has been forwarded to the Procurement Manager for review.
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <DialogFooter className="mt-6">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowQuoteSuccess(false);
                setSubmittedQuote(null);
              }}
            >
              Close
            </Button>
            <Button 
              onClick={() => {
                setShowQuoteSuccess(false);
                setSubmittedQuote(null);
                setActiveTab("quotations");
              }}
            >
              View My Quotations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorPortal;
