import type { PoRegisterSummary } from "@/services/reportsApi";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthParts(value: string): { year: number; month: number } | undefined {
  const numeric = /^(\d{4})-(\d{1,2})(?:$|-|T)/.exec(value.trim());
  if (numeric) {
    const month = Number(numeric[2]);
    if (month >= 1 && month <= 12) return { year: Number(numeric[1]), month };
  }
  const named = /^([a-z]+)\s+(\d{4})$/i.exec(value.trim());
  if (named) {
    const index = monthNames.findIndex((name) => name.toLowerCase() === named[1].slice(0, 3).toLowerCase());
    if (index >= 0) return { year: Number(named[2]), month: index + 1 };
  }
  return undefined;
}

export function chronologicalMonths(rows: PoRegisterSummary["monthlyTrend"]) {
  return rows.map((row) => {
    const parts = monthParts(row.month);
    return { ...row, label: parts ? `${monthNames[parts.month - 1]} ${parts.year}` : row.month,
      monthOrder: parts ? parts.year * 12 + parts.month : Number.POSITIVE_INFINITY };
  }).sort((a, b) => a.monthOrder - b.monthOrder);
}

export function rankedVendorGroups(groups: PoRegisterSummary["topVendorsByCurrency"]) {
  return groups.map((group) => ({ ...group,
    vendors: [...group.vendors].sort((a, b) => b.totalPoValue - a.totalPoValue),
  }));
}

export function formatRegisterMoney(value: number, currency = "NGN", compact = false) {
  const code = currency.trim().toUpperCase() || "NGN";
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: code,
      currencyDisplay: "narrowSymbol", notation: compact ? "compact" : "standard",
      minimumFractionDigits: compact ? 0 : 2, maximumFractionDigits: compact ? 1 : 2,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
  }
}