import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, User, FileText, Package } from "lucide-react";
import { format } from "date-fns";

const MRNDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mrns } = useApp();

  const mrn = mrns.find(m => m.id === id);

  if (!mrn) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>MRN not found</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending": return "bg-yellow-500";
      case "Under Review": return "bg-blue-500";
      case "Converted to MRF": return "bg-green-500";
      case "Rejected": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const totalEstimatedCost = mrn.items.reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.estimatedUnitCost) || 0),
    0
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* MRN Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{mrn.title}</CardTitle>
                <CardDescription className="mt-2">
                  <span className="font-mono text-sm font-semibold">{mrn.controlNumber}</span>
                </CardDescription>
              </div>
              <Badge className={getStatusColor(mrn.status)}>
                {mrn.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Department</label>
                  <p className="text-lg">{mrn.department}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Category</label>
                  <p className="text-lg capitalize">{mrn.category}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">Urgency</label>
                  <div className="mt-1">
                    <Badge variant={mrn.urgency === "High" ? "destructive" : "secondary"}>
                      {mrn.urgency}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-semibold text-muted-foreground">Requested By</label>
                    <p className="text-lg">{mrn.requesterName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-semibold text-muted-foreground">Submitted Date</label>
                    <p className="text-lg">{format(new Date(mrn.submittedDate), "MMMM dd, yyyy")}</p>
                  </div>
                </div>
                {mrn.reviewDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <label className="text-sm font-semibold text-muted-foreground">Review Date</label>
                      <p className="text-lg">{format(new Date(mrn.reviewDate), "MMMM dd, yyyy")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Justification */}
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Justification</label>
              <p className="mt-2 text-base">{mrn.justification}</p>
            </div>

            {/* Items Requested */}
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-3 block">
                Items Requested ({mrn.items.length})
              </label>
              <div className="space-y-3">
                {mrn.items.map((item, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-semibold">{item.name}</h4>
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Quantity</p>
                          <p className="font-semibold">{item.quantity}</p>
                          <p className="text-sm text-muted-foreground mt-2">Unit Cost</p>
                          <p className="font-semibold">₦{parseFloat(item.estimatedUnitCost).toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground mt-2">Subtotal</p>
                          <p className="text-lg font-bold">
                            ₦{(parseFloat(item.quantity) * parseFloat(item.estimatedUnitCost)).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Total Cost */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">Total Estimated Cost</span>
                <span className="text-2xl font-bold text-primary">
                  ₦{totalEstimatedCost.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Review Notes */}
            {mrn.reviewNotes && (
              <div className="bg-muted p-4 rounded-lg">
                <label className="text-sm font-semibold">Review Notes</label>
                <p className="mt-2 text-sm">{mrn.reviewNotes}</p>
                {mrn.reviewedBy && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Reviewed by {mrn.reviewedBy}
                    {mrn.reviewDate && ` on ${format(new Date(mrn.reviewDate), "MMM dd, yyyy")}`}
                  </p>
                )}
              </div>
            )}

            {/* Converted MRF Info */}
            {mrn.convertedMRFId && (
              <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                  ✓ This MRN has been converted to MRF
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  MRF Control Number: <span className="font-mono font-semibold">{mrn.convertedMRFId}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MRNDetail;
