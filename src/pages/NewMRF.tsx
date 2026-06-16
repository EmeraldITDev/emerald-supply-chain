import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ArrowLeft, AlertCircle, Loader2, Upload, FileText, X, Cloud, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, isEmployeeRole } from "@/contexts/AuthContext";
import { type MRFRequest } from "@/contexts/AppContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { mrfApi } from "@/services/api";
import type { LineItem } from "@/types";
import { getScmRole, formatScmRoleLabel } from "@/utils/scmRole";

const NewMRF = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Staff and Logistics Manager can create MRF
  useEffect(() => {
    if (user && !isEmployeeRole(getScmRole(user)) && getScmRole(user) !== "logistics_manager") {
      toast({
        title: "Access Denied",
        description: "Only staff members can create Material Request Forms. Please contact your administrator.",
        variant: "destructive",
      });
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate, toast]);

  // Fetch contract types on mount
  useEffect(() => {
    const fetchContractTypes = async () => {
      try {
        const response = await mrfApi.getContractTypes();
        if (response.success && response.data) {
          if (response.data.standardTypes) {
            setContractTypes(response.data.standardTypes);
          }
          setAllowFreeText(response.data.allowFreeText ?? true);
          setRoutingNote(response.data.routingNote || "");
        }
      } catch (error) {
        console.error("Failed to fetch contract types", error);
      }
    };
    fetchContractTypes();
  }, []);
  
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
    department: "",
  });
  const [pfiFile, setPfiFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceOneDriveUrl, setInvoiceOneDriveUrl] = useState<string>("");
  const [contractTypes, setContractTypes] = useState<Array<{ value: string; label: string }>>([]);
  const [allowFreeText, setAllowFreeText] = useState(true);
  const [routingNote, setRoutingNote] = useState("");
  const [showCustomContractType, setShowCustomContractType] = useState(false);
  const [customContractType, setCustomContractType] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [newLineItem, setNewLineItem] = useState<LineItem>({
    itemName: "",
    quantity: 0,
    unit: "",
    budgetAmount: 0,
  });

  useEffect(() => {
    // Initialize department from user's department if available
    if (user?.department) {
      setFormData(prev => ({
        ...prev,
        department: user.department || "",
      }));
    }
  }, [user]);

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
        department: rejectedMRF.department || user?.department || "",
      });
    }
  }, [rejectedMRF, user]);

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
      
      if (isResubmission && rejectedMRF) {
        // Resubmission: update existing MRF
        const standardValues = contractTypes.map((t) => t.value);
        const contractTypeValue =
          formData.contractType === "other" || !formData.contractType.trim()
            ? ""
            : !standardValues.includes(formData.contractType)
              ? formData.contractType
              : formData.contractType;
        if (!contractTypeValue) {
          toast({ title: "Validation Error", description: "Please enter a contract type", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        const itemsForBackend = lineItems.map((it) => ({
          item_name: it.itemName,
          itemName: it.itemName,
          quantity: Number(it.quantity) || 0,
          unit: it.unit,
          budget_amount: Number(it.budgetAmount) || 0,
          budgetAmount: Number(it.budgetAmount) || 0,
        }));
        const updatePayload: any = {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          quantity: formData.quantity,
          urgency: urgencyValue,
          justification: formData.justification,
          contractType: contractTypeValue,
          contract_type: contractTypeValue,
          department: formData.department || user?.department || "",
          items: itemsForBackend,
          line_items: itemsForBackend,
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
          window.dispatchEvent(new CustomEvent("app:refresh"));
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
        const standardValues = contractTypes.map((t) => t.value);
        const contractTypeValue =
          formData.contractType === "other" || !formData.contractType.trim()
            ? ""
            : !standardValues.includes(formData.contractType)
              ? formData.contractType
              : formData.contractType;
        if (!contractTypeValue) {
          toast({ title: "Validation Error", description: "Please enter a contract type", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        const itemsForBackend = lineItems.map((it) => ({
          item_name: it.itemName,
          itemName: it.itemName,
          quantity: Number(it.quantity) || 0,
          unit: it.unit,
          budget_amount: Number(it.budgetAmount) || 0,
          budgetAmount: Number(it.budgetAmount) || 0,
        }));
        const payload: any = {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          quantity: formData.quantity,
          urgency: urgencyValue,
          justification: formData.justification,
          contractType: contractTypeValue,
          contract_type: contractTypeValue,
          department: formData.department || user?.department || "",
          items: itemsForBackend,
          line_items: itemsForBackend,
        };
        // Include estimatedCost - use 0 if not provided (backend expects a number)
        payload.estimatedCost = formData.estimatedCost && formData.estimatedCost.trim() !== '' 
          ? formData.estimatedCost 
          : '0';
        
        
        // Debug: Log the API base URL and full endpoint
        
        // Create FormData if PFI or invoice file is provided
        let response;
        if (pfiFile || invoiceFile || invoiceOneDriveUrl) {
          const formDataObj = new FormData();
          Object.entries(payload).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            // Arrays/objects must be JSON-encoded — String() turns them into "[object Object]"
            if (Array.isArray(value) || typeof value === "object") {
              formDataObj.append(key, JSON.stringify(value));
            } else {
              formDataObj.append(key, String(value));
            }
          });
          if (pfiFile) {
            formDataObj.append('pfi', pfiFile);
          }
          if (invoiceFile) {
            formDataObj.append('attachment', invoiceFile);
          }
          if (invoiceOneDriveUrl) {
            formDataObj.append('onedrive_link', invoiceOneDriveUrl);
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
      const fid = (response as any)?.data?.formatted_id || (response as any)?.data?.formattedId;
      const routedReason =
        (response as any)?.data?.routedReason || (response as any)?.data?.routed_reason;
      const customRouted = routedReason === "custom_contract_type";
      toast({
        title: fid ? `MRF ${fid} Submitted` : "MRF Submitted Successfully",
        description: customRouted
          ? "Routed to Supply Chain Director (non-standard contract)."
          : isHighValue
          ? "High-value request (>₦1M) - Will require both Executive and Chairman approval"
          : "Your request has been sent to Executive for approval",
      });
      // Trigger global re-fetch so dashboards/procurement reflect the new MRF immediately
      window.dispatchEvent(new CustomEvent("app:refresh"));
    navigate("/dashboard");
        } else {
          // Enhanced error handling for network issues
          const errorMessage = response.error || "Failed to create MRF";
          console.error('MRF creation failed:', {
            error: response.error,
            fullResponse: response,
            payload: payload,
            apiUrl: import.meta.env.VITE_API_BASE_URL
          });
          
          // Check for specific error types
          if (response.status === 403) {
            const raw: any = response.raw || {};
            const creatorName =
              raw?.designated_creator?.name ||
              raw?.designatedCreator?.name ||
              raw?.data?.designated_creator?.name ||
              null;
            toast({
              title: "Not the Designated Creator",
              description: creatorName
                ? `Only ${creatorName} can create requisitions for this department.`
                : "You are not the designated requisition creator for this department. Contact your department head.",
              variant: "destructive",
            });
          } else if (errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
            toast({
              title: "Network Error",
              description: "Unable to connect to the server. Please check your internet connection and try again.",
              variant: "destructive",
            });
          } else if (errorMessage.includes('CORS')) {
            toast({
              title: "Connection Error",
              description: "Server connection blocked. Please contact support.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: errorMessage,
              variant: "destructive",
            });
          }
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

  const handleAddLineItem = () => {
    if (!newLineItem.itemName || newLineItem.quantity <= 0 || !newLineItem.unit || newLineItem.budgetAmount < 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all line item fields (Item Name, Quantity, Unit, Budget Amount)",
        variant: "destructive",
      });
      return;
    }
    setLineItems([...lineItems, { ...newLineItem, id: `${Date.now()}` }]);
    setNewLineItem({
      itemName: "",
      quantity: 0,
      unit: "",
      budgetAmount: 0,
    });
  };

  const handleRemoveLineItem = (id: string | undefined) => {
    if (id) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
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
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Input
                  id="department"
                  placeholder="e.g., Procurement, Finance, Operations"
                  value={formData.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {user?.department ? `Your department: ${user.department}` : "Enter your department name"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractType">Contract Type *</Label>
                {(() => {
                  const standardValues = contractTypes.map((t) => t.value);
                  const isStandard = standardValues.includes(formData.contractType);
                  const isOther =
                    allowFreeText &&
                    (formData.contractType === "other" ||
                      (!isStandard && formData.contractType !== ""));
                  const selectValue = isStandard
                    ? formData.contractType
                    : isOther
                      ? "other"
                      : "";
                  return (
                    <>
                      <Select
                        value={selectValue}
                        onValueChange={(value) => {
                          if (value === "other") {
                            handleChange("contractType", "other");
                          } else {
                            handleChange("contractType", value);
                          }
                        }}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select contract type" />
                        </SelectTrigger>
                        <SelectContent>
                          {contractTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                          {allowFreeText && (
                            <SelectItem value="other">Other / custom</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {isOther && (
                        <div className="space-y-1 pt-2">
                          <Input
                            id="contractTypeOther"
                            placeholder="Enter custom contract name (e.g., Shell, NLNG)"
                            value={formData.contractType === "other" ? "" : formData.contractType}
                            onChange={(e) => handleChange("contractType", e.target.value)}
                            required
                          />
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {routingNote ||
                              "Non-standard contract types are routed directly to the Supply Chain Director."}
                          </p>
                        </div>
                      )}
                      {!isOther && (
                        <p className="text-xs text-muted-foreground">
                          The contract type will be included in the MRF reference for easy identification.
                        </p>
                      )}
                    </>
                  );
                })()}
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

              {/* Line Items Section */}
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-base font-semibold">Line Items (Budget Breakdown)</Label>
                <p className="text-sm text-muted-foreground">
                  Add individual items with quantity, unit, and budget amount for budget tracking and P&L analysis
                </p>
                
                {/* Line Items Table */}
                {lineItems.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Budget Amount (₦)</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.itemName}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell className="text-right">₦{item.budgetAmount.toLocaleString()}</TableCell>
                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveLineItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                {/* Add New Line Item */}
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="itemName" className="text-xs">Item Name</Label>
                      <Input
                        id="itemName"
                        placeholder="e.g., Office Chairs"
                        value={newLineItem.itemName}
                        onChange={(e) => setNewLineItem({ ...newLineItem, itemName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="quantity" className="text-xs">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        placeholder="e.g., 10"
                        value={newLineItem.quantity || ""}
                        onChange={(e) => setNewLineItem({ ...newLineItem, quantity: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="unit" className="text-xs">Unit</Label>
                      <Input
                        id="unit"
                        placeholder="e.g., pcs, boxes"
                        value={newLineItem.unit}
                        onChange={(e) => setNewLineItem({ ...newLineItem, unit: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="budgetAmount" className="text-xs">Budget Amount (₦)</Label>
                      <Input
                        id="budgetAmount"
                        type="number"
                        placeholder="e.g., 500000"
                        value={newLineItem.budgetAmount || ""}
                        onChange={(e) => setNewLineItem({ ...newLineItem, budgetAmount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddLineItem}
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Line Item
                  </Button>
                </div>
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
