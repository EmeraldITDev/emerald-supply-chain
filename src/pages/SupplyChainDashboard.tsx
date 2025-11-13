import { useState, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Upload, Download, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const SupplyChainDashboard = () => {
  const { mrfRequests, updateMRF } = useApp();
  const [selectedMRF, setSelectedMRF] = useState<string | null>(null);
  const [poNumbers, setPoNumbers] = useState<{ [key: string]: string }>({});
  const [signedPOs, setSignedPOs] = useState<{ [key: string]: File | null }>({});

  // Filter MRFs at supply chain stage with PO uploaded by Procurement
  const pendingPOs = useMemo(() => {
    return mrfRequests.filter(mrf => 
      mrf.currentStage === "supply_chain" && 
      mrf.unsignedPOUrl && // PO already uploaded by Procurement
      !mrf.signedPOUrl     // Not yet signed
    );
  }, [mrfRequests]);

  const handleGeneratePO = (mrfId: string) => {
    const poNumber = poNumbers[mrfId];
    if (!poNumber?.trim()) {
      toast.error("Please enter PO number");
      return;
    }

    updateMRF(mrfId, {
      poNumber,
      unsignedPOUrl: `unsigned-po-${poNumber}.pdf`, // Placeholder
      status: "PO Generated - Awaiting Signature"
    });
    toast.success("Unsigned PO generated - Please sign and upload");
    setSelectedMRF(null);
  };

  const handleUploadSignedPO = (mrfId: string) => {
    const file = signedPOs[mrfId];
    if (!file) {
      toast.error("Please select a signed PO file");
      return;
    }

    updateMRF(mrfId, {
      signedPOUrl: `signed-po-${mrfId}.pdf`, // Placeholder
      currentStage: "finance",
      status: "PO Signed - Forwarded to Finance"
    });
    toast.success("Signed PO uploaded successfully - Forwarded to Finance for payment processing");
    setSignedPOs(prev => ({ ...prev, [mrfId]: null }));
    setSelectedMRF(null);
  };

  const handleFileChange = (mrfId: string, file: File | null) => {
    setSignedPOs(prev => ({ ...prev, [mrfId]: file }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Supply Chain Director Dashboard</h1>
          <p className="text-muted-foreground">Review, sign and upload Purchase Orders</p>
        </div>

        {/* Summary Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending POs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPOs.length}</div>
            <p className="text-xs text-muted-foreground">POs awaiting review and signature</p>
          </CardContent>
        </Card>

        {/* PO Management */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders</CardTitle>
            <CardDescription>Review, sign, and upload Purchase Orders from Procurement</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingPOs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No POs pending processing</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPOs.map((mrf) => (
                  <Card key={mrf.id} className="border-l-4 border-l-primary">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{mrf.title}</CardTitle>
                          <CardDescription>
                            {mrf.id} • {mrf.requester} • {mrf.department}
                          </CardDescription>
                        </div>
                        <Badge>₦{parseFloat(mrf.estimatedCost).toLocaleString()}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-semibold">Category:</p>
                          <p className="text-muted-foreground">{mrf.category}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Quantity:</p>
                          <p className="text-muted-foreground">{mrf.quantity}</p>
                        </div>
                        <div>
                          <p className="font-semibold">PO Number:</p>
                          <p className="text-muted-foreground font-mono">{mrf.poNumber}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Status:</p>
                          <Badge variant="outline">{mrf.status}</Badge>
                        </div>
                        <div className="md:col-span-2">
                          <p className="font-semibold">Description:</p>
                          <p className="text-muted-foreground">{mrf.description}</p>
                        </div>
                      </div>

                      {/* Download unsigned PO */}
                      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm flex-1">PO uploaded by Procurement Manager</span>
                        <Button variant="outline" size="sm" onClick={() => toast.info("Downloading PO...")}>
                          <Download className="h-4 w-4 mr-2" />
                          Download PO
                        </Button>
                      </div>

                      {/* Upload signed PO */}
                      <div className="space-y-3">
                        <Label>Upload Signed PO</Label>
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => handleFileChange(mrf.id, e.target.files?.[0] || null)}
                        />
                        {signedPOs[mrf.id] && (
                          <p className="text-xs text-muted-foreground">
                            Selected: {signedPOs[mrf.id]?.name}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          onClick={() => handleUploadSignedPO(mrf.id)} 
                          className="flex-1"
                          disabled={!signedPOs[mrf.id]}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload & Forward to Finance
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={() => {
                            const reason = prompt("Enter reason for rejection:");
                            if (reason) {
                              updateMRF(mrf.id, {
                                currentStage: "procurement",
                                status: "PO Rejected by Supply Chain",
                                rejectionReason: reason
                              });
                              toast.error("PO rejected - Sent back to Procurement for revision");
                            }
                          }}
                        >
                          Reject PO
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SupplyChainDashboard;
