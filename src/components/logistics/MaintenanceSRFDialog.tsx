import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { srfApi } from "@/services/api";
import type { FleetVehicle, MaintenanceSchedule } from "@/types/logistics";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maintenance: MaintenanceSchedule | null;
  vehicle: FleetVehicle;
  onSuccess?: () => void;
}

export const MaintenanceSRFDialog = ({
  open,
  onOpenChange,
  maintenance,
  vehicle,
  onSuccess,
}: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceOneDriveUrl, setInvoiceOneDriveUrl] = useState("");

  const [formData, setFormData] = useState({
    title: maintenance
      ? `Vehicle Maintenance Service - ${maintenance.maintenanceType}`
      : "Vehicle Maintenance Service",
    serviceType: "maintenance",
    description: maintenance
      ? `Maintenance Type: ${maintenance.maintenanceType}\n\nVehicle: ${vehicle.name || vehicle.vehicleNumber} (${vehicle.plate})\n\nLast Maintenance: ${
          maintenance.lastMaintenanceDate
            ? new Date(maintenance.lastMaintenanceDate).toLocaleDateString()
            : "Not recorded"
        }\n\nNext Due: ${
          maintenance.nextMaintenanceDate
            ? new Date(maintenance.nextMaintenanceDate).toLocaleDateString()
            : "Not scheduled"
        }\n\nNotes: ${maintenance.notes || "None"}\n\nAdditional Details:\n`
      : "",
    urgency: "medium",
    justification: "",
    estimatedCost: "",
    duration: "",
  });

  const buildVehicleContext = (): string => {
    const parts: string[] = [];
    parts.push(`=== VEHICLE CONTEXT ===`);
    parts.push(`Vehicle: ${vehicle.name || vehicle.vehicleNumber || ""} (${vehicle.plate || "no plate"})`);
    if (vehicle.make || vehicle.model || vehicle.year)
      parts.push(`Make/Model: ${[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ")}`);
    if (vehicle.type) parts.push(`Type: ${vehicle.type}`);
    if (vehicle.color) parts.push(`Color: ${vehicle.color}`);
    if (vehicle.fuelType) parts.push(`Fuel: ${vehicle.fuelType}`);
    if (vehicle.totalDistance != null)
      parts.push(`Total Distance: ${Number(vehicle.totalDistance).toLocaleString()} km`);
    if (vehicle.lastMaintenanceAt)
      parts.push(`Last Maintenance: ${new Date(vehicle.lastMaintenanceAt).toLocaleDateString()}`);
    if (vehicle.nextMaintenanceAt)
      parts.push(`Next Scheduled: ${new Date(vehicle.nextMaintenanceAt).toLocaleDateString()}`);
    const history = (vehicle.maintenanceHistory || []).slice(0, 5);
    if (history.length) {
      parts.push(`Recent Maintenance:`);
      history.forEach((h: any) => {
        const when = h.performedAt || h.performed_at || h.lastMaintenanceDate || "";
        parts.push(
          `  • ${when ? new Date(when).toLocaleDateString() : "—"} — ${h.description || h.maintenance_type || h.maintenanceType || "Service"}`
        );
      });
    }
    parts.push(`=======================`);
    return parts.join("\n");
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.serviceType || !formData.urgency) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const capitalizeUrgency = (urgency: string): "Low" | "Medium" | "High" => {
        const normalized = urgency.toLowerCase();
        if (normalized === "low") return "Low";
        if (normalized === "medium") return "Medium";
        if (normalized === "high" || normalized === "critical") return "High";
        return "Medium";
      };

      // Append vehicle context to description
      const finalDescription = `${formData.description}\n\n${buildVehicleContext()}`;

      let response;
      if (invoiceFile || invoiceOneDriveUrl) {
        const formDataObj = new FormData();
        formDataObj.append("title", formData.title);
        formDataObj.append("description", finalDescription);
        formDataObj.append("serviceType", formData.serviceType);
        formDataObj.append("urgency", capitalizeUrgency(formData.urgency));
        formDataObj.append("justification", formData.justification);
        formDataObj.append("estimatedCost", formData.estimatedCost);
        formDataObj.append("duration", formData.duration);
        formDataObj.append("vehicle_id", vehicle.id);
        formDataObj.append("vehicle_plate", vehicle.plate || "");
        if (invoiceFile) {
          formDataObj.append("invoice", invoiceFile);
        }
        if (invoiceOneDriveUrl) {
          formDataObj.append("invoice_onedrive_url", invoiceOneDriveUrl);
        }
        response = await srfApi.createWithInvoice(formDataObj);
      } else {
        response = await srfApi.create({
          title: formData.title,
          description: finalDescription,
          serviceType: formData.serviceType,
          urgency: capitalizeUrgency(formData.urgency),
          justification: formData.justification,
          estimatedCost: formData.estimatedCost,
          duration: formData.duration,
          vehicleId: vehicle.id,
          vehiclePlate: vehicle.plate,
        } as any);
      }

      if (response.success) {
        const fid = (response as any)?.data?.formatted_id || (response as any)?.data?.formattedId;
        toast({
          title: fid ? `SRF ${fid} Submitted` : "SRF Submitted Successfully",
          description: "Your service request form has been submitted to the Supply Chain Director",
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        if ((response as any).status === 403) {
          const raw: any = (response as any).raw || {};
          const creatorName =
            raw?.designated_creator?.name ||
            raw?.designatedCreator?.name ||
            raw?.data?.designated_creator?.name ||
            null;
          toast({
            title: "Not the Designated Creator",
            description: creatorName
              ? `Only ${creatorName} can create requisitions for this department.`
              : "You are not the designated requisition creator for this department.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to create SRF",
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
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        title: maintenance
          ? `Vehicle Maintenance Service - ${maintenance.maintenanceType}`
          : "Vehicle Maintenance Service",
        serviceType: "maintenance",
        description: maintenance
          ? `Maintenance Type: ${maintenance.maintenanceType}\n\nVehicle: ${vehicle.name || vehicle.vehicleNumber} (${vehicle.plate})\n\nLast Maintenance: ${
              maintenance.lastMaintenanceDate
                ? new Date(maintenance.lastMaintenanceDate).toLocaleDateString()
                : "Not recorded"
            }\n\nNext Due: ${
              maintenance.nextMaintenanceDate
                ? new Date(maintenance.nextMaintenanceDate).toLocaleDateString()
                : "Not scheduled"
            }\n\nNotes: ${maintenance.notes || "None"}\n\nAdditional Details:\n`
          : "",
        urgency: "medium",
        justification: "",
        estimatedCost: "",
        duration: "",
      });
      setInvoiceFile(null);
      setInvoiceOneDriveUrl("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Initiate Service Request Form (SRF)</DialogTitle>
          <DialogDescription>
            Create an SRF for maintenance. This will be forwarded to the Supply Chain Director.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>Vehicle:</strong> {vehicle.name || vehicle.vehicleNumber} ({vehicle.plate})
              {maintenance && (
                <div className="mt-2">
                  <strong>Maintenance Type:</strong> {maintenance.maintenanceType}
                </div>
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="title">
              Request Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., Vehicle Maintenance Service"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              disabled={loading}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="serviceType">
                Service Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.serviceType}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, serviceType: value }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgency">
                Urgency Level <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.urgency}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, urgency: value }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
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
            <Label htmlFor="description">
              Description & Details <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Add any additional details about the maintenance..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={6}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">Vehicle context will be automatically appended.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="estimatedCost">Estimated Cost</Label>
              <Input
                id="estimatedCost"
                type="number"
                placeholder="0.00"
                value={formData.estimatedCost}
                onChange={(e) => setFormData((prev) => ({ ...prev, estimatedCost: e.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (days)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="0"
                value={formData.duration}
                onChange={(e) => setFormData((prev) => ({ ...prev, duration: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">Justification</Label>
            <Textarea
              id="justification"
              placeholder="Why is this maintenance necessary? What are the risks if not completed?"
              value={formData.justification}
              onChange={(e) => setFormData((prev) => ({ ...prev, justification: e.target.value }))}
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <h4 className="text-sm font-semibold">Invoice / Quotation (Optional)</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invoiceFile" className="text-xs">
                  Upload File (PDF / Image)
                </Label>
                <Input
                  id="invoiceFile"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoiceUrl" className="text-xs">
                  OneDrive URL
                </Label>
                <Input
                  id="invoiceUrl"
                  placeholder="https://..."
                  value={invoiceOneDriveUrl}
                  onChange={(e) => setInvoiceOneDriveUrl(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            {invoiceFile && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {invoiceFile.name}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit SRF to Supply Chain Director
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
