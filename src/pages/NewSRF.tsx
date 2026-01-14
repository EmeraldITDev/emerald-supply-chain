import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ArrowLeft, Loader2, Upload, FileText, X, Cloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { srfApi } from "@/services/api";

const NewSRF = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Only employees can create SRF
  useEffect(() => {
    if (user && user.role !== "employee") {
      toast({
        title: "Access Denied",
        description: "Only staff members can create Service Request Forms. Please contact your administrator.",
        variant: "destructive",
      });
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate, toast]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    serviceType: "",
    description: "",
    duration: "",
    estimatedCost: "",
    urgency: "",
    justification: "",
  });
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceOneDriveUrl, setInvoiceOneDriveUrl] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Capitalize urgency for backend (expects 'Low', 'Medium', 'High')
      const capitalizeUrgency = (urgency: string): 'Low' | 'Medium' | 'High' => {
        const normalized = urgency.toLowerCase();
        if (normalized === 'low') return 'Low';
        if (normalized === 'medium') return 'Medium';
        if (normalized === 'high' || normalized === 'critical') return 'High';
        return 'Medium'; // Default fallback
      };
      
      // Create FormData if invoice file is provided
      let response;
      if (invoiceFile || invoiceOneDriveUrl) {
        const formDataObj = new FormData();
        formDataObj.append('title', formData.title);
        formDataObj.append('description', formData.description);
        formDataObj.append('serviceType', formData.serviceType);
        formDataObj.append('urgency', capitalizeUrgency(formData.urgency));
        formDataObj.append('justification', formData.justification);
        formDataObj.append('estimatedCost', formData.estimatedCost);
        formDataObj.append('duration', formData.duration);
        if (invoiceFile) {
          formDataObj.append('invoice', invoiceFile);
        }
        if (invoiceOneDriveUrl) {
          formDataObj.append('invoice_onedrive_url', invoiceOneDriveUrl);
        }
        response = await srfApi.createWithInvoice(formDataObj);
      } else {
        response = await srfApi.create({
          title: formData.title,
          description: formData.description,
          serviceType: formData.serviceType,
          urgency: capitalizeUrgency(formData.urgency),
          justification: formData.justification,
          estimatedCost: formData.estimatedCost,
          duration: formData.duration,
        });
      }
      
      if (response.success) {
    toast({
      title: "SRF Submitted Successfully",
      description: "Your service request form has been submitted for approval",
    });
    navigate("/procurement");
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to create SRF",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate("/procurement")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Procurement
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">New Service Request Form</h1>
          <p className="text-muted-foreground mt-2">Submit a new service requisition request</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Service Details</CardTitle>
              <CardDescription>Fill in the information for your service request</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Request Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Office Maintenance Service"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="serviceType">Service Type *</Label>
                  <Select
                    value={formData.serviceType}
                    onValueChange={(value) => handleChange("serviceType", value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="it-support">IT Support</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urgency">Urgency Level *</Label>
                  <Select
                    value={formData.urgency}
                    onValueChange={(value) => handleChange("urgency", value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select urgency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the service you need..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="duration">Expected Duration</Label>
                  <Input
                    id="duration"
                    placeholder="e.g., 2 weeks"
                    value={formData.duration}
                    onChange={(e) => handleChange("duration", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimatedCost">Estimated Cost (₦)</Label>
                  <Input
                    id="estimatedCost"
                    type="number"
                    placeholder="e.g., 100000"
                    value={formData.estimatedCost}
                    onChange={(e) => handleChange("estimatedCost", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="justification">Justification *</Label>
                <Textarea
                  id="justification"
                  placeholder="Explain why this service is needed..."
                  value={formData.justification}
                  onChange={(e) => handleChange("justification", e.target.value)}
                  rows={3}
                  required
                />
              </div>

              {/* Invoice Upload Section */}
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-base font-semibold">Invoice / Supporting Document (Optional)</Label>
                <p className="text-sm text-muted-foreground">
                  Upload an invoice or supporting document from your computer or provide a OneDrive link
                </p>
                
                {/* Local File Upload */}
                <div className="space-y-2">
                  <Label htmlFor="invoice-file">Upload from Computer</Label>
                  <div className="flex gap-2">
                    <Input
                      id="invoice-file"
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 10 * 1024 * 1024) {
                            toast({
                              title: "File Too Large",
                              description: "Maximum file size is 10MB",
                              variant: "destructive",
                            });
                            return;
                          }
                          setInvoiceFile(file);
                          setInvoiceOneDriveUrl(""); // Clear OneDrive URL if file is selected
                        }
                      }}
                      className="flex-1"
                    />
                    {invoiceFile && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setInvoiceFile(null);
                          const input = document.getElementById("invoice-file") as HTMLInputElement;
                          if (input) input.value = "";
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {invoiceFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{invoiceFile.name}</span>
                      <span className="text-xs">({(invoiceFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                </div>

                {/* OneDrive URL Input */}
                <div className="space-y-2">
                  <Label htmlFor="invoice-onedrive">Or provide OneDrive link</Label>
                  <div className="flex gap-2">
                    <Input
                      id="invoice-onedrive"
                      type="url"
                      placeholder="https://onedrive.live.com/..."
                      value={invoiceOneDriveUrl}
                      onChange={(e) => {
                        setInvoiceOneDriveUrl(e.target.value);
                        if (e.target.value) {
                          setInvoiceFile(null); // Clear file if OneDrive URL is provided
                          const input = document.getElementById("invoice-file") as HTMLInputElement;
                          if (input) input.value = "";
                        }
                      }}
                      className="flex-1"
                    />
                    {invoiceOneDriveUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setInvoiceOneDriveUrl("")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {invoiceOneDriveUrl && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Cloud className="h-4 w-4" />
                      <span className="truncate">{invoiceOneDriveUrl}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/procurement")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default NewSRF;
