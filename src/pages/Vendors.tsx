import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Users, TrendingUp, FileCheck, Plus, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Vendor {
  id: string;
  name: string;
  category: string;
  rating: number;
  orders: number;
  status: string;
  kyc: string;
}
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
  const [addVendorDialogOpen, setAddVendorDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorDetailsOpen, setVendorDetailsOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactTo, setContactTo] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  const vendors: Vendor[] = [
    { id: "V001", name: "Steel Works Ltd", category: "Raw Materials", rating: 4.8, orders: 45, status: "Active", kyc: "Verified" },
    { id: "V002", name: "BuildMart Supplies", category: "Construction", rating: 4.5, orders: 32, status: "Active", kyc: "Verified" },
    { id: "V003", name: "SafetyFirst Co", category: "Safety Equipment", rating: 4.9, orders: 28, status: "Active", kyc: "Verified" },
    { id: "V004", name: "TechEquip Ltd", category: "Equipment", rating: 4.3, orders: 18, status: "Pending", kyc: "Under Review" },
  ];

  const pendingKYC = [
    { name: "NewVendor Industries", category: "Raw Materials", submitted: "2024-01-14", documents: 8 },
    { name: "Global Suppliers", category: "Equipment", submitted: "2024-01-13", documents: 6 },
  ];

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vendor Management</h1>
            <p className="text-muted-foreground mt-2">Manage vendor relationships, KYC, and performance</p>
          </div>
          <Dialog open={addVendorDialogOpen} onOpenChange={setAddVendorDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Vendor
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
                  <Input placeholder="Enter company name" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw">Raw Materials</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="safety">Safety Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input type="email" placeholder="vendor@company.com" />
                </div>
                <Button className="w-full" onClick={() => {
                  toast({ title: "Vendor Added", description: "New vendor has been registered" });
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
              <div className="text-2xl font-bold">4</div>
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
                  <div key={vendor.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-semibold">{vendor.name}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Category: {vendor.category}</span>
                        <span>Documents: {vendor.documents}</span>
                        <span>Submitted: {vendor.submitted}</span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toast({ title: "KYC Review", description: `Reviewing documents for ${vendor.name}` })}
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
          <TabsList>
            <TabsTrigger value="all">All Vendors</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
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
                    <div key={vendor.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{vendor.id}</span>
                          <span className="text-sm">{vendor.name}</span>
                          <Badge className={getStatusColor(vendor.status)}>{vendor.status}</Badge>
                          <Badge className={getStatusColor(vendor.kyc)}>{vendor.kyc}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Category: {vendor.category}</span>
                          <span>Orders: {vendor.orders}</span>
                          <span className="flex items-center gap-1">
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
              <div className="flex gap-2 pt-4">
                <Button className="flex-1">View Orders</Button>
                <Button variant="outline" className="flex-1">Contact Vendor</Button>
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
    </DashboardLayout>
  );
};

export default Vendors;
