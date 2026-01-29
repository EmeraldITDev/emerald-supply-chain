import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertCircle, X, AlertTriangle, Info, Building2, Loader2, Wallet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VENDOR_DOCUMENT_REQUIREMENTS, VENDOR_CATEGORIES, type VendorDocument, type VendorDocumentType, type EnhancedVendorRegistration as VendorRegType } from "@/types/vendor-registration";
import { COUNTRIES_SORTED, getCountryByCode, getDialCodeForCountry } from "@/data/countries";
import { getBanksForCountry, hasBankListForCountry } from "@/data/banks-by-country";


interface EnhancedVendorRegistrationProps {
  onSubmit: (registration: Partial<VendorRegType>) => Promise<void>;
  onCancel: () => void;
  isRegistrationOpen?: boolean;
}

export const EnhancedVendorRegistration = ({ onSubmit, onCancel, isRegistrationOpen = true }: EnhancedVendorRegistrationProps) => {
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isOEMRepresentative, setIsOEMRepresentative] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [countryCode, setCountryCode] = useState("NG");
  const [country, setCountry] = useState("Nigeria");
  const [postalCode, setPostalCode] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPersonTitle, setContactPersonTitle] = useState("");
  const [contactPersonEmail, setContactPersonEmail] = useState("");
  const [contactPersonPhone, setContactPersonPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [yearEstablished, setYearEstablished] = useState<number | undefined>();
  const [numberOfEmployees, setNumberOfEmployees] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  // Financial information
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [currency, setCurrency] = useState("");

  // Documents state
  const [uploadedDocuments, setUploadedDocuments] = useState<VendorDocument[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Sync country name when countryCode changes
  useEffect(() => {
    const c = getCountryByCode(countryCode);
    if (c) setCountry(c.name);
  }, [countryCode]);

  // Banks list for selected country
  const banksForCountry = useMemo(() => getBanksForCountry(countryCode), [countryCode]);
  const showBankDropdown = hasBankListForCountry(countryCode);
  const phonePlaceholder = useMemo(() => {
    const dial = getDialCodeForCountry(countryCode);
    if (dial === "+234") return "+234-800-XXX-XXXX";
    if (dial === "+1") return "+1-XXX-XXX-XXXX";
    if (dial) return `${dial}-XXX-XXX-XXXX`;
    return "Phone number";
  }, [countryCode]);
  const postalLabel = countryCode === "US" ? "ZIP Code" : "Postal Code";
  const stateLabel = countryCode === "US" ? "State" : countryCode === "GB" ? "County" : "State / Province";
  const defaultCurrency = useMemo(() => {
    if (countryCode === "NG") return "NGN";
    if (countryCode === "US") return "USD";
    if (countryCode === "GB") return "GBP";
    if (countryCode === "GH") return "GHS";
    if (countryCode === "ZA") return "ZAR";
    return "";
  }, [countryCode]);

  // Calculate required documents based on OEM status
  const requiredDocuments = useMemo(() => {
    return VENDOR_DOCUMENT_REQUIREMENTS.filter(doc => {
      if (doc.isOEMOnly) return isOEMRepresentative;
      return doc.isRequired;
    });
  }, [isOEMRepresentative]);

  // Check which documents are missing
  const missingDocuments = useMemo(() => {
    const uploadedTypes = uploadedDocuments.map(d => d.type);
    return requiredDocuments.filter(doc => !uploadedTypes.includes(doc.type));
  }, [requiredDocuments, uploadedDocuments]);

  // Calculate completion percentage
  const completionPercentage = useMemo(() => {
    const totalRequired = requiredDocuments.length;
    const uploaded = requiredDocuments.filter(doc => 
      uploadedDocuments.some(d => d.type === doc.type)
    ).length;
    return totalRequired > 0 ? Math.round((uploaded / totalRequired) * 100) : 0;
  }, [requiredDocuments, uploadedDocuments]);

  const handleFileUpload = (docType: VendorDocumentType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = () => {
      const docReq = VENDOR_DOCUMENT_REQUIREMENTS.find(d => d.type === docType);
      const newDoc: VendorDocument = {
        id: `DOC-${Date.now()}`,
        name: docReq?.label || docType,
        type: docType,
        fileData: reader.result as string,
        fileName: file.name,
        fileSize: file.size,
        uploadDate: new Date().toISOString(),
        status: "Pending",
        isRequired: docReq?.isRequired || false,
      };

      // Replace if exists, otherwise add
      setUploadedDocuments(prev => {
        const filtered = prev.filter(d => d.type !== docType);
        return [...filtered, newDoc];
      });

      toast({
        title: "Document Uploaded",
        description: `${docReq?.label} has been uploaded successfully`,
      });
    };
    reader.readAsDataURL(file);
  };

  const removeDocument = (docType: VendorDocumentType) => {
    setUploadedDocuments(prev => prev.filter(d => d.type !== docType));
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      }
      return [...prev, category];
    });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!companyName.trim()) errors.companyName = "Company name is required";
    if (selectedCategories.length === 0) errors.categories = "Select at least one business category";
    if (!email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Invalid email format";
    if (!phone.trim()) errors.phone = "Phone number is required";
    if (!address.trim()) errors.address = "Business address is required";
    if (!city.trim()) errors.city = "City is required";
    if (!state.trim()) errors.state = "State is required";
    if (!taxId.trim()) errors.taxId = "Tax ID (TIN) is required";
    if (!contactPerson.trim()) errors.contactPerson = "Contact person name is required";

    // Check for missing required documents
    if (missingDocuments.length > 0) {
      errors.documents = `Missing required documents: ${missingDocuments.map(d => d.label).join(", ")}`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!isRegistrationOpen) {
      toast({
        title: "Registration Closed",
        description: "The vendor registration cycle is currently closed. Please try again during the next registration period.",
        variant: "destructive",
      });
      return;
    }

    if (!validateForm()) {
      toast({
        title: "Incomplete Application",
        description: "Please fill all required fields and upload all required documents",
        variant: "destructive",
      });
      return;
    }

    // Set submitting state to show loading button
    setIsSubmitting(true);

    try {
    // Build the registration object and let the parent handle API call
    const registration: Partial<VendorRegType> = {
      companyName,
      categories: selectedCategories,
      isOEMRepresentative,
      email,
      phone,
      alternatePhone,
      address,
      city,
      state,
      country,
      countryCode,
      postalCode,
      taxId,
      contactPerson,
      contactPersonTitle,
      contactPersonEmail,
      contactPersonPhone,
      website,
      yearEstablished,
      numberOfEmployees,
      annualRevenue,
      financialInfo: (bankName || accountNumber || accountName)
        ? {
            bankName: bankName || undefined,
            accountNumber: accountNumber || undefined,
            accountName: accountName || undefined,
            currency: (currency || defaultCurrency) || undefined,
            countryCode,
          }
        : undefined,
      documents: uploadedDocuments,
      status: "Pending",
    };

      // Wait for parent component to handle the API call
      await onSubmit(registration);
    } catch (error) {
      console.error('Submission error:', error);
      // Error handling is done in parent, just log here
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDocumentStatus = (docType: VendorDocumentType) => {
    const doc = uploadedDocuments.find(d => d.type === docType);
    if (!doc) return null;
    return doc;
  };

  if (!isRegistrationOpen) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Registration Closed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              The vendor registration cycle is currently closed. Please check back during the next registration period 
              or contact procurement@emeraldcfze.com for more information.
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-4" onClick={onCancel}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Indicator */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Application Completion</span>
              <span className="text-sm font-bold">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {missingDocuments.length === 0 
                ? "All required documents uploaded" 
                : `${missingDocuments.length} required document(s) remaining`}
            </p>
          </CardContent>
        </Card>

        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Information
            </CardTitle>
            <CardDescription>Basic information about your company</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Company Name *</Label>
                <Input 
                  placeholder="Your Company Ltd"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (formErrors.companyName) setFormErrors(prev => ({ ...prev, companyName: "" }));
                  }}
                  className={formErrors.companyName ? "border-destructive" : ""}
                />
                {formErrors.companyName && <p className="text-sm text-destructive">{formErrors.companyName}</p>}
              </div>

              <div className="space-y-2">
                <Label>Year Established</Label>
                <Input 
                  type="number"
                  placeholder="2010"
                  value={yearEstablished || ""}
                  onChange={(e) => setYearEstablished(parseInt(e.target.value) || undefined)}
                />
              </div>

              <div className="space-y-2">
                <Label>Number of Employees</Label>
                <Input 
                  placeholder="50-100"
                  value={numberOfEmployees}
                  onChange={(e) => setNumberOfEmployees(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tax ID (TIN) *</Label>
                <Input 
                  placeholder="TIN-XXXXXXXXX"
                  value={taxId}
                  onChange={(e) => {
                    setTaxId(e.target.value);
                    if (formErrors.taxId) setFormErrors(prev => ({ ...prev, taxId: "" }));
                  }}
                  className={formErrors.taxId ? "border-destructive" : ""}
                />
                {formErrors.taxId && <p className="text-sm text-destructive">{formErrors.taxId}</p>}
              </div>

              <div className="space-y-2">
                <Label>Website</Label>
                <Input 
                  placeholder="https://yourcompany.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>

            {/* Business Categories - Checkboxes */}
            <div className="space-y-3">
              <Label>Business Categories * (Select all that apply)</Label>
              {formErrors.categories && <p className="text-sm text-destructive">{formErrors.categories}</p>}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {VENDOR_CATEGORIES.map((category) => (
                  <div 
                    key={category}
                    className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedCategories.includes(category) 
                        ? "bg-primary/10 border-primary" 
                        : "hover:bg-accent"
                    }`}
                    onClick={() => handleCategoryToggle(category)}
                  >
                    <Checkbox 
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => handleCategoryToggle(category)}
                    />
                    <span className="text-sm">{category}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* OEM Representative */}
            <div className="flex items-center space-x-2 p-4 border rounded-lg bg-accent/30">
              <Checkbox 
                id="oem"
                checked={isOEMRepresentative}
                onCheckedChange={(checked) => setIsOEMRepresentative(checked === true)}
              />
              <div className="flex-1">
                <Label htmlFor="oem" className="cursor-pointer">I am an OEM Representative</Label>
                <p className="text-xs text-muted-foreground">
                  Additional documents will be required (OEM Certificate, Authorization Letter, Bank Reference)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business Email *</Label>
                <Input 
                  type="email"
                  placeholder="info@yourcompany.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) setFormErrors(prev => ({ ...prev, email: "" }));
                  }}
                  className={formErrors.email ? "border-destructive" : ""}
                />
                {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input 
                  placeholder={phonePlaceholder}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: "" }));
                  }}
                  className={formErrors.phone ? "border-destructive" : ""}
                />
                {formErrors.phone && <p className="text-sm text-destructive">{formErrors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label>Alternate Phone</Label>
                <Input 
                  placeholder={phonePlaceholder}
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Business Address *</Label>
                <Input 
                  placeholder="Street Address"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (formErrors.address) setFormErrors(prev => ({ ...prev, address: "" }));
                  }}
                  className={formErrors.address ? "border-destructive" : ""}
                />
                {formErrors.address && <p className="text-sm text-destructive">{formErrors.address}</p>}
              </div>

              <div className="space-y-2">
                <Label>City *</Label>
                <Input 
                  placeholder="Lagos"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (formErrors.city) setFormErrors(prev => ({ ...prev, city: "" }));
                  }}
                  className={formErrors.city ? "border-destructive" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label>{stateLabel} *</Label>
                <Input 
                  placeholder={countryCode === "US" ? "e.g. California" : countryCode === "NG" ? "Lagos State" : "State / Province"}
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    if (formErrors.state) setFormErrors(prev => ({ ...prev, state: "" }));
                  }}
                  className={formErrors.state ? "border-destructive" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label>Country *</Label>
                <Select
                  value={countryCode}
                  onValueChange={(code) => {
                    setCountryCode(code);
                    setBankName(""); // Reset bank when country changes
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES_SORTED.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{postalLabel}</Label>
                <Input 
                  placeholder={countryCode === "US" ? "e.g. 90210" : "100001"}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
            </div>

            {/* Primary Contact Person */}
            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-4">Primary Contact Person</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input 
                    placeholder="John Doe"
                    value={contactPerson}
                    onChange={(e) => {
                      setContactPerson(e.target.value);
                      if (formErrors.contactPerson) setFormErrors(prev => ({ ...prev, contactPerson: "" }));
                    }}
                    className={formErrors.contactPerson ? "border-destructive" : ""}
                  />
                  {formErrors.contactPerson && <p className="text-sm text-destructive">{formErrors.contactPerson}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Title/Position</Label>
                  <Input 
                    placeholder="Managing Director"
                    value={contactPersonTitle}
                    onChange={(e) => setContactPersonTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input 
                    type="email"
                    placeholder="john@yourcompany.com"
                    value={contactPersonEmail}
                    onChange={(e) => setContactPersonEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input 
                    placeholder="+234-800-XXX-XXXX"
                    value={contactPersonPhone}
                    onChange={(e) => setContactPersonPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Financial Information
            </CardTitle>
            <CardDescription>
              Bank and account details for payments. Fields update based on selected country.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input 
                  placeholder={defaultCurrency ? `e.g. ${defaultCurrency}` : "e.g. NGN, USD"}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </div>
              {showBankDropdown ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>Bank</Label>
                  <Select value={bankName || ""} onValueChange={setBankName}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Select a bank in ${country}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {banksForCountry.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2 md:col-span-2">
                  <Label>Bank Name</Label>
                  <Input 
                    placeholder="Enter your bank name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input 
                  placeholder="Account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input 
                  placeholder="Name on account"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Required Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Required Documents
            </CardTitle>
            <CardDescription>
              All documents marked with * are mandatory. Files must be PDF, DOC, DOCX, JPG, or PNG format (max 10MB each).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formErrors.documents && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formErrors.documents}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {VENDOR_DOCUMENT_REQUIREMENTS.map((docReq) => {
                // Skip OEM-only docs if not OEM representative
                if (docReq.isOEMOnly && !isOEMRepresentative) return null;

                const uploadedDoc = getDocumentStatus(docReq.type);
                const isRequired = docReq.isRequired || (docReq.isOEMOnly && isOEMRepresentative);

                return (
                  <div 
                    key={docReq.type}
                    className={`p-4 border rounded-lg ${
                      uploadedDoc 
                        ? "bg-success/5 border-success/30" 
                        : isRequired 
                          ? "bg-warning/5 border-warning/30" 
                          : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {uploadedDoc ? (
                            <CheckCircle className="h-5 w-5 text-success" />
                          ) : isRequired ? (
                            <AlertCircle className="h-5 w-5 text-warning" />
                          ) : (
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="font-medium">
                            {docReq.label}
                            {isRequired && <span className="text-destructive ml-1">*</span>}
                          </span>
                          {docReq.expiresAnnually && (
                            <Badge variant="outline" className="text-xs">Expires Annually</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 ml-7">{docReq.description}</p>
                        
                        {uploadedDoc && (
                          <div className="flex items-center gap-2 mt-2 ml-7">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{uploadedDoc.fileName}</span>
                            <Badge variant="secondary" className="text-xs">
                              {(uploadedDoc.fileSize / 1024).toFixed(1)} KB
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {uploadedDoc && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeDocument(docReq.type)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <input
                          type="file"
                          ref={(el) => { fileInputRefs.current[docReq.type] = el; }}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.txt,.rtf,.csv,.odt,.ods,.odp"
                          onChange={(e) => handleFileUpload(docReq.type, e)}
                        />
                        <Button 
                          variant={uploadedDoc ? "outline" : "default"}
                          size="sm"
                          onClick={() => fileInputRefs.current[docReq.type]?.click()}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          {uploadedDoc ? "Replace" : "Upload"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Submission Notice */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your application will be reviewed by our procurement team within 3-5 business days. 
            Once approved, you'll receive login credentials and access to RFQs via email.
            <strong className="block mt-2">
              Documents that expire annually (e.g., HSE Certificate) will require re-upload before expiry.
            </strong>
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end sticky bottom-0 bg-background py-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={completionPercentage < 100 || isSubmitting}
            className="min-w-[150px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : completionPercentage < 100 ? (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Incomplete
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Submit Application
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
