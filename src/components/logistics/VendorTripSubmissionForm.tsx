import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle2, X, AlertCircle, RefreshCw, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vendorTripApi } from "@/services/logisticsApi";
import type { Trip, VendorTripDocType, VendorTripDocument } from "@/types/logistics";
import { formatTripStatus, tripStatusBadgeClass } from "@/utils/tripStatus";

interface UploadRow {
  localId: string;
  file: File;
  docType: VendorTripDocType;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  document?: VendorTripDocument;
}

const DOC_TYPE_LABEL: Record<VendorTripDocType, string> = {
  insurance_certificate: "Insurance Certificate",
  road_worthiness_certificate: "Road-Worthiness Certificate",
  other: "Other",
};

interface Props {
  trip: Trip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function VendorTripSubmissionForm({ trip, open, onOpenChange, onSubmitted }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    vehicleMake: "",
    vehicleModel: "",
    plateNumber: "",
    driverName: "",
    driverPhone: "",
    driverLicenceNumber: "",
    securityInformation: "",
  });
  const [nextDocType, setNextDocType] = useState<VendorTripDocType>("insurance_certificate");
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string>("Draft");
  const [statusKey, setStatusKey] = useState<string>("draft");

  useEffect(() => {
    if (!open || !trip) return;
    setStatusKey(trip.status ?? "draft");
    setStatusLabel(formatTripStatus(trip.status));
    setLocked(trip.status === "pending_approval" || trip.status === "approved");
    // Try to rehydrate prior submission
    vendorTripApi.getSubmission(trip.id).then((res) => {
      if (res.success && res.data) {
        const s: any = res.data;
        setForm({
          vehicleMake: s.vehicleMake ?? s.vehicle_make ?? "",
          vehicleModel: s.vehicleModel ?? s.vehicle_model ?? "",
          plateNumber: s.plateNumber ?? s.plate_number ?? "",
          driverName: s.driverName ?? s.driver_name ?? "",
          driverPhone: s.driverPhone ?? s.driver_phone ?? "",
          driverLicenceNumber: s.driverLicenceNumber ?? s.driver_licence_number ?? "",
          securityInformation: s.securityInformation ?? s.security_information ?? "",
        });
        const docs: VendorTripDocument[] = s.documents ?? [];
        setUploads(
          docs.map((d) => ({
            localId: d.id,
            file: new File([], d.fileName),
            docType: d.docType,
            progress: 100,
            status: "done",
            document: d,
          })),
        );
        setLocked(true);
      }
    });
  }, [open, trip]);

  const isUploading = uploads.some((u) => u.status === "uploading");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!trip) return;
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      const localId = crypto.randomUUID();
      const docType = nextDocType;
      setUploads((prev) => [...prev, { localId, file, docType, progress: 0, status: "uploading" }]);
      const res = await vendorTripApi.uploadDoc(trip.id, file, docType, (pct) => {
        setUploads((prev) => prev.map((u) => (u.localId === localId ? { ...u, progress: pct } : u)));
      });
      if (res.success && res.data) {
        setUploads((prev) =>
          prev.map((u) => (u.localId === localId ? { ...u, progress: 100, status: "done", document: res.data } : u)),
        );
      } else {
        setUploads((prev) =>
          prev.map((u) => (u.localId === localId ? { ...u, status: "error", error: res.error } : u)),
        );
      }
    }
  };

  const retryUpload = async (row: UploadRow) => {
    if (!trip) return;
    setUploads((prev) => prev.map((u) => (u.localId === row.localId ? { ...u, status: "uploading", progress: 0, error: undefined } : u)));
    const res = await vendorTripApi.uploadDoc(trip.id, row.file, row.docType, (pct) => {
      setUploads((prev) => prev.map((u) => (u.localId === row.localId ? { ...u, progress: pct } : u)));
    });
    if (res.success && res.data) {
      setUploads((prev) =>
        prev.map((u) => (u.localId === row.localId ? { ...u, progress: 100, status: "done", document: res.data } : u)),
      );
    } else {
      setUploads((prev) => prev.map((u) => (u.localId === row.localId ? { ...u, status: "error", error: res.error } : u)));
    }
  };

  const removeUpload = (localId: string) => {
    setUploads((prev) => prev.filter((u) => u.localId !== localId));
  };

  const handleSubmit = async () => {
    if (!trip) return;
    const required = [form.vehicleMake, form.vehicleModel, form.plateNumber, form.driverName, form.driverPhone, form.driverLicenceNumber];
    if (required.some((v) => !v.trim())) {
      toast({ variant: "destructive", title: "Missing fields", description: "All driver and vehicle fields are required." });
      return;
    }
    const completed = uploads.filter((u) => u.status === "done" && u.document);
    if (completed.length === 0) {
      toast({ variant: "destructive", title: "Documents required", description: "Upload at least one supporting document." });
      return;
    }
    setSubmitting(true);
    const res = await vendorTripApi.submit(trip.id, {
      ...form,
      documentIds: completed.map((u) => u.document!.id),
    } as any);
    setSubmitting(false);
    if (res.success) {
      toast({ title: "Submitted", description: "Trip details sent for approval." });
      setLocked(true);
      setStatusKey("pending_approval");
      setStatusLabel(formatTripStatus("pending_approval"));
      window.dispatchEvent(new CustomEvent("app:refresh"));
      onSubmitted?.();
    } else {
      toast({ variant: "destructive", title: "Submission failed", description: res.error });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto max-h-screen">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Submit Trip Details</SheetTitle>
            <Badge className={tripStatusBadgeClass(statusKey)}>{statusLabel}</Badge>
          </div>
          <SheetDescription>
            {trip ? <>Trip <span className="font-medium">{trip.tripNumber}</span> · {trip.origin} → {trip.destination}</> : null}
          </SheetDescription>
        </SheetHeader>

        {locked && (
          <div className="mt-4 rounded-md bg-info/10 text-info p-3 text-sm flex gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>Submission locked. The form is read-only because the trip is {statusLabel.toLowerCase()}.</span>
          </div>
        )}

        <fieldset disabled={locked} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vehicle Make *</Label>
              <Input value={form.vehicleMake} onChange={(e) => setForm({ ...form, vehicleMake: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Model *</Label>
              <Input value={form.vehicleModel} onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Plate Number *</Label>
              <Input value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Driver Name *</Label>
              <Input value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Driver Phone *</Label>
              <Input value={form.driverPhone} onChange={(e) => setForm({ ...form, driverPhone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Driver Licence Number *</Label>
              <Input value={form.driverLicenceNumber} onChange={(e) => setForm({ ...form, driverLicenceNumber: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Security Information</Label>
            <Textarea value={form.securityInformation} onChange={(e) => setForm({ ...form, securityInformation: e.target.value })} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Supporting Documents *</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={nextDocType} onValueChange={(v) => setNextDocType(v as VendorTripDocType)}>
                <SelectTrigger className="sm:w-72"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border bg-background hover:bg-accent cursor-pointer text-sm">
                <Upload className="h-4 w-4" />
                Choose files
                <input type="file" multiple className="hidden" onChange={handleFileSelect} />
              </label>
            </div>
            {uploads.length > 0 && (
              <ul className="space-y-2 mt-2">
                {uploads.map((u) => (
                  <li key={u.localId} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate">{u.document?.fileName ?? u.file.name}</span>
                        <Badge variant="outline" className="ml-1 flex-shrink-0">{DOC_TYPE_LABEL[u.docType]}</Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {u.status === "done" && <CheckCircle2 className="h-4 w-4 text-success" />}
                        {u.status === "error" && (
                          <Button variant="ghost" size="sm" onClick={() => retryUpload(u)} className="h-7">
                            <RefreshCw className="h-3 w-3 mr-1" /> Retry
                          </Button>
                        )}
                        {!locked && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeUpload(u.localId)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {u.status === "uploading" && <Progress value={u.progress} className="h-1.5 mt-2" />}
                    {u.status === "error" && <p className="text-destructive text-xs mt-1">{u.error ?? "Upload failed"}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </fieldset>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {!locked && (
            <Button onClick={handleSubmit} disabled={submitting || isUploading}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit for Approval
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default VendorTripSubmissionForm;