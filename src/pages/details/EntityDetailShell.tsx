import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText } from "lucide-react";

interface EntityDetailShellProps {
  title: string;
  subtitle?: string;
  status?: string;
  backTo: string;
  backLabel: string;
  loading?: boolean;
  error?: string | null;
  notFound?: boolean;
  notFoundLabel?: string;
  children?: ReactNode;
}

export function EntityDetailShell({
  title,
  subtitle,
  status,
  backTo,
  backLabel,
  loading,
  error,
  notFound,
  notFoundLabel = "Record not found",
  children,
}: EntityDetailShellProps) {
  const navigate = useNavigate();

  const header = (
    <div className="flex items-center gap-4">
      <Button variant="ghost" onClick={() => navigate(backTo)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {backLabel}
      </Button>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {header}
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading…
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (error || notFound) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {header}
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>{error || notFoundLabel}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {header}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-2xl truncate">{title}</CardTitle>
                {subtitle && (
                  <p className="mt-2 font-mono text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                )}
              </div>
              {status && (
                <Badge variant="secondary" className="shrink-0">
                  {status}
                </Badge>
              )}
            </div>
          </CardHeader>
          {children && <CardContent>{children}</CardContent>}
        </Card>
      </div>
    </DashboardLayout>
  );
}

interface DetailFieldsProps {
  fields: Array<{ label: string; value: ReactNode }>;
}

export function DetailFields({ fields }: DetailFieldsProps) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.label} className="space-y-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {f.label}
          </dt>
          <dd className="text-sm break-words">{f.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}