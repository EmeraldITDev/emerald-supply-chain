import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { procurementApi } from "@/services/procurementApi";
import type {
  ProcurementDocument,
  ProcurementDocumentType,
  ProcurementDocumentsResponse,
} from "@/types/procurement-documents";
import { LM_UPLOADABLE_DOC_TYPES } from "@/utils/stripReadOnlyActions";

interface ProcurementDocumentsPanelProps {
  mrfId: string;
  defaultUploadType?: ProcurementDocumentType;
  /**
   * When true (Logistics Manager procurement overview), the upload section is
   * restricted to JCC and waybill only. All other document types are view-only.
   */
  restrictToLmTypes?: boolean;
  /** When true, hide the upload form (read-only document registry). */
  readOnly?: boolean;
  /** Seed from parent MRF hydrate (`include_documents=1`) to skip the first empty load. */
  initialData?: ProcurementDocumentsResponse | null;
}

const UPLOADABLE_TYPES: { value: ProcurementDocumentType; label: string }[] = [
  { value: "waybill", label: "Waybill" },
  { value: "jcc", label: "JCC" },
  { value: "pfi", label: "PFI" },
  { value: "delivery_confirmation", label: "Delivery Confirmation" },
  { value: "grn", label: "GRN (file)" },
  { value: "other", label: "Other" },
];

const TYPE_LABELS: Record<ProcurementDocumentType, string> = {
  vendor_invoice: "Vendor Invoice",
  grn: "Goods Received Note",
  waybill: "Waybill",
  jcc: "JCC",
  pfi: "Proforma Invoice (PFI)",
  po_pdf: "Purchase Order (PDF)",
  signed_po: "Signed Purchase Order",
  delivery_confirmation: "Delivery Confirmation",
  other: "Other",
};

const ACCEPTED_MIME = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
const MAX_BYTES = 20 * 1024 * 1024;

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function ProcurementDocumentsPanel({
  mrfId,
  defaultUploadType = "waybill",
  restrictToLmTypes = false,
  readOnly = false,
  initialData = null,
}: ProcurementDocumentsPanelProps) {
  const { toast } = useToast();
  const [data, setData] = useState<ProcurementDocumentsResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [openingDocId, setOpeningDocId] = useState<number | null>(null);
  const [uploadType, setUploadType] = useState<ProcurementDocumentType>(defaultUploadType);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await procurementApi.getProcurementDocuments(mrfId, {
        includeInactive: true,
      });
      if (res.success && res.data) {
        setData(res.data);
        return res.data;
      }
      if (!res.success) {
        toast({
          title: "Failed to load documents",
          description: res.error || "Unknown error",
          variant: "destructive",
        });
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [mrfId, toast]);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
    }
  }, [initialData]);

  useEffect(() => {
    if (!initialData) {
      void fetchDocs();
    }
    const onRefresh = () => void fetchDocs();
    window.addEventListener("app:refresh", onRefresh);
    return () => window.removeEventListener("app:refresh", onRefresh);
  }, [fetchDocs, initialData]);

  const openDocument = useCallback(
    async (doc: ProcurementDocument) => {
      setOpeningDocId(doc.id);
      try {
        // Always re-fetch registry so S3 pre-signed URLs are freshly signed.
        const fresh = await fetchDocs();
        const docs = fresh?.documents ?? [];
        const match =
          docs.find((d) => d.id === doc.id) ||
          docs.find(
            (d) =>
              d.type === doc.type &&
              d.version === doc.version &&
              d.fileName === doc.fileName,
          );
        const url = match?.fileUrl || doc.fileUrl;
        if (!url) {
          toast({
            title: "Document unavailable",
            description: "No download URL returned for this file.",
            variant: "destructive",
          });
          return;
        }
        window.open(url, "_blank", "noopener,noreferrer");
      } finally {
        setOpeningDocId(null);
      }
    },
    [fetchDocs, toast],
  );

  const grouped = useMemo(() => {
    if (data?.documentsByType) return data.documentsByType;
    const out: Partial<Record<ProcurementDocumentType, ProcurementDocument[]>> = {};
    (data?.documents ?? []).forEach((doc) => {
      const key = doc.type;
      (out[key] ||= []).push(doc);
    });
    return out;
  }, [data]);

  const active = useMemo(() => {
    if (data?.activeByType) return data.activeByType;
    const out: Partial<Record<ProcurementDocumentType, ProcurementDocument>> = {};
    Object.entries(grouped).forEach(([type, list]) => {
      const found = list?.find((d) => d.isActive) ?? list?.[0];
      if (found) out[type as ProcurementDocumentType] = found;
    });
    return out;
  }, [data, grouped]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_BYTES) {
      toast({
        title: "File too large",
        description: "Maximum size is 20MB.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) {
      toast({ title: "Select a file first", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const res = await procurementApi.uploadProcurementDocument(mrfId, {
        type: uploadType,
        file,
      });
      if (res.success) {
        toast({
          title: "Document uploaded",
          description: `${TYPE_LABELS[uploadType]} added to registry.`,
        });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        void fetchDocs();
      } else {
        toast({
          title: "Upload failed",
          description: res.error || "Unknown error",
          variant: "destructive",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const activeEntries = Object.entries(active) as [
    ProcurementDocumentType,
    ProcurementDocument,
  ][];
  const groupedEntries = Object.entries(grouped) as [
    ProcurementDocumentType,
    ProcurementDocument[],
  ][];

  return (
    <Card className="border-t">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Procurement Documents</CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void fetchDocs()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span className="sr-only">Refresh</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active documents */}
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">
            Active Documents
          </h4>
          {loading && !data ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : activeEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents in the registry yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeEntries.map(([type, doc]) => (
                <div
                  key={`active-${type}`}
                  className="flex items-start justify-between rounded-md border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {TYPE_LABELS[type] ?? type}
                      </span>
                      <Badge variant="secondary">v{doc.version}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.fileName}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-3 shrink-0"
                    disabled={openingDocId === doc.id}
                    onClick={() => void openDocument(doc)}
                  >
                    {openingDocId === doc.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3 w-3 mr-1" />
                    )}{" "}
                    Open
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* All versions */}
        {groupedEntries.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">
              All Versions
            </h4>
            <Accordion type="multiple" className="w-full">
              {groupedEntries.map(([type, list]) => (
                <AccordionItem key={`group-${type}`} value={type}>
                  <AccordionTrigger className="text-sm">
                    {TYPE_LABELS[type] ?? type}
                    <Badge variant="outline" className="ml-2">
                      {list.length}
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2">
                      {list.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between rounded border p-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">
                                {doc.fileName}
                              </span>
                              <Badge variant="secondary">v{doc.version}</Badge>
                              {doc.isActive && (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground">
                              Uploaded by {doc.uploadedBy?.name ?? "—"} ·{" "}
                              {formatDate(doc.uploadedAt)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={openingDocId === doc.id}
                            onClick={() => void openDocument(doc)}
                          >
                            {openingDocId === doc.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ExternalLink className="h-3 w-3" />
                            )}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {/* Upload form — hidden when read-only or when no types are available for this user */}
        {!readOnly &&
        (!restrictToLmTypes ||
          LM_UPLOADABLE_DOC_TYPES.some((t) =>
            UPLOADABLE_TYPES.find((u) => u.value === t),
          )) && (
        <section className="space-y-3 rounded-md border bg-muted/30 p-3">
          <h4 className="text-sm font-semibold">Upload Supporting Document</h4>
          {restrictToLmTypes && (
            <p className="text-xs text-muted-foreground">
              Your role can upload JCC and Waybill documents only.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={uploadType}
                onValueChange={(v) => setUploadType(v as ProcurementDocumentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(restrictToLmTypes
                    ? UPLOADABLE_TYPES.filter((t) =>
                        (LM_UPLOADABLE_DOC_TYPES as readonly string[]).includes(t.value),
                      )
                    : UPLOADABLE_TYPES
                  ).map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">File</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIME}
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleUpload} disabled={uploading || !file}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-4 w-4" /> Upload
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Accepted: PDF, DOC, DOCX, JPG, PNG · Max 20MB
          </p>
        </section>
        )}
      </CardContent>
    </Card>
  );
}