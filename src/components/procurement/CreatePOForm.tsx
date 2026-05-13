import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  CalendarIcon,
  ChevronDown,
  Download,
  ExternalLink,
  Loader2,
  Save,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { vendorApi } from '@/services/api';
import { procurementApi, type GeneratePOResponse } from '@/services/procurementApi';
import { describeBackendError } from '@/utils/poStatus';
import type { ApiResponse, MRF, Vendor } from '@/types';
import type {
  POFormPayload,
  POType,
  POTermsMode,
  PriceComparisonEntry,
  PriceComparisonRow,
} from '@/types/procurement';

import {
  PriceComparisonTable,
  validatePriceComparison,
  makeEmptyRow,
} from './PriceComparisonTable';
import { EmeraldPurchaseOrderPreview } from './EmeraldPurchaseOrderPreview';
import { buildEmeraldPoDisplayModel, coercePOTermsMode } from '@/utils/emeraldPoDocumentModel';
import { buildEmeraldPurchaseOrderPdf } from '@/utils/emeraldPOPdf';

export interface CreatePOFormProps {
  mrfId: string;
  /**
   * Set when opened from Purchase Orders → Create PO (manual MRF). Sends
   * `fast_track: true` on generate-po (draft + finalise).
   */
  fastTrack?: boolean;
  /**
   * When true, sends `allow_missing_rfq: true` (manual PO or MRF overview with no RFQ).
   * Often combined with {@link fastTrack}.
   */
  allowMissingRfq?: boolean;
  /** Called once the PO is finalised so the parent can close the dialog. */
  onFinalised?: (mrf: MRF) => void;
  /** Called whenever the user wants to close (Cancel / X). */
  onRequestClose: () => void;
}

const BLOCKED_EMAIL = 'douglas.anuforo@emeraldcfze.com';
const DEFAULT_INVOICE_TO = 'accountpayables@emeraldcfze.com';
const DEFAULT_INVOICE_CC = 'lateef.olanrewaju@emeraldcfze.com';
const PO_TYPES: { value: POType; label: string }[] = [
  { value: 'goods', label: 'Goods' },
  { value: 'services', label: 'Services' },
  { value: 'logistics', label: 'Logistics' },
];

interface FormState {
  po_type: POType;
  po_date: Date | undefined;
  delivery_date: Date | undefined;
  ship_to_address: string;
  payment_terms: string;
  tax_rate: string;
  invoice_submission_email: string;
  invoice_submission_cc: string;
  terms_mode: POTermsMode;
  custom_terms: string;
  remarks: string;
}

const initialState = (): FormState => ({
  po_type: 'goods',
  po_date: new Date(),
  delivery_date: undefined,
  ship_to_address: '',
  payment_terms: '',
  tax_rate: '',
  invoice_submission_email: DEFAULT_INVOICE_TO,
  invoice_submission_cc: DEFAULT_INVOICE_CC,
  terms_mode: 'standard',
  custom_terms: '',
  remarks: '',
});

const isValidEmail = (e: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** Coerce a backend price-comparison row into the local editable shape. */
const hydrateRow = (e: PriceComparisonEntry): PriceComparisonRow => ({
  _key:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `row_${Math.random().toString(36).slice(2)}`,
  vendor_id: e.vendor_id,
  manual_vendor: e.manual_vendor,
  item_description: e.item_description ?? '',
  unit_price: typeof e.unit_price === 'string' ? Number(e.unit_price) || '' : e.unit_price,
  quantity: typeof e.quantity === 'string' ? Number(e.quantity) || '' : e.quantity,
  is_selected: Boolean(e.is_selected),
  selection_reason: e.selection_reason ?? '',
});
  is_selected: Boolean(e.is_selected),
  selection_reason: e.selection_reason ?? '',
});

export function CreatePOForm({
  mrfId,
  fastTrack = false,
  allowMissingRfq = false,
  onFinalised,
  onRequestClose,
}: CreatePOFormProps) {
  // ---------- workflow selection ----------
  const [workflow, setWorkflow] = useState<'standard' | 'manual'>(
    fastTrack ? 'manual' : 'standard'
  );

  // ---------- hydration ----------
  const [hydrating, setHydrating] = useState(true);
  const [hydrateSlow, setHydrateSlow] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);

  const [mrf, setMrf] = useState<MRF | null>(null);
  const [form, setForm] = useState<FormState>(initialState());
  const [rows, setRows] = useState<PriceComparisonRow[]>([
    makeEmptyRow(),
    makeEmptyRow(),
  ]);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // ---------- T&C template ----------
  const [standardTerms, setStandardTerms] = useState('');
  const [termsLoading, setTermsLoading] = useState(false);
  const [termsMissing, setTermsMissing] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);

  // ---------- save state ----------
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingMode, setSavingMode] = useState<'draft' | 'finalise' | 'auto' | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const lastManualSaveRef = useRef<number>(0);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  // ---------- review + cancel ----------
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [finalisedMrf, setFinalisedMrf] = useState<MRF | null>(null);
  /** Mirrors `data.fast_tracked` from generate-po when the PO tab fast-track path was used. */
  const [finalisedFastTracked, setFinalisedFastTracked] = useState(false);

  useEffect(() => {
    setFinalisedFastTracked(false);
  }, [mrfId]);

  // -------------------------------------------------------------------------
  // Hydrate MRF + price comparison
  // -------------------------------------------------------------------------
  const hydrate = useCallback(async () => {
    setHydrating(true);
    setHydrateSlow(false);
    setHydrateError(null);
    const slowTimer = window.setTimeout(() => setHydrateSlow(true), 15000);
    try {
      const [mrfRes, pcRes] = await Promise.all([
        procurementApi.getMRFForPO(mrfId),
        procurementApi.getPriceComparison(mrfId),
      ]);
      if (!mrfRes.success || !mrfRes.data) {
        setHydrateError(mrfRes.error || 'Failed to load MRF.');
        return;
      }
      const m = mrfRes.data as MRF & {
        po_special_terms?: string;
        ship_to_address?: string;
        tax_rate?: number | string | null;
        invoice_submission_email?: string;
        invoice_submission_cc?: string;
        custom_terms?: string;
        remarks?: string;
        po_draft_saved_at?: string | null;
        is_po_draft?: boolean;
        priceComparisons?: PriceComparisonEntry[];
      };
      setMrf(m);
      setForm((prev) => ({
        ...prev,
        ship_to_address: m.ship_to_address ?? prev.ship_to_address,
        tax_rate:
          m.tax_rate === null || m.tax_rate === undefined || m.tax_rate === ''
            ? ''
            : String(m.tax_rate),
        invoice_submission_email:
          m.invoice_submission_email || prev.invoice_submission_email,
        invoice_submission_cc:
          m.invoice_submission_cc || prev.invoice_submission_cc,
        terms_mode: coercePOTermsMode(
          (m as { terms_mode?: string; termsMode?: string }).terms_mode ??
            (m as { terms_mode?: string; termsMode?: string }).termsMode,
        ),
        custom_terms: m.custom_terms ?? prev.custom_terms,
        remarks: m.remarks ?? prev.remarks,
      }));
      setDraftSavedAt(m.po_draft_saved_at ?? null);

      const incoming = pcRes.success && pcRes.data ? pcRes.data : m.priceComparisons;
      if (Array.isArray(incoming) && incoming.length > 0) {
        setRows(incoming.map(hydrateRow));
      }
    } catch (err) {
      setHydrateError(err instanceof Error ? err.message : 'Failed to load MRF.');
    } finally {
      window.clearTimeout(slowTimer);
      setHydrating(false);
    }
  }, [mrfId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // -------------------------------------------------------------------------
  // Vendors (full /api/vendors list — PC table is broader than RFQ vendors)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoadingVendors(true);
    vendorApi
      .getAll()
      .then((res: ApiResponse<Vendor[]>) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          setVendors(res.data.filter((v) => v.status === 'Active' || v.status === 'Pending'));
        }
      })
      .finally(() => !cancelled && setLoadingVendors(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------------------------
  // T&C template (refetch on po_type change)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setTermsLoading(true);
    setTermsError(null);
    setTermsMissing(false);
    procurementApi
      .getPOTermsTemplate(form.po_type)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          if (res.status === 404) {
            setTermsMissing(true);
            setStandardTerms('');
          } else {
            setTermsError(res.error || 'Could not load standard terms.');
          }
          return;
        }
        const data = res.data;
        setStandardTerms(data?.content ?? data?.standard_terms ?? '');
      })
      .finally(() => !cancelled && setTermsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [form.po_type]);

  // -------------------------------------------------------------------------
  // Form helpers / derived state
  // -------------------------------------------------------------------------
  const isDraft =
    Boolean((mrf as MRF & { is_po_draft?: boolean })?.is_po_draft) ||
    !mrf?.po_number;
  const isFinalised = Boolean(finalisedMrf?.po_number || mrf?.po_number);

  const ccBlocked =
    form.invoice_submission_cc.trim().toLowerCase() === BLOCKED_EMAIL.toLowerCase();

  const ccInvalid =
    form.invoice_submission_cc.trim().length > 0 && !isValidEmail(form.invoice_submission_cc);

  const termsModeCustomInvalid =
    form.terms_mode === 'custom' && !form.custom_terms.trim();

  const toInvalid =
    form.invoice_submission_email.trim().length > 0 &&
    !isValidEmail(form.invoice_submission_email);

  const pcErrors = useMemo(
    () => validatePriceComparison(rows, vendors),
    [rows, vendors]
  );

  const section1Valid =
    !!form.po_date &&
    !!form.delivery_date &&
    !!form.ship_to_address.trim() &&
    !!form.payment_terms.trim() &&
    !ccBlocked &&
    !ccInvalid &&
    !toInvalid &&
    !termsMissing &&
    !termsError &&
    !termsModeCustomInvalid;

  const canFinalise =
    section1Valid &&
    pcErrors.length === 0 &&
    !isSaving &&
    !finalisedMrf;

  const hasAnyInput =
    form.ship_to_address.trim() ||
    form.payment_terms.trim() ||
    form.custom_terms.trim() ||
    form.remarks.trim() ||
    form.tax_rate.trim() ||
    rows.some((r) => r.vendor_id || r.item_description.trim() || r.unit_price || r.quantity);

  // Mark dirty whenever inputs change (after hydrate completes)
  useEffect(() => {
    if (hydrating) return;
    dirtyRef.current = true;
  }, [form, rows, hydrating]);

  // -------------------------------------------------------------------------
  // Build the PO payload from form state.
  // Per spec: delivery date appended to remarks, payment terms appended to custom_terms.
  // -------------------------------------------------------------------------
  const buildPayload = useCallback((): POFormPayload => {
    const remarksPieces: string[] = [];
    if (form.delivery_date)
      remarksPieces.push(`Delivery / Service Date: ${format(form.delivery_date, 'yyyy-MM-dd')}`);
    if (form.remarks.trim()) remarksPieces.push(form.remarks.trim());

    const customPieces: string[] = [];
    if (form.payment_terms.trim())
      customPieces.push(`Payment Terms: ${form.payment_terms.trim()}`);
    if (form.custom_terms.trim()) customPieces.push(form.custom_terms.trim());

    const base: POFormPayload = {
      po_type: form.po_type,
      ship_to_address: form.ship_to_address.trim() || undefined,
      tax_rate: form.tax_rate ? Number(form.tax_rate) : undefined,
      invoice_submission_email: form.invoice_submission_email.trim() || undefined,
      invoice_submission_cc: form.invoice_submission_cc.trim() || undefined,
      terms_mode: form.terms_mode,
      custom_terms: customPieces.join('\n\n') || undefined,
      remarks: remarksPieces.join('\n\n') || undefined,
    };

    if (fastTrack) base.fast_track = true;
    if (allowMissingRfq) {
      base.allow_missing_rfq = true;
      if (form.payment_terms.trim()) {
        base.payment_terms = form.payment_terms.trim();
      }
      if (form.delivery_date) {
        base.delivery_date = format(form.delivery_date, 'yyyy-MM-dd');
      }
    }

    return base;
  }, [form, fastTrack, allowMissingRfq]);

  const emeraldPreviewModel = useMemo(() => {
    if (!mrf) return null;
    const payload = buildPayload();
    const merged = {
      ...mrf,
      ship_to_address:
        form.ship_to_address.trim() ||
        (mrf as MRF & { ship_to_address?: string }).ship_to_address,
      tax_rate:
        form.tax_rate.trim() === ''
          ? (mrf as MRF & { tax_rate?: number | string }).tax_rate
          : Number(form.tax_rate),
      invoice_submission_email: form.invoice_submission_email.trim() || undefined,
      invoice_submission_cc: form.invoice_submission_cc.trim() || undefined,
      custom_terms: payload.custom_terms ?? (mrf as MRF & { custom_terms?: string }).custom_terms,
      remarks: payload.remarks ?? (mrf as MRF & { remarks?: string }).remarks,
      po_number:
        (finalisedMrf?.po_number ||
          finalisedMrf?.poNumber ||
          mrf.po_number ||
          mrf.poNumber ||
          'DRAFT') as string,
    } as MRF & { ship_to_address?: string; tax_rate?: number | string; custom_terms?: string };
    return buildEmeraldPoDisplayModel({
      mrf: merged,
      rows,
      vendors,
      standardTermsBody: standardTerms,
      terms_mode: form.terms_mode,
      user_terms_text: form.custom_terms.trim() || undefined,
      includeSignature: false,
      poDate: form.po_date,
      approvalDate: form.po_date ?? new Date(),
    });
  }, [
    mrf,
    form,
    rows,
    vendors,
    standardTerms,
    finalisedMrf,
    buildPayload,
  ]);

  const downloadEmeraldPreviewPdf = useCallback(async () => {
    if (!emeraldPreviewModel) return;
    try {
      const blob = await buildEmeraldPurchaseOrderPdf(emeraldPreviewModel);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const num =
        finalisedMrf?.po_number ||
        finalisedMrf?.poNumber ||
        mrf?.po_number ||
        mrf?.poNumber ||
        mrfId;
      a.href = url;
      a.download = `PO-${num}-emerald-layout.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build PDF');
    }
  }, [emeraldPreviewModel, finalisedMrf, mrf, mrfId]);

  // -------------------------------------------------------------------------
  // Save flows
  // -------------------------------------------------------------------------
  const acquireLock = (mode: 'draft' | 'finalise' | 'auto'): boolean => {
    if (isSavingRef.current) return false;
    isSavingRef.current = true;
    setIsSaving(true);
    setSavingMode(mode);
    return true;
  };

  const releaseLock = () => {
    isSavingRef.current = false;
    setIsSaving(false);
    setSavingMode(null);
  };

  const saveDraft = useCallback(async () => {
    if (!acquireLock('draft')) return;
    try {
      // (a) Send current PC when valid or when not using vendor-override shortcut.
      const pcInvalid = validatePriceComparison(rows, vendors).length > 0;
      const skipPcPersist =
        allowMissingRfq && overrideVendorSufficient && pcInvalid;
      if (!skipPcPersist) {
        const pcRes = await procurementApi.savePriceComparison(mrfId, rows);
        if (!pcRes.success) {
          toast.warning('Price comparison not saved', {
            description: pcRes.error || 'You can fix it before generating the PO.',
          });
        }
      }
      // (b) Save PO draft regardless
      const draftRes = await procurementApi.savePODraft(mrfId, buildPayload());
      if (!draftRes.success) {
        toast.error('Draft save failed', {
          description: draftRes.error || 'Please try again.',
        });
        return;
      }
      const stamp = (draftRes.data?.mrf as { po_draft_saved_at?: string } | undefined)
        ?.po_draft_saved_at;
      setDraftSavedAt(stamp ?? new Date().toISOString());
      setMrf((prev) => (prev && draftRes.data?.mrf ? { ...prev, ...draftRes.data.mrf } : prev));
      dirtyRef.current = false;
      lastManualSaveRef.current = Date.now();
      toast.success('Draft saved.');
    } catch (err) {
      toast.error('Draft save failed', {
        description: err instanceof Error ? err.message : 'Unexpected error.',
      });
    } finally {
      releaseLock();
    }
  }, [mrfId, rows, buildPayload, vendors]);

  const finalisePO = useCallback(async () => {
    if (!acquireLock('finalise')) return;
    try {
      const pcRes = await procurementApi.savePriceComparison(mrfId, rows);
      if (!pcRes.success) {
        toast.error('Could not save price comparison', {
          description: pcRes.error || 'Fix the errors and try again.',
        });
        return;
      }
      const finalRes = await procurementApi.finalisePO(mrfId, buildPayload());
      if (!finalRes.success || !finalRes.data?.mrf) {
        toast.error('PO generation failed', {
          description: describeBackendError(finalRes.raw, finalRes.error || 'Please try again.'),
        });
        return;
      }
      const newMrf = finalRes.data.mrf;
      const gen = finalRes.data as GeneratePOResponse;
      const wf = String(
        (newMrf as MRF & { workflow_state?: string }).workflow_state ||
          (newMrf as MRF & { workflowState?: string }).workflowState ||
          newMrf.status ||
          '',
      ).toLowerCase();
      const fastTrackedSuccess = Boolean(
        gen.fast_tracked ??
          gen.fastTracked ??
          wf === 'awaiting_scd_signature',
      );
      setFinalisedFastTracked(fastTrackedSuccess);
      setFinalisedMrf(newMrf);
      const poNumber = newMrf.po_number || newMrf.poNumber || '—';
      toast.success(`PO ${poNumber} generated`, {
        description: fastTrackedSuccess
          ? 'Fast-track: awaiting Supply Chain Director signature (executive review skipped).'
          : 'Routed to the Supply Chain Director for signature.',
      });
      onFinalised?.(newMrf);
    } catch (err) {
      toast.error('PO generation failed', {
        description: err instanceof Error ? err.message : 'Unexpected error.',
      });
    } finally {
      releaseLock();
    }
  }, [mrfId, rows, buildPayload, onFinalised, vendors]);

  // -------------------------------------------------------------------------
  // Autosave — debounced 3s, draft mode only, lock-protected,
  // paused 5s after manual save, skipped on validation failure.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (hydrating || isFinalised) return;
    if (!dirtyRef.current) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (isSavingRef.current) return;
      if (Date.now() - lastManualSaveRef.current < 5000) return;
      // Gate: autosave when PC is valid (prevents 422 spam).
      const pcInvalid = validatePriceComparison(rows, vendors).length > 0;
      if (pcInvalid) return;
      // Run as auto save (uses same draft path).
      void (async () => {
        if (!acquireLock('auto')) return;
        try {
          const pcRes = await procurementApi.savePriceComparison(mrfId, rows);
          if (!pcRes.success) return;
          const draftRes = await procurementApi.savePODraft(mrfId, buildPayload());
          if (draftRes.success) {
            const stamp = (draftRes.data?.mrf as { po_draft_saved_at?: string } | undefined)
              ?.po_draft_saved_at;
            setDraftSavedAt(stamp ?? new Date().toISOString());
            dirtyRef.current = false;
          }
        } catch {
          // swallow autosave failures
        } finally {
          releaseLock();
        }
      })();
    }, 3000);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [form, rows, vendors, hydrating, isFinalised, mrfId, buildPayload]);

  // -------------------------------------------------------------------------
  // Render — loading skeleton
  // -------------------------------------------------------------------------
  if (hydrating) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-24" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-40" />
        {hydrateSlow && (
          <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs flex items-center justify-between">
            <span>Backend slow to respond — still loading.</span>
            <Button variant="outline" size="sm" onClick={() => void hydrate()}>
              Retry
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (hydrateError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
        <div className="flex items-center gap-2 font-medium text-destructive">
          <AlertCircle className="h-4 w-4" />
          Could not load MRF
        </div>
        <p className="text-muted-foreground">{hydrateError}</p>
        <Button variant="outline" size="sm" onClick={() => void hydrate()}>
          Retry
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render — form
  // -------------------------------------------------------------------------
  const finalisedUrl =
    finalisedMrf?.unsigned_po_url ||
    finalisedMrf?.unsignedPOUrl ||
    mrf?.unsigned_po_url ||
    mrf?.unsignedPOUrl;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden pr-1 pb-1">
      {/* Progress chip + draft banner */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">PO Details</Badge>
          <span>→</span>
          <Badge variant="secondary">Price Comparison</Badge>
          <span>→</span>
          <Badge variant="secondary">Review &amp; Submit</Badge>
        </div>
        {isDraft && draftSavedAt && (
          <Badge variant="outline" className="text-xs">
            Draft last saved {formatDistanceToNow(new Date(draftSavedAt), { addSuffix: true })}
          </Badge>
        )}
      </div>

      {fastTrack && !isFinalised && (
        <div className="rounded-md border border-primary/35 bg-primary/5 px-3 py-2 text-xs text-muted-foreground leading-snug">
          <span className="font-medium text-foreground">Fast-track: complete the price comparison</span>
          {' — '}
          You can add suppliers not yet in the directory from the price comparison step. After completion,
          Procurement will route the PO to the Supply Chain Director for signature.
        </div>
      )}

      {allowMissingRfq && !isFinalised && (
        <div className="rounded-md border border-muted-foreground/25 bg-muted/30 px-3 py-2 text-xs text-muted-foreground leading-snug">
          <span className="font-medium text-foreground">allow_missing_rfq</span>
          {' — '}
          The generate-po request includes{' '}
          <span className="font-medium text-foreground">allow_missing_rfq: true</span>
          {fastTrack ? (
            <>
              {' '}
              and <span className="font-medium text-foreground">fast_track: true</span>
            </>
          ) : null}{' '}
          so the backend can proceed without an RFQ when appropriate.
        </div>
      )}

      {/* ============== SECTION 1 — PO Details ============== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">1. PO Details</h3>
          <Badge variant="outline">MRF: {mrf?.formatted_id || mrf?.id || mrfId}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>PO Type *</Label>
            <Select
              value={form.po_type}
              onValueChange={(v) => setForm((s) => ({ ...s, po_type: v as POType }))}
              disabled={isFinalised}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                {PO_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Vendor (from approved quotation)</Label>
            <Input
              value={mrf?.requester ? '' : ''}
              placeholder="Resolved server-side from the approved quotation"
              readOnly
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label>PO Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start font-normal', !form.po_date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.po_date ? format(form.po_date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <Calendar mode="single" selected={form.po_date} onSelect={(d) => setForm((s) => ({ ...s, po_date: d ?? undefined }))} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Delivery / Service Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start font-normal', !form.delivery_date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.delivery_date ? format(form.delivery_date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <Calendar mode="single" selected={form.delivery_date} onSelect={(d) => setForm((s) => ({ ...s, delivery_date: d ?? undefined }))} initialFocus disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ship-to">Ship-to / Delivery Address *</Label>
            <Input id="ship-to" value={form.ship_to_address} onChange={(e) => setForm((s) => ({ ...s, ship_to_address: e.target.value }))} placeholder="e.g. Lekki HQ, Lagos" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-terms">Payment Terms *</Label>
            <Input id="payment-terms" value={form.payment_terms} onChange={(e) => setForm((s) => ({ ...s, payment_terms: e.target.value }))} placeholder="e.g. Net 30 Days" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax-rate">Tax Rate (%)</Label>
            <Input id="tax-rate" type="number" min="0" step="0.01" value={form.tax_rate} onChange={(e) => setForm((s) => ({ ...s, tax_rate: e.target.value }))} placeholder="e.g. 7.5" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-to">Invoice Submission Email (To)</Label>
            <Input id="invoice-to" type="email" value={form.invoice_submission_email} onChange={(e) => setForm((s) => ({ ...s, invoice_submission_email: e.target.value }))} aria-invalid={toInvalid} />
            {toInvalid && <p className="text-xs text-destructive">Enter a valid email address.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-cc">CC Email *</Label>
            <Input id="invoice-cc" type="email" value={form.invoice_submission_cc} onChange={(e) => setForm((s) => ({ ...s, invoice_submission_cc: e.target.value }))} aria-invalid={ccBlocked || ccInvalid} />
            {ccBlocked && <p className="text-xs text-destructive">This email address is not allowed in the CC field.</p>}
            {ccInvalid && !ccBlocked && <p className="text-xs text-destructive">Enter a valid email address.</p>}
          </div>
        </div>

        {/* T&C */}
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Terms &amp; Conditions</Label>
            {termsLoading && (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading…
              </span>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Terms on generated PO</Label>
            <ToggleGroup
              type="single"
              value={form.terms_mode}
              onValueChange={(v) => {
                if (v) setForm((s) => ({ ...s, terms_mode: v as POTermsMode }));
              }}
              disabled={isFinalised}
              variant="outline"
              className="flex w-full flex-wrap justify-stretch gap-1 sm:flex-nowrap"
            >
              <ToggleGroupItem value="standard" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
                Standard only
              </ToggleGroupItem>
              <ToggleGroupItem value="custom" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
                My terms only
              </ToggleGroupItem>
              <ToggleGroupItem value="both" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
                Both
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Standard uses the template below. My terms uses only your additional text (required).
              Both includes the template and your text. Payment terms above are always sent.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Standard Terms (read-only)</Label>
            {termsMissing ? (
              <div className="rounded-md border border-warning/40 bg-warning/5 p-2 text-xs text-warning-foreground">
                No standard T&amp;C template configured for this PO type. Contact admin.
              </div>
            ) : termsError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                {termsError}
              </div>
            ) : (
              <Textarea value={standardTerms} readOnly rows={4} className="bg-background/60 text-xs" placeholder={termsLoading ? 'Loading…' : 'No standard terms configured'} />
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="custom-terms" className="text-xs text-muted-foreground">
              Additional custom terms
              {form.terms_mode === 'custom' ? ' (required)' : ' (optional)'}
            </Label>
            <Textarea
              id="custom-terms"
              rows={3}
              value={form.custom_terms}
              onChange={(e) => setForm((s) => ({ ...s, custom_terms: e.target.value }))}
              placeholder="Add any PO-specific terms here…"
              className={cn('text-xs', termsModeCustomInvalid && 'border-destructive')}
              disabled={isFinalised}
            />
            {termsModeCustomInvalid && (
              <p className="text-xs text-destructive">Enter your custom terms when using &quot;My terms only&quot;.</p>
            )}
            {form.terms_mode === 'standard' && form.custom_terms.trim() && (
              <p className="text-[11px] text-muted-foreground">
                Text here is still saved with your draft and sent to the server, but the preview uses
                standard-only until you switch to Both or My terms.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="remarks">Additional Notes</Label>
          <Textarea id="remarks" rows={2} value={form.remarks} onChange={(e) => setForm((s) => ({ ...s, remarks: e.target.value }))} placeholder="Special instructions, shipping requirements, etc." />
        </div>
      </section>

      {/* ============== SECTION 2 — Price Comparison ============== */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">2. Price Comparison Sheet</h3>
        <PriceComparisonTable
          value={rows}
          onChange={setRows}
          vendors={vendors}
          loadingVendors={loadingVendors}
          disabled={isFinalised}
        />
      </section>

      {/* ============== SECTION 3 — Review & Submit ============== */}
      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setReviewOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', reviewOpen && 'rotate-180')} />
          3. Review before submitting
        </button>
        {reviewOpen && (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">PO Type</dt>
              <dd className="font-medium capitalize">{form.po_type}</dd>
              <dt className="text-muted-foreground">PO Date</dt>
              <dd>{form.po_date ? format(form.po_date, 'PPP') : '—'}</dd>
              <dt className="text-muted-foreground">Delivery Date</dt>
              <dd>{form.delivery_date ? format(form.delivery_date, 'PPP') : '—'}</dd>
              <dt className="text-muted-foreground">Ship-to</dt>
              <dd>{form.ship_to_address || '—'}</dd>
              <dt className="text-muted-foreground">Payment Terms</dt>
              <dd>{form.payment_terms || '—'}</dd>
              <dt className="text-muted-foreground">Tax Rate</dt>
              <dd>{form.tax_rate ? `${form.tax_rate}%` : '—'}</dd>
              <dt className="text-muted-foreground">Invoice To</dt>
              <dd>{form.invoice_submission_email}</dd>
              <dt className="text-muted-foreground">CC</dt>
              <dd>{form.invoice_submission_cc}</dd>
              <dt className="text-muted-foreground">Terms on PO</dt>
              <dd className="capitalize">
                {form.terms_mode === 'standard'
                  ? 'Standard only'
                  : form.terms_mode === 'custom'
                    ? 'My terms only'
                    : 'Standard + custom (both)'}
              </dd>
            </dl>
            <div className="border-t pt-2">
              <p className="text-xs font-medium mb-1">Comparison ({rows.length} suppliers)</p>
              <ul className="text-xs space-y-1">
                {rows.map((r, i) => {
                  const vendorName = r.manual_vendor?.name
                    ? r.manual_vendor.name
                    : r.vendor_id || '—';
                  return (
                    <li key={r._key} className={cn('flex justify-between', r.is_selected && 'font-semibold text-success')}>
                      <span>{i + 1}. {vendorName} · {r.item_description || '—'}</span>
                      <span className="tabular-nums">₦{((Number(r.unit_price) || 0) * (Number(r.quantity) || 0)).toLocaleString()}{r.is_selected && ' ✓'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {emeraldPreviewModel && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold">Purchase Order — Emerald layout (preview)</p>
                <p className="text-[11px] text-muted-foreground">
                  Matches the standard company PO format. The system PDF after you generate may differ until the server template is updated; use this preview and download for a consistent layout.
                </p>
                <div className="max-h-[min(520px,70vh)] overflow-y-auto rounded-md border bg-muted/40 p-2">
                  <EmeraldPurchaseOrderPreview model={emeraldPreviewModel} />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void downloadEmeraldPreviewPdf()}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download PDF (Emerald layout)
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ============== Finalised banner ============== */}
      {isFinalised && finalisedUrl && (
        <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span>
              PO <strong>{finalisedMrf?.po_number || finalisedMrf?.poNumber || mrf?.po_number}</strong> generated.
            </span>
            <a href={finalisedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline flex-shrink-0">
              <ExternalLink className="h-3.5 w-3.5" /> Open PDF
            </a>
          </div>
          {finalisedFastTracked && (
            <p className="text-xs text-muted-foreground border-t border-success/25 pt-2">
              <span className="font-medium text-foreground">SCD signature pending</span>
              {' — '}Executive review was skipped. The Supply Chain Director signs via the dashboard or uploads the signed PO; completion matches the regular flow after signature.
            </p>
          )}
        </div>
      )}

      </div>

      {/* Footer actions — fixed below scroll area so fields are never covered */}
      <div className="mt-2 flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="text-xs text-muted-foreground">
          {isSaving && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {savingMode === 'auto' ? 'Autosaving…' : savingMode === 'finalise' ? 'Generating PO…' : 'Saving draft…'}
            </span>
          )}
          {!isSaving && draftSavedAt && (
            <span>Saved {formatDistanceToNow(new Date(draftSavedAt), { addSuffix: true })}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isFinalised && finalisedUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={finalisedUrl} target="_blank" rel="noreferrer">
                <Download className="h-3.5 w-3.5 mr-1" />
                Download PDF
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (hasAnyInput && !isFinalised) setConfirmCancelOpen(true);
              else onRequestClose();
            }}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => void saveDraft()}
            disabled={isSaving || !hasAnyInput || isFinalised}
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            Save as Draft
          </Button>
          <Button
            onClick={() => void finalisePO()}
            disabled={!canFinalise}
            title={!canFinalise && !isSaving ? 'Complete all PO details and add at least 2 supplier quotes with one selected before generating.' : undefined}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {fastTrack ? 'Generate & route to SCD (fast-track)' : 'Generate & Route for Approval'}
          </Button>
        </div>
      </div>

      {/* Cancel confirmation */}
      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved input on this PO. Save it as a draft, discard your changes, or keep editing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Continue editing</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={async () => {
                setConfirmCancelOpen(false);
                await saveDraft();
                onRequestClose();
              }}
              disabled={isSaving}
            >
              Save as Draft
            </Button>
            <AlertDialogAction
              onClick={() => {
                setConfirmCancelOpen(false);
                onRequestClose();
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}