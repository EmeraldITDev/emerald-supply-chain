import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, FileText, Loader2, Lock, RefreshCw, Upload, AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vendorPortalApi } from "@/services/api";
import { cn } from "@/lib/utils";

type MrfRow = {
  mrfId: string;
  title: string;
  workflowState: string;
  vendorInvoiceGate: { canSubmit: boolean; gateType?: string | null; reason?: string | null };
  invoiceSubmitted: boolean;
};

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const MAX_BYTES = 10 * 1024 * 1024;

const prettyState = (s: string) =>
  s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

export const VendorInvoicesPanel = () => {
  const { toast } = useToast();
  const [mrfs, setMrfs] = useState<MrfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await vendorPortalApi.listFinanceApMrfs();
    setLoading(false);
    if (res.success && res.data) {
      setMrfs(Array.isArray((res.data as any).mrfs) ? (res.data as any).mrfs : []);
    } else {
      setError(res.error || "Failed to load invoices");
    }
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("app:refresh", handler);
    return () => window.removeEventListener("app:refresh", handler);
  }, [load]);

  const handleUpload = async (mrfId: string, file: File | null) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Maximum size is 10MB.", variant: "destructive" });
      return;
    }
    setBusyId(mrfId);
    const res = await vendorPortalApi.uploadInvoice(mrfId, file);
    setBusyId(null);
    if (res.success) {
      toast({ title: "Invoice submitted", description: "Your final invoice has been uploaded." });
      load();
    } else {
      toast({
        title: "Upload failed",
        description: res.error || "Could not submit invoice.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Final Invoices
            </CardTitle>
            <CardDescription>
              Upload your final invoice for awarded MRFs. The upload opens once payment terms allow it
              (after PO sign for advance, or after delivery confirmation).
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
            <p className="text-sm">Loading…</p>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Couldn't load invoices</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : mrfs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-40" />
            <p>No awarded MRFs requiring an invoice yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mrfs.map((m) => {
              const gate = m.vendorInvoiceGate || { canSubmit: false };
              const canUpload = gate.canSubmit && !m.invoiceSubmitted;
              return (
                <div key={m.mrfId} className="rounded-md border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-medium">{m.title || `MRF ${m.mrfId}`}</p>
                      <p className="text-xs text-muted-foreground">
                        Status: {prettyState(m.workflowState)}
                        {gate.gateType && <span className="ml-2 capitalize">· Gate: {gate.gateType}</span>}
                      </p>
                    </div>
                    {m.invoiceSubmitted ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Submitted
                      </Badge>
                    ) : canUpload ? (
                      <Badge variant="secondary">Action required</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" /> Locked
                      </Badge>
                    )}
                  </div>

                  {!m.invoiceSubmitted && !canUpload && (
                    <Alert>
                      <AlertTitle>Awaiting approval</AlertTitle>
                      <AlertDescription>
                        {gate.reason ||
                          "Your quote has been received. You will be notified when you can submit your final invoice."}
                      </AlertDescription>
                    </Alert>
                  )}
                  {!m.invoiceSubmitted && canUpload && gate.reason && (
                    <p className="text-xs text-muted-foreground">{gate.reason}</p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      ref={(el) => (fileInputs.current[m.mrfId] = el)}
                      type="file"
                      accept={ACCEPTED}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        handleUpload(m.mrfId, f);
                        e.target.value = "";
                      }}
                    />
                    {m.invoiceSubmitted ? (
                      <>
                        <Badge variant="outline" className="text-[10px]">Read-only</Badge>
                        <span className="text-xs text-muted-foreground">
                          Submitted invoices cannot be replaced. Contact procurement if a correction is needed.
                        </span>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!canUpload || busyId === m.mrfId}
                        onClick={() => fileInputs.current[m.mrfId]?.click()}
                      >
                        {busyId === m.mrfId ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Upload Invoice
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">PDF, JPG or PNG. Max 10MB.</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VendorInvoicesPanel;