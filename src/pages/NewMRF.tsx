import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ArrowLeft, AlertCircle, Loader2, Upload, FileText, X, Cloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { type MRFRequest } from "@/contexts/AppContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { mrfApi } from "@/services/api";

const NewMRF = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Only employees can create MRF
  useEffect(() => {
    if (user && user.role !== "employee") {
      toast({
        title: "Access Denied",
        description: "Only staff members can create Material Request Forms. Please contact your administrator.",
        variant: "destructive",
      });
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate, toast]);
  
  const rejectedMRF = location.state?.rejectedMRF as MRFRequest | undefined;
  const isResubmission = !!rejectedMRF;
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    quantity: "",
    estimatedCost: "",
    urgency: "",
    justification: "",
    contractType: "",
  });
  const [pfiFile, setPfiFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceOneDriveUrl, setInvoiceOneDriveUrl] = useState<string>("");

  useEffect(() => {
    if (rejectedMRF) {
      setFormData({
        title: rejectedMRF.title,
        category: rejectedMRF.category,
        description: rejectedMRF.description,
        quantity: rejectedMRF.quantity,
        estimatedCost: rejectedMRF.estimatedCost,
        urgency: rejectedMRF.urgency,
        justification: rejectedMRF.justification,
        contractType: (rejectedMRF as any).contractType || "",
      });
    }
  }, [rejectedMRF]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Validate urgency is selected
    if (!formData.urgency) {
      toast({
        title: "Validation Error",
        description: "Please select an urgency level",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }
    
    try {
      // Capitalize urgency for backend (expects 'Low', 'Medium', 'High')
      const capitalizeUrgency = (urgency: string): 'Low' | 'Medium' | 'High' => {
        const normalized = urgency.toLowerCase();
        if (normalized === 'low') return 'Low';
        if (normalized === 'medium') return 'Medium';
        if (normalized === 'high' || normalized === 'critical') return 'High';
        return 'Medium'; // Default fallback
      };
      
      const urgencyValue = capitalizeUrgency(formData.urgency);
      console.log('Submitting MRF with urgency:', urgencyValue, 'from form value:', formData.urgency);
      
      if (isResubmission && rejectedMRF) {
        // Resubmission: update existing MRF
        const updatePayload: any = {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          quantity: formData.quantity,
          urgency: urgencyValue,
          justification: formData.justification,
          contractType: formData.contractType,
        };
        // Include estimatedCost - use 0 if not provided (backend expects a number)
        updatePayload.estimatedCost = formData.estimatedCost && formData.estimatedCost.trim() !== '' 
          ? formData.estimatedCost 
          : '0';
        const response = await mrfApi.update(rejectedMRF.id, updatePayload);
      
        if (response.success) {
      toast({
        title: "MRF Resubmitted Successfully",
        description: "Your updated material request has been resubmitted for approval",
      });
          navigate("/dashboard");
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to resubmit MRF",
            variant: "destructive",
          });
        }
    } else {
        // New submission
        const payload: any = {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          quantity: formData.quantity,
          urgency: urgencyValue,
          justification: formData.justification,
          contractType: formData.contractType,
        };
        // Include estimatedCost - use 0 if not provided (backend expects a number)
        payload.estimatedCost = formData.estimatedCost && formData.estimatedCost.trim() !== '' 
          ? formData.estimatedCost 
          : '0';
        
        console.log('Creating MRF with payload:', payload, 'PFI file:', pfiFile?.name);
        
        // Create FormData if PFI or invoice file is provided
        let response;
        if (pfiFile || invoiceFile || invoiceOneDriveUrl) {
          const formDataObj = new FormData();
          Object.entries(payload).forEach(([key, value]) => {
            formDataObj.append(key, String(value));
          });
          if (pfiFile) {
            formDataObj.append('pfi', pfiFile);
          }
          if (invoiceFile) {
            formDataObj.append('invoice', invoiceFile);
          }
          if (invoiceOneDriveUrl) {
            formDataObj.append('invoice_onedrive_url', invoiceOneDriveUrl);
          }
          response = await mrfApi.createWithPFI(formDataObj);
        } else {
          response = await mrfApi.create(payload);
        }
        
        if (response.success) {
      const estimatedCost = formData.estimatedCost && formData.estimatedCost.trim() !== '' 
        ? parseFloat(formData.estimatedCost) 
        : 0;
      const isHighValue = estimatedCost > 1000000;
      
      toast({
        title: "MRF Submitted Successfully",
        description: isHighValue 
          ? "High-value request (>₦1M) - Will require both Executive and Chairman approval"
          : "Your request has been sent to Executive for approval",
      });
    navigate("/dashboard");
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to create MRF",
            variant: "destructive",
          });
        }
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
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {isResubmission ? "Resubmit Material Request Form" : "New Material Request Form"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isResubmission 
              ? "Update your material request based on the rejection feedback"
              : "Submit a new material requisition request"
            }
          </p>
        </div>

        {isResubmission && rejectedMRF?.rejectionReason && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Rejection Reason</AlertTitle>
            <AlertDescription>{rejectedMRF.rejectionReason}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
              <CardDescription>Fill in the information for your material request</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Request Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Office Supplies Restock"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => handleChange("category", value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office-supplies">Office Supplies</SelectItem>
                      <SelectItem value="raw-materials">Raw Materials</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="consumables">Consumables</SelectItem>
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
                <Label htmlFor="contractType">Contract Type *</Label>
                <Select
                  value={formData.contractType}
                  onValueChange={(value) => handleChange("contractType", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contract type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emerald">Emerald Contract</SelectItem>
                    <SelectItem value="oando">Oando Contract</SelectItem>
                    <SelectItem value="dangote">Dangote Contract</SelectItem>
                    <SelectItem value="heritage">Heritage Contract</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The contract type will be included in the MRF reference for easy identification
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the materials you need..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    placeholder="e.g., 50"
                    value={formData.quantity}
                    onChange={(e) => handleChange("quantity", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimatedCost">Estimated Cost (₦) <span className="text-muted-foreground text-xs font-normal">(Optional)</span></Label>
                  <Input
                    id="estimatedCost"
                    type="number"
                    placeholder="e.g., 50000"
                    value={formData.estimatedCost}
                    onChange={(e) => handleChange("estimatedCost", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="justification">Justification *</Label>
                <Textarea
                  id="justification"
                  placeholder="Explain why this material is needed..."
                  value={formData.justification}
                  onChange={(e) => handleChange("justification", e.target.value)}
                  rows={3}
                  required
                />
              </div>

              {/* Supporting Document Upload Section */}
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-base font-semibold">Supporting Document (Optional)</Label>
                <p className="text-sm text-muted-foreground">
                  Upload specifications or supporting documents for this material request from your computer or provide a OneDrive link
                </p>
                
                {/* Local File Upload */}
                <div className="space-y-2">
                  <Label htmlFor="supporting-doc-file">Upload from Computer</Label>
                  <div className="flex gap-2">
                    <Input
                      id="supporting-doc-file"
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
                          const input = document.getElementById("supporting-doc-file") as HTMLInputElement;
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
                  <Label htmlFor="supporting-doc-onedrive">Or provide OneDrive link</Label>
                  <div className="flex gap-2">
                    <Input
                      id="supporting-doc-onedrive"
                      type="url"
                      placeholder="https://onedrive.live.com/..."
                      value={invoiceOneDriveUrl}
                      onChange={(e) => {
                        setInvoiceOneDriveUrl(e.target.value);
                        if (e.target.value) {
                          setInvoiceFile(null); // Clear file if OneDrive URL is provided
                          const input = document.getElementById("supporting-doc-file") as HTMLInputElement;
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
                    isResubmission ? "Resubmit Request" : "Submit Request"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
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

export default NewMRF;
