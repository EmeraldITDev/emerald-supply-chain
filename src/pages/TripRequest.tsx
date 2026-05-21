import { Navigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TripRequestForm } from "@/components/logistics/TripRequestForm";
import { useAuth } from "@/contexts/AuthContext";
import { canCreateTripRequest } from "@/utils/tripRequestAccess";

const TripRequest = () => {
  const { user } = useAuth();

  if (!canCreateTripRequest(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trip Request</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Request travel for business purposes. Logistics will review and arrange transport.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New trip request</CardTitle>
            <CardDescription>
              Provide destination, schedule, and passengers. You will be notified as the request progresses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TripRequestForm />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TripRequest;
