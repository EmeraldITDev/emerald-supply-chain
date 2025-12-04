import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useApp, type MRFRequest } from "@/contexts/AppContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const NewMRF = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { addMRF, updateMRF } = useApp();
  
  const rejectedMRF = location.state?.rejectedMRF as MRFRequest | undefined;
  const isResubmission = !!rejectedMRF;
  
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    quantity: "",
    estimatedCost: "",
    urgency: "",
    justification: "",
  });

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
      });
    }
  }, [rejectedMRF]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isResubmission && rejectedMRF) {
      // Resubmission: update existing MRF with new approval flow
      updateMRF(rejectedMRF.id, {
        ...formData,
        status: "Submitted",
        currentStage: "procurement",
        procurementManagerApprovalTime: new Date().toISOString(),
        isResubmission: true,
        date: new Date().toISOString().split("T")[0],
      });
      
      toast({
        title: "MRF Resubmitted Successfully",
        description: "Your updated material request has been resubmitted for approval",
      });
    } else {
      // New submission - all MRFs go to Executive first
      const estimatedCost = parseFloat(formData.estimatedCost) || 0;
      const isHighValue = estimatedCost > 1000000;
      
      addMRF(formData);
      
      toast({
        title: "MRF Submitted Successfully",
        description: isHighValue 
          ? "High-value request (>₦1M) - Will require both Executive and Chairman approval"
          : "Your request has been sent to Executive for approval",
      });
    }
    
    navigate("/dashboard");
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
                  <Label htmlFor="estimatedCost">Estimated Cost (₦)</Label>
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

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  {isResubmission ? "Resubmit Request" : "Submit Request"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
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
