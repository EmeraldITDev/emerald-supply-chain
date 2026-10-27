import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { PoRegisterSummary } from "@/services/reportsApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chronologicalMonths, formatRegisterMoney, rankedVendorGroups } from "./poRegisterPresentation";

export function PoRegisterCharts({ summary }: { summary: PoRegisterSummary }) {
  const months = useMemo(() => chronologicalMonths(summary.monthlyTrend ?? []), [summary.monthlyTrend]);
  const groups = useMemo(() => rankedVendorGroups(summary.topVendorsByCurrency ?? []), [summary.topVendorsByCurrency]);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [limit, setLimit] = useState("5");
  const group = groups.find((entry) => entry.currency === selectedCurrency) ?? groups[0];
  const vendors = group?.vendors.slice(0, Number(limit)) ?? [];

  return <div className="grid min-w-0 gap-4 xl:grid-cols-2">
    <Card className="min-w-0 rounded-lg">
      <CardHeader className="pb-4"><CardTitle className="text-base">Monthly PO trend</CardTitle></CardHeader>
      <CardContent className="px-3 pb-5 sm:px-6">
        {months.length ? <div className="overflow-x-auto overscroll-x-contain">
          <ChartContainer aria-label="Monthly purchase order counts" config={{ count: { label: "POs", color: "hsl(var(--primary))" } }} className={`h-[320px] w-full aspect-auto ${months.length > 6 ? "min-w-[640px]" : "min-w-[300px]"}`}>
            <LineChart data={months} margin={{ top: 20, right: 24, left: 0, bottom: 12 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} minTickGap={14} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent className="max-w-[260px]" formatter={(value) => <span className="tabular-nums">{Number(value).toLocaleString()} POs</span>} />} />
              <Line type="linear" dataKey="count" stroke="var(--color-count)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
        </div> : <p className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">No monthly trend data for these filters.</p>}
      </CardContent>
    </Card>
    <Card className="min-w-0 rounded-lg">
      <CardHeader className="gap-3 pb-4">
        <CardTitle className="text-base">Top vendors by value</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          {groups.length > 0 && <div className="min-w-[120px] space-y-1"><Label htmlFor="vendor-chart-currency" className="text-xs text-muted-foreground">Currency</Label>
            <Select value={group?.currency} onValueChange={setSelectedCurrency}><SelectTrigger id="vendor-chart-currency" className="h-9"><SelectValue /></SelectTrigger><SelectContent>{groups.map((entry) => <SelectItem key={entry.currency} value={entry.currency}>{entry.currency}</SelectItem>)}</SelectContent></Select>
          </div>}
          <div className="min-w-[110px] space-y-1"><Label htmlFor="vendor-chart-limit" className="text-xs text-muted-foreground">Ranking</Label>
            <Select value={limit} onValueChange={setLimit}><SelectTrigger id="vendor-chart-limit" className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="5">Top 5</SelectItem><SelectItem value="10">Top 10</SelectItem></SelectContent></Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-5 sm:px-6">
        {vendors.length && group ? <div className="max-h-[360px] overflow-auto overscroll-contain">
          <ChartContainer aria-label={`Highest value vendors in ${group.currency}`} config={{ totalPoValue: { label: "PO value", color: "hsl(var(--success))" } }} className={`w-full min-w-[480px] aspect-auto ${vendors.length > 5 ? "h-[560px]" : "h-[320px]"}`}>
            <BarChart data={vendors} layout="vertical" barSize={20} margin={{ top: 10, right: 28, left: 0, bottom: 14 }}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
              <XAxis type="number" tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} tickFormatter={(value) => formatRegisterMoney(Number(value), group.currency, true)} />
              <YAxis type="category" dataKey="name" width={160} interval={0} tickLine={false} axisLine={false} tickMargin={10} tickFormatter={(name: string) => name.length > 21 ? `${name.slice(0, 20)}…` : name} />
              <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent className="max-w-[260px] break-words" labelFormatter={(_, payload) => String(payload[0]?.payload?.name ?? "")} formatter={(value) => <span className="font-medium tabular-nums">{formatRegisterMoney(Number(value), group.currency)}</span>} />} />
              <Bar dataKey="totalPoValue" fill="var(--color-totalPoValue)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </div> : <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">No vendor data for these filters.</p>}
      </CardContent>
    </Card>
  </div>;
}