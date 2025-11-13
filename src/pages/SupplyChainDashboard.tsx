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

  // Filter MRFs at supply chain stage
  const pendingPOs = useMemo(() => {
    return mrfRequests.filter(mrf => 
      mrf.currentStage === "supply_chain" && 
      (mrf.status === "Executive Approved" || mrf.status === "Chairman Approved") &&
      !mrf.signedPOUrl
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
          <p className="text-muted-foreground">Generate and sign Purchase Orders</p>
        </div>

        {/* Summary Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending POs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPOs.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting PO generation and signature</p>
          </CardContent>
        </Card>

        {/* PO Management */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders</CardTitle>
            <CardDescription>Generate unsigned POs and upload signed copies</CardDescription>
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
                        <div className="md:col-span-2">
                          <p className="font-semibold">Description:</p>
                          <p className="text-muted-foreground">{mrf.description}</p>
                        </div>
                      </div>

                      {!mrf.poNumber ? (
                        // Generate PO step
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>PO Number</Label>
                            <Input
                              value={poNumbers[mrf.id] || ""}
                              onChange={(e) => setPoNumbers(prev => ({ ...prev, [mrf.id]: e.target.value }))}
                              placeholder="Enter PO number (e.g., PO-2025-001)"
                            />
                          </div>
                          <Button onClick={() => handleGeneratePO(mrf.id)} className="w-full">
                            <FileText className="mr-2 h-4 w-4" />
                            Generate Unsigned PO
                          </Button>
                        </div>
                      ) : !mrf.signedPOUrl ? (
                        // Upload signed PO step
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>PO Generated: {mrf.poNumber}</span>
                          </div>
                          <Button variant="outline" className="w-full">
                            <Download className="mr-2 h-4 w-4" />
                            Download Unsigned PO
                          </Button>
                          <div className="space-y-2">
                            <Label>Upload Signed PO</Label>
                            <Input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => handleFileChange(mrf.id, e.target.files?.[0] || null)}
                            />
                          </div>
                          {signedPOs[mrf.id] && (
                            <Button onClick={() => handleUploadSignedPO(mrf.id)} className="w-full">
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Signed PO & Forward to Finance
                            </Button>
                          )}
                        </div>
                      ) : null}
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
