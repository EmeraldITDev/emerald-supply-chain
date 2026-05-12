import { useMemo } from 'react';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { PriceComparisonRow } from '@/types/procurement';

export interface PriceComparisonTableProps {
  value: PriceComparisonRow[];
  onChange: (rows: PriceComparisonRow[]) => void;
  vendors: Vendor[];
  disabled?: boolean;
  loadingVendors?: boolean;
}

/**
 * Returns a vendor's stable "string id" for `vendor_id` (e.g. VND-001).
 * Falls back to the canonical id when no formatted id exists.
 */
const vendorStringId = (v: Vendor): string => {
  const anyV = v as Vendor & { formatted_id?: string; vendor_id?: string };
  return anyV.formatted_id ?? anyV.vendor_id ?? v.id;
};

export const makeEmptyRow = (): PriceComparisonRow => ({
  _key:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `row_${Math.random().toString(36).slice(2)}`,
  vendor_id: '',
  item_description: '',
  unit_price: '',
  quantity: '',
  is_selected: false,
  selection_reason: '',
});

/** Validation summary used by the parent form to gate Generate. */
export function validatePriceComparison(rows: PriceComparisonRow[], vendors: Vendor[]): string[] {
  const errors: string[] = [];
  if (rows.length < 2) errors.push('Add at least two supplier rows.');
  const selected = rows.filter((r) => r.is_selected);
  if (selected.length === 0) errors.push('Mark exactly one row as the selected supplier.');
  if (selected.length > 1) errors.push('Only one row can be marked as selected.');
  rows.forEach((r, i) => {
    if (!r.vendor_id) errors.push(`Row ${i + 1}: choose a supplier.`);
    else if (
      vendors.length > 0 &&
      !vendors.some((v) => vendorStringId(v) === r.vendor_id)
    )
      errors.push(`Row ${i + 1}: supplier does not match a known vendor.`);
    if (!r.item_description.trim()) errors.push(`Row ${i + 1}: item description is required.`);
    const up = typeof r.unit_price === 'number' ? r.unit_price : Number(r.unit_price);
    if (!Number.isFinite(up) || up <= 0) errors.push(`Row ${i + 1}: enter a unit price > 0.`);
    const qty = typeof r.quantity === 'number' ? r.quantity : Number(r.quantity);
    if (!Number.isFinite(qty) || qty <= 0) errors.push(`Row ${i + 1}: enter a quantity > 0.`);
  });
  return errors;
}

export function PriceComparisonTable({
  value,
  onChange,
  vendors,
  disabled = false,
  loadingVendors = false,
}: PriceComparisonTableProps) {
  const update = (key: string, patch: Partial<PriceComparisonRow>) => {
    onChange(value.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  };

  const setSelected = (key: string) => {
    onChange(value.map((r) => ({ ...r, is_selected: r._key === key })));
  };

  const addRow = () => onChange([...value, makeEmptyRow()]);

  const removeRow = (key: string) => {
    if (value.length <= 2) return; // visual guard, min 2
    onChange(value.filter((r) => r._key !== key));
  };

  const errors = useMemo(() => validatePriceComparison(value, vendors), [value, vendors]);
  const hasMin = value.length >= 2;
  const selectedCount = value.filter((r) => r.is_selected).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Add at least two supplier quotes below. Mark the selected supplier. This comparison
          will be saved against the MRF and attached to the PO when routed for approval.
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
              <TableHead className="min-w-[180px]">Supplier *</TableHead>
              <TableHead className="min-w-[200px]">Item / Service Description *</TableHead>
              <TableHead className="min-w-[120px]">Unit Price (₦) *</TableHead>
              <TableHead className="min-w-[90px]">Qty *</TableHead>
              <TableHead className="min-w-[120px]">Total (₦)</TableHead>
              <TableHead className="min-w-[180px]">Notes / Reason</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {value.map((row, idx) => {
              const up = Number(row.unit_price) || 0;
              const qty = Number(row.quantity) || 0;
              const total = up * qty;
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
                    <Select
                      value={row.vendor_id || undefined}
                      onValueChange={(v) => update(row._key, { vendor_id: v })}
                      disabled={disabled || loadingVendors}
                    >
                      <SelectTrigger className="h-9">
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
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={row.item_description}
                      onChange={(e) =>
                        update(row._key, { item_description: e.target.value })
                      }
                      placeholder="e.g. HP EliteBook 840"
                      disabled={disabled}
                      className="h-9"
                    />
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
                      className="h-9"
                    />
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
                      className="h-9"
                    />
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
                      size="icon"
                      onClick={() => removeRow(row._key)}
                      disabled={disabled || value.length <= 2}
                      title={value.length <= 2 ? 'Minimum of 2 rows required' : 'Remove row'}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
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