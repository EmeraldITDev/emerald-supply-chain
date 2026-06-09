import { useMemo } from 'react';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

export const makeEmptyRow = (opts?: {
  supplierMode?: 'directory' | 'manual';
}): PriceComparisonRow => {
  const mode = opts?.supplierMode ?? 'directory';
  return {
    _key:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `row_${Math.random().toString(36).slice(2)}`,
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
  if (selected.length === 0) errors.push('Mark exactly one row as the selected supplier.');
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
  const update = (key: string, patch: Partial<PriceComparisonRow>) => {
    onChange(value.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  };

  const setSelected = (key: string) => {
    onChange(value.map((r) => ({ ...r, is_selected: r._key === key })));
  };

  const setMode = (key: string, mode: 'directory' | 'manual') => {
    update(key, {
      vendor_id: mode === 'directory' ? undefined : undefined,
      manual_vendor: mode === 'manual' ? { name: '' } : undefined,
    });
  };

  const addRow = () =>
    onChange([...value, makeEmptyRow({ supplierMode: defaultSupplierModeForNewRows })]);

  const removeRow = (key: string) => {
    if (value.length <= 1) return; // keep at least one row
    onChange(value.filter((r) => r._key !== key));
  };

  /** 1a — add another line item for the SAME supplier (copies vendor/manual fields). */
  const addLineItemForRow = (key: string) => {
    const src = value.find((r) => r._key === key);
    if (!src) return;
    const next: PriceComparisonRow = {
      ...makeEmptyRow({
        supplierMode: src.manual_vendor ? 'manual' : 'directory',
      }),
      vendor_id: src.vendor_id,
      manual_vendor: src.manual_vendor
        ? { ...src.manual_vendor }
        : undefined,
    };
    const idx = value.findIndex((r) => r._key === key);
    const out = [...value];
    out.splice(idx + 1, 0, next);
    onChange(out);
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
          Add one or more supplier quotes. Use <span className="font-medium text-foreground">Directory</span> to pick
          an existing vendor, or <span className="font-medium text-foreground">Manual</span> to type name, contact, and
          pricing without a directory record. Use <span className="font-medium text-foreground">+ Line item</span> to add
          additional items for the same supplier. Mark exactly one row as selected. This sheet is saved on the MRF and
          attached when the PO is generated for approval.
        </p>
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
                    <div className="flex flex-col items-stretch gap-1.5 min-w-[140px]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addLineItemForRow(row._key)}
                        disabled={disabled}
                        title="Add another line item for this supplier"
                        className="h-8 justify-start"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add line item
                      </Button>
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
                    </div>
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