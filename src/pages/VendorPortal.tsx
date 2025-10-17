import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Package, LogOut, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import logo from "@/assets/emerald-logo.png";
import { useToast } from "@/hooks/use-toast";

const VendorPortal = () => {
  const { toast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [category, setCategory] = useState("");

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
    if (!companyName || !email || !password || !category) {
      toast({ 
        title: "Registration Failed", 
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    toast({ 
      title: "Registration Submitted", 
      description: "Your application is pending approval. You'll be notified via email."
    });
    setShowRegistration(false);
    setEmail("");
    setPassword("");
    setCompanyName("");
    setCategory("");
  };

  const purchaseOrders = [
    { id: "PO-2024-001", date: "2024-01-15", items: 5, total: "₦850,000", status: "Pending Confirmation", dueDate: "2024-01-20" },
    { id: "PO-2024-002", date: "2024-01-10", items: 3, total: "₦425,000", status: "Confirmed", dueDate: "2024-01-18" },
    { id: "PO-2024-003", date: "2024-01-05", items: 8, total: "₦1,200,000", status: "In Progress", dueDate: "2024-01-22" },
  ];

  const documents = [
    { name: "Company Registration", status: "Approved", uploaded: "2024-01-01" },
    { name: "Tax Clearance", status: "Approved", uploaded: "2024-01-01" },
    { name: "Bank Details", status: "Approved", uploaded: "2024-01-01" },
    { name: "ISO Certificate", status: "Pending Review", uploaded: "2024-01-15" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
      case "Confirmed":
      case "Delivered":
        return "bg-success/10 text-success";
      case "Pending Confirmation":
      case "Pending Review":
        return "bg-warning/10 text-warning";
      case "In Progress":
        return "bg-info/10 text-info";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (!isLoggedIn) {
    if (showRegistration) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-4">
              <div className="flex justify-center">
                <img src={logo} alt="Emerald Industrial" className="h-16 object-contain" />
              </div>
              <div className="space-y-2 text-center">
                <CardTitle className="text-2xl">Register as Vendor</CardTitle>
                <CardDescription>Apply to become an approved vendor</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input 
                  id="company" 
                  placeholder="Your Company Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Business Category</Label>
                <Input 
                  id="category" 
                  placeholder="e.g., Raw Materials, Equipment"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email</Label>
                <Input 
                  id="reg-email" 
                  type="email" 
                  placeholder="vendor@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input 
                  id="reg-password" 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="bg-muted p-3 rounded-md text-sm">
                <p className="text-muted-foreground">
                  Your application will be reviewed by our team. Once approved, you'll receive 
                  login credentials via email.
                </p>
              </div>
              <Button className="w-full" onClick={handleRegister}>
                Submit Application
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button 
                  onClick={() => setShowRegistration(false)} 
                  className="text-primary hover:underline"
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <img src={logo} alt="Emerald Industrial" className="h-16 object-contain" />
            </div>
            <div className="space-y-2 text-center">
              <CardTitle className="text-2xl">Vendor Portal</CardTitle>
              <CardDescription>Sign in to access your account</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-info/10 border border-info/20 p-3 rounded-md">
              <p className="text-sm font-medium text-info">Demo Credentials</p>
              <p className="text-xs text-muted-foreground mt-1">
                Email: vendor@demo.com<br/>
                Password: demo123
              </p>
            </div>
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
            <Button className="w-full" onClick={handleLogin}>
              Sign In
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button 
                onClick={() => setShowRegistration(true)} 
                className="text-primary hover:underline"
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
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Emerald Industrial" className="h-10 object-contain" />
            <div className="border-l pl-4">
              <h1 className="font-semibold">Vendor Portal</h1>
              <p className="text-xs text-muted-foreground">Steel Works Ltd</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setIsLoggedIn(false)} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Welcome Back</h2>
            <p className="text-muted-foreground mt-2">Manage your purchase orders and documents</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active POs</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">3 pending confirmation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦4.2M</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
              <CheckCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">96%</div>
              <p className="text-xs text-muted-foreground">On-time delivery rate</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList>
            <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="submit">Submit PO Response</TabsTrigger>
            <TabsTrigger value="documents">KYC Documents</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Purchase Orders</CardTitle>
                <CardDescription>View and manage your assigned purchase orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {purchaseOrders.map((po) => (
                    <div key={po.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{po.id}</span>
                          <Badge className={getStatusColor(po.status)}>{po.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Date: {po.date}</span>
                          <span>Items: {po.items}</span>
                          <span>Total: {po.total}</span>
                          <span>Due: {po.dueDate}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => toast({ title: "PO Details", description: `Viewing details for ${po.id}` })}
                        >
                          View Details
                        </Button>
                        {po.status === "Pending Confirmation" && (
                          <Button 
                            size="sm"
                            onClick={() => toast({ title: "PO Confirmed", description: `${po.id} has been confirmed` })}
                          >
                            Confirm
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Submit PO Response</CardTitle>
                <CardDescription>Confirm or respond to purchase orders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="po-number">PO Number</Label>
                  <Input id="po-number" placeholder="Enter PO number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery-date">Proposed Delivery Date</Label>
                  <Input id="delivery-date" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price Quote (₦)</Label>
                  <Input id="price" type="number" placeholder="Enter total price" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea id="notes" placeholder="Any special terms or conditions..." rows={4} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote">Upload Quote/Invoice</Label>
                  <div className="flex gap-2">
                    <Input id="quote" type="file" className="flex-1" />
                    <Button variant="outline" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Upload
                    </Button>
                  </div>
                </div>
                <Button 
                  className="w-full"
                  onClick={() => toast({ title: "Response Submitted", description: "Your PO response has been submitted successfully" })}
                >
                  Submit Response
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>KYC Documentation</CardTitle>
                <CardDescription>Upload and manage your verification documents (CAC, Tax, Bank Details, etc.)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
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
                    {documents.map((doc) => (
                      <div key={doc.name} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{doc.name}</span>
                            <Badge className={getStatusColor(doc.status)}>{doc.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">Uploaded: {doc.uploaded}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => toast({ title: "Document Update", description: `Updating ${doc.name}` })}
                        >
                          Replace
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Management</CardTitle>
                <CardDescription>Submit and track your invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Upload invoices for completed deliveries
                  </p>
                  <Button 
                    className="gap-2"
                    onClick={() => toast({ title: "Upload Invoice", description: "Opening invoice upload..." })}
                  >
                    <Upload className="h-4 w-4" />
                    Upload Invoice
                  </Button>
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
