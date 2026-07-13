import { useMemo, useState, useCallback, useEffect } from 'react';
import { Trash2, Plus, AlertCircle, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { vendorApi } from '@/services/api';
import type { Vendor, VendorLookupMatch } from '@/types';
import type { PriceComparisonRow, ManualVendor } from '@/types/procurement';
import type { PaymentSchedule } from '@/types/payment-schedule';
import { formatScheduleSummary } from '@/types/payment-schedule';
import { currencySymbol, formatPoAmount } from '@/utils/currency';

export interface PriceComparisonTableProps {
  value: PriceComparisonRow[];
  onChange: (rows: PriceComparisonRow[]) => void;
  vendors: Vendor[];
  disabled?: boolean;
  loadingVendors?: boolean;
  /** ISO 4217 code for unit prices and totals (NGN or USD). */
  currency?: string;
  /** New rows from “Add Supplier” start in this mode (fast-track defaults to manual entry). */
  defaultSupplierModeForNewRows?: 'directory' | 'manual';
  /**
   * MRF-level payment schedule (Finance AP Phase 1). When provided, rendered
   * as a banner above the table so reviewers see the milestone split.
   */
  paymentSchedule?: PaymentSchedule | null;
}

/**
 * Returns a vendor's stable "string id" for `vendor_id` (e.g. VND-001).
 * Falls back to the canonical id when no formatted id exists.
 */
const vendorStringId = (v: Vendor): string => {
  const anyV = v as Vendor & { formatted_id?: string; vendor_id?: string };
  return anyV.formatted_id ?? anyV.vendor_id ?? v.id;
};

const isValidEmail = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/**
 * Find an existing directory vendor that matches a manual vendor entry by
 * (case-insensitive) name or email. Used for inline duplicate detection so the
 * PM is steered toward the existing record instead of creating a duplicate.
 */
export const findExistingVendorMatch = (
  manual: ManualVendor | undefined,
  vendors: Vendor[],
): Vendor | null => {
  if (!manual) return null;
  const name = manual.name?.trim().toLowerCase();
  const email = manual.email?.trim().toLowerCase();
  if (!name && !email) return null;
  return (
    vendors.find((v) => {
      const vName = v.name?.trim().toLowerCase();
      const vEmail = (v.email ?? '').trim().toLowerCase();
      if (email && vEmail && vEmail === email) return true;
      if (name && vName && vName === name) return true;
      return false;
    }) ?? null
  );
};

const genGroupKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `g_${Math.random().toString(36).slice(2)}`;

export const makeEmptyRow = (opts?: {
  supplierMode?: 'directory' | 'manual';
  group_key?: string;
}): PriceComparisonRow => {
  const mode = opts?.supplierMode ?? 'directory';
  return {
    _key:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `row_${Math.random().toString(36).slice(2)}`,
    group_key: opts?.group_key ?? genGroupKey(),
    vendor_id: undefined,
    manual_vendor: mode === 'manual' ? { name: '' } : undefined,
    item_description: '',
    unit_price: '',
    quantity: '',
    is_selected: false,
    selection_reason: '',
  };
};

/**
 * Get display name for a row (either from directory vendor or manual vendor name).
 */
const getRowVendorName = (row: PriceComparisonRow, vendors: Vendor[]): string => {
  if (row.manual_vendor?.name) return row.manual_vendor.name;
  if (row.vendor_id) {
    const vendor = vendors.find((v) => vendorStringId(v) === row.vendor_id);
    return vendor?.name ?? row.vendor_id;
  }
  return '—';
};

/**
 * Determine the mode of a row: 'directory' or 'manual'
 */
const getRowMode = (row: PriceComparisonRow): 'directory' | 'manual' => {
  return row.manual_vendor ? 'manual' : 'directory';
};

/** Validation summary used by the parent form to gate Generate. */
export function validatePriceComparison(rows: PriceComparisonRow[], vendors: Vendor[]): string[] {
  const errors: string[] = [];
  if (rows.length < 1) errors.push('Add at least one supplier row.');
  const selected = rows.filter((r) => r.is_selected);
  if (selected.length === 0) errors.push('Mark one row as the selected supplier (the chosen vendor for the PO).');
  if (selected.length > 1) errors.push('Only one row can be marked as selected.');
  rows.forEach((r, i) => {
    // Check that either vendor_id or manual_vendor is set (but not both)
    const hasVendorId = !!r.vendor_id;
    const hasManualVendor = !!r.manual_vendor?.name;
    
    if (!hasVendorId && !hasManualVendor) {
      errors.push(`Row ${i + 1}: select a supplier or add manual vendor details.`);
    } else if (hasVendorId && hasManualVendor) {
      errors.push(`Row ${i + 1}: use either directory vendor OR manual vendor, not both.`);
    }
    
    // Validate vendor_id if using directory mode
    if (hasVendorId && !hasManualVendor) {
      if (
        vendors.length > 0 &&
        !vendors.some((v) => vendorStringId(v) === r.vendor_id)
      ) {
        errors.push(`Row ${i + 1}: supplier does not match a known vendor.`);
      }
    }
    
    // Validate manual_vendor if using manual mode. Email + phone are mandatory
    // because the manually-created vendor will later access the Vendor Portal.
    if (hasManualVendor && !hasVendorId) {
      const mv = r.manual_vendor!;
      if (!mv.name.trim()) {
        errors.push(`Row ${i + 1}: vendor name is required.`);
      }
      if (!mv.email?.trim()) {
        errors.push(`Row ${i + 1}: vendor email is required.`);
      } else if (!isValidEmail(mv.email)) {
        errors.push(`Row ${i + 1}: enter a valid vendor email.`);
      }
      if (!mv.phone?.trim()) {
        errors.push(`Row ${i + 1}: vendor phone number is required.`);
      }
    }
    
    if (!r.item_description.trim()) errors.push(`Row ${i + 1}: item description is required.`);
    const up = typeof r.unit_price === 'number' ? r.unit_price : Number(r.unit_price);
    if (!Number.isFinite(up) || up <= 0) errors.push(`Row ${i + 1}: enter a unit price > 0.`);
    const qty = typeof r.quantity === 'number' ? r.quantity : Number(r.quantity);
    if (!Number.isFinite(qty) || qty <= 0) errors.push(`Row ${i + 1}: enter a quantity > 0.`);
  });
  return errors;
}

/**
 * Per-row field error map. Used to highlight individual cells with red borders
 * so the PM can see exactly which inputs need fixing (1c — inline errors).
 */
export interface RowFieldErrors {
  supplier?: string;
  email?: string;
  phone?: string;
  item_description?: string;
  unit_price?: string;
  quantity?: string;
}

function computeRowFieldErrors(row: PriceComparisonRow, vendors: Vendor[]): RowFieldErrors {
  const out: RowFieldErrors = {};
  const hasVendorId = !!row.vendor_id;
  const hasManualVendor = !!row.manual_vendor;
  const hasManualName = !!row.manual_vendor?.name?.trim();
  if (!hasVendorId && !hasManualName) {
    out.supplier = 'Select a supplier or enter manual vendor name.';
  } else if (hasVendorId && hasManualName) {
    out.supplier = 'Use directory OR manual, not both.';
  } else if (hasVendorId && vendors.length > 0 && !vendors.some((v) => vendorStringId(v) === row.vendor_id)) {
    out.supplier = 'Supplier does not match a known vendor.';
  }
  // Manual vendors must capture a valid email + phone (used for Vendor Portal access).
  if (!hasVendorId && hasManualVendor) {
    const mv = row.manual_vendor!;
    if (!mv.email?.trim()) {
      out.email = 'Email is required.';
    } else if (!isValidEmail(mv.email)) {
      out.email = 'Enter a valid email.';
    }
    if (!mv.phone?.trim()) {
      out.phone = 'Phone is required.';
    }
  }
  if (!row.item_description.trim()) {
    out.item_description = 'Item description is required.';
  }
  const up = typeof row.unit_price === 'number' ? row.unit_price : Number(row.unit_price);
  if (!Number.isFinite(up) || up <= 0) out.unit_price = 'Unit price must be > 0.';
  const qty = typeof row.quantity === 'number' ? row.quantity : Number(row.quantity);
  if (!Number.isFinite(qty) || qty <= 0) out.quantity = 'Qty must be > 0.';
  return out;
}

export function PriceComparisonTable({
  value,
  onChange,
  vendors,
  disabled = false,
  loadingVendors = false,
  currency = 'NGN',
  defaultSupplierModeForNewRows = 'directory',
  paymentSchedule = null,
}: PriceComparisonTableProps) {
  const moneySymbol = currencySymbol(currency);
  /** Authoritative duplicate matches from GET /vendors/lookup, keyed by supplier group. */
  const [lookupMatches, setLookupMatches] = useState<
    Record<string, VendorLookupMatch | null | undefined>
  >({});
  const [lookupLoading, setLookupLoading] = useState<Set<string>>(() => new Set());
  const [vendorSearch, setVendorSearch] = useState('');
  const [searchedVendors, setSearchedVendors] = useState<Vendor[]>([]);
  const [searchingVendors, setSearchingVendors] = useState(false);

  useEffect(() => {
    const q = vendorSearch.trim();
    if (!q) {
      setSearchedVendors([]);
      setSearchingVendors(false);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearchingVendors(true);
      try {
        const res = await vendorApi.list({
          search: q,
          per_page: 20,
          page: 1,
          dropdown: true,
          status: 'Active',
        });
        if (res.success && res.data?.items) {
          setSearchedVendors(
            res.data.items.filter(
              (v) => v.status === 'Active' || v.status === 'Pending' || !v.status,
            ),
          );
        } else {
          setSearchedVendors([]);
        }
      } finally {
        setSearchingVendors(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [vendorSearch]);

  const directoryVendors = useMemo(() => {
    const q = vendorSearch.trim();
    if (q) return searchedVendors;
    // Prefer any selected vendors already on the rows so values stay visible.
    const selectedIds = new Set(
      value.map((r) => r.vendor_id).filter(Boolean) as string[],
    );
    const fromProps = vendors.filter((v) => selectedIds.has(vendorStringId(v)));
    const merged = new Map<string, Vendor>();
    for (const v of [...fromProps, ...searchedVendors]) {
      merged.set(vendorStringId(v), v);
    }
    return Array.from(merged.values());
  }, [vendorSearch, searchedVendors, vendors, value]);

  const runVendorLookup = useCallback(
    async (groupKey: string, manual: ManualVendor | undefined) => {
      const email = manual?.email?.trim();
      const name = manual?.name?.trim();
      if (!email && !name) {
        setLookupMatches((prev) => ({ ...prev, [groupKey]: null }));
        return;
      }
      setLookupLoading((prev) => new Set(prev).add(groupKey));
      try {
        const res = await vendorApi.lookup({ email, name });
        if (res.success && res.data) {
          setLookupMatches((prev) => ({ ...prev, [groupKey]: res.data!.match ?? null }));
        }
      } finally {
        setLookupLoading((prev) => {
          const next = new Set(prev);
          next.delete(groupKey);
          return next;
        });
      }
    },
    [],
  );

  const clearLookupForGroup = useCallback((groupKey: string) => {
    setLookupMatches((prev) => {
      const next = { ...prev };
      delete next[groupKey];
      return next;
    });
  }, []);
  /**
   * Group rows into supplier cards. Each card shares supplier identity
   * (vendor_id OR manual_vendor) across all its line items. The grouping key
   * is `group_key` when present; otherwise derived from supplier identity so
   * legacy rows hydrated from the backend snap together automatically.
   */
  const groups = useMemo(() => {
    const map = new Map<string, PriceComparisonRow[]>();
    const orderedKeys: string[] = [];
    value.forEach((r) => {
      const identityKey =
        r.vendor_id
          ? `v:${r.vendor_id}`
          : r.manual_vendor?.name?.trim()
            ? `m:${r.manual_vendor.name.trim().toLowerCase()}`
            : '';
      const key = r.group_key || identityKey || r._key;
      if (!map.has(key)) {
        map.set(key, []);
        orderedKeys.push(key);
      }
      map.get(key)!.push(r);
    });
    return orderedKeys.map((k) => ({ key: k, rows: map.get(k)! }));
  }, [value]);

  const update = (key: string, patch: Partial<PriceComparisonRow>) => {
    onChange(value.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  };

  /** Update supplier identity for ALL rows in a group at once. */
  const updateGroup = (groupKey: string, patch: Partial<PriceComparisonRow>) => {
    const rowsInGroup = new Set(
      groups.find((g) => g.key === groupKey)?.rows.map((r) => r._key) ?? [],
    );
    onChange(value.map((r) => (rowsInGroup.has(r._key) ? { ...r, ...patch } : r)));
  };

  /** Mark the supplier in a group as the selected (winning) supplier. */
  const selectGroup = (groupKey: string) => {
    const group = groups.find((g) => g.key === groupKey);
    if (!group) return;
    const firstRowKey = group.rows[0]?._key;
    onChange(
      value.map((r) => ({ ...r, is_selected: r._key === firstRowKey })),
    );
  };

  const setGroupMode = (groupKey: string, mode: 'directory' | 'manual') => {
    clearLookupForGroup(groupKey);
    updateGroup(groupKey, {
      vendor_id: undefined,
      manual_vendor: mode === 'manual' ? { name: '' } : undefined,
    });
  };

  /** Append a new line item to an existing supplier card. */
  const addLineItemToGroup = (groupKey: string) => {
    const group = groups.find((g) => g.key === groupKey);
    if (!group) return;
    const head = group.rows[0];
    const newRow: PriceComparisonRow = {
      ...makeEmptyRow({
        supplierMode: head?.manual_vendor ? 'manual' : 'directory',
        group_key: groupKey,
      }),
      vendor_id: head?.vendor_id,
      manual_vendor: head?.manual_vendor ? { ...head.manual_vendor } : undefined,
      selection_reason: head?.selection_reason ?? '',
      is_selected: false,
    };
    // Insert right after the last row of this group, preserving card order.
    const lastIdx = value
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => group.rows.some((gr) => gr._key === r._key))
      .pop()?.i;
    if (lastIdx === undefined) {
      onChange([...value, newRow]);
    } else {
      const next = [...value];
      next.splice(lastIdx + 1, 0, newRow);
      onChange(next);
    }
  };

  /** Add a brand-new supplier card (one empty line item). */
  const addSupplier = () =>
    onChange([
      ...value,
      makeEmptyRow({
        supplierMode: defaultSupplierModeForNewRows,
        group_key: genGroupKey(),
      }),
    ]);

  const removeRow = (rowKey: string) => {
    if (value.length <= 1) return;
    onChange(value.filter((r) => r._key !== rowKey));
  };

  /** Remove an entire supplier card and all its line items. */
  const removeGroup = (groupKey: string) => {
    const group = groups.find((g) => g.key === groupKey);
    if (!group) return;
    if (group.rows.length >= value.length) return; // keep at least one row overall
    const removeKeys = new Set(group.rows.map((r) => r._key));
    onChange(value.filter((r) => !removeKeys.has(r._key)));
  };

  const errors = useMemo(() => validatePriceComparison(value, vendors), [value, vendors]);
  const hasMin = value.length >= 1;
  const selectedCount = value.filter((r) => r.is_selected).length;
  const rowErrorMap = useMemo(() => {
    const m = new Map<string, RowFieldErrors>();
    value.forEach((r) => m.set(r._key, computeRowFieldErrors(r, vendors)));
    return m;
  }, [value, vendors]);

  return (
    <div className="space-y-3">
      {paymentSchedule ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <p className="font-medium text-foreground">
            Payment schedule
            {paymentSchedule.templateName ? ` · ${paymentSchedule.templateName}` : ''}
            {paymentSchedule.isLocked ? ' (locked)' : ''}
          </p>
          <p className="text-muted-foreground mt-0.5">
            {paymentSchedule.summary || formatScheduleSummary(paymentSchedule.milestones) || '—'}
          </p>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Each supplier card holds its own line items. Mark exactly one supplier as the
          <span className="font-medium text-foreground"> selected supplier</span> — that vendor is awarded the PO,
          and every line item under that card appears on the generated PO as a separate row.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSupplier}
            disabled={disabled}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Supplier
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {groups.map((group, gIdx) => {
          const head = group.rows[0];
          const headMode = getRowMode(head);
          const headFe = rowErrorMap.get(head._key) ?? {};
          const groupSelected = group.rows.some((r) => r.is_selected);
          const apiLookupMatch = lookupMatches[group.key];
          const clientDuplicateMatch =
            headMode === 'manual' ? findExistingVendorMatch(head.manual_vendor, vendors) : null;
          /** Prefer authoritative API match; fall back to client-side directory scan. */
          const duplicateMatch: (Vendor & { matchedOn?: 'email' | 'name' }) | null =
            headMode === 'manual'
              ? apiLookupMatch
                ? {
                    id: apiLookupMatch.id,
                    name: apiLookupMatch.name,
                    email: apiLookupMatch.email,
                    phone: apiLookupMatch.phone,
                    status: (apiLookupMatch.status as Vendor['status']) || 'Active',
                    category: '',
                    rating: 0,
                    totalOrders: 0,
                    matchedOn: apiLookupMatch.matchedOn,
                  }
                : clientDuplicateMatch
              : null;
          const isLookupPending = lookupLoading.has(group.key);
          const subtotal = group.rows.reduce(
            (acc, r) =>
              acc + (Number(r.unit_price) || 0) * (Number(r.quantity) || 0),
            0,
          );
          const supplierLabel =
            headMode === 'manual'
              ? head.manual_vendor?.name?.trim() || `Supplier ${gIdx + 1}`
              : head.vendor_id
                ? getRowVendorName(head, vendors)
                : `Supplier ${gIdx + 1}`;
          return (
            <div
              key={group.key}
              className={cn(
                'rounded-lg border bg-card p-3 space-y-3',
                groupSelected && 'border-success/60 bg-success/5',
              )}
            >
              {/* Supplier header */}
              <div className="flex flex-wrap items-start gap-3">
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="radio"
                    name="pc-supplier"
                    checked={groupSelected}
                    onChange={() => selectGroup(group.key)}
                    disabled={disabled}
                    className="h-4 w-4 accent-primary"
                    aria-label={`Select ${supplierLabel} as the winning supplier`}
                  />
                  <span className="text-xs font-medium">Selected</span>
                </label>
                <div className="flex-1 min-w-[260px] space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-xs font-semibold uppercase tracking-wide">
                      Supplier {gIdx + 1}
                    </Label>
                    {groupSelected && (
                      <span className="text-[10px] font-semibold text-success uppercase tracking-wide">
                        Winning
                      </span>
                    )}
                  </div>
                  <ToggleGroup
                    type="single"
                    value={headMode}
                    onValueChange={(m) =>
                      m && setGroupMode(group.key, m as 'directory' | 'manual')
                    }
                    disabled={disabled}
                    variant="outline"
                    size="sm"
                  >
                    <ToggleGroupItem value="directory" className="text-xs">
                      Directory
                    </ToggleGroupItem>
                    <ToggleGroupItem value="manual" className="text-xs">
                      Manual
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {headMode === 'directory' ? (
                    <div className="space-y-1.5">
                      <Input
                        value={vendorSearch}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        placeholder="Type to search vendors…"
                        disabled={disabled}
                        className="h-9"
                      />
                      <Select
                        value={head.vendor_id || undefined}
                        onValueChange={(v) =>
                          updateGroup(group.key, {
                            vendor_id: v,
                            manual_vendor: undefined,
                          })
                        }
                        disabled={disabled || searchingVendors || loadingVendors}
                      >
                        <SelectTrigger
                          className={cn('h-9', headFe.supplier && 'border-destructive')}
                          aria-invalid={!!headFe.supplier}
                        >
                          <SelectValue
                            placeholder={
                              searchingVendors || loadingVendors
                                ? 'Searching…'
                                : vendorSearch.trim()
                                  ? 'Select supplier from results'
                                  : 'Search vendors above'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-popover max-h-64">
                          {!vendorSearch.trim() && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              Type a vendor name or email to search
                            </div>
                          )}
                          {vendorSearch.trim() && !searchingVendors && directoryVendors.length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              No vendors found
                            </div>
                          )}
                          {directoryVendors.map((v) => (
                            <SelectItem key={v.id} value={vendorStringId(v)}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Input
                        value={head.manual_vendor?.name || ''}
                        onChange={(e) =>
                          updateGroup(group.key, {
                            manual_vendor: {
                              ...(head.manual_vendor || {}),
                              name: e.target.value,
                            } as ManualVendor,
                            vendor_id: undefined,
                          })
                        }
                        placeholder="Vendor name *"
                        disabled={disabled}
                        className={cn('h-9', headFe.supplier && 'border-destructive')}
                        aria-invalid={!!headFe.supplier}
                        onBlur={(e) => {
                          const name = e.target.value;
                          void runVendorLookup(group.key, {
                            ...(head.manual_vendor || { name: '' }),
                            name,
                          } as ManualVendor);
                        }}
                      />
                      <div className="grid grid-cols-2 gap-1">
                        <div className="space-y-0.5">
                          <Input
                            type="email"
                            value={head.manual_vendor?.email || ''}
                            onChange={(e) =>
                              updateGroup(group.key, {
                                manual_vendor: {
                                  ...(head.manual_vendor || {}),
                                  email: e.target.value,
                                } as ManualVendor,
                              })
                            }
                            placeholder="Email *"
                            disabled={disabled}
                            className={cn('h-8 text-xs', headFe.email && 'border-destructive')}
                            aria-invalid={!!headFe.email}
                            onBlur={(e) => {
                              const email = e.target.value;
                              void runVendorLookup(group.key, {
                                ...(head.manual_vendor || { name: '' }),
                                email,
                              } as ManualVendor);
                            }}
                          />
                          {headFe.email && (
                            <p className="text-[10px] text-destructive">{headFe.email}</p>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <Input
                            type="tel"
                            value={head.manual_vendor?.phone || ''}
                            onChange={(e) =>
                              updateGroup(group.key, {
                                manual_vendor: {
                                  ...(head.manual_vendor || {}),
                                  phone: e.target.value,
                                } as ManualVendor,
                              })
                            }
                            placeholder="Phone *"
                            disabled={disabled}
                            className={cn('h-8 text-xs', headFe.phone && 'border-destructive')}
                            aria-invalid={!!headFe.phone}
                          />
                          {headFe.phone && (
                            <p className="text-[10px] text-destructive">{headFe.phone}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        Email &amp; phone are required — the vendor uses them to access the Vendor Portal and finish onboarding.
                      </p>
                      {isLookupPending && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Checking vendor directory…
                        </p>
                      )}
                      {duplicateMatch && !isLookupPending && (
                        <div className="rounded-md border border-warning/50 bg-warning/10 p-2 space-y-1.5">
                          <div className="flex items-start gap-1.5 text-[11px] text-warning-foreground">
                            <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
                            <span>
                              A vendor matching this{' '}
                              {duplicateMatch.matchedOn === 'email' ||
                              (!duplicateMatch.matchedOn &&
                                head.manual_vendor?.email?.trim().toLowerCase() ===
                                  (duplicateMatch.email ?? '').trim().toLowerCase())
                                ? 'email'
                                : 'name'}{' '}
                              already exists:{' '}
                              <span className="font-medium">{duplicateMatch.name}</span>
                              {duplicateMatch.email ? ` (${duplicateMatch.email})` : ''}
                              {duplicateMatch.status === 'Inactive' && (
                                <span className="font-medium"> — status: Inactive</span>
                              )}
                              . Use the existing record to avoid creating a duplicate.
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={disabled}
                            onClick={() => {
                              clearLookupForGroup(group.key);
                              updateGroup(group.key, {
                                vendor_id: vendorStringId(duplicateMatch),
                                manual_vendor: undefined,
                              });
                            }}
                          >
                            Use existing vendor
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {headFe.supplier && (
                    <p className="text-[11px] text-destructive">{headFe.supplier}</p>
                  )}
                  <Input
                    value={head.selection_reason}
                    onChange={(e) =>
                      updateGroup(group.key, { selection_reason: e.target.value })
                    }
                    placeholder={
                      groupSelected
                        ? 'Why this supplier? (recorded on the PO)'
                        : 'Notes / reason (optional)'
                    }
                    disabled={disabled}
                    className="h-9 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGroup(group.key)}
                  disabled={disabled || group.rows.length >= value.length}
                  title={
                    group.rows.length >= value.length
                      ? 'At least one supplier is required'
                      : 'Remove this supplier and all its line items'
                  }
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remove supplier
                </Button>
              </div>

              {/* Line items */}
              <div className="rounded-md border bg-background/40">
                <div className="grid grid-cols-[1fr_120px_90px_120px_40px] gap-2 px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Description *</span>
                  <span>Unit Price ({moneySymbol}) *</span>
                  <span>Qty *</span>
                  <span className="text-right">Total ({moneySymbol})</span>
                  <span />
                </div>
                <div className="divide-y">
                  {group.rows.map((row, idx) => {
                    const up = Number(row.unit_price) || 0;
                    const qty = Number(row.quantity) || 0;
                    const total = up * qty;
                    const fe = rowErrorMap.get(row._key) ?? {};
                    const canRemove =
                      !(group.rows.length <= 1) && value.length > 1;
                    return (
                      <div
                        key={row._key}
                        className="grid grid-cols-[1fr_120px_90px_120px_40px] gap-2 px-3 py-2 items-start"
                      >
                        <div>
                          <Input
                            value={row.item_description}
                            onChange={(e) =>
                              update(row._key, { item_description: e.target.value })
                            }
                            placeholder={`Line item ${idx + 1}`}
                            disabled={disabled}
                            className={cn(
                              'h-9',
                              fe.item_description && 'border-destructive',
                            )}
                            aria-invalid={!!fe.item_description}
                          />
                          {fe.item_description && (
                            <p className="mt-1 text-[11px] text-destructive">
                              {fe.item_description}
                            </p>
                          )}
                        </div>
                        <div>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.unit_price}
                            onChange={(e) =>
                              update(row._key, {
                                unit_price:
                                  e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                            disabled={disabled}
                            className={cn('h-9', fe.unit_price && 'border-destructive')}
                            aria-invalid={!!fe.unit_price}
                          />
                          {fe.unit_price && (
                            <p className="mt-1 text-[11px] text-destructive">
                              {fe.unit_price}
                            </p>
                          )}
                        </div>
                        <div>
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            value={row.quantity}
                            onChange={(e) =>
                              update(row._key, {
                                quantity:
                                  e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                            disabled={disabled}
                            className={cn('h-9', fe.quantity && 'border-destructive')}
                            aria-invalid={!!fe.quantity}
                          />
                          {fe.quantity && (
                            <p className="mt-1 text-[11px] text-destructive">
                              {fe.quantity}
                            </p>
                          )}
                        </div>
                        <div className="pt-2 text-right font-medium tabular-nums text-sm">
                          {total > 0 ? formatPoAmount(total, currency) : '—'}
                        </div>
                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(row._key)}
                            disabled={disabled || !canRemove}
                            title={
                              canRemove
                                ? 'Remove this line item'
                                : 'Each supplier needs at least one line item'
                            }
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 text-xs">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addLineItemToGroup(group.key)}
                    disabled={disabled}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add line item
                  </Button>
                  <div className="font-medium">
                    Subtotal:{' '}
                    <span className="tabular-nums">{formatPoAmount(subtotal, currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(errors.length > 0 || !hasMin || selectedCount !== 1) && (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2 text-warning-foreground font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            Comparison sheet incomplete
          </div>
          <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
            {errors.slice(0, 6).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <p className="text-muted-foreground italic">
            You can still Save as Draft — partial rows will be preserved.
          </p>
        </div>
      )}
    </div>
  );
}