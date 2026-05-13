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

/** Row authored client-side, sent to the backend on PUT /price-comparisons. */
export interface PriceComparisonRow {
  /** Local-only key for React rendering. */
  _key: string;
  /** Vendor's stable string id (e.g. VND-001) — NOT the numeric internal id. */
  vendor_id: string;
  item_description: string;
  unit_price: number | '';
  quantity: number | '';
  is_selected: boolean;
  selection_reason: string;
}

/** Row returned from the backend (includes server-computed fields). */
export interface PriceComparisonEntry {
  id?: number | string;
  vendor_id: string;
  vendor_internal_id?: number | string;
  vendor_name?: string;
  item_description: string;
  unit_price: number | string;
  quantity: number | string;
  total_price?: number | string;
  is_selected: boolean;
  selection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
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