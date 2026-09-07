import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import type { Concentration, ExecAlert, TrendPoint } from "@/utils/executiveIntelligence";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const money = (v: number): string => {
  if (!Number.isFinite(v)) return "-";
  if (Math.abs(v) >= 1_000_000_000) return `₦${(v / 1_000_000_000).toFixed(1)}b`;
  if (Math.abs(v) >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}m`;
  if (Math.abs(v) >= 1_000) return `₦${(v / 1_000).toFixed(0)}k`;
  return `₦${Math.round(v).toLocaleString()}`;
};

interface MetricProps {
  label: string;
  value: string | number;
  hint?: string;
  delta?: number | null;
  /** Lower is better — inverts delta colouring. */
  invertDelta?: boolean;
  tone?: "default" | "warning" | "danger" | "success";
  onClick?: () => void;
}

export const ExecMetric = ({
  label,
  value,
  hint,
  delta,
  invertDelta,
  tone = "default",
  onClick,
}: MetricProps) => {
  const positive = (delta ?? 0) >= 0;
  const good = invertDelta ? !positive : positive;
  const DeltaIcon = delta == null ? Minus : positive ? ArrowUpRight : ArrowDownRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group w-full rounded-xl border bg-card p-3 text-left transition-all sm:p-4",
        onClick && "hover:border-primary/40 hover:shadow-md",
        tone === "danger" && "border-destructive/40 bg-destructive/5",
        tone === "warning" && "border-amber-500/40 bg-amber-500/5",
        tone === "success" && "border-emerald-500/40 bg-emerald-500/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
          {label}
        </p>
        {onClick && (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
        {delta != null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium",
              good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
            )}
          >
            <DeltaIcon className="h-3 w-3" />
            {Math.abs(Math.round(delta))}%
          </span>
        )}
      </div>
    </button>
  );
};

export const SectionCard = ({
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
  <Card className={className}>
    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
      <div className="min-w-0">
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </div>
      {action}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const severityStyles: Record<ExecAlert["severity"], string> = {
  critical: "border-l-destructive bg-destructive/5",
  high: "border-l-amber-500 bg-amber-500/5",
  medium: "border-l-primary bg-primary/5",
};

export const AlertsPanel = ({
  alerts,
  onSelect,
}: {
  alerts: ExecAlert[];
  onSelect: (alert: ExecAlert) => void;
}) => {
  if (alerts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nothing needs executive attention right now.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <button
          key={alert.id}
          type="button"
          onClick={() => onSelect(alert)}
          className={cn(
            "flex w-full items-start justify-between gap-3 rounded-lg border border-l-4 p-3 text-left transition-colors hover:bg-muted/60",
            severityStyles[alert.severity],
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{alert.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{alert.detail}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant={alert.severity === "critical" ? "destructive" : "secondary"}
              className="hidden capitalize sm:inline-flex"
            >
              {alert.severity}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
};

export const PipelineFlow = ({
  stages,
  onSelect,
}: {
  stages: { label: string; count: number; bucket: string }[];
  onSelect: (bucket: string) => void;
}) => {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <button
          key={stage.label}
          type="button"
          onClick={() => onSelect(stage.bucket)}
          className="w-full text-left"
        >
          <div className="mb-1 flex items-center justify-between gap-2 text-xs sm:text-sm">
            <span className="truncate text-muted-foreground">{stage.label}</span>
            <span className="font-semibold tabular-nums">{stage.count}</span>
          </div>
          <Progress value={(stage.count / max) * 100} className="h-2" />
        </button>
      ))}
    </div>
  );
};

export const SpendTrendChart = ({ data }: { data: TrendPoint[] }) => (
  <div className="h-56 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="execSpend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickFormatter={(v) => money(Number(v))} tickLine={false} axisLine={false} fontSize={11} width={56} />
        <Tooltip
          formatter={(value: number, name) =>
            name === "value" ? [money(Number(value)), "Value"] : [value, "Requests"]
          }
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#execSpend)"
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export const ConcentrationChart = ({ data }: { data: Concentration[] }) => {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No data for this period.</p>;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => money(Number(v))} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={110} fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value: number) => [money(Number(value)), "Value"]}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
