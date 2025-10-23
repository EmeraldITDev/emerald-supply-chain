import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Plus, CheckCircle, XCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EmployeeDashboard = () => {
  const { mrfRequests, srfRequests } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filter to show only current user's requests
  const myMRFs = mrfRequests.filter(mrf => mrf.requester === user?.name || mrf.requester === "Current User");
  const mySRFs = srfRequests.filter(srf => srf.requester === user?.name || srf.requester === "Current User");

  const pendingMRFs = myMRFs.filter(mrf => mrf.status === "Submitted" || mrf.status.includes("Pending"));
  const approvedMRFs = myMRFs.filter(mrf => mrf.status === "Approved");
  const rejectedMRFs = myMRFs.filter(mrf => mrf.status === "Rejected");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Employee Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.name}</p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/new-mrf")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New MRF
            </CardTitle>
            <CardDescription>Submit a Material Request Form</CardDescription>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/new-srf")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New SRF
            </CardTitle>
            <CardDescription>Submit a Service Request Form</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingMRFs.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedMRFs.length}</div>
            <p className="text-xs text-muted-foreground">Successfully approved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedMRFs.length}</div>
            <p className="text-xs text-muted-foreground">Needs revision</p>
          </CardContent>
        </Card>
      </div>

      {/* My Requests */}
      <Card>
        <CardHeader>
          <CardTitle>My Requests</CardTitle>
          <CardDescription>View and track your submitted requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {myMRFs.length === 0 && mySRFs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No requests submitted yet</p>
                <p className="text-sm">Create your first MRF or SRF to get started</p>
              </div>
            ) : (
              <>
                {myMRFs.map((mrf) => (
                  <div key={mrf.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{mrf.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${
                          mrf.status === "Approved" ? "bg-green-100 text-green-800" :
                          mrf.status === "Rejected" ? "bg-red-100 text-red-800" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {mrf.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{mrf.id} • {mrf.date}</p>
                      <p className="text-sm mt-1">{mrf.description}</p>
                      {mrf.rejectionReason && (
                        <p className="text-sm text-destructive mt-2">Rejection reason: {mrf.rejectionReason}</p>
                      )}
                    </div>
                    {mrf.status === "Rejected" && (
                      <Button 
                        size="sm" 
                        onClick={() => navigate("/new-mrf", { state: { rejectedMRF: mrf } })}
                      >
                        Edit & Resubmit
                      </Button>
                    )}
                  </div>
                ))}
                {mySRFs.map((srf) => (
                  <div key={srf.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{srf.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${
                          srf.status === "Completed" ? "bg-green-100 text-green-800" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {srf.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{srf.id} • {srf.date}</p>
                      <p className="text-sm mt-1">{srf.description}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDashboard;
