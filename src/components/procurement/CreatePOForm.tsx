import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  CalendarIcon,
  ChevronDown,
  Download,
  ExternalLink,
  Loader2,
  PencilLine,
  Save,
  Send,
  Paperclip,
  Trash2,
  UploadCloud,
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
import { procurementApi, type GeneratePOResponse, type ResolvedVendorEntry } from '@/services/procurementApi';
import { describeBackendError } from '@/utils/poStatus';
import { pollForGeneratedPO, isPoReady } from '@/utils/pollPoGeneration';
import type { ApiResponse, MRF, Vendor } from '@/types';
import type {
  POFormPayload,
  POType,
  POTermsMode,
  PriceComparisonEntry,
  PriceComparisonRow,
} from '@/types/procurement';
import type {
  ProcurementDocumentType,
  UploadProcurementDocumentPayload,
} from '@/types/procurement-documents';

import {
  PriceComparisonTable,
  validatePriceComparison,
  makeEmptyRow,
} from './PriceComparisonTable';
import { EmeraldPurchaseOrderPreview } from './EmeraldPurchaseOrderPreview';
import { buildEmeraldPoDisplayModel, coercePOTermsMode, parseDeliveryDateFromRemarks, parsePaymentTermsFromCustomTerms, resolveSelectedSupplier, userClausesFromStoredCustomTerms, userRemarksFromStored } from '@/utils/emeraldPoDocumentModel';
import { previewPoNumber } from '@/utils/poNumber';
import {
  formatPoAmount,
  normalizeCurrencyCode,
  PO_CURRENCY_OPTIONS,
} from '@/utils/currency';
import { buildEmeraldPurchaseOrderPdf } from '@/utils/emeraldPOPdf';
import { openEmeraldPurchaseOrderPdfInNewTab } from '@/utils/emeraldPoPdfActions';
import {
  PaymentMilestoneBuilder,
  serializePaymentMilestones,
  type PaymentMilestoneInput,
} from '@/components/payments/PaymentMilestoneBuilder';

export interface CreatePOFormProps {
  mrfId: string;
  /**
   * When true, generate-po sends `fast_track: true` so the PO skips executive distribution
   * and is routed to the Supply Chain Director for signature (urgent / direct procurement).
   */
  fastTrack?: boolean;
  /**
   * When true, generate-po sends `allow_missing_rfq: true` so the backend can finalise without
   * a linked RFQ / quotation record (same use case as fast-track; often set together).
   */
  allowMissingRfq?: boolean;
  /** Called once the PO is finalised so the parent can close the dialog. */
  onFinalised?: (mrf: MRF) => void;
  /** Called after a PO draft is saved so the parent can refresh the PO list. */
  onDraftSaved?: (mrf: MRF) => void;
  /** Called whenever the user wants to close (Cancel / X). */
  onRequestClose: () => void;
  /**
   * When true and the MRF is already finalised, the form opens directly in edit
   * mode (unlocked for changes) instead of showing the read-only finalised view.
   * Used by the "Edit PO" entry point in the Purchase Orders list.
   */
  initialEditMode?: boolean;
}

const BLOCKED_EMAIL = 'douglas.anuforo@emeraldcfze.com';
const DEFAULT_INVOICE_TO = 'accountpayables@emeraldcfze.com';
const PROCUREMENT_CC = 'procurement@emeraldcfze.com';
const DEFAULT_INVOICE_CC = `lateef.olanrewaju@emeraldcfze.com, ${PROCUREMENT_CC}`;

/** Ensure procurement is always on the invoice CC list. */
function ensureProcurementCc(cc: string | null | undefined): string {
  const parts = String(cc || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lower = new Set(parts.map((p) => p.toLowerCase()));
  if (!lower.has(PROCUREMENT_CC)) {
    parts.push(PROCUREMENT_CC);
  }
  return parts.join(', ') || DEFAULT_INVOICE_CC;
}
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
  currency: string;
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
  currency: 'NGN',
  invoice_submission_email: DEFAULT_INVOICE_TO,
  invoice_submission_cc: DEFAULT_INVOICE_CC,
  terms_mode: 'standard',
  custom_terms: '',
  remarks: '',
});

const isValidEmail = (e: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** CC may be a comma/semicolon-separated list of emails. */
const isValidEmailList = (value: string) => {
  const parts = value
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return true;
  return parts.every(isValidEmail);
};

const emailListContains = (value: string, target: string) =>
  value
    .split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(target.trim().toLowerCase());

/** Summarise backend vendor resolution from generate-po for the success toast. */
function formatResolvedVendorsSummary(entries: ResolvedVendorEntry[]): string | undefined {
  if (!entries.length) return undefined;
  return entries
    .map((r) => {
      const label = r.input?.name || r.input?.email || 'Supplier';
      const id = r.vendorId || r.vendor_id;
      const idPart = id ? ` (${id})` : '';
      const statusPart =
        r.status && r.status !== 'Active' ? ` — status: ${r.status}` : '';
      if (r.action === 'linked_existing') {
        return `Linked to existing vendor ${label}${idPart}${statusPart}.`;
      }
      const sent = r.onboardingEmailSent ?? r.onboarding_email_sent;
      return `New vendor ${label}${idPart}${sent ? ' — portal onboarding email sent' : ''}${statusPart}.`;
    })
    .join(' ');
}

/**
 * Coerce a backend price-comparison row into the local editable shape.
 * `groupKey` is passed in so multiple rows sharing the same supplier identity
 * snap into the same supplier card in the new card-based UI.
 */
const hydrateRow = (
  e: PriceComparisonEntry,
  groupKey: string,
): PriceComparisonRow => ({
  _key:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `row_${Math.random().toString(36).slice(2)}`,
  group_key: groupKey,
  vendor_id: e.vendor_id,
  manual_vendor: e.manual_vendor,
  item_description: e.item_description ?? '',
  unit_price: typeof e.unit_price === 'string' ? Number(e.unit_price) || '' : e.unit_price,
  quantity: typeof e.quantity === 'string' ? Number(e.quantity) || '' : e.quantity,
  is_selected: Boolean(e.is_selected),
  selection_reason: e.selection_reason ?? '',
});

/** Group hydrated rows by supplier identity so they map to one card each. */
const groupKeyFor = (e: PriceComparisonEntry): string => {
  if (e.vendor_id) return `v:${String(e.vendor_id)}`;
  const name = (e.manual_vendor?.name ?? e.vendor_name ?? '').trim().toLowerCase();
  return name ? `m:${name}` : `r:${Math.random().toString(36).slice(2)}`;
};

export function CreatePOForm({
  mrfId,
  fastTrack = false,
  allowMissingRfq = false,
  onFinalised,
  onDraftSaved,
  onRequestClose,
  initialEditMode = false,
}: CreatePOFormProps) {
  /** Urgent / direct procurement: Purchase Orders tab or “no RFQ” path — still uses full price comparison, not vendor-ID shortcuts. */
  const isDirectProcurement = fastTrack || allowMissingRfq;

  // ---------- hydration ----------
  const [hydrating, setHydrating] = useState(true);
  const [hydrateSlow, setHydrateSlow] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);

  const [mrf, setMrf] = useState<MRF | null>(null);
  const [form, setForm] = useState<FormState>(initialState());
  const [rows, setRows] = useState<PriceComparisonRow[]>(() => [
    makeEmptyRow({ supplierMode: fastTrack || allowMissingRfq ? 'manual' : 'directory' }),
  ]);

  const [paymentMilestones, setPaymentMilestones] = useState<PaymentMilestoneInput[]>([]);
  const [paymentMilestonesValid, setPaymentMilestonesValid] = useState(true);

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
  /**
   * Autosave runs in the background and must NEVER block user input or
   * disable the manual save / generate buttons. It's tracked separately so
   * the "Save as Draft" / "Generate & Route" buttons stay enabled while it
   * flushes.
   */
  const isAutoSavingRef = useRef(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // ---------- optional PO document attachments (create + update) ----------
  type PendingPoDoc = {
    key: string;
    file: File;
    type: ProcurementDocumentType;
    remarks: string;
  };
  const PO_DOC_TYPES: { value: ProcurementDocumentType; label: string }[] = [
    { value: 'pfi', label: 'Proforma Invoice (PFI)' },
    { value: 'vendor_invoice', label: 'Vendor Invoice' },
    { value: 'waybill', label: 'Waybill' },
    { value: 'jcc', label: 'JCC' },
    { value: 'delivery_confirmation', label: 'Delivery Confirmation' },
    { value: 'other', label: 'Other' },
  ];
  const MAX_PO_DOC_BYTES = 20 * 1024 * 1024;
  const [pendingDocs, setPendingDocs] = useState<PendingPoDoc[]>([]);
  const poDocInputRef = useRef<HTMLInputElement | null>(null);
  const addPendingDocs = (files: FileList | File[]) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const accepted: PendingPoDoc[] = [];
    let skipped = 0;
    for (const f of list) {
      if (f.size > MAX_PO_DOC_BYTES) {
        skipped += 1;
        continue;
      }
      accepted.push({
        key: `pod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        type: 'pfi',
        remarks: '',
      });
    }
    if (skipped > 0) {
      toast.warning(`${skipped} file(s) skipped`, {
        description: 'Each file must be 20MB or smaller.',
      });
    }
    if (accepted.length) setPendingDocs((prev) => [...prev, ...accepted]);
  };
  const uploadPendingDocs = useCallback(async () => {
    if (!pendingDocs.length) return;
    const res = await procurementApi.uploadProcurementDocuments(mrfId, {
      documents: pendingDocs.map<UploadProcurementDocumentPayload>((p) => ({
        type: p.type,
        file: p.file,
        remarks: p.remarks || undefined,
      })),
    });
    if (!res.success || !res.data) {
      toast.warning('PO saved, but document upload failed', {
        description: res.error || 'Please retry from the Documents panel.',
      });
      return;
    }
    const { uploaded, failed } = res.data;
    if (uploaded.length > 0) {
      toast.success(`${uploaded.length} document(s) attached`);
    }
    if (failed.length > 0) {
      toast.warning('Some attachments failed', {
        description: failed
          .slice(0, 3)
          .map((f) => `${f.fileName ?? `#${f.index + 1}`}: ${f.error}`)
          .join(' · '),
      });
      const failedIdx = new Set(failed.map((f) => f.index));
      setPendingDocs((prev) => prev.filter((_, i) => failedIdx.has(i)));
    } else {
      setPendingDocs([]);
    }
  }, [mrfId, pendingDocs]);

  /**
   * Field-level errors returned by the backend on a 422 Unprocessable Entity
   * response. Keyed by backend field name so we can attach a red border and
   * inline error message to the specific input that failed. Cleared on the
   * next save attempt or as the user edits the field.
   */
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const lastManualSaveRef = useRef<number>(0);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);
  /** Suppress dirty/autosave for the first form write that comes from hydrate. */
  const justHydratedRef = useRef(false);

  // ---------- review + cancel ----------
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [finalisedMrf, setFinalisedMrf] = useState<MRF | null>(null);
  /** Mirrors `data.fast_tracked` from generate-po when the PO tab fast-track path was used. */
  const [finalisedFastTracked, setFinalisedFastTracked] = useState(false);
  /**
   * When the user reopens an already-finalised PO to edit it, we unlock the
   * form (`editingFinalised = true`) and the next finalise call regenerates
   * the PO — the SCD's approval queue only ever shows the latest version.
   */
  const [editingFinalised, setEditingFinalised] = useState(false);

  useEffect(() => {
    setFinalisedFastTracked(false);
  }, [mrfId]);

  // When opened in edit mode from the PO list, unlock the form for editing as
  // soon as the hydrated MRF reveals it is already finalised.
  useEffect(() => {
    if (initialEditMode && mrf?.po_number && !editingFinalised) {
      setEditingFinalised(true);
    }
  }, [initialEditMode, mrf?.po_number, editingFinalised]);

  // -------------------------------------------------------------------------
  // Hydrate MRF + price comparison
  // -------------------------------------------------------------------------
  const hydrate = useCallback(async () => {
    setHydrating(true);
    setHydrateSlow(false);
    setHydrateError(null);
    const slowTimer = window.setTimeout(() => setHydrateSlow(true), 15000);
    const hydrateStarted = performance.now();
    try {
      // Single lightweight call — for_po already embeds priceComparisons + milestones.
      const mrfRes = await procurementApi.getMRFForPO(mrfId);
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
        po_type?: string;
        poType?: string;
        po_payment_terms?: string | null;
        payment_terms?: string | null;
        paymentTerms?: string | null;
        expected_delivery_date?: string | null;
        delivery_date?: string | null;
        deliveryDate?: string | null;
        payment_milestones?: Array<{
          label?: string;
          percentage?: number;
          trigger_condition?: string;
          triggerCondition?: string;
        }>;
        paymentMilestones?: Array<{
          label?: string;
          percentage?: number;
          trigger_condition?: string;
          triggerCondition?: string;
        }>;
      };
      setMrf(m);

      const deliveryRaw =
        m.expected_delivery_date || m.delivery_date || m.deliveryDate || null;
      let deliveryDate: Date | undefined;
      if (deliveryRaw) {
        const d = new Date(`${String(deliveryRaw).slice(0, 10)}T00:00:00`);
        if (!Number.isNaN(d.getTime())) deliveryDate = d;
      }
      if (!deliveryDate) {
        deliveryDate = parseDeliveryDateFromRemarks(m.remarks);
      }

      const paymentTerms =
        (m.po_payment_terms || m.payment_terms || m.paymentTerms || '').trim() ||
        parsePaymentTermsFromCustomTerms(m.custom_terms) ||
        '';

      const poTypeRaw = String(m.po_type || m.poType || 'goods').toLowerCase();
      const poType: POType =
        poTypeRaw === 'services' || poTypeRaw === 'logistics' ? poTypeRaw : 'goods';

      justHydratedRef.current = true;
      setForm((prev) => ({
        ...prev,
        po_type: poType,
        delivery_date: deliveryDate ?? prev.delivery_date,
        ship_to_address: m.ship_to_address ?? prev.ship_to_address,
        payment_terms: paymentTerms || prev.payment_terms,
        currency: normalizeCurrencyCode(m.currency),
        tax_rate:
          m.tax_rate === null || m.tax_rate === undefined || m.tax_rate === ''
            ? ''
            : String(m.tax_rate),
        invoice_submission_email:
          m.invoice_submission_email || prev.invoice_submission_email,
        invoice_submission_cc: ensureProcurementCc(
          m.invoice_submission_cc || prev.invoice_submission_cc || DEFAULT_INVOICE_CC,
        ),
        terms_mode: coercePOTermsMode(
          (m as { terms_mode?: string; termsMode?: string; po_terms_mode?: string }).terms_mode ??
            (m as { termsMode?: string }).termsMode ??
            (m as { po_terms_mode?: string }).po_terms_mode,
        ),
        custom_terms:
          userClausesFromStoredCustomTerms(m.custom_terms) ??
          m.custom_terms ??
          prev.custom_terms,
        remarks: userRemarksFromStored(m.remarks) || (m.remarks ?? prev.remarks),
      }));
      setDraftSavedAt(m.po_draft_saved_at ?? null);

      const milestones = m.payment_milestones ?? m.paymentMilestones ?? [];
      if (Array.isArray(milestones) && milestones.length > 0) {
        setPaymentMilestones(
          milestones.map((row, i) => ({
            milestoneNumber: i + 1,
            label: row.label ?? '',
            percentage: Number(row.percentage) || 0,
            triggerCondition: (row.triggerCondition ||
              row.trigger_condition ||
              'on_advance') as PaymentMilestoneInput['triggerCondition'],
          })),
        );
      }

      let incoming = m.priceComparisons;
      // Fallback only when for_po payload omitted comparisons (legacy backends).
      if (!Array.isArray(incoming) || incoming.length === 0) {
        const pcRes = await procurementApi.getPriceComparison(mrfId);
        incoming = pcRes.success && pcRes.data ? pcRes.data : undefined;
      }
      if (Array.isArray(incoming) && incoming.length > 0) {
        setRows(incoming.map((e) => hydrateRow(e, groupKeyFor(e))));
      }

      // Hydrate vendor directory entries for any vendor_ids already on the
      // price comparison rows so their NAMES render immediately (instead of
      // showing the raw VND-xxx code / blank Select while the user waits for
      // the async vendor search). Batched + parallel so it's fast.
      if (Array.isArray(incoming) && incoming.length > 0) {
        const ids = Array.from(
          new Set(
            incoming
              .map((e) => e.vendor_id)
              .filter((v): v is string => typeof v === 'string' && v.trim().length > 0),
          ),
        );
        if (ids.length > 0) {
          void Promise.all(
            ids.map(async (id) => {
              // Try direct id lookup first (works when the row stored a UUID),
              // then fall back to a search on the formatted vendor_id (V001).
              const direct = await vendorApi.getById(id).catch(() => null);
              if (direct?.success && direct.data) return direct.data;
              const listRes = await vendorApi
                .list({ search: id, dropdown: true, per_page: 5, page: 1 })
                .catch(() => null);
              if (!listRes?.success || !listRes.data) return null;
              const match = listRes.data.items.find((v) => {
                const anyV = v as Vendor & { formatted_id?: string; vendor_id?: string };
                return (
                  anyV.formatted_id === id ||
                  anyV.vendor_id === id ||
                  String(v.id) === id
                );
              });
              return match ?? listRes.data.items[0] ?? null;
            }),
          )
            .then((results) => {
              const fetched = results.filter((v): v is Vendor => !!v);
              if (fetched.length === 0) return;
              setVendors((prev) => {
                const merged = new Map<string, Vendor>();
                for (const v of [...prev, ...fetched]) merged.set(String(v.id), v);
                return Array.from(merged.values());
              });
            });
        }
      }
      console.info('[PO hydrate]', {
        mrfId,
        elapsed_ms: Math.round(performance.now() - hydrateStarted),
        fields: {
          delivery_date: Boolean(deliveryDate),
          payment_terms: Boolean(paymentTerms),
          ship_to: Boolean(m.ship_to_address),
          tax_rate: m.tax_rate != null && m.tax_rate !== '',
          milestones: milestones.length,
          price_rows: Array.isArray(incoming) ? incoming.length : 0,
        },
      });
    } catch (err) {
      setHydrateError(err instanceof Error ? err.message : 'Failed to load MRF.');
    } finally {
      window.clearTimeout(slowTimer);
      setHydrating(false);
      dirtyRef.current = false;
    }
  }, [mrfId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // -------------------------------------------------------------------------
  // Vendors — async search only (no mount preload).
  // Directory selects type-to-search via PriceComparisonTable →
  // GET /api/vendors?dropdown=1&search=…
  useEffect(() => {
    if (hydrating) return;
    setVendors([]);
    setLoadingVendors(false);
  }, [hydrating, isDirectProcurement]);

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
  /**
   * A PO is only truly "locked" once it has been SIGNED by the SCD.
   * Before that (draft, awaiting signature, rejected) the PM must still be
   * able to edit every field — including the payment schedule — so we key
   * off the signed URL / workflow_state instead of the mere presence of a
   * PO number.
   */
  const signedLocked = (() => {
    const source = finalisedMrf || mrf;
    if (!source) return false;
    const s = source as MRF & { workflow_state?: string; workflowState?: string; signed_po_url?: string; signedPOUrl?: string };
    if (s.signed_po_url || s.signedPOUrl) return true;
    const wf = String(s.workflow_state ?? s.workflowState ?? s.status ?? '').toLowerCase();
    return wf === 'po_signed' || wf === 'signed' || wf === 'completed';
  })();
  const isFinalisedRaw = signedLocked;
  const isFinalised = isFinalisedRaw && !editingFinalised;

  const ccBlocked = emailListContains(form.invoice_submission_cc, BLOCKED_EMAIL);

  const ccInvalid =
    form.invoice_submission_cc.trim().length > 0 &&
    !isValidEmailList(form.invoice_submission_cc);

  const termsModeCustomInvalid =
    form.terms_mode === 'custom' && !form.custom_terms.trim();

  const toInvalid =
    form.invoice_submission_email.trim().length > 0 &&
    !isValidEmail(form.invoice_submission_email);

  const pcErrors = useMemo(
    () => validatePriceComparison(rows, vendors),
    [rows, vendors]
  );

  /**
   * Top-of-form blocker summary (1c). Aggregates Section 1 + Section 2 errors so
   * the PM can see every reason Generate & Route is disabled in one place.
   */
  const section1Errors = useMemo<string[]>(() => {
    const list: string[] = [];
    if (!form.po_date) list.push('PO Details: pick a PO date.');
    if (!form.delivery_date) list.push('PO Details: pick a delivery / service date.');
    if (!form.ship_to_address.trim()) list.push('PO Details: enter a ship-to address.');
    if (!form.payment_terms.trim()) list.push('PO Details: enter payment terms.');
    if (!paymentMilestonesValid) list.push('PO Details: payment milestones must sum to 100%.');
    if (ccBlocked) list.push('PO Details: CC email is not allowed.');
    if (ccInvalid) list.push('PO Details: CC email is not valid.');
    if (toInvalid) list.push('PO Details: Invoice To email is not valid.');
    if (termsMissing) list.push('PO Details: no standard T&C template configured for this PO type.');
    if (termsError) list.push(`PO Details: ${termsError}`);
    if (termsModeCustomInvalid) list.push('PO Details: enter custom terms when using "My terms only".');
    return list;
  }, [
    form.po_date,
    form.delivery_date,
    form.ship_to_address,
    form.payment_terms,
    paymentMilestonesValid,
    ccBlocked,
    ccInvalid,
    toInvalid,
    termsMissing,
    termsError,
    termsModeCustomInvalid,
  ]);
  const blockingErrors = useMemo<string[]>(
    () => [...section1Errors, ...pcErrors.map((e) => `Price Comparison: ${e}`)],
    [section1Errors, pcErrors],
  );

  const selectedSupplierLabel = useMemo(() => {
    const sel = rows.find((r) => r.is_selected);
    if (!sel) return '— (mark one row in the price comparison)';
    if (sel.manual_vendor?.name?.trim()) return sel.manual_vendor.name.trim();
    if (sel.vendor_id) {
      const v = vendors.find(
        (x) =>
          (x as Vendor & { formatted_id?: string; vendor_id?: string }).formatted_id ===
            sel.vendor_id ||
          (x as Vendor & { vendor_id?: string }).vendor_id === sel.vendor_id ||
          x.id === sel.vendor_id,
      );
      return v?.name ?? sel.vendor_id;
    }
    return '—';
  }, [rows, vendors]);

  const section1Valid =
    !!form.po_date &&
    !!form.delivery_date &&
    !!form.ship_to_address.trim() &&
    !!form.payment_terms.trim() &&
    paymentMilestonesValid &&
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
    (!finalisedMrf || editingFinalised);

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
    if (justHydratedRef.current) {
      justHydratedRef.current = false;
      dirtyRef.current = false;
      return;
    }
    dirtyRef.current = true;
  }, [form, rows, paymentMilestones, hydrating]);

  // -------------------------------------------------------------------------
  // Build the PO payload from form state.
  // Per spec: delivery date appended to remarks, payment terms appended to custom_terms.
  // Top-level delivery_date / payment_terms are ALWAYS sent so draft reopen works.
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
      currency: form.currency,
      ship_to_address: form.ship_to_address.trim() || undefined,
      // Allow explicit 0 — do NOT rely on truthiness (0 and "0" would be dropped).
      tax_rate:
        form.tax_rate.trim() === '' || Number.isNaN(Number(form.tax_rate))
          ? undefined
          : Number(form.tax_rate),
      invoice_submission_email: form.invoice_submission_email.trim() || undefined,
      invoice_submission_cc: ensureProcurementCc(form.invoice_submission_cc.trim()) || undefined,
      terms_mode: form.terms_mode,
      custom_terms: customPieces.join('\n\n') || undefined,
      remarks: remarksPieces.join('\n\n') || undefined,
      // Always persist dedicated columns (not only allow_missing_rfq path).
      payment_terms: form.payment_terms.trim() || undefined,
      delivery_date: form.delivery_date
        ? format(form.delivery_date, 'yyyy-MM-dd')
        : undefined,
    };

    if (fastTrack) base.fast_track = true;
    if (allowMissingRfq) {
      base.allow_missing_rfq = true;
    }

    if (paymentMilestones.length > 0 && paymentMilestonesValid) {
      base.payment_milestones = serializePaymentMilestones(paymentMilestones);
    }

    return base;
  }, [form, fastTrack, allowMissingRfq, paymentMilestones, paymentMilestonesValid]);

  const emeraldPreviewModel = useMemo(() => {
    if (!mrf) return null;
    const payload = buildPayload();
    const merged = {
      ...mrf,
      currency: form.currency,
      ship_to_address:
        form.ship_to_address.trim() ||
        (mrf as MRF & { ship_to_address?: string }).ship_to_address,
      tax_rate:
        form.tax_rate.trim() === ''
          ? (mrf as MRF & { tax_rate?: number | string }).tax_rate
          : Number(form.tax_rate),
      invoice_submission_email: form.invoice_submission_email.trim() || undefined,
      invoice_submission_cc: ensureProcurementCc(form.invoice_submission_cc.trim()) || undefined,
      custom_terms: payload.custom_terms ?? (mrf as MRF & { custom_terms?: string }).custom_terms,
      remarks: payload.remarks ?? (mrf as MRF & { remarks?: string }).remarks,
      po_number:
        (finalisedMrf?.po_number ||
          finalisedMrf?.poNumber ||
          mrf.po_number ||
          mrf.poNumber ||
          previewPoNumber(
            resolveSelectedSupplier(rows, vendors).supplierName,
            form.po_date ?? new Date(),
          )) as string,
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
      a.download = `PO-${num}.pdf`;
      // Attach + remove is required by Firefox/Safari; without it the browser
      // just navigates to the blob: URL instead of saving the file.
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build PDF');
    }
  }, [emeraldPreviewModel, finalisedMrf, mrf, mrfId]);

  /** Finalised POs always stream from the authenticated Emerald API endpoint. */
  const downloadFinalisedServerPo = useCallback(async () => {
    const target = (finalisedMrf || mrf) as import('@/types').MRF | null | undefined;
    if (!target) {
      toast.error('PO is not ready yet.');
      return;
    }
    const { downloadMrfPurchaseOrderPdf } = await import(
      '@/utils/downloadMrfPurchaseOrderPdf'
    );
    const res = await downloadMrfPurchaseOrderPdf(target);
    if (res.success) {
      toast.success('PO download started (Emerald layout)');
    } else {
      toast.error(res.error || 'Unable to download PO');
    }
  }, [finalisedMrf, mrf]);

  const openEmeraldPoInNewTab = useCallback(async () => {
    if (isFinalised) {
      await downloadFinalisedServerPo();
      return;
    }
    if (!emeraldPreviewModel) {
      toast.error('PO preview is not ready yet.');
      return;
    }
    try {
      await openEmeraldPurchaseOrderPdfInNewTab(emeraldPreviewModel);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open PDF');
    }
  }, [emeraldPreviewModel, isFinalised, downloadFinalisedServerPo]);

  // -------------------------------------------------------------------------
  // Save flows
  // -------------------------------------------------------------------------
  const acquireLock = async (mode: 'draft' | 'finalise' | 'auto'): Promise<boolean> => {
    // Wait for in-flight autosave so manual save / finalise never race it.
    if (isAutoSavingRef.current) {
      for (let i = 0; i < 40 && isAutoSavingRef.current; i += 1) {
        await new Promise((r) => window.setTimeout(r, 50));
      }
    }
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

  /**
   * Normalise the `fieldErrors` bag from an ApiResponse (backend 422) into a
   * flat `{ field: message }` map that the form can bind to. Values arriving
   * as arrays are joined with " · " so a single input can surface every
   * violation the backend reported.
   */
  const flattenFieldErrors = (
    src: Record<string, string | string[]> | undefined,
  ): Record<string, string> => {
    if (!src) return {};
    const out: Record<string, string> = {};
    Object.entries(src).forEach(([k, v]) => {
      out[k] = Array.isArray(v) ? v.join(' · ') : String(v);
    });
    return out;
  };

  /** Clear an individual server error the moment the user edits that field. */
  const clearServerFieldError = useCallback((name: string) => {
    setServerFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const { [name]: _dropped, ...rest } = prev;
      void _dropped;
      return rest;
    });
  }, []);

  const patchForm = useCallback(
    (patch: Partial<FormState>) => {
      setForm((s) => ({ ...s, ...patch }));
      Object.keys(patch).forEach((k) => clearServerFieldError(k));
    },
    [clearServerFieldError],
  );

  const saveDraft = useCallback(async () => {
    if (!(await acquireLock('draft'))) return;
    setServerFieldErrors({});
    try {
      const pcInvalid = validatePriceComparison(rows, vendors).length > 0;
      if (!pcInvalid) {
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
        if (draftRes.fieldErrors) {
          setServerFieldErrors(flattenFieldErrors(draftRes.fieldErrors));
        }
        toast.error('Draft save failed', {
          description: draftRes.error || 'Please try again.',
        });
        return;
      }
      const stamp = (draftRes.data?.mrf as { po_draft_saved_at?: string } | undefined)
        ?.po_draft_saved_at;
      setDraftSavedAt(stamp ?? new Date().toISOString());
      const savedMrf = draftRes.data?.mrf
        ? ({ ...mrf, ...draftRes.data.mrf } as MRF)
        : mrf;
      setMrf((prev) => (prev && draftRes.data?.mrf ? { ...prev, ...draftRes.data.mrf } : prev));
      dirtyRef.current = false;
      lastManualSaveRef.current = Date.now();
      toast.success('Draft saved.');
      await uploadPendingDocs();
      if (savedMrf) onDraftSaved?.(savedMrf);
    } catch (err) {
      toast.error('Draft save failed', {
        description: err instanceof Error ? err.message : 'Unexpected error.',
      });
    } finally {
      releaseLock();
    }
  }, [mrfId, rows, buildPayload, vendors, mrf, onDraftSaved, uploadPendingDocs]);

  const finalisePO = useCallback(async () => {
    if (!(await acquireLock('finalise'))) return;
    setServerFieldErrors({});
    try {
      const pcRes = await procurementApi.savePriceComparison(mrfId, rows);
      if (!pcRes.success) {
        if (pcRes.fieldErrors) {
          setServerFieldErrors(flattenFieldErrors(pcRes.fieldErrors));
        }
        toast.error('Could not save price comparison', {
          description: pcRes.error || 'Fix the errors and try again.',
        });
        return;
      }
      const isRegen = editingFinalised;
      const payload = {
        ...buildPayload(),
        // Backend contract: when `regenerate: true` is set, the server bumps
        // the PO version, archives the previous PDF (kept for audit), and
        // replaces the active SCD approval entry with this new revision so
        // the SCD never sees two pending versions of the same PO.
        ...(isRegen ? { regenerate: true } : {}),
      };
      // Backend locks the payment schedule after PO generation; sending
      // `payment_milestones` on a regenerate causes a hard rejection
      // ("Payment schedule is locked after PO generation"). Strip it.
      if (isRegen && 'payment_milestones' in payload) {
        delete (payload as { payment_milestones?: unknown }).payment_milestones;
      }
      const finalRes = await procurementApi.finalisePO(mrfId, payload);
      if (!finalRes.success || !finalRes.data?.mrf) {
        if (finalRes.fieldErrors) {
          setServerFieldErrors(flattenFieldErrors(finalRes.fieldErrors));
        }
        console.error('[PO regenerate/finalise failed]', {
          mrfId,
          isRegen,
          status: finalRes.status,
          error: finalRes.error,
          fieldErrors: finalRes.fieldErrors,
          raw: finalRes.raw,
          payload,
        });
        toast.error('PO generation failed', {
          description: describeBackendError(finalRes.raw, finalRes.error || 'Please try again.'),
        });
        return;
      }
      const newMrf = finalRes.data.mrf;
      const gen = finalRes.data as GeneratePOResponse;
      let resolvedMrf = newMrf;
      // Backend may 202-accept and defer PDF generation to a queue worker.
      // Poll GET /api/mrfs/{id} until unsigned_po_url / workflow_state show up.
      if (!isPoReady(resolvedMrf)) {
        try {
          const polled = await pollForGeneratedPO(mrfId);
          if (polled) {
            resolvedMrf = polled;
          } else {
            toast.warning('PO generation is still processing', {
              description:
                'The backend accepted the request but the PDF is not ready yet. Refresh in a moment to see the unsigned PO.',
            });
          }
        } catch (pollErr) {
          toast.error('PO generation failed', {
            description:
              pollErr instanceof Error
                ? pollErr.message
                : 'Background PDF generation failed. Please try again.',
          });
          return;
        }
      }
      const wf = String(
        (newMrf as MRF & { workflow_state?: string }).workflow_state ||
          (newMrf as MRF & { workflowState?: string }).workflowState ||
          resolvedMrf.status ||
          '',
      ).toLowerCase();
      const fastTrackedSuccess = Boolean(
        gen.fast_tracked ??
          gen.fastTracked ??
          wf === 'awaiting_scd_signature',
      );
      setFinalisedFastTracked(fastTrackedSuccess);
      setFinalisedMrf(resolvedMrf);
      setEditingFinalised(false);
      const poNumber = resolvedMrf.po_number || resolvedMrf.poNumber || '—';
      const resolved =
        gen.resolvedVendors ?? gen.resolved_vendors ?? [];
      const vendorSummary = formatResolvedVendorsSummary(resolved);
      const baseDescription = isRegen
        ? 'Previous version archived. The Supply Chain Director now sees only the latest revision.'
        : fastTrackedSuccess
          ? 'Fast-track: awaiting Supply Chain Director signature (executive review skipped).'
          : 'Routed to the Supply Chain Director for signature.';
      toast.success(
        isRegen ? `PO ${poNumber} regenerated` : `PO ${poNumber} generated`,
        {
          description: vendorSummary
            ? `${baseDescription} ${vendorSummary}`
            : baseDescription,
        },
      );
      onFinalised?.(resolvedMrf);
      await uploadPendingDocs();
    } catch (err) {
      toast.error('PO generation failed', {
        description: err instanceof Error ? err.message : 'Unexpected error.',
      });
    } finally {
      releaseLock();
    }
  }, [mrfId, rows, buildPayload, onFinalised, vendors, editingFinalised, uploadPendingDocs]);

  // -------------------------------------------------------------------------
  // Autosave — debounced 3s, draft mode only, lock-protected,
  // paused 5s after manual save, skipped on validation failure.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (hydrating || isFinalised) return;
    if (!dirtyRef.current) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // Task 3 — strict 1500ms debounce so keystrokes never block the UI.
    debounceRef.current = window.setTimeout(() => {
      if (isSavingRef.current || isAutoSavingRef.current) return;
      if (Date.now() - lastManualSaveRef.current < 5000) return;
      // Gate: autosave when PC is valid (prevents 422 spam).
      const pcInvalid = validatePriceComparison(rows, vendors).length > 0;
      if (pcInvalid) return;
      // Autosave uses its OWN lock so it never disables the manual buttons
      // or the input fields the user is typing into.
      void (async () => {
        isAutoSavingRef.current = true;
        setIsAutoSaving(true);
        try {
          const pcRes = await procurementApi.savePriceComparison(mrfId, rows);
          if (!pcRes.success) return;
          const autoPayload = buildPayload();
          // Payment schedule is locked once a PO exists on the backend —
          // an autosave must never trip that lock (would spam error toasts).
          if (editingFinalised && 'payment_milestones' in autoPayload) {
            delete (autoPayload as { payment_milestones?: unknown }).payment_milestones;
          }
          const draftRes = await procurementApi.savePODraft(mrfId, autoPayload);
          if (draftRes.success) {
            const stamp = (draftRes.data?.mrf as { po_draft_saved_at?: string } | undefined)
              ?.po_draft_saved_at;
            setDraftSavedAt(stamp ?? new Date().toISOString());
            dirtyRef.current = false;
          }
        } catch {
          // swallow autosave failures
        } finally {
          isAutoSavingRef.current = false;
          setIsAutoSaving(false);
        }
      })();
    }, 1500);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [form, rows, vendors, hydrating, isFinalised, mrfId, buildPayload, editingFinalised]);

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

      {!isDirectProcurement && !isFinalised && (
        <div className="rounded-md border border-muted-foreground/20 bg-muted/20 px-3 py-2 text-xs text-muted-foreground leading-snug">
          <span className="font-medium text-foreground">Standard PO</span>
          {' — '}
          This MRF is in the normal procurement workflow. Complete PO details and the price comparison sheet;
          the generated PO is routed for Supply Chain Director signature like other approved requests.
        </div>
      )}

      {isDirectProcurement && !isFinalised && (
        <div className="rounded-md border border-primary/35 bg-primary/5 px-3 py-2 text-xs text-muted-foreground leading-snug">
          <span className="font-medium text-foreground">Fast-track / direct procurement</span>
          {' — '}
          Use this path for urgent buys without waiting on a full RFQ cycle. Enter at least two supplier quotes
          below (pick from the directory or use <span className="font-medium text-foreground">Manual</span> to type
          vendor name, contact, and pricing). When you generate the PO, it goes to the Supply Chain Director for
          signing and approval.
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
            <Label>Selected supplier (from price comparison)</Label>
            <Input value={selectedSupplierLabel} readOnly disabled className="bg-muted/40" />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Mark exactly one row as selected in section 2. For fast-track, that supplier can be from the directory
              or entered manually.
            </p>
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
            <Input
              id="ship-to"
              value={form.ship_to_address}
              onChange={(e) => patchForm({ ship_to_address: e.target.value })}
              placeholder="e.g. Lekki HQ, Lagos"
              aria-invalid={Boolean(serverFieldErrors.ship_to_address)}
              className={cn(serverFieldErrors.ship_to_address && 'border-destructive focus-visible:ring-destructive')}
            />
            {serverFieldErrors.ship_to_address && (
              <p className="text-xs text-destructive">{serverFieldErrors.ship_to_address}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-terms">Payment Terms *</Label>
            <Input
              id="payment-terms"
              value={form.payment_terms}
              onChange={(e) => patchForm({ payment_terms: e.target.value })}
              placeholder="e.g. Net 30 Days"
              aria-invalid={Boolean(serverFieldErrors.payment_terms)}
              className={cn(serverFieldErrors.payment_terms && 'border-destructive focus-visible:ring-destructive')}
            />
            {serverFieldErrors.payment_terms && (
              <p className="text-xs text-destructive">{serverFieldErrors.payment_terms}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax-rate">Tax Rate (%)</Label>
            <Input
              id="tax-rate"
              type="number"
              min="0"
              step="0.01"
              value={form.tax_rate}
              onChange={(e) => patchForm({ tax_rate: e.target.value })}
              placeholder="e.g. 7.5 (enter 0 for no tax)"
              aria-invalid={Boolean(serverFieldErrors.tax_rate)}
              className={cn(serverFieldErrors.tax_rate && 'border-destructive focus-visible:ring-destructive')}
            />
            {serverFieldErrors.tax_rate && (
              <p className="text-xs text-destructive">{serverFieldErrors.tax_rate}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="po-currency">Currency</Label>
            <Select
              value={form.currency}
              onValueChange={(v) => setForm((s) => ({ ...s, currency: v }))}
              disabled={isFinalised}
            >
              <SelectTrigger id="po-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PO_CURRENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              All line-item prices on this PO use the selected currency.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-to">Invoice Submission Email (To)</Label>
            <Input
              id="invoice-to"
              type="email"
              value={form.invoice_submission_email}
              onChange={(e) => patchForm({ invoice_submission_email: e.target.value })}
              aria-invalid={toInvalid || Boolean(serverFieldErrors.invoice_submission_email)}
              className={cn((toInvalid || serverFieldErrors.invoice_submission_email) && 'border-destructive focus-visible:ring-destructive')}
            />
            {toInvalid && <p className="text-xs text-destructive">Enter a valid email address.</p>}
            {!toInvalid && serverFieldErrors.invoice_submission_email && (
              <p className="text-xs text-destructive">{serverFieldErrors.invoice_submission_email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-cc">CC Email *</Label>
            <Input
              id="invoice-cc"
              type="email"
              value={form.invoice_submission_cc}
              onChange={(e) => patchForm({ invoice_submission_cc: e.target.value })}
              aria-invalid={ccBlocked || ccInvalid || Boolean(serverFieldErrors.invoice_submission_cc)}
              className={cn((ccBlocked || ccInvalid || serverFieldErrors.invoice_submission_cc) && 'border-destructive focus-visible:ring-destructive')}
            />
            {ccBlocked && <p className="text-xs text-destructive">This email address is not allowed in the CC field.</p>}
            {ccInvalid && !ccBlocked && (
              <p className="text-xs text-destructive">
                Enter valid email addresses (comma-separated allowed).
              </p>
            )}
            {!ccBlocked && !ccInvalid && serverFieldErrors.invoice_submission_cc && (
              <p className="text-xs text-destructive">{serverFieldErrors.invoice_submission_cc}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <PaymentMilestoneBuilder
            value={paymentMilestones}
            onChange={setPaymentMilestones}
            onValidityChange={setPaymentMilestonesValid}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Optional structured payment schedule. When set, it overrides the free-text Payment Terms above on the generated PO.
          </p>
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
          currency={form.currency}
          defaultSupplierModeForNewRows={isDirectProcurement ? 'manual' : 'directory'}
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
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="font-medium">{form.currency}</dd>
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
              {(() => {
                // Group rows by supplier identity so the review shows one entry per supplier
                // with all their line items beneath, matching the new card-based form layout.
                const supplierGroups = new Map<
                  string,
                  { name: string; selected: boolean; rows: PriceComparisonRow[] }
                >();
                rows.forEach((r) => {
                  const key = r.group_key
                    || (r.vendor_id ? `v:${r.vendor_id}` : `m:${(r.manual_vendor?.name || '').trim().toLowerCase()}`)
                    || r._key;
                  const name = r.manual_vendor?.name
                    ? r.manual_vendor.name
                    : r.vendor_id || '—';
                  const existing = supplierGroups.get(key);
                  if (existing) {
                    existing.rows.push(r);
                    existing.selected = existing.selected || r.is_selected;
                  } else {
                    supplierGroups.set(key, { name, selected: r.is_selected, rows: [r] });
                  }
                });
                const groupsArr = Array.from(supplierGroups.values());
                return (
                  <>
                    <p className="text-xs font-medium mb-2">
                      Comparison ({groupsArr.length} supplier{groupsArr.length === 1 ? '' : 's'})
                    </p>
                    <ul className="text-xs space-y-3">
                      {groupsArr.map((g, i) => {
                        const subtotal = g.rows.reduce(
                          (acc, r) =>
                            acc + (Number(r.unit_price) || 0) * (Number(r.quantity) || 0),
                          0,
                        );
                        return (
                          <li
                            key={i}
                            className={cn(
                              'rounded border bg-background/60 p-2',
                              g.selected && 'border-success/50 bg-success/5',
                            )}
                          >
                            <div className="flex justify-between items-center font-medium">
                              <span className={cn(g.selected && 'text-success')}>
                                {i + 1}. {g.name}
                                {g.selected && ' ✓'}
                              </span>
                              <span className="tabular-nums">
                                {formatPoAmount(subtotal, form.currency)}
                              </span>
                            </div>
                            <ul className="mt-1 ml-3 space-y-0.5 text-muted-foreground">
                              {g.rows.map((r) => {
                                const total =
                                  (Number(r.unit_price) || 0) * (Number(r.quantity) || 0);
                                return (
                                  <li key={r._key} className="flex justify-between gap-2">
                                    <span className="truncate">
                                      • {r.item_description || '—'}{' '}
                                      <span className="text-[10px]">
                                        ({r.quantity || 0} ×{' '}
                                        {formatPoAmount(Number(r.unit_price) || 0, form.currency)})
                                      </span>
                                    </span>
                                    <span className="tabular-nums">
                                      {formatPoAmount(total, form.currency)}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                );
              })()}
            </div>
            {emeraldPreviewModel && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold">Purchase Order — Emerald layout (preview)</p>
                <p className="text-[11px] text-muted-foreground">
                  This is the standard Emerald company PO layout. <strong>Open PDF</strong> and downloads use this
                  format by default.
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
      {isFinalised && (
        <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span>
              PO <strong>{finalisedMrf?.po_number || finalisedMrf?.poNumber || mrf?.po_number}</strong> generated.
            </span>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setEditingFinalised(true)}
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium bg-transparent border-0 cursor-pointer p-0"
                title="Edit this PO and regenerate. The previous version is archived and the SCD's approval queue is replaced with the new revision."
              >
                <PencilLine className="h-3.5 w-3.5" /> Edit PO
              </button>
              {isFinalised ? (
                <button
                  type="button"
                  onClick={() => void downloadFinalisedServerPo()}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium bg-transparent border-0 cursor-pointer p-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open PDF
                </button>
              ) : emeraldPreviewModel ? (
                <button
                  type="button"
                  onClick={() => void openEmeraldPoInNewTab()}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium bg-transparent border-0 cursor-pointer p-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open PDF
                </button>
              ) : null}
            </div>
          </div>
          {finalisedFastTracked && (
            <p className="text-xs text-muted-foreground border-t border-success/25 pt-2">
              <span className="font-medium text-foreground">SCD signature pending</span>
              {' — '}Executive review was skipped. The Supply Chain Director signs via the dashboard or uploads the signed PO; completion matches the regular flow after signature.
            </p>
          )}
        </div>
      )}

      {/* ============== Editing existing PO banner ============== */}
      {editingFinalised && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span>
              Editing existing PO{' '}
              <strong>
                {finalisedMrf?.po_number || finalisedMrf?.poNumber || mrf?.po_number}
              </strong>
              . Resubmitting will replace the version currently in the SCD's approval queue.
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditingFinalised(false)}
            >
              Cancel edit
            </Button>
          </div>
        </div>
      )}

      {/* ============== Blocking errors summary (1c) ============== */}
      {!isFinalised && blockingErrors.length > 0 && (
        null
      )}
      {/* Optional: attach supporting documents alongside the PO save */}
      {!isFinalised && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              Supporting Documents (optional)
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => poDocInputRef.current?.click()}
              disabled={isSaving}
            >
              <UploadCloud className="mr-2 h-4 w-4" /> Add files
            </Button>
            <input
              ref={poDocInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addPendingDocs(e.target.files);
                e.currentTarget.value = '';
              }}
            />
          </div>
          {pendingDocs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Attach PFI, invoices, waybills or any related file. They upload after
              the PO is saved or generated. PDF, DOC, DOCX, JPG, PNG · 20MB each.
            </p>
          ) : (
            <div className="space-y-2">
              {pendingDocs.map((p) => (
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
                        setPendingDocs((prev) =>
                          prev.map((d) =>
                            d.key === p.key ? { ...d, type: v as ProcurementDocumentType } : d,
                          ),
                        )
                      }
                      disabled={isSaving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PO_DOC_TYPES.map((t) => (
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
                      onChange={(e) =>
                        setPendingDocs((prev) =>
                          prev.map((d) =>
                            d.key === p.key ? { ...d, remarks: e.target.value } : d,
                          ),
                        )
                      }
                      placeholder="Notes for this file"
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPendingDocs((prev) => prev.filter((d) => d.key !== p.key))
                    }
                    disabled={isSaving}
                    aria-label="Remove attachment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!isFinalised && blockingErrors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            Fix {blockingErrors.length} issue{blockingErrors.length === 1 ? '' : 's'} before generating &amp; routing
          </div>
          <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
            {blockingErrors.slice(0, 12).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {blockingErrors.length > 12 && (
              <li className="italic">…and {blockingErrors.length - 12} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Server-side (422) field errors — shows any errors that could not be
          mapped to a specific input above so the PM still sees the message. */}
      {Object.keys(serverFieldErrors).length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            The server rejected {Object.keys(serverFieldErrors).length} field
            {Object.keys(serverFieldErrors).length === 1 ? '' : 's'} — fix the highlighted inputs below.
          </div>
          <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
            {Object.entries(serverFieldErrors).map(([field, msg]) => (
              <li key={field}>
                <span className="font-medium text-foreground">{field}</span>: {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      </div>

      {/* Footer actions — fixed below scroll area so fields are never covered */}
      <div className="mt-2 flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="text-xs text-muted-foreground">
          {isSaving && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {savingMode === 'finalise' ? 'Generating PO…' : 'Saving draft…'}
            </span>
          )}
          {!isSaving && isAutoSaving && (
            <span className="inline-flex items-center gap-1 opacity-75">
              <Loader2 className="h-3 w-3 animate-spin" />
              Autosaving in background…
            </span>
          )}
          {!isSaving && !isAutoSaving && draftSavedAt && (
            <span>Saved {formatDistanceToNow(new Date(draftSavedAt), { addSuffix: true })}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isFinalised && (
            <Button variant="outline" size="sm" type="button" onClick={() => void downloadFinalisedServerPo()}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Download PDF
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
            {isSaving && savingMode === 'draft' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save as Draft
              </>
            )}
          </Button>
          <Button
            onClick={() => void finalisePO()}
            disabled={!canFinalise}
            title={
              !canFinalise && !isSaving
                ? blockingErrors.length > 0
                  ? `Fix ${blockingErrors.length} issue${blockingErrors.length === 1 ? '' : 's'} listed above before generating.`
                  : 'Complete all required fields before generating.'
                : undefined
            }
          >
            {isSaving && savingMode === 'finalise' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1" />
                {editingFinalised
                  ? 'Regenerate & replace SCD queue'
                  : fastTrack
                    ? 'Generate & route to SCD (fast-track)'
                    : 'Generate & Route for Approval'}
              </>
            )}
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