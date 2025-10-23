import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/contexts/AppContext";
import { CheckCircle, Download, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const FinanceDashboard = () => {
  const { mrfRequests, purchaseOrders } = useApp();
  const { toast } = useToast();
  const [processedItems, setProcessedItems] = useState<Set<string>>(new Set());

  // Filter for approved MRFs only (those that reached finance stage)
  const approvedMRFs = mrfRequests.filter(mrf => 
    mrf.currentStage === "chairman" || mrf.currentStage === "approved"
  );

  const pendingPayment = approvedMRFs.filter(mrf => !processedItems.has(mrf.id));
  const processed = approvedMRFs.filter(mrf => processedItems.has(mrf.id));

  const handleMarkProcessed = (id: string) => {
    setProcessedItems(prev => new Set([...prev, id]));
    toast({
      title: "Payment Processed",
      description: "Request has been marked as processed",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Finance Dashboard</h1>
        <p className="text-muted-foreground">Payment Processing & Financial Oversight</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Processing</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayment.length}</div>
            <p className="text-xs text-muted-foreground">Approved requests pending payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processed.length}</div>
            <p className="text-xs text-muted-foreground">Payments completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Approved Requests for Processing */}
      <Card>
        <CardHeader>
          <CardTitle>Approved Requests for Processing</CardTitle>
          <CardDescription>Review and process approved requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingPayment.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No requests pending payment</p>
              </div>
            ) : (
              pendingPayment.map((mrf) => (
                <div key={mrf.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{mrf.title}</h3>
                      <Badge variant="outline">{mrf.id}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p className="text-muted-foreground">Requester: {mrf.requester}</p>
                      <p className="text-muted-foreground">Category: {mrf.category}</p>
                      <p className="font-semibold">Amount: ₦{parseInt(mrf.estimatedCost).toLocaleString()}</p>
                      <p className="text-muted-foreground">Date: {mrf.date}</p>
                    </div>
                    <p className="text-sm mt-2">{mrf.description}</p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4 mr-1" />
                      Documents
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleMarkProcessed(mrf.id)}
                    >
                      Mark as Processed
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Processed Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Processed Payments</CardTitle>
          <CardDescription>Payment history and records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {processed.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No processed payments yet</p>
              </div>
            ) : (
              processed.map((mrf) => (
                <div key={mrf.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{mrf.title}</h3>
                      <Badge variant="outline">{mrf.id}</Badge>
                      <Badge className="bg-green-100 text-green-800">Processed</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p className="text-muted-foreground">Requester: {mrf.requester}</p>
                      <p className="font-semibold">Amount: ₦{parseInt(mrf.estimatedCost).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceDashboard;
