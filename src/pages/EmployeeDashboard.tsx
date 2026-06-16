import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { getDisplayId } from "@/utils/displayId";
import { getSrfRequesterDisplayName } from "@/utils/srfRequester";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  FileText,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Eye,
  MapPin,
  Calendar,
  ShoppingCart,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { canCreateTripRequest } from "@/utils/tripRequestAccess";
import { getScmRole, formatScmRoleLabel } from "@/utils/scmRole";

/**
 * Employee Dashboard — a true overview page (separate from "My Requests").
 *
 * Stats aggregate the user's own MRFs and SRFs:
 *   - Total Requests
 *   - Pending Requests
 *   - In Review Requests
 *   - Converted to RFQs (MRFs that have a linked RFQ)
 *   - Rejected Requests
 */
const EmployeeDashboard = () => {
  const { mrfRequests, srfRequests, rfqs } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();

  const ownsRequester = (requester?: string | null) => {
    if (!requester) return false;
    const r = requester.trim().toLowerCase();
    return (
      r === (user?.name || "").trim().toLowerCase() ||
      r === (user?.email || "").trim().toLowerCase()
    );
  };

  const myMRFs = useMemo(
    () => mrfRequests.filter((m) => ownsRequester(m.requester)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mrfRequests, user],
  );

  const mySRFs = useMemo(
    () => srfRequests.filter((s) => ownsRequester(getSrfRequesterDisplayName(s))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [srfRequests, user],
  );

  const stats = useMemo(() => {
    const all = [
      ...myMRFs.map((m) => ({ id: m.id, status: m.status || "", kind: "mrf" as const })),
      ...mySRFs.map((s) => ({ id: s.id, status: s.status || "", kind: "srf" as const })),
    ];

    const isPending = (s: string) => {
      const v = s.toLowerCase();
      return v.includes("pending") || v === "submitted" || v === "draft";
    };
    const isInReview = (s: string) => {
      const v = s.toLowerCase();
      return (
        v.includes("review") ||
        v.includes("approval") ||
        (v.includes("approved") && !v.includes("rfq") && !v.includes("po"))
      );
    };
    const isRejected = (s: string) => s.toLowerCase().includes("reject");

    const myMrfIds = new Set(myMRFs.map((m) => m.id));
    const convertedCount = rfqs.filter((r) => myMrfIds.has(r.mrfId)).length;
    // Plus MRFs whose status itself indicates RFQ stage
    const statusRfqCount = myMRFs.filter((m) =>
      (m.status || "").toLowerCase().includes("rfq"),
    ).length;
    const convertedToRfq = Math.max(convertedCount, statusRfqCount);

    return {
      total: all.length,
      pending: all.filter((x) => isPending(x.status)).length,
      inReview: all.filter((x) => isInReview(x.status)).length,
      convertedToRfq,
      rejected: all.filter((x) => isRejected(x.status)).length,
    };
  }, [myMRFs, mySRFs, rfqs]);

  const recent = useMemo(() => {
    type Row = {
      id: string;
      title: string;
      displayId: string;
      status: string;
      kind: "MRF" | "SRF";
      date: string;
    };
    const rows: Row[] = [
      ...myMRFs.map((m) => ({
        id: m.id,
        title: m.title,
        displayId: getDisplayId(m as never),
        status: m.status || "—",
        kind: "MRF" as const,
        date: m.date || "",
      })),
      ...mySRFs.map((s) => ({
        id: s.id,
        title: s.title,
        displayId: getDisplayId(s as never),
        status: s.status || "—",
        kind: "SRF" as const,
        date: (s as { createdAt?: string }).createdAt || s.date || "",
      })),
    ];
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows.slice(0, 5);
  }, [myMRFs, mySRFs]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome back{user?.name ? `, ${user.name}` : ""}. Here's a snapshot of your activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/new-mrf")} size="sm">
              <Plus className="mr-2 h-4 w-4" /> New MRF
            </Button>
            <Button onClick={() => navigate("/new-srf")} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" /> New SRF
            </Button>
            {canCreateTripRequest(getScmRole(user)) && (
              <Button onClick={() => navigate("/trip-request")} variant="outline" size="sm">
                <MapPin className="mr-2 h-4 w-4" /> Trip Request
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Requests"
            value={stats.total}
            description="MRFs + SRFs you raised"
            icon={TrendingUp}
            iconColor="text-info"
            onClick={() => navigate("/department")}
          />
          <StatCard
            title="Pending Requests"
            value={stats.pending}
            description="Awaiting first review"
            icon={Clock}
            iconColor="text-warning"
            onClick={() => navigate("/department")}
          />
          <StatCard
            title="In Review"
            value={stats.inReview}
            description="Under approval"
            icon={Eye}
            iconColor="text-primary"
            onClick={() => navigate("/department")}
          />
          <StatCard
            title="Converted to RFQs"
            value={stats.convertedToRfq}
            description="Reached RFQ stage"
            icon={ShoppingCart}
            iconColor="text-success"
            onClick={() => navigate("/department")}
          />
          <StatCard
            title="Rejected"
            value={stats.rejected}
            description="Needs revision"
            icon={XCircle}
            iconColor="text-destructive"
            onClick={() => navigate("/department")}
          />
        </div>

        {/* Recent + quick actions */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>Your five most recent requests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recent.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No requests yet. Create your first MRF or SRF.</p>
                </div>
              ) : (
                recent.map((r) => (
                  <button
                    key={`${r.kind}-${r.id}`}
                    type="button"
                    onClick={() => navigate("/department")}
                    className="w-full text-left flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.kind} • {r.displayId}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {r.status}
                    </Badge>
                  </button>
                ))
              )}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/department")}
              >
                Open My Requests
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
              <CardDescription>Jump into a workflow</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="justify-start" onClick={() => navigate("/new-mrf")}>
                <Plus className="mr-2 h-4 w-4" /> Create Material Request (MRF)
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate("/new-srf")}>
                <Plus className="mr-2 h-4 w-4" /> Create Service Request (SRF)
              </Button>
              {canCreateTripRequest(getScmRole(user)) && (
                <Button variant="outline" className="justify-start" onClick={() => navigate("/trip-request")}>
                  <MapPin className="mr-2 h-4 w-4" /> Submit Trip Request
                </Button>
              )}
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => navigate("/department?tab=annual")}
              >
                <Calendar className="mr-2 h-4 w-4" /> Annual Planning
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => navigate("/department")}
              >
                <CheckCircle className="mr-2 h-4 w-4" /> View all my requests
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmployeeDashboard;
