import { useMemo } from 'react';
import { Trash2, Plus, AlertCircle, Building2 } from 'lucide-react';
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
import type { Vendor } from '@/types';
import type { PriceComparisonRow, ManualVendor } from '@/types/procurement';
import type { PaymentSchedule } from '@/types/payment-schedule';
import { formatScheduleSummary } from '@/types/payment-schedule';

export interface PriceComparisonTableProps {
  value: PriceComparisonRow[];
  onChange: (rows: PriceComparisonRow[]) => void;
  vendors: Vendor[];
  disabled?: boolean;
  loadingVendors?: boolean;
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
    
    // Validate manual_vendor if using manual mode
    if (hasManualVendor && !hasVendorId) {
      if (!r.manual_vendor!.name.trim()) {
        errors.push(`Row ${i + 1}: vendor name is required.`);
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
  item_description?: string;
  unit_price?: string;
  quantity?: string;
}

function computeRowFieldErrors(row: PriceComparisonRow, vendors: Vendor[]): RowFieldErrors {
  const out: RowFieldErrors = {};
  const hasVendorId = !!row.vendor_id;
  const hasManualVendor = !!row.manual_vendor?.name?.trim();
  if (!hasVendorId && !hasManualVendor) {
    out.supplier = 'Select a supplier or enter manual vendor name.';
  } else if (hasVendorId && hasManualVendor) {
    out.supplier = 'Use directory OR manual, not both.';
  } else if (hasVendorId && vendors.length > 0 && !vendors.some((v) => vendorStringId(v) === row.vendor_id)) {
    out.supplier = 'Supplier does not match a known vendor.';
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
  defaultSupplierModeForNewRows = 'directory',
  paymentSchedule = null,
}: PriceComparisonTableProps) {
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
          Add one row per supplier quote (Directory or Manual). Mark one row as the
          <span className="font-medium text-foreground"> selected supplier</span> — that vendor is awarded the PO.
          To put multiple items on the same PO for that supplier, use{' '}
          <span className="font-medium text-foreground">+ Add line item</span> below; each extra row for the selected
          supplier becomes its own line on the generated PO.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLineItemForSelected}
            disabled={disabled || !selectedRow}
            title={
              selectedRow
                ? `Add another line item for ${selectedSupplierName}`
                : 'Mark a supplier as selected first'
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add line item{selectedRow ? ` for ${selectedSupplierName}` : ''}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={disabled}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Supplier
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] text-center">Selected</TableHead>
              <TableHead className="min-w-[200px]">Supplier / Source *</TableHead>
              <TableHead className="min-w-[200px]">Item / Service Description *</TableHead>
              <TableHead className="min-w-[120px]">Unit Price (₦) *</TableHead>
              <TableHead className="min-w-[90px]">Qty *</TableHead>
              <TableHead className="min-w-[120px]">Total (₦)</TableHead>
              <TableHead className="min-w-[160px]">Notes / Reason</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {value.map((row, idx) => {
              const up = Number(row.unit_price) || 0;
              const qty = Number(row.quantity) || 0;
              const total = up * qty;
              const mode = getRowMode(row);
              const vendorName = getRowVendorName(row, vendors);
              const fe = rowErrorMap.get(row._key) ?? {};

              return (
                <TableRow
                  key={row._key}
                  className={cn(row.is_selected && 'bg-success/10')}
                >
                  <TableCell className="text-center align-top pt-3">
                    <input
                      type="radio"
                      name="pc-selected"
                      checked={row.is_selected}
                      onChange={() => setSelected(row._key)}
                      disabled={disabled}
                      className="h-4 w-4 accent-primary cursor-pointer"
                      aria-label={`Mark row ${idx + 1} as selected`}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-2">
                      <ToggleGroup
                        type="single"
                        value={mode}
                        onValueChange={(m) => m && setMode(row._key, m as 'directory' | 'manual')}
                        disabled={disabled}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                      >
                        <ToggleGroupItem value="directory" className="text-xs flex-1">
                          Directory
                        </ToggleGroupItem>
                        <ToggleGroupItem value="manual" className="text-xs flex-1">
                          Manual
                        </ToggleGroupItem>
                      </ToggleGroup>

                      {mode === 'directory' ? (
                        <Select
                          value={row.vendor_id || undefined}
                          onValueChange={(v) =>
                            update(row._key, { vendor_id: v, manual_vendor: undefined })
                          }
                          disabled={disabled || loadingVendors}
                        >
                          <SelectTrigger
                            className={cn('h-9', fe.supplier && 'border-destructive')}
                            aria-invalid={!!fe.supplier}
                          >
                            <SelectValue
                              placeholder={loadingVendors ? 'Loading…' : 'Select supplier'}
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-popover max-h-64">
                            {vendors.map((v) => (
                              <SelectItem key={v.id} value={vendorStringId(v)}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-1.5">
                          <Input
                            value={row.manual_vendor?.name || ''}
                            onChange={(e) =>
                              update(row._key, {
                                manual_vendor: {
                                  ...(row.manual_vendor || {}),
                                  name: e.target.value,
                                } as ManualVendor,
                                vendor_id: undefined,
                              })
                            }
                            placeholder="Vendor name"
                            disabled={disabled}
                            className={cn('h-9 text-xs', fe.supplier && 'border-destructive')}
                            aria-invalid={!!fe.supplier}
                          />
                          <div className="grid grid-cols-2 gap-1">
                            <Input
                              type="email"
                              value={row.manual_vendor?.email || ''}
                              onChange={(e) =>
                                update(row._key, {
                                  manual_vendor: {
                                    ...(row.manual_vendor || {}),
                                    email: e.target.value,
                                  } as ManualVendor,
                                })
                              }
                              placeholder="Email (optional)"
                              disabled={disabled}
                              className="h-8 text-xs"
                            />
                            <Input
                              type="tel"
                              value={row.manual_vendor?.phone || ''}
                              onChange={(e) =>
                                update(row._key, {
                                  manual_vendor: {
                                    ...(row.manual_vendor || {}),
                                    phone: e.target.value,
                                  } as ManualVendor,
                                })
                              }
                              placeholder="Phone (optional)"
                              disabled={disabled}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      {fe.supplier && (
                        <p className="text-[11px] text-destructive">{fe.supplier}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={row.item_description}
                      onChange={(e) =>
                        update(row._key, { item_description: e.target.value })
                      }
                      placeholder="e.g. HP EliteBook 840"
                      disabled={disabled}
                      className={cn('h-9', fe.item_description && 'border-destructive')}
                      aria-invalid={!!fe.item_description}
                    />
                    {fe.item_description && (
                      <p className="mt-1 text-[11px] text-destructive">{fe.item_description}</p>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.unit_price}
                      onChange={(e) =>
                        update(row._key, {
                          unit_price: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      disabled={disabled}
                      className={cn('h-9', fe.unit_price && 'border-destructive')}
                      aria-invalid={!!fe.unit_price}
                    />
                    {fe.unit_price && (
                      <p className="mt-1 text-[11px] text-destructive">{fe.unit_price}</p>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      value={row.quantity}
                      onChange={(e) =>
                        update(row._key, {
                          quantity: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      disabled={disabled}
                      className={cn('h-9', fe.quantity && 'border-destructive')}
                      aria-invalid={!!fe.quantity}
                    />
                    {fe.quantity && (
                      <p className="mt-1 text-[11px] text-destructive">{fe.quantity}</p>
                    )}
                  </TableCell>
                  <TableCell className="align-top pt-4 font-medium tabular-nums">
                    {total > 0 ? `₦${total.toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={row.selection_reason}
                      onChange={(e) =>
                        update(row._key, { selection_reason: e.target.value })
                      }
                      placeholder={row.is_selected ? 'Why this supplier?' : 'Optional'}
                      disabled={disabled}
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(row._key)}
                      disabled={disabled || value.length <= 1}
                      title={value.length <= 1 ? 'At least one row required' : 'Remove row'}
                      className="h-8 justify-start text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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