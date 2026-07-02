/**
 * Types for the PO Generator + Price Comparison flow.
 * See `po_generator_frontend.md` for the spec.
 */

export type POType = 'goods' | 'services' | 'logistics';

/** How standard vs custom clauses are applied on the generated PO. */
export type POTermsMode = 'standard' | 'custom' | 'both';

export interface POTermsTemplate {
  id?: number | string;
  po_type: string;
  /** Standard T&C body. Backend may return as `content` or `standard_terms`. */
  content?: string;
  standard_terms?: string;
  is_active?: boolean;
  updated_at?: string;
}

/** Manual vendor data for price comparison rows without a directory entry. */
export interface ManualVendor {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_person?: string;
  contact_person_email?: string;
}

/** Row authored client-side, sent to the backend on PUT /price-comparisons. */
export interface PriceComparisonRow {
  /** Local-only key for React rendering. */
  _key: string;
  /**
   * Local-only stable group identifier shared by every row that belongs to the
   * same supplier card in the UI. Lets the form keep rows visually grouped
   * even before a vendor identity is chosen, and survives identity edits
   * (e.g. switching from Directory to Manual within the same card).
   * Stripped before sending to the backend.
   */
  group_key?: string;
  /** Vendor's stable string id (e.g. VND-001) — NOT the numeric internal id. Send when using directory vendor. */
  vendor_id?: string;
  /** Manual vendor data — send when adding supplier not yet in directory. */
  manual_vendor?: ManualVendor;
  item_description: string;
  unit_price: number | '';
  quantity: number | '';
  is_selected: boolean;
  selection_reason: string;
}

/** Row returned from the backend (includes server-computed fields). */
export interface PriceComparisonEntry {
  id?: number | string;
  vendor_id?: string;
  vendor_internal_id?: number | string;
  vendor_name?: string;
  manual_vendor?: ManualVendor;
  item_description: string;
  unit_price: number | string;
  quantity: number | string;
  total_price?: number | string;
  is_selected: boolean;
  selection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Free-text payment terms returned by the backend (when no structured schedule). */
  paymentTerms?: string | null;
  payment_terms?: string | null;
  /** Compact human summary of the MRF payment schedule applied to this row. */
  paymentScheduleSummary?: string | null;
  payment_schedule_summary?: string | null;
}

/** Payload for POST /api/mrfs/{id}/generate-po (both draft and finalise). */
export interface POFormPayload {
  po_type?: POType;
  custom_terms?: string;
  tax_rate?: number | null;
  ship_to_address?: string;
  invoice_submission_email?: string;
  invoice_submission_cc?: string;
  remarks?: string;
  /** Which terms appear on the PO; backend may use this with `custom_terms`. */
  terms_mode?: POTermsMode;
  /** When true, persists fields without rendering PDF or moving the workflow. */
  save_as_draft?: boolean;
  /**
   * When true, backend skips executive distribution and routes the generated PO to SCD signature
   * (`awaiting_scd_signature`). Typical for urgent / direct procurement from the Purchase Orders tab.
   * Aliases accepted server-side: `bypassExecutiveReview`, `bypass_executive_review`.
   */
  fast_track?: boolean;
  /**
   * When true, the server can finalise PO generation without a linked RFQ / quotation record on the MRF.
   * Use with a completed price comparison sheet (directory and/or manual suppliers). Often set together with {@link fast_track}.
   */
  allow_missing_rfq?: boolean;
  /**
   * Optional vendor fields some backends accept for legacy PDF paths. Prefer the price comparison
   * sheet for supplier selection; do not treat these as a separate “override” flow in the UI.
   */
  vendor_id?: number;
  vendor_name?: string;
  /** Top-level fields for PDF generation (in addition to payment/delivery embedded in remarks/custom_terms). */
  payment_terms?: string;
  /** ISO date `yyyy-MM-dd`. */
  delivery_date?: string;
  /**
   * Structured payment milestones (preferred over free-text `payment_terms`).
   * Backend must accept and validate that sum of `percentage` === 100.
   */
  payment_milestones?: Array<{
    label: string;
    percentage: number;
    trigger_condition: string;
  }>;
  /**
   * When true, the server treats this generate-po call as a regeneration of an
   * already-finalised PO: it bumps the PO version, archives the previous PDF
   * (kept in PO history for audit), and replaces the entry in the Supply Chain
   * Director's approval queue so the SCD only ever sees the latest revision.
   */
  regenerate?: boolean;
  /** ISO 4217 code for PO line amounts (e.g. NGN, USD). */
  currency?: string;
}

/**
 * MRF fields the PO list view + form depend on. Subset of MRF; we type them
 * here so the procurement helpers stay self-contained.
 */
export interface POProjection {
  id: string;
  status?: string;
  workflow_state?: string;
  workflowState?: string;
  is_po_draft?: boolean;
  isPODraft?: boolean;
  unsigned_po_url?: string;
  unsignedPOUrl?: string;
  signed_po_url?: string;
  signedPOUrl?: string;
  po_number?: string;
  poNumber?: string;
  po_draft_saved_at?: string | null;
  poDraftSavedAt?: string | null;
  priceComparisons?: PriceComparisonEntry[] | null;
}

export type POStatusKey =
  | 'signed'
  | 'rejected'
  | 'draft'
  | 'awaiting_po'
  | 'pending_signature'
  | 'with_supply_chain'
  | 'with_finance'
  | 'unknown';

/**
 * Shape of `GET /api/mrfs/{id}/price-comparisons` once the backend ships the
 * structured payment schedule alongside the rows.
 *
 * Existing callers that consume `apiRequest<PriceComparisonEntry[]>` continue
 * to work — this type is for screens that need the MRF-level schedule header.
 */
export interface PriceComparisonResponse {
  rows: PriceComparisonEntry[];
  paymentSchedule?: import('./payment-schedule').PaymentSchedule | null;
  payment_schedule?: import('./payment-schedule').PaymentSchedule | null;
}