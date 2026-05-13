import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { mrfApi } from '@/services/api';
import type { MRF } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export interface ManualPOQuickStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired with the new MRF id once it has been created on the backend. */
  onMRFCreated: (mrfId: string) => void;
}

const CATEGORY_OPTIONS = [
  'equipment',
  'maintenance',
  'construction',
  'safety-equipment',
  'office-supplies',
  'services',
  'other',
];

/** Same values as New MRF — must match backend `contract_type` validation. */
const CONTRACT_TYPE_OPTIONS = [
  { value: 'emerald', label: 'Emerald Contract' },
  { value: 'oando', label: 'Oando Contract' },
  { value: 'dangote', label: 'Dangote Contract' },
  { value: 'heritage', label: 'Heritage Contract' },
] as const;

export function ManualPOQuickStartDialog({
  open,
  onOpenChange,
  onMRFCreated,
}: ManualPOQuickStartDialogProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('equipment');
  const [contractType, setContractType] = useState('');
  const [urgency, setUrgency] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [quantity, setQuantity] = useState('1');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setCategory('equipment');
      setContractType('');
      setUrgency('Medium');
      setQuantity('1');
      setEstimatedCost('');
      setDescription('');
      setSubmitting(false);
    }
  }, [open]);

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    quantity.trim().length > 0 &&
    contractType.length > 0 &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const dept = user?.department?.trim();
      const res = await mrfApi.create({
        title: title.trim(),
        category,
        urgency,
        description: description.trim(),
        quantity: quantity.trim(),
        estimatedCost: estimatedCost.trim(),
        justification:
          'Manual PO created without RFQ — vendor and pricing captured directly on the purchase order.',
        contract_type: contractType,
        contractType,
        ...(dept ? { department: dept } : {}),
      });
      if (!res.success || !res.data) {
        toast.error(res.error || 'Could not create the backing request.');
        return;
      }
      const mrf = res.data as MRF;
      const id = (mrf as MRF & { id?: string }).id;
      if (!id) {
        toast.error('Backend did not return a request id.');
        return;
      }
      toast.success('Request created. Continue with PO details.');
      onMRFCreated(id);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle>Create PO without RFQ</DialogTitle>
          <DialogDescription>
            Enter the basic request details. After this, you will fill in the
            full PO (vendor, line items, price comparison) on the next screen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-po-title">Title *</Label>
            <Input
              id="manual-po-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Replacement generator parts"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c.replace('-', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Urgency *</Label>
              <Select
                value={urgency}
                onValueChange={(v) => setUrgency(v as 'Low' | 'Medium' | 'High')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contract type *</Label>
            <Select value={contractType} onValueChange={setContractType}>
              <SelectTrigger>
                <SelectValue placeholder="Select contract type" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {CONTRACT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Required for routing (e.g. Emerald vs non-Emerald approval paths). Same options as
              New Material Request.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manual-po-qty">Quantity *</Label>
              <Input
                id="manual-po-qty"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 10 units"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-po-cost">Estimated Cost (₦)</Label>
              <Input
                id="manual-po-cost"
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="Optional"
              />
              <p className="text-xs text-muted-foreground">
                Internal-only — never shown to vendors.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-po-desc">Description *</Label>
            <Textarea
              id="manual-po-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is being purchased and why?"
              required
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                'Continue to PO Details'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}