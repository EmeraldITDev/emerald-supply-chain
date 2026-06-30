/** Read vendor bank fields from API payloads (snake_case or camelCase). */
export function pickVendorBankDetails(source: Record<string, unknown> | null | undefined) {
  if (!source) {
    return { bankName: '', accountName: '', accountNumber: '' };
  }
  return {
    bankName: String(source.bank_name ?? source.bankName ?? '').trim(),
    accountName: String(source.account_name ?? source.accountName ?? '').trim(),
    accountNumber: String(source.account_number ?? source.accountNumber ?? '').trim(),
  };
}

export function maskAccountNumber(value?: string | null): string {
  if (!value) return '—';
  const s = String(value).trim();
  if (s.length <= 4) return '••••';
  return `••••${s.slice(-4)}`;
}

export function hasVendorBankDetails(source: Record<string, unknown> | null | undefined): boolean {
  const { bankName, accountName, accountNumber } = pickVendorBankDetails(source);
  return Boolean(bankName && accountName && accountNumber);
}
