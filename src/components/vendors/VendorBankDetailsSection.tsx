import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Landmark } from 'lucide-react';
import { hasVendorBankDetails, maskAccountNumber, pickVendorBankDetails } from '@/utils/vendorBankDetails';

interface VendorBankDetailsSectionProps {
  vendor: Record<string, unknown> | null | undefined;
  editing?: boolean;
  values?: { bankName: string; accountName: string; accountNumber: string };
  onChange?: (field: 'bankName' | 'accountName' | 'accountNumber', value: string) => void;
  /** When true, account number is masked in view mode (internal staff). */
  maskAccount?: boolean;
}

export function VendorBankDetailsSection({
  vendor,
  editing = false,
  values,
  onChange,
  maskAccount = true,
}: VendorBankDetailsSectionProps) {
  const bank = values ?? pickVendorBankDetails(vendor);
  const complete = hasVendorBankDetails(editing ? (values as Record<string, unknown>) : vendor);

  return (
    <div className="pt-4 border-t">
      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Landmark className="h-4 w-4" />
        Bank Details
        <span className="text-xs font-normal text-muted-foreground">(synced to Finance AP for payments)</span>
      </h4>

      {editing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground text-xs">Bank Name</Label>
            <Input
              value={bank.bankName}
              onChange={(e) => onChange?.('bankName', e.target.value)}
              placeholder="e.g. GTBank"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Account Name</Label>
            <Input
              value={bank.accountName}
              onChange={(e) => onChange?.('accountName', e.target.value)}
              placeholder="Account holder name"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-muted-foreground text-xs">Account Number</Label>
            <Input
              value={bank.accountNumber}
              onChange={(e) => onChange?.('accountNumber', e.target.value)}
              placeholder="10-digit account number"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-muted-foreground text-xs">Bank Name</Label>
            <p className="font-medium">{bank.bankName || '—'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Account Name</Label>
            <p className="font-medium">{bank.accountName || '—'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Account Number</Label>
            <p className="font-medium font-mono">
              {bank.accountNumber
                ? maskAccount
                  ? maskAccountNumber(bank.accountNumber)
                  : bank.accountNumber
                : '—'}
            </p>
          </div>
        </div>
      )}

      {!complete && !editing && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
          Bank details are incomplete. Vendors should complete these in the vendor portal so Finance AP can disburse payments.
        </p>
      )}
    </div>
  );
}
