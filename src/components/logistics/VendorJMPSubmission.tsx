import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Truck,
  User,
  Shield,
  FileCheck,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Camera,
  Calendar,
  Wrench,
  HeartPulse,
  Flame,
  CircleDot,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Trip } from "@/types/logistics";

// Journey Management Plan data structure
export interface JMPFormData {
  // Vehicle Details
  vehicleFleetNumber: string;
  vehicleType: string;
  vehiclePlate: string;
  vehicleMake?: string;
  vehicleModel?: string;
  
  // Driver Details
  driverName: string;
  driverPhone: string;
  driverPhoto?: File | null;
  driverLicenseNumber: string;
  driverLicenseExpiry: string;
  
  // Security Escort (if required)
  securityRequired: boolean;
  securityCompany?: string;
  securityOfficerName?: string;
  securityOfficerPhone?: string;
  
  // Safety Checklist
  safetyChecklist: {
    tyresCondition: boolean;
    toolkitPresent: boolean;
    firstAidKit: boolean;
    fireExtinguisher: boolean;
    generalRoadworthiness: boolean;
    spareTyre: boolean;
    warnTriangle: boolean;
    reflectiveVest: boolean;
  };
  
  // Additional Notes
  additionalNotes?: string;
  
  // Supporting Documents/Photos
  documents: File[];
}

interface VendorJMPSubmissionProps {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: JMPFormData) => Promise<void>;
}

const defaultSafetyChecklist = {
  tyresCondition: false,
  toolkitPresent: false,
  firstAidKit: false,
  fireExtinguisher: false,
  generalRoadworthiness: false,
  spareTyre: false,
  warnTriangle: false,
  reflectiveVest: false,
};

export const VendorJMPSubmission = ({ 
  trip, 
  open, 
  onOpenChange,
  onSubmit 
}: VendorJMPSubmissionProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState<JMPFormData>({
    vehicleFleetNumber: "",
    vehicleType: "",
    vehiclePlate: "",
    driverName: "",
    driverPhone: "",
    driverPhoto: null,
    driverLicenseNumber: "",
    driverLicenseExpiry: "",
    securityRequired: false,
    safetyChecklist: { ...defaultSafetyChecklist },
    documents: [],
  });

  const totalSteps = 4;

  const updateFormData = (updates: Partial<JMPFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const updateSafetyChecklist = (key: keyof typeof defaultSafetyChecklist, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      safetyChecklist: {
        ...prev.safetyChecklist,
        [key]: value,
      },
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData(prev => ({
      ...prev,
      documents: [...prev.documents, ...files],
    }));
  };

  const handleDriverPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    updateFormData({ driverPhoto: file });
  };

  const removeDocument = (index: number) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.vehicleFleetNumber && formData.vehicleType && formData.vehiclePlate);
      case 2:
        return !!(formData.driverName && formData.driverPhone && formData.driverLicenseNumber && formData.driverLicenseExpiry);
      case 3:
        const checklist = formData.safetyChecklist;
        return !!(checklist.tyresCondition && checklist.toolkitPresent && 
                  checklist.firstAidKit && checklist.fireExtinguisher && 
                  checklist.generalRoadworthiness);
      case 4:
        return true; // Documents optional
      default:
        return true;
    }
  };

  const getSafetyChecklistProgress = (): number => {
    const checklist = formData.safetyChecklist;
    const completed = Object.values(checklist).filter(Boolean).length;
    return Math.round((completed / Object.keys(checklist).length) * 100);
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      toast({
        title: "Incomplete Information",
        description: "Please fill all required fields before proceeding",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      toast({
        title: "Incomplete Safety Checklist",
        description: "Please complete all mandatory safety checks",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
      
      toast({
        title: "JMP Submitted Successfully",
        description: "The Journey Management Plan has been submitted. Passengers will be notified automatically.",
      });
      
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Failed to submit the Journey Management Plan",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vehicleFleetNumber: "",
      vehicleType: "",
      vehiclePlate: "",
      driverName: "",
      driverPhone: "",
      driverPhoto: null,
      driverLicenseNumber: "",
      driverLicenseExpiry: "",
      securityRequired: false,
      safetyChecklist: { ...defaultSafetyChecklist },
      documents: [],
    });
    setCurrentStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Journey Management Plan (JMP)
          </DialogTitle>
          <DialogDescription>
            Submit vehicle, driver, and safety details for trip {trip.tripNumber}
          </DialogDescription>
        </DialogHeader>

        {/* Trip Summary */}
        <Alert className="bg-muted/50">
          <AlertDescription className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Route:</span>
              <span className="font-medium">{trip.origin} → {trip.destination}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Scheduled:</span>
              <span className="font-medium">
                {new Date(trip.scheduledDepartureAt).toLocaleString()}
              </span>
            </div>
            {trip.passengers && trip.passengers.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Passengers:</span>
                <span className="font-medium">{trip.passengers.length}</span>
              </div>
            )}
          </AlertDescription>
        </Alert>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  currentStep === step
                    ? "bg-primary text-primary-foreground"
                    : currentStep > step
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {currentStep > step ? <CheckCircle2 className="h-4 w-4" /> : step}
              </div>
              {step < totalSteps && (
                <div
                  className={cn(
                    "w-12 h-1 mx-1",
                    currentStep > step ? "bg-success" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="text-center text-sm text-muted-foreground mb-4">
          {currentStep === 1 && "Vehicle Details"}
          {currentStep === 2 && "Driver Details"}
          {currentStep === 3 && "Safety Checklist"}
          {currentStep === 4 && "Documents & Submit"}
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          {/* Step 1: Vehicle Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Truck className="h-4 w-4" />
                Vehicle Information
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fleet Number *</Label>
                  <Input
                    placeholder="e.g., FLT-001"
                    value={formData.vehicleFleetNumber}
                    onChange={(e) => updateFormData({ vehicleFleetNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Type *</Label>
                  <Select
                    value={formData.vehicleType}
                    onValueChange={(v) => updateFormData({ vehicleType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedan">Sedan</SelectItem>
                      <SelectItem value="suv">SUV</SelectItem>
                      <SelectItem value="pickup">Pickup Truck</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="bus">Bus / Coaster</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plate Number *</Label>
                  <Input
                    placeholder="e.g., ABC-123-XY"
                    value={formData.vehiclePlate}
                    onChange={(e) => updateFormData({ vehiclePlate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Make / Model</Label>
                  <Input
                    placeholder="e.g., Toyota Hilux"
                    value={formData.vehicleMake || ""}
                    onChange={(e) => updateFormData({ vehicleMake: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Driver Details */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <User className="h-4 w-4" />
                Driver Information
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Driver Name *</Label>
                  <Input
                    placeholder="Full name"
                    value={formData.driverName}
                    onChange={(e) => updateFormData({ driverName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <Input
                    type="tel"
                    placeholder="+234..."
                    value={formData.driverPhone}
                    onChange={(e) => updateFormData({ driverPhone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>License Number *</Label>
                  <Input
                    placeholder="Driver's license number"
                    value={formData.driverLicenseNumber}
                    onChange={(e) => updateFormData({ driverLicenseNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>License Expiry *</Label>
                  <Input
                    type="date"
                    value={formData.driverLicenseExpiry}
                    onChange={(e) => updateFormData({ driverLicenseExpiry: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Driver Photo (Optional)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleDriverPhotoUpload}
                    className="flex-1"
                  />
                  {formData.driverPhoto && (
                    <Badge variant="outline" className="gap-1">
                      <Camera className="h-3 w-3" />
                      Photo attached
                    </Badge>
                  )}
                </div>
              </div>

              {/* Security Escort Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-4">
                  <Checkbox
                    id="security-required"
                    checked={formData.securityRequired}
                    onCheckedChange={(checked) => updateFormData({ securityRequired: !!checked })}
                  />
                  <Label htmlFor="security-required" className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-warning" />
                    Security Escort Required
                  </Label>
                </div>
                {formData.securityRequired && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label>Security Company</Label>
                      <Input
                        placeholder="Company name"
                        value={formData.securityCompany || ""}
                        onChange={(e) => updateFormData({ securityCompany: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Officer Name</Label>
                      <Input
                        placeholder="Officer name"
                        value={formData.securityOfficerName || ""}
                        onChange={(e) => updateFormData({ securityOfficerName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Officer Phone</Label>
                      <Input
                        type="tel"
                        placeholder="+234..."
                        value={formData.securityOfficerPhone || ""}
                        onChange={(e) => updateFormData({ securityOfficerPhone: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Safety Checklist */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Wrench className="h-4 w-4" />
                  Vehicle Safety Checklist
                </div>
                <Badge variant={getSafetyChecklistProgress() === 100 ? "default" : "outline"}>
                  {getSafetyChecklistProgress()}% Complete
                </Badge>
              </div>
              
              <Alert className="bg-warning/10 border-warning/20">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-sm">
                  All items marked with * are mandatory for trip approval
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center space-x-3 p-3 rounded-lg border">
                  <Checkbox
                    id="tyres"
                    checked={formData.safetyChecklist.tyresCondition}
                    onCheckedChange={(checked) => updateSafetyChecklist("tyresCondition", !!checked)}
                  />
                  <Label htmlFor="tyres" className="flex items-center gap-2 flex-1 cursor-pointer">
                    <CircleDot className="h-4 w-4 text-muted-foreground" />
                    <span>Tyres in good condition *</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border">
                  <Checkbox
                    id="toolkit"
                    checked={formData.safetyChecklist.toolkitPresent}
                    onCheckedChange={(checked) => updateSafetyChecklist("toolkitPresent", !!checked)}
                  />
                  <Label htmlFor="toolkit" className="flex items-center gap-2 flex-1 cursor-pointer">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <span>Toolkit present *</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border">
                  <Checkbox
                    id="firstaid"
                    checked={formData.safetyChecklist.firstAidKit}
                    onCheckedChange={(checked) => updateSafetyChecklist("firstAidKit", !!checked)}
                  />
                  <Label htmlFor="firstaid" className="flex items-center gap-2 flex-1 cursor-pointer">
                    <HeartPulse className="h-4 w-4 text-muted-foreground" />
                    <span>First Aid Kit *</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border">
                  <Checkbox
                    id="fireext"
                    checked={formData.safetyChecklist.fireExtinguisher}
                    onCheckedChange={(checked) => updateSafetyChecklist("fireExtinguisher", !!checked)}
                  />
                  <Label htmlFor="fireext" className="flex items-center gap-2 flex-1 cursor-pointer">
                    <Flame className="h-4 w-4 text-muted-foreground" />
                    <span>Fire Extinguisher *</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border">
                  <Checkbox
                    id="roadworthy"
                    checked={formData.safetyChecklist.generalRoadworthiness}
                    onCheckedChange={(checked) => updateSafetyChecklist("generalRoadworthiness", !!checked)}
                  />
                  <Label htmlFor="roadworthy" className="flex items-center gap-2 flex-1 cursor-pointer">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <span>General Roadworthiness *</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border">
                  <Checkbox
                    id="spare"
                    checked={formData.safetyChecklist.spareTyre}
                    onCheckedChange={(checked) => updateSafetyChecklist("spareTyre", !!checked)}
                  />
                  <Label htmlFor="spare" className="flex items-center gap-2 flex-1 cursor-pointer">
                    <CircleDot className="h-4 w-4 text-muted-foreground" />
                    <span>Spare Tyre</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border">
                  <Checkbox
                    id="triangle"
                    checked={formData.safetyChecklist.warnTriangle}
                    onCheckedChange={(checked) => updateSafetyChecklist("warnTriangle", !!checked)}
                  />
                  <Label htmlFor="triangle" className="flex items-center gap-2 flex-1 cursor-pointer">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <span>Warning Triangle</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border">
                  <Checkbox
                    id="vest"
                    checked={formData.safetyChecklist.reflectiveVest}
                    onCheckedChange={(checked) => updateSafetyChecklist("reflectiveVest", !!checked)}
                  />
                  <Label htmlFor="vest" className="flex items-center gap-2 flex-1 cursor-pointer">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Reflective Vest</span>
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Documents & Submit */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Upload className="h-4 w-4" />
                Supporting Documents & Photos
              </div>
              
              <div className="space-y-2">
                <Label>Upload Documents/Photos (Optional)</Label>
                <Input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                />
                <p className="text-xs text-muted-foreground">
                  Upload vehicle photos, license copies, or other supporting documents
                </p>
              </div>

              {formData.documents.length > 0 && (
                <div className="space-y-2">
                  <Label>Uploaded Files ({formData.documents.length})</Label>
                  <div className="space-y-1">
                    {formData.documents.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm truncate">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDocument(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Additional Notes</Label>
                <Textarea
                  placeholder="Any additional information about the vehicle or journey..."
                  value={formData.additionalNotes || ""}
                  onChange={(e) => updateFormData({ additionalNotes: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Summary */}
              <Card className="bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">JMP Summary</CardTitle>
                </CardHeader>
                <CardContent className="py-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span>{formData.vehiclePlate} ({formData.vehicleType})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Driver:</span>
                    <span>{formData.driverName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Safety Checklist:</span>
                    <Badge variant={getSafetyChecklistProgress() === 100 ? "default" : "secondary"}>
                      {getSafetyChecklistProgress()}%
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Security Escort:</span>
                    <span>{formData.securityRequired ? "Yes" : "No"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          {currentStep < totalSteps ? (
            <Button onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Submit JMP
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VendorJMPSubmission;
