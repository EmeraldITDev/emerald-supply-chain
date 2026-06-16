import { useState } from "react";
import { Navigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TripRequestForm } from "@/components/logistics/TripRequestForm";
import { MyTripRequestsList } from "@/components/logistics/MyTripRequestsList";
import { useAuth } from "@/contexts/AuthContext";
import { canCreateTripRequest } from "@/utils/tripRequestAccess";
import { getScmRole, formatScmRoleLabel } from "@/utils/scmRole";

const TripRequest = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("new");
  const [listRefresh, setListRefresh] = useState(0);

  if (!canCreateTripRequest(getScmRole(user))) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trip Request</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Request travel for business purposes. Choose within state or outside state and book
            ahead per policy.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">New request</TabsTrigger>
            <TabsTrigger value="mine">My trip requests</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">New trip request</CardTitle>
                <CardDescription>
                  Trip type sets the minimum advance booking period. Logistics assigns the driver
                  after review.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TripRequestForm
                  onSuccess={() => {
                    setListRefresh((k) => k + 1);
                    setTab("mine");
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mine" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">My trip requests</CardTitle>
                <CardDescription>Track status and progress for your submitted trips.</CardDescription>
              </CardHeader>
              <CardContent>
                <MyTripRequestsList refreshKey={listRefresh} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default TripRequest;
