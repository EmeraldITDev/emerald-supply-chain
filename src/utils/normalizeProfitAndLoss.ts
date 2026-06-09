/**
 * Bug B — Normalize the `/mrfs/{id}/line-item-pnl` (and SRF equivalent)
 * response into the `ProfitAndLoss` shape the UI expects.
 *
 * Backend has been observed to return any of:
 *   - { items: [...], summary: {...} }                  (camelCase already)
 *   - { line_items: [...], summary: { total_budget } }  (snake_case)
 *   - { data: { items|line_items: [...] } }             (wrapped)
 *   - bare array of line rows                           (no summary)
 *
 * If genuinely empty we still return a well-formed object so the UI can
 * decide between "loading" and "empty".
 */
import type { LineItemPnL, ProfitAndLoss } from '@/types';

const num = (v: unknown): number => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

const pickArray = (raw: any): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const candidates = [
    raw.items,
    raw.line_items,
    raw.lineItems,
    raw.line_item_pnl,
    raw.lineItemPnl,
    raw.rows,
    raw.data?.items,
    raw.data?.line_items,
    raw.data?.lineItems,
    raw.data,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
};

const normalizeItem = (row: any, idx: number): LineItemPnL => {
  const budget = num(
    row.budgetAmount ??
      row.budget_amount ??
      row.budget ??
      row.estimated_amount ??
      row.estimatedAmount,
  );
  const quoted = num(
    row.quotedAmount ??
      row.quoted_amount ??
      row.quoted ??
      row.actual_amount ??
      row.actualAmount ??
      row.total_price ??
      row.totalPrice,
  );
  const variance = num(row.variance ?? row.delta ?? budget - quoted);
  const rawType = String(
    row.varianceType ?? row.variance_type ?? '',
  ).toLowerCase();
  const varianceType: LineItemPnL['varianceType'] =
    rawType === 'saving' || rawType === 'loss' || rawType === 'neutral'
      ? (rawType as LineItemPnL['varianceType'])
      : variance > 0
      ? 'saving'
      : variance < 0
      ? 'loss'
      : 'neutral';
  return {
    id: String(row.id ?? row.line_item_id ?? row.lineItemId ?? `row-${idx}`),
    itemName: String(
      row.itemName ??
        row.item_name ??
        row.name ??
        row.description ??
        `Item ${idx + 1}`,
    ),
    budgetAmount: budget,
    quotedAmount: quoted,
    variance: Math.abs(variance),
    varianceType,
  };
};

export const normalizeProfitAndLoss = (raw: unknown): ProfitAndLoss => {
  const r: any = raw ?? {};
  const rawItems = pickArray(r);
  const items = rawItems.map(normalizeItem);

  const summarySrc: any = r.summary ?? r.totals ?? r.data?.summary ?? {};
  const computed = items.reduce(
    (acc, it) => {
      acc.budget += it.budgetAmount;
      acc.quoted += it.quotedAmount;
      if (it.varianceType === 'saving') acc.savings += it.variance;
      if (it.varianceType === 'loss') acc.loss += it.variance;
      return acc;
    },
    { budget: 0, quoted: 0, savings: 0, loss: 0 },
  );

  const totalBudget = num(
    summarySrc.totalBudget ?? summarySrc.total_budget ?? computed.budget,
  );
  const totalQuoted = num(
    summarySrc.totalQuoted ?? summarySrc.total_quoted ?? computed.quoted,
  );
  const totalSavings = num(
    summarySrc.totalSavings ?? summarySrc.total_savings ?? computed.savings,
  );
  const totalLoss = num(
    summarySrc.totalLoss ?? summarySrc.total_loss ?? computed.loss,
  );
  const netVariance = num(
    summarySrc.netVariance ??
      summarySrc.net_variance ??
      totalSavings - totalLoss,
  );
  const lineCount = num(
    summarySrc.lineCount ?? summarySrc.line_count ?? items.length,
  );

  return {
    items,
    summary: {
      totalBudget,
      totalQuoted,
      netVariance,
      totalSavings,
      totalLoss,
      lineCount,
    },
  };
};
