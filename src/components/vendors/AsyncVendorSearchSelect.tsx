import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { vendorApi } from '@/services/api';
import type { Vendor } from '@/types';

interface AsyncVendorSearchSelectProps {
  value: string;
  onChange: (vendorId: string, vendor?: Vendor) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** When true (default), load Active vendors even before the user types. */
  loadOnOpen?: boolean;
  purpose?: 'rfq' | 'po' | 'manual_select';
}

export function AsyncVendorSearchSelect({
  value,
  onChange,
  label = 'Vendor',
  placeholder = 'Search vendors by name or email…',
  disabled = false,
  loadOnOpen = true,
  purpose = 'po',
}: AsyncVendorSearchSelectProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (disabled) return;
    const handle = window.setTimeout(async () => {
      if (!search.trim() && !loadOnOpen) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await vendorApi.list({
          search: search.trim() || undefined,
          per_page: 50,
          page: 1,
          dropdown: true,
          allowEmpty: true,
          purpose,
          activeOnly: true,
        });
        if (res.success && res.data) {
          setResults(res.data.items);
        } else {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search, disabled, loadOnOpen, purpose]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <Select
        value={value || undefined}
        onValueChange={(id) => {
          const vendor = results.find((v) => String(v.id) === id);
          onChange(id, vendor);
        }}
        disabled={disabled || (!results.length && !value && !loading)}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? 'Loading…' : 'Select vendor'} />
        </SelectTrigger>
        <SelectContent>
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {search.trim() ? 'Searching…' : 'Loading vendors…'}
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No vendors found</div>
          )}
          {results.map((v) => (
            <SelectItem key={String(v.id)} value={String(v.id)}>
              {v.name}
              {v.email ? ` (${v.email})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
