import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Package, LogOut, CheckCircle, Bell, Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import logo from "@/assets/emerald-logo.png";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/contexts/AppContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const VendorPortal = () => {
  const { toast } = useToast();
  const { rfqs, quotations, addQuotation, updateQuotation, addVendorRegistration } = useApp();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [currentVendorId] = useState("V001"); // Simulated logged-in vendor
  
  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Registration form
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

  // Demo credentials: vendor@demo.com / demo123
  const handleLogin = () => {
    if (email === "vendor@demo.com" && password === "demo123") {
      setIsLoggedIn(true);
      toast({ title: "Login Successful", description: "Welcome to Vendor Portal" });
    } else {
      toast({ 
        title: "Login Failed", 
        description: "Invalid credentials. Use: vendor@demo.com / demo123",
        variant: "destructive"
      });
    }
  };

  const handleRegister = () => {
    if (!companyName || !email || !password || !category || !phone || !address || !taxId || !contactPerson) {
      toast({ 
        title: "Registration Failed", 
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

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
    setEmail("");
    setPassword("");
    setCompanyName("");
    setCategory("");
    setPhone("");
    setAddress("");
    setTaxId("");
    setContactPerson("");
  };

  const handleSubmitQuotation = () => {
    if (!selectedRfqId || !quotePrice || !deliveryDate) {
      toast({
        title: "Submission Failed",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const selectedRfq = rfqs.find(r => r.id === selectedRfqId);
    if (!selectedRfq) return;

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
      title: "Quotation Submitted",
      description: `Your quote for ${selectedRfq.mrfTitle} has been submitted successfully`
    });

    // Reset form
    setSelectedRfqId("");
    setQuotePrice("");
    setDeliveryDate("");
    setQuoteNotes("");
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
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl shadow-xl">
            <CardHeader className="space-y-4">
              <div className="flex justify-center">
                <img src={logo} alt="Emerald Industrial" className="h-16 object-contain" />
              </div>
              <div className="space-y-2 text-center">
                <CardTitle className="text-3xl">Vendor Registration</CardTitle>
                <CardDescription>Apply to become an approved vendor partner</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="company">Company Name *</Label>
                  <Input 
                    id="company" 
                    placeholder="Your Company Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Business Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                      <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                      <SelectItem value="Construction">Construction</SelectItem>
                      <SelectItem value="Safety Equipment">Safety Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID / TIN *</Label>
                  <Input 
                    id="taxId" 
                    placeholder="TIN-123456789"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact Person *</Label>
                  <Input 
                    id="contactPerson" 
                    placeholder="Full Name"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input 
                    id="phone" 
                    placeholder="+234-800-000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="address">Business Address *</Label>
                  <Input 
                    id="address" 
                    placeholder="Street, City, State"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email Address *</Label>
                  <Input 
                    id="reg-email" 
                    type="email" 
                    placeholder="vendor@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password *</Label>
                  <Input 
                    id="reg-password" 
                    type="password"
                    placeholder="Create strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Upload KYC Documents (CAC, Tax Clearance, Bank Details)</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Click to upload or drag and drop
                  </p>
                  <Input type="file" className="hidden" id="doc-upload" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('doc-upload')?.click()}>
                    Select Files
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  Your application will be reviewed by our procurement team within 3-5 business days. 
                  Once approved, you'll receive login credentials and access to RFQs via email.
                </AlertDescription>
              </Alert>

              <Button className="w-full" size="lg" onClick={handleRegister}>
                Submit Application
              </Button>
              
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button 
                  onClick={() => setShowRegistration(false)} 
                  className="text-primary hover:underline font-medium"
                >
                  Sign In
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
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
            <Alert className="bg-info/10 border-info/20">
              <AlertDescription>
                <p className="text-sm font-medium text-info">Demo Credentials</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Email: vendor@demo.com<br/>
                  Password: demo123
                </p>
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="vendor@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button className="w-full" size="lg" onClick={handleLogin}>
              Sign In
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button 
                onClick={() => setShowRegistration(true)} 
                className="text-primary hover:underline font-medium"
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
              <p className="text-xs text-muted-foreground">Steel Works Ltd</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {newRfqCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                  {newRfqCount}
                </span>
              )}
            </Button>
            <Button variant="outline" onClick={() => setIsLoggedIn(false)} className="gap-2">
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

        <Tabs defaultValue="rfqs" className="space-y-4">
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
                              document.querySelector('[value="submit"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                            }}
                          >
                            Submit Quotation
                          </Button>
                          <Button variant="outline" size="sm">
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
            <Card>
              <CardHeader>
                <CardTitle>Submit Quotation</CardTitle>
                <CardDescription>Provide your best quote for an RFQ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rfq-select">Select RFQ *</Label>
                  <Select value={selectedRfqId} onValueChange={setSelectedRfqId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an open RFQ" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorRfqs.map((rfq) => (
                        <SelectItem key={rfq.id} value={rfq.id}>
                          {rfq.id} - {rfq.mrfTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRfqId && (
                  <>
                    <Alert className="bg-muted">
                      <AlertDescription className="text-sm">
                        {vendorRfqs.find(r => r.id === selectedRfqId)?.description}
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Your Quote Price (₦) *</Label>
                        <Input 
                          id="price" 
                          type="number" 
                          placeholder="Enter total price"
                          value={quotePrice}
                          onChange={(e) => setQuotePrice(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="delivery-date">Proposed Delivery Date *</Label>
                        <Input 
                          id="delivery-date" 
                          type="date"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Additional Notes / Terms</Label>
                      <Textarea 
                        id="notes" 
                        placeholder="Payment terms, delivery conditions, warranties, etc..."
                        rows={4}
                        value={quoteNotes}
                        onChange={(e) => setQuoteNotes(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quote-doc">Upload Quotation Document (Optional)</Label>
                      <div className="flex gap-2">
                        <Input id="quote-doc" type="file" className="flex-1" accept=".pdf,.doc,.docx" />
                        <Button variant="outline" className="gap-2">
                          <Upload className="h-4 w-4" />
                          Upload
                        </Button>
                      </div>
                    </div>

                    <Button className="w-full" size="lg" onClick={handleSubmitQuotation}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Submit Quotation
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
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
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium mb-1">Upload KYC Documents</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      CAC Certificate, Tax Clearance, Bank Details, ISO Certificates
                    </p>
                    <Input 
                      type="file" 
                      className="max-w-xs mx-auto"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          toast({ 
                            title: "Document Uploaded", 
                            description: `${file.name} uploaded successfully. Pending review.` 
                          });
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    {[
                      { name: "CAC Certificate", status: "Approved", uploaded: "2024-01-01" },
                      { name: "Tax Clearance", status: "Approved", uploaded: "2024-01-01" },
                      { name: "Bank Details", status: "Approved", uploaded: "2024-01-01" },
                      { name: "ISO Certificate", status: "Pending", uploaded: "2025-10-15" },
                    ].map((doc) => (
                      <div key={doc.name} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{doc.name}</span>
                            <Badge className={getStatusColor(doc.status)}>{doc.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">Uploaded: {doc.uploaded}</p>
                        </div>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default VendorPortal;
