import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Info,
  Minus,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ActivityPoint,
  DeliveryStats,
  HealthItem,
  Insight,
  PipelineStage,
  ProcAlert,
  VendorPerf,
} from "@/utils/procurementIntelligence";

export const money = (v: number): string => {
  if (!Number.isFinite(v)) return "-";
  if (Math.abs(v) >= 1_000_000_000) return `₦${(v / 1_000_000_000).toFixed(1)}b`;
  if (Math.abs(v) >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}m`;
  if (Math.abs(v) >= 1_000) return `₦${(v / 1_000).toFixed(0)}k`;
  return `₦${Math.round(v).toLocaleString()}`;
};

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
};

/* ---------------- Section shell ---------------- */

export const Section = ({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn("rounded-xl border bg-card", className)}>
    <header className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold sm:text-base">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </header>
    <div className="p-4 sm:p-5">{children}</div>
  </section>
);

/* ---------------- KPI card with sparkline ---------------- */

export interface KpiProps {
  label: string;
  value: string | number;
  delta?: number | null;
  deltaLabel?: string;
  context?: string;
  concern?: string;
  invertDelta?: boolean;
  spark?: { label: string; v: number }[];
  tone?: "default" | "warning" | "danger" | "success";
  onClick?: () => void;
}

export const KpiCard = ({
  label,
  value,
  delta,
  deltaLabel = "vs previous period",
  context,
  concern,
  invertDelta,
  spark,
  tone = "default",
  onClick,
}: KpiProps) => {
  const positive = (delta ?? 0) >= 0;
  const good = invertDelta ? !positive : positive;
  const DeltaIcon = delta == null ? Minus : positive ? ArrowUpRight : ArrowDownRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group flex w-full flex-col rounded-xl border bg-card p-3 text-left transition-all sm:p-4",
        onClick && "hover:border-primary/50 hover:shadow-md",
        tone === "danger" && "border-destructive/40 bg-destructive/5",
        tone === "warning" && "border-amber-500/40 bg-amber-500/5",
        tone === "success" && "border-emerald-500/40 bg-emerald-500/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {onClick && (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>

      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
        {spark && spark.length > 1 && (
          <div className="h-8 w-16 shrink-0 sm:w-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill={`url(#spark-${label.replace(/\W/g, "")})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {delta != null && (
        <span
          className={cn(
            "mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium",
            good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
          )}
        >
          <DeltaIcon className="h-3 w-3" />
          {Math.abs(Math.round(delta))}% {deltaLabel}
        </span>
      )}
      {context && <span className="mt-0.5 text-[11px] text-muted-foreground">{context}</span>}
      {concern && (
        <span className="mt-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          {concern}
        </span>
      )}
    </button>
  );
};

/* ---------------- Health overview ---------------- */

const healthTone: Record<HealthItem["status"], string> = {
  good: "border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  attention: "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  critical: "border-destructive/40 bg-destructive/5 text-destructive",
  unknown: "border-border bg-muted/30 text-muted-foreground",
};

const healthWord: Record<HealthItem["status"], string> = {
  good: "Healthy",
  attention: "Attention needed",
  critical: "Critical",
  unknown: "No data",
};

export const HealthOverview = ({ items }: { items: HealthItem[] }) => (
  <TooltipProvider delayDuration={150}>
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
      {items.map((item) => (
        <UITooltip key={item.key}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "cursor-help rounded-xl border p-3 transition-shadow hover:shadow-md",
                healthTone[item.status],
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <Info className="h-3 w-3 shrink-0 opacity-60" />
              </div>
              <p className="mt-1.5 text-sm font-semibold">{item.value}</p>
              <p className="mt-0.5 text-[11px] font-medium">{healthWord[item.status]}</p>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{item.reason}</TooltipContent>
        </UITooltip>
      ))}
    </div>
  </TooltipProvider>
);

/* ---------------- Activity trend ---------------- */

export const SERIES_META: { key: keyof ActivityPoint; label: string; color: string }[] = [
  { key: "materialRequests", label: "Material requests", color: "hsl(var(--primary))" },
  { key: "serviceRequests", label: "Service requests", color: "hsl(217 91% 60%)" },
  { key: "approved", label: "Approved", color: "hsl(142 71% 45%)" },
  { key: "purchaseOrders", label: "Purchase orders", color: "hsl(38 92% 50%)" },
];

export const ActivityTrendChart = ({
  data,
  visible,
  onPointClick,
}: {
  data: ActivityPoint[];
  visible: Record<string, boolean>;
  onPointClick?: () => void;
}) => (
  <div className="h-64 w-full sm:h-72">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} onClick={onPointClick}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={16} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={36} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {SERIES_META.filter((s) => visible[s.key as string]).map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key as string}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </div>
);

/* ---------------- Pipeline ---------------- */

export const PipelineBoard = ({
  stages,
  onSelect,
}: {
  stages: PipelineStage[];
  onSelect: (key: string) => void;
}) => {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-2.5">
      {stages.map((stage) => (
        <button
          key={stage.key}
          type="button"
          onClick={() => onSelect(stage.key)}
          className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
        >
          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
            <span className="truncate text-muted-foreground">{stage.label}</span>
            <span className="flex shrink-0 items-center gap-2">
              {stage.avgDays != null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                    stage.tone === "danger"
                      ? "bg-destructive/10 text-destructive"
                      : stage.tone === "warning"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {stage.avgDays.toFixed(1)}d avg
                </span>
              )}
              <span className="font-semibold tabular-nums">{stage.count}</span>
            </span>
          </div>
          <Progress
            value={(stage.count / max) * 100}
            className={cn(
              "mt-1.5 h-2",
              stage.tone === "danger" && "[&>div]:bg-destructive",
              stage.tone === "warning" && "[&>div]:bg-amber-500",
            )}
          />
        </button>
      ))}
    </div>
  );
};

/* ---------------- Alerts ---------------- */

const alertTone: Record<ProcAlert["severity"], string> = {
  critical: "border-l-destructive bg-destructive/5",
  attention: "border-l-amber-500 bg-amber-500/5",
  monitor: "border-l-primary bg-primary/5",
};

const alertBadge: Record<ProcAlert["severity"], string> = {
  critical: "Critical",
  attention: "Attention needed",
  monitor: "Monitor",
};

export const AttentionPanel = ({
  alerts,
  onSelect,
}: {
  alerts: ProcAlert[];
  onSelect: (alert: ProcAlert) => void;
}) => {
  if (!alerts.length) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nothing needs your attention right now.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onSelect(a)}
          className={cn(
            "flex w-full items-start justify-between gap-3 rounded-lg border border-l-4 p-3 text-left transition-colors hover:bg-muted/60",
            alertTone[a.severity],
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{a.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant={a.severity === "critical" ? "destructive" : "secondary"}
              className="hidden text-[10px] sm:inline-flex"
            >
              {alertBadge[a.severity]}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
};

/* ---------------- Insights ---------------- */

export const InsightCards = ({ insights }: { insights: Insight[] }) => {
  if (!insights.length) return null;
  return (
    <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
      {insights.map((i) => (
        <Card
          key={i.id}
          className={cn(
            "border-l-4",
            i.tone === "positive"
              ? "border-l-emerald-500"
              : i.tone === "negative"
                ? "border-l-amber-500"
                : "border-l-primary",
          )}
        >
          <CardContent className="p-3 sm:p-4">
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              {i.label}
            </p>
            <p className="mt-1.5 text-sm font-semibold leading-snug">{i.headline}</p>
            <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

/* ---------------- Vendor table ---------------- */

export const VendorPerformanceTable = ({
  rows,
  onSelect,
}: {
  rows: VendorPerf[];
  onSelect?: (name: string) => void;
}) => {
  if (!rows.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No vendor has a purchase order in this view yet.
      </p>
    );
  }
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-2 font-medium">Vendor</th>
            <th className="px-2 py-2 text-right font-medium">Rating</th>
            <th className="px-2 py-2 text-right font-medium">Active POs</th>
            <th className="px-2 py-2 text-right font-medium">On time</th>
            <th className="px-2 py-2 text-right font-medium">Avg delivery</th>
            <th className="px-2 py-2 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr
              key={v.name}
              onClick={() => onSelect?.(v.name)}
              className={cn("border-b last:border-0", onSelect && "cursor-pointer hover:bg-muted/50")}
            >
              <td className="max-w-[180px] truncate px-2 py-2.5 font-medium">
                {v.name}
                {v.kycPending && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    KYC pending
                  </Badge>
                )}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">
                {v.rating != null ? v.rating.toFixed(1) : "-"}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">{v.activePOs}</td>
              <td
                className={cn(
                  "px-2 py-2.5 text-right tabular-nums",
                  v.onTimePct != null && v.onTimePct < 70 && "text-destructive",
                  v.onTimePct != null && v.onTimePct >= 90 && "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {v.onTimePct != null ? `${v.onTimePct}%` : "-"}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">
                {v.avgDeliveryDays != null ? `${v.avgDeliveryDays.toFixed(1)}d` : "-"}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">{money(v.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ---------------- Delivery ---------------- */

const DELIVERY_COLORS = [
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(217 91% 60%)",
  "hsl(var(--destructive))",
];

export const DeliveryBreakdown = ({
  stats,
  onSelect,
}: {
  stats: DeliveryStats;
  onSelect: (bucket: "completed" | "awaiting_delivery" | "overdue_delivery") => void;
}) => {
  const data = [
    { name: "Delivered on time", value: stats.onTime, bucket: "completed" as const },
    { name: "Delivered late", value: stats.late, bucket: "completed" as const },
    { name: "In progress", value: stats.inProgress, bucket: "awaiting_delivery" as const },
    { name: "Overdue", value: stats.overdue, bucket: "overdue_delivery" as const },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  if (!total) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No delivery records for this period yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={DELIVERY_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5 self-center">
        {data.map((d, i) => (
          <button
            key={d.name}
            type="button"
            onClick={() => onSelect(d.bucket)}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: DELIVERY_COLORS[i] }}
              />
              {d.name}
            </span>
            <span className="font-semibold tabular-nums">
              {d.value} ({Math.round((d.value / total) * 100)}%)
            </span>
          </button>
        ))}
        {stats.upcoming > 0 && (
          <p className="px-2 pt-1 text-[11px] text-amber-600 dark:text-amber-400">
            {stats.upcoming} delivery deadline(s) within 7 days
          </p>
        )}
      </div>
    </div>
  );
};

export const DeliveryTrendChart = ({ data }: { data: { label: string; onTime: number; late: number }[] }) => (
  <div className="h-48 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={16} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={32} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="onTime" name="On time" stackId="d" fill="hsl(142 71% 45%)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="late" name="Late" stackId="d" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

/* ---------------- Value bars ---------------- */

export const ValueBarChart = ({
  data,
  emptyLabel = "No data for this view.",
}: {
  data: { name: string; value: number; count: number }[];
  emptyLabel?: string;
}) => {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => money(Number(v))} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={110} fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number) => [money(Number(v)), "Value"]} contentStyle={tooltipStyle} />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ValueTrendChart = ({ data }: { data: { label: string; value: number }[] }) => (
  <div className="h-48 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="poValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={16} />
        <YAxis tickFormatter={(v) => money(Number(v))} tickLine={false} axisLine={false} fontSize={11} width={52} />
        <Tooltip formatter={(v: number) => [money(Number(v)), "PO value"]} contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#poValue)" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);
