import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PaymentScheduleCustomMilestoneInput, PaymentTriggerCondition } from '@/types/payment-schedule';
import { sumMilestonePercentages } from '@/types/payment-schedule';

export type PaymentMilestoneInput = PaymentScheduleCustomMilestoneInput;

interface TemplateDef {
  key: string;
  name: string;
  milestones: Omit<PaymentMilestoneInput, 'milestoneNumber'>[];
}

const TEMPLATES: TemplateDef[] = [
  { key: 'advance_100', name: '100% Advance', milestones: [
    { label: 'Full Advance', percentage: 100, triggerCondition: 'on_advance' },
  ]},
  { key: '70_30', name: '70% Advance / 30% on Delivery', milestones: [
    { label: 'Advance', percentage: 70, triggerCondition: 'on_advance' },
    { label: 'On Delivery', percentage: 30, triggerCondition: 'upon_delivery' },
  ]},
  { key: '50_50', name: '50% Advance / 50% on Delivery', milestones: [
    { label: 'Advance', percentage: 50, triggerCondition: 'on_advance' },
    { label: 'On Delivery', percentage: 50, triggerCondition: 'upon_delivery' },
  ]},
  { key: '30_40_30', name: '30% Advance / 40% on Delivery / 30% on Completion', milestones: [
    { label: 'Advance', percentage: 30, triggerCondition: 'on_advance' },
    { label: 'On Delivery', percentage: 40, triggerCondition: 'upon_delivery' },
    { label: 'On Completion', percentage: 30, triggerCondition: 'on_completion' },
  ]},
  { key: 'custom', name: 'Custom', milestones: [] },
];

const TRIGGER_LABELS: Record<string, string> = {
  on_advance: 'On Advance',
  upon_delivery: 'Upon Delivery',
  on_grn: 'On GRN',
  on_invoice: 'On Invoice',
  on_completion: 'On Completion',
};

const TRIGGER_OPTIONS: PaymentTriggerCondition[] = [
  'on_advance', 'upon_delivery', 'on_grn', 'on_invoice', 'on_completion',
];

interface Props {
  value: PaymentMilestoneInput[];
  onChange: (next: PaymentMilestoneInput[]) => void;
  /** When provided, the builder also reports validity changes (sum===100). */
  onValidityChange?: (valid: boolean) => void;
  required?: boolean;
  className?: string;
}

/**
 * PaymentMilestoneBuilder — reusable structured-milestone editor.
 * Submit-on-parent should be gated on `onValidityChange === true`.
 */
export function PaymentMilestoneBuilder({ value, onChange, onValidityChange, required, className }: Props) {
  const [templateKey, setTemplateKey] = useState<string>(() =>
    value.length === 0 ? '' : 'custom',
  );

  const total = useMemo(() => sumMilestonePercentages(value), [value]);
  // Empty schedule is valid when optional (Create PO marks milestones optional).
  const valid =
    value.length === 0
      ? !required
      : Math.abs(total - 100) < 0.001;

  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  const applyTemplate = (key: string) => {
    setTemplateKey(key);
    const tpl = TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    if (key === 'custom') {
      if (value.length === 0) {
        onChange([{ milestoneNumber: 1, label: '', percentage: 0, triggerCondition: 'on_advance' }]);
      }
      return;
    }
    onChange(
      tpl.milestones.map((m, i) => ({ ...m, milestoneNumber: i + 1 })),
    );
  };

  const updateRow = (idx: number, patch: Partial<PaymentMilestoneInput>) => {
    const next = value.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...value,
      { milestoneNumber: value.length + 1, label: '', percentage: 0, triggerCondition: 'on_advance' },
    ]);
    setTemplateKey('custom');
  };

  const removeRow = (idx: number) => {
    const next = value
      .filter((_, i) => i !== idx)
      .map((m, i) => ({ ...m, milestoneNumber: i + 1 }));
    onChange(next);
    setTemplateKey('custom');
  };

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <div className="space-y-2">
        <Label>
          Payment Milestones {required && <span className="text-destructive">*</span>}
        </Label>
        <Select value={templateKey} onValueChange={applyTemplate}>
          <SelectTrigger>
            <SelectValue placeholder="Select a payment template…" />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATES.map((t) => (
              <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          {value.map((m, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5 space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={m.label}
                  onChange={(e) => updateRow(idx, { label: e.target.value })}
                  placeholder="e.g. Advance"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">%</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={m.percentage}
                  onChange={(e) => updateRow(idx, { percentage: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-4 space-y-1">
                <Label className="text-xs">Trigger</Label>
                <Select
                  value={m.triggerCondition}
                  onValueChange={(v) =>
                    updateRow(idx, { triggerCondition: v as PaymentTriggerCondition })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{TRIGGER_LABELS[t] ?? t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeRow(idx)}
                  aria-label="Remove milestone"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2 border-t">
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Add milestone
            </Button>
            <div className={`text-sm font-medium flex items-center gap-1 ${valid ? 'text-emerald-600' : 'text-destructive'}`}>
              {valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              Total: {total.toFixed(2)}% {valid ? '' : `(must equal 100%)`}
            </div>
          </div>
        </div>
      )}

      {value.length > 0 && !valid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Milestone percentages must add up to exactly 100%. Submission will be blocked until they balance.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/** Serialize for backend: payment_milestones: [{label, percentage, trigger_condition}]. */
export function serializePaymentMilestones(
  value: PaymentMilestoneInput[],
): Array<{ label: string; percentage: number; trigger_condition: string }> {
  return value.map((m) => ({
    label: m.label,
    percentage: m.percentage,
    trigger_condition: m.triggerCondition,
  }));
}