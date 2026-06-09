import { useCallback, useEffect, useState } from "react";
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
import { Loader2, Upload, Trash2 } from "lucide-react";
import { driversApi } from "@/services/logisticsApi";
import { useToast } from "@/hooks/use-toast";
import type { Driver } from "@/types/logistics";

interface Props {
  driver: Driver | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DOC_TYPES = [
  { value: "drivers_license", label: "Driver's Licence" },
  { value: "lasdri", label: "LASDRI Card" },
  { value: "training_certificate", label: "Training Certificate" },
  { value: "medical_certificate", label: "Medical Certificate" },
  { value: "id_card", label: "ID Card" },
  { value: "other", label: "Other" },
];

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
};

const expiryTier = (iso?: string): { label: string; cls: string } => {
  if (!iso) return { label: "No expiry", cls: "bg-muted text-muted-foreground" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { label: "Unknown", cls: "bg-muted text-muted-foreground" };
  const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "Expired", cls: "bg-destructive/10 text-destructive border-destructive/20" };
  if (days <= 7) return { label: "Critical", cls: "bg-destructive/10 text-destructive border-destructive/20" };
  if (days <= 42) return { label: "Expiring Soon", cls: "bg-warning/10 text-warning border-warning/20" };
  return { label: "Valid", cls: "bg-success/10 text-success border-success/20" };
};

export const DriverDocumentsDialog = ({ driver, open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("drivers_license");
  const [expiry, setExpiry] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!driver) return;
    setLoading(true);
    setError(null);
    try {
      const res = await driversApi.listDocuments(driver.id);
      if (res.success && res.data) {
        const arr = Array.isArray(res.data) ? res.data : (res.data as any).documents || [];
        setDocs(arr);
      } else {
        setDocs([]);
        if (res.error) setError(res.error);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [driver]);

  useEffect(() => {
    if (open) fetchDocs();
  }, [open, fetchDocs]);

  const handleUpload = async () => {
    if (!driver || !file) {
      toast({ title: "Select a file", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const res = await driversApi.uploadDocument(driver.id, file, docType, expiry || undefined);
      if (res.success) {
        toast({ title: "Document uploaded" });
        setFile(null);
        setExpiry("");
        setDocType("drivers_license");
        fetchDocs();
      } else {
        toast({ title: "Upload failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!driver) return;
    const res = await driversApi.deleteDocument(driver.id, id);
    if (res.success) {
      toast({ title: "Document removed" });
      fetchDocs();
    } else {
      toast({ title: "Delete failed", description: res.error, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Driver Documents — {driver?.name}</DialogTitle>
          <DialogDescription>
            Manage licence, training, and other personal documents for this driver. Expiry status is
            colour-coded the same way as vehicle documents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 space-y-3">
            <h4 className="text-sm font-semibold">Upload document</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Document Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date</Label>
                <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>File</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleUpload} disabled={uploading || !file}>
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading documents…
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>{error}</span>
                <Button size="sm" variant="outline" onClick={fetchDocs}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No documents on file.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => {
                    const id = String(d.id ?? d.document_id ?? "");
                    const url = d.file_url || d.url || d.s3_url;
                    const name = d.name || d.file_name || "Document";
                    const exp = d.expires_at || d.expiry_date || d.expiresAt;
                    const tier = expiryTier(exp);
                    const typeLabel =
                      DOC_TYPES.find((t) => t.value === (d.document_type || d.type))?.label ||
                      d.document_type ||
                      d.type ||
                      "—";
                    return (
                      <TableRow key={id || name}>
                        <TableCell className="font-medium">{typeLabel}</TableCell>
                        <TableCell>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              {name}
                            </a>
                          ) : (
                            name
                          )}
                        </TableCell>
                        <TableCell>{formatDate(d.uploaded_at || d.created_at)}</TableCell>
                        <TableCell>{formatDate(exp)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={tier.cls}>
                            {tier.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleDelete(id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DriverDocumentsDialog;