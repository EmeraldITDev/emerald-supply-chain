import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Upload, Eye, Trash2, AlertTriangle } from "lucide-react";
import { fleetApi } from "@/services/logisticsApi";
import { useToast } from "@/hooks/use-toast";
import {
  VEHICLE_DOCUMENT_TYPE_LABELS,
  type FleetVehicle,
  type VehicleDocument,
  type VehicleDocumentType,
} from "@/types/logistics";

interface Props {
  vehicle: FleetVehicle;
  onChanged?: () => void;
}

const ALERT_BADGE: Record<string, string> = {
  GREEN: "bg-success/10 text-success border-success/20",
  AMBER: "bg-warning/10 text-warning border-warning/20",
  RED: "bg-destructive/10 text-destructive border-destructive/20",
};

const ALERT_LABEL: Record<string, string> = {
  GREEN: "Valid",
  AMBER: "Expiring Soon",
  RED: "Critical",
};

const isPastDate = (iso?: string) => {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
};

export const VehicleDocumentsTab = ({ vehicle, onChanged }: Props) => {
  const { toast } = useToast();
  const [docs, setDocs] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [docType, setDocType] = useState<VehicleDocumentType>("insurance_certificate");
  const [expiry, setExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fleetApi.listDocuments(vehicle.id);
      if (res.success && res.data) {
        const arr = Array.isArray(res.data) ? res.data : (res.data as any).documents || [];
        setDocs(arr.map((d: any) => ({
          id: d.id?.toString(),
          vehicleId: d.vehicle_id?.toString() ?? vehicle.id,
          name: d.name || d.file_name || d.document_type || "Document",
          type: d.type || d.document_type || "other",
          documentType: d.document_type || d.documentType,
          fileUrl: d.file_url || d.fileUrl,
          uploadedAt: d.uploaded_at || d.uploadedAt || d.created_at,
          expiryDate: d.expiry_date || d.expiryDate || d.expires_at,
          expiresAt: d.expires_at || d.expiry_date,
          alertColour: d.alert_colour || d.alertColour || null,
        })));
      } else {
        setDocs([]);
        if (res.error) setError(res.error);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load documents");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [vehicle.id]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const hasExpired = docs.some(
    (d) => d.alertColour === null && isPastDate(d.expiryDate || d.expiresAt),
  ) || docs.some((d) => isPastDate(d.expiryDate || d.expiresAt) && d.alertColour === undefined);

  const handleUpload = async () => {
    if (!file || !expiry) {
      toast({ title: "Missing fields", description: "Pick a file and expiry date.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const res = await fleetApi.uploadDocumentV2(vehicle.id, file, docType, expiry);
      if (res.success) {
        toast({ title: "Document Uploaded", description: file.name });
        setFile(null);
        setExpiry("");
        await fetchDocs();
        onChanged?.();
      } else {
        toast({ title: "Upload Failed", description: res.error || "Try again.", variant: "destructive" });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    const res = await fleetApi.deleteDocument(vehicle.id, docId);
    if (res.success) {
      toast({ title: "Document Deleted" });
      fetchDocs();
      onChanged?.();
    } else {
      toast({ title: "Delete Failed", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {hasExpired && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This vehicle has expired documents and has been set to Inactive.
          </AlertDescription>
        </Alert>
      )}

      {/* Upload form */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-semibold">Upload Document</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Document Type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as VehicleDocumentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(VEHICLE_DOCUMENT_TYPE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expiry Date</Label>
            <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>File (PDF / Image)</Label>
            <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleUpload} disabled={!file || !expiry || uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload Document
          </Button>
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading documents…
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={fetchDocs}>Retry</Button>
          </AlertDescription>
        </Alert>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Type</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => {
                const expIso = d.expiryDate || d.expiresAt;
                const expired = !d.alertColour && isPastDate(expIso);
                const cellClass = expired
                  ? "text-destructive font-medium"
                  : d.alertColour === "RED"
                    ? "text-destructive font-medium"
                    : d.alertColour === "AMBER"
                      ? "text-warning font-medium"
                      : d.alertColour === "GREEN"
                        ? "text-success"
                        : "";
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      {VEHICLE_DOCUMENT_TYPE_LABELS[(d.documentType || "") as VehicleDocumentType] || d.name || d.type}
                    </TableCell>
                    <TableCell>{formatDate(d.uploadedAt)}</TableCell>
                    <TableCell className={cellClass}>{formatDate(expIso)}</TableCell>
                    <TableCell>
                      {expired ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Expired</Badge>
                      ) : d.alertColour ? (
                        <Badge variant="outline" className={ALERT_BADGE[d.alertColour]}>
                          {ALERT_LABEL[d.alertColour]}
                        </Badge>
                      ) : (
                        <Badge variant="outline">—</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {d.fileUrl && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={d.fileUrl} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" /></a>
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default VehicleDocumentsTab;