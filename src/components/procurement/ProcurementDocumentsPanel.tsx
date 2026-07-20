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
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

type PendingUpload = {
  key: string;
  file: File;
  type: ProcurementDocumentType;
  remarks: string;
};

function newPendingKey() {
  return `pu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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
  const [openingDocId, setOpeningDocId] = useState<number | string | null>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<number | string | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<ProcurementDocument | null>(null);
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

  const handleDeleteDocument = useCallback(
    async (doc: ProcurementDocument) => {
      setDeletingDocId(doc.id);
      try {
        const res = await procurementApi.deleteProcurementDocument(mrfId, doc.id);
        if (res.success) {
          toast({
            title: "Document removed",
            description: `${doc.fileName} was deleted from the registry.`,
          });
          setConfirmDeleteDoc(null);
          void fetchDocs();
        } else {
          toast({
            title: "Failed to delete document",
            description: res.error || "Unknown error",
            variant: "destructive",
          });
        }
      } finally {
        setDeletingDocId(null);
      }
    },
    [mrfId, toast, fetchDocs],
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

  const availableTypes = useMemo(
    () =>
      restrictToLmTypes
        ? UPLOADABLE_TYPES.filter((t) =>
            (LM_UPLOADABLE_DOC_TYPES as readonly string[]).includes(t.value),
          )
        : UPLOADABLE_TYPES,
    [restrictToLmTypes],
  );

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (!list.length) return;
    const accepted: PendingUpload[] = [];
    let rejected = 0;
    for (const f of list) {
      if (f.size > MAX_BYTES) {
        rejected += 1;
        continue;
      }
      accepted.push({
        key: newPendingKey(),
        file: f,
        type: defaultUploadType,
        remarks: "",
      });
    }
    if (rejected > 0) {
      toast({
        title: `${rejected} file(s) skipped`,
        description: "Each file must be ≤ 20MB.",
        variant: "destructive",
      });
    }
    if (accepted.length) setPending((prev) => [...prev, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updatePending = (key: string, patch: Partial<PendingUpload>) =>
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const removePending = (key: string) =>
    setPending((prev) => prev.filter((p) => p.key !== key));

  const handleUpload = async () => {
    if (!pending.length) {
      toast({ title: "Add at least one file", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const res = await procurementApi.uploadProcurementDocuments(mrfId, {
        documents: pending.map((p) => ({
          type: p.type,
          file: p.file,
          remarks: p.remarks || undefined,
        })),
      });
      if (res.success && res.data) {
        const uploaded = res.data.uploaded.length;
        const failed = res.data.failed;
        if (uploaded > 0) {
          toast({
            title: `${uploaded} document(s) uploaded`,
            description: failed.length
              ? `${failed.length} file(s) failed — see below.`
              : "Registry refreshed.",
          });
        }
        if (failed.length > 0) {
          toast({
            title: "Some uploads failed",
            description: failed
              .slice(0, 3)
              .map((f) => `${f.fileName ?? `#${f.index + 1}`}: ${f.error}`)
              .join(" · "),
            variant: "destructive",
          });
        }
        // Keep only the failed items so the user can retry them.
        const failedIndexes = new Set(failed.map((f) => f.index));
        setPending((prev) => prev.filter((_, i) => failedIndexes.has(i)));
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
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-1 shrink-0 text-destructive hover:text-destructive"
                      disabled={deletingDocId === doc.id}
                      onClick={() => setConfirmDeleteDoc(doc)}
                      aria-label={`Delete ${doc.fileName}`}
                    >
                      {deletingDocId === doc.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  )}
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
                          {!readOnly && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={deletingDocId === doc.id}
                              onClick={() => setConfirmDeleteDoc(doc)}
                              aria-label={`Delete ${doc.fileName}`}
                            >
                              {deletingDocId === doc.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {/* Multi-file upload — hidden when read-only or no types available */}
        {!readOnly && availableTypes.length > 0 && (
          <section className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Upload Supporting Documents</h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <UploadCloud className="mr-2 h-4 w-4" /> Add files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_MIME}
                className="hidden"
                onChange={handleFilesSelected}
                disabled={uploading}
              />
            </div>
            {restrictToLmTypes && (
              <p className="text-xs text-muted-foreground">
                Your role can upload JCC and Waybill documents only.
              </p>
            )}
            {pending.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Select one or more files to attach. Each file can have its own
                type and remarks. PDF, DOC, DOCX, JPG, PNG · Max 20MB each.
              </p>
            ) : (
              <div className="space-y-2">
                {pending.map((p) => (
                  <div
                    key={p.key}
                    className="grid gap-2 rounded border bg-background p-2 sm:grid-cols-[1fr_180px_1fr_auto] sm:items-end"
                  >
                    <div className="min-w-0">
                      <Label className="text-xs">File</Label>
                      <p className="truncate text-sm font-medium" title={p.file.name}>
                        {p.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(p.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={p.type}
                        onValueChange={(v) =>
                          updatePending(p.key, { type: v as ProcurementDocumentType })
                        }
                        disabled={uploading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Remarks (optional)</Label>
                      <Input
                        value={p.remarks}
                        onChange={(e) => updatePending(p.key, { remarks: e.target.value })}
                        placeholder="Notes for this file"
                        disabled={uploading}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePending(p.key)}
                      disabled={uploading}
                      aria-label="Remove file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-end">
              <Button
                type="button"
                onClick={handleUpload}
                disabled={uploading || pending.length === 0}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading {pending.length} file{pending.length === 1 ? "" : "s"}…
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload {pending.length > 0 ? `${pending.length} ` : ""}file
                    {pending.length === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}