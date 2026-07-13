import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { procurementApi } from "@/services/procurementApi";
import type {
  DeliveryConfirmationResponse,
  DeliveryChecklistItem,
} from "@/types/delivery-confirmation";
import type { ProcurementDocumentType } from "@/types/procurement-documents";

interface DeliveryConfirmationPanelProps {
  mrfId: string;
  /** Bump to force re-fetch after external mutations. */
  refreshKey?: number;
  className?: string;
}

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const MAX_BYTES = 10 * 1024 * 1024;

const prettyState = (s?: string) =>
  s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

export const DeliveryConfirmationPanel = ({
  mrfId,
  refreshKey = 0,
  className,
}: DeliveryConfirmationPanelProps) => {
  const { toast } = useToast();
  const [data, setData] = useState<DeliveryConfirmationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyType, setBusyType] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchData = useCallback(async () => {
    if (!mrfId) return;
    setLoading(true);
    setError(null);
    const res = await procurementApi.getDeliveryConfirmation(mrfId);
    setLoading(false);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || "Failed to load delivery confirmation");
    }
  }, [mrfId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  useEffect(() => {
    const h = () => fetchData();
    window.addEventListener("app:refresh", h);
    return () => window.removeEventListener("app:refresh", h);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-sm text-muted-foreground flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Hide entirely when backend says we shouldn't show (advance-only schedules, etc.)
  if (!data || data.showPanel === false) return null;

  const checklist = data.checklist ?? [];
  const perms = data.permissions ?? {};
  const readOnly =
    data.satisfied === true || !perms.canManageDeliveryConfirmation;

  const triggerUpload = (type: ProcurementDocumentType) => {
    fileInputs.current[type]?.click();
  };

  const handleFile = async (type: ProcurementDocumentType, file: File | null) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast({
        title: "File too large",
        description: "Maximum size is 10MB.",
        variant: "destructive",
      });
      return;
    }
    setBusyType(`upload:${type}`);
    const res = await procurementApi.uploadProcurementDocument(mrfId, { type, file });
    setBusyType(null);
    if (res.success) {
      toast({ title: "Document uploaded", description: `Saved as ${type.replace(/_/g, " ")}.` });
      fetchData();
    } else {
      toast({
        title: "Upload failed",
        description: res.error || "Could not upload document.",
        variant: "destructive",
      });
    }
  };

  const handlePreviewGRN = async () => {
    setBusyType("preview:grn");
    const res = await procurementApi.previewGRN(mrfId);
    setBusyType(null);
    if (res.success && res.data) {
      window.open(res.data.objectUrl, "_blank", "noopener,noreferrer");
    } else {
      toast({
        title: "Preview failed",
        description: res.error || "Could not preview GRN.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateGRN = async () => {
    setBusyType("generate:grn");
    const res = await procurementApi.generateGRN(mrfId, { confirm: true });
    setBusyType(null);
    if (res.success) {
      toast({ title: "GRN generated", description: "Goods Received Note registered." });
      fetchData();
    } else {
      toast({
        title: "GRN generation failed",
        description: res.error || "Could not generate GRN.",
        variant: "destructive",
      });
    }
  };

  const canActFor = (item: DeliveryChecklistItem): boolean => {
    if (readOnly) return false;
    switch (item.type) {
      case "grn":
        return Boolean(perms.canUploadGRN || perms.canGenerateGRN);
      case "waybill":
        return Boolean(perms.canUploadWaybill);
      case "jcc":
        return Boolean(perms.canUploadJcc);
      case "delivery_confirmation":
        return Boolean(perms.canUploadDeliveryConfirmation);
      default:
        return Boolean(perms.canUploadOther ?? perms.canManageDeliveryConfirmation);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCheck className="h-4 w-4" />
              Delivery Confirmation
              {data.satisfied ? (
                <Badge variant="default" className="text-[10px] gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Satisfied
                </Badge>
              ) : data.required ? (
                <Badge variant="secondary" className="text-[10px]">Pending</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Not required</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {data.workflowState && (
                <>State: <span className="font-medium">{prettyState(data.workflowState)}</span></>
              )}
              {data.currentMilestone?.label && (
                <span className="ml-2">
                  · Milestone:{" "}
                  <span className="font-medium">
                    M{data.currentMilestone.milestoneNumber} {data.currentMilestone.label}
                  </span>
                  {data.currentMilestone.percentage != null && (
                    <span className="text-muted-foreground"> ({data.currentMilestone.percentage}%)</span>
                  )}
                </span>
              )}
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {readOnly && data.satisfied && (
          <Alert className="py-2">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle className="text-xs">Delivery confirmed</AlertTitle>
            <AlertDescription className="text-xs">
              Workflow has moved past delivery confirmation. Checklist is shown for reference.
            </AlertDescription>
          </Alert>
        )}

        {checklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checklist items provided.</p>
        ) : (
          <ul className="space-y-2">
            {checklist.map((item) => {
              const actions = item.actions ?? [];
              const allowAct = canActFor(item);
              const showGenerate =
                item.type === "grn" &&
                allowAct &&
                perms.canGenerateGRN &&
                (actions.length === 0 || actions.includes("generate_grn"));
              const showUpload =
                allowAct &&
                (actions.length === 0 ||
                  actions.some((a) => a.startsWith("upload_")));

              return (
                <li
                  key={item.type}
                  className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {item.satisfied ? (
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    ) : item.required ? (
                      <XCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.label}
                        {!item.required && (
                          <span className="ml-2 text-[10px] text-muted-foreground">(optional)</span>
                        )}
                      </p>
                      {item.document?.fileName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.document.fileName}
                          {item.document.version ? ` · v${item.document.version}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {item.satisfied && item.document?.fileUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          // Re-fetch MRF documents for a fresh pre-signed URL.
                          try {
                            const res = await procurementApi.getProcurementDocuments(mrfId, {
                              includeInactive: true,
                            });
                            const docs = res.data?.documents ?? [];
                            const match = docs.find((d) => d.id === item.document?.id);
                            const url = match?.fileUrl || item.document?.fileUrl;
                            if (url) window.open(url, "_blank", "noopener,noreferrer");
                          } catch {
                            if (item.document?.fileUrl) {
                              window.open(item.document.fileUrl, "_blank", "noopener,noreferrer");
                            }
                          }
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View
                      </Button>
                    )}

                    {!item.satisfied && showGenerate && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handlePreviewGRN}
                          disabled={busyType === "preview:grn"}
                        >
                          {busyType === "preview:grn" ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleGenerateGRN}
                          disabled={busyType === "generate:grn"}
                        >
                          {busyType === "generate:grn" ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Generate GRN
                        </Button>
                      </>
                    )}

                    {!item.satisfied && showUpload && (
                      <>
                        <input
                          ref={(el) => (fileInputs.current[item.type] = el)}
                          type="file"
                          accept={ACCEPT}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            handleFile(item.type, f);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          size="sm"
                          variant={showGenerate ? "outline" : "default"}
                          onClick={() => triggerUpload(item.type)}
                          disabled={busyType === `upload:${item.type}`}
                        >
                          {busyType === `upload:${item.type}` ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Upload
                        </Button>
                      </>
                    )}

                    {!item.satisfied && !allowAct && (
                      <Badge variant="outline" className="text-[10px]">No permission</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {(data.missingDocuments?.length ?? 0) > 0 && !data.satisfied && (
          <Alert className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xs">Still missing</AlertTitle>
            <AlertDescription className="text-xs">
              {data.missingDocuments!.map((d) => d.replace(/_/g, " ")).join(", ")}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default DeliveryConfirmationPanel;