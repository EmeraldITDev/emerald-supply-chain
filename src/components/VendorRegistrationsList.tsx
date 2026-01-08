import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { vendorApi } from "@/services/api";
import { VendorRegistration } from "@/types";
import {
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Loader2,
  Users,
} from "lucide-react";

interface VendorRegistrationsListProps {
  maxItems?: number;
  showTabs?: boolean;
  title?: string;
  onViewRegistration?: (registration: VendorRegistration) => void;
  externalRegistrations?: VendorRegistration[];
  externalLoading?: boolean;
}

const VendorRegistrationsList = ({
  maxItems,
  showTabs = true,
  title = "Vendor Registrations",
  onViewRegistration,
  externalRegistrations,
  externalLoading,
}: VendorRegistrationsListProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<VendorRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  // Use external data if provided, otherwise fetch from API
  const useExternalData = externalRegistrations !== undefined;

  useEffect(() => {
    if (useExternalData) {
      setRegistrations(externalRegistrations || []);
      setLoading(externalLoading || false);
      return;
    }

    const fetchRegistrations = async () => {
      setLoading(true);
      try {
        const response = await vendorApi.getRegistrations();
        if (response.success && response.data) {
          setRegistrations(response.data);
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load vendor registrations",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRegistrations();
  }, [toast, useExternalData, externalRegistrations, externalLoading]);

  const pendingRegistrations = registrations.filter(r => r.status === "Pending" || r.status === "Under Review");
  const approvedRegistrations = registrations.filter(r => r.status === "Approved");
  const rejectedRegistrations = registrations.filter(r => r.status === "Rejected");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <Badge className="bg-warning/10 text-warning"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case "Approved":
        return <Badge className="bg-success/10 text-success"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
      case "Rejected":
        return <Badge className="bg-destructive/10 text-destructive"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      case "Under Review":
        return <Badge className="bg-info/10 text-info"><FileText className="h-3 w-3 mr-1" /> Under Review</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleViewClick = (registration: VendorRegistration) => {
    if (onViewRegistration) {
      onViewRegistration(registration);
    } else {
      navigate(`/vendors/registration/${registration.id}`);
    }
  };

  const renderRegistrationCard = (registration: VendorRegistration) => (
    <Card key={registration.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold truncate">{registration.companyName}</h4>
              <p className="text-sm text-muted-foreground truncate">{registration.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {getStatusBadge(registration.status)}
                <span className="text-xs text-muted-foreground">
                  {registration.category}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewClick(registration)}
            className="shrink-0"
          >
            <Eye className="h-4 w-4 mr-1" />
            Review
          </Button>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Submitted: {registration.submittedDate ? new Date(registration.submittedDate).toLocaleDateString() : "N/A"}
        </div>
      </CardContent>
    </Card>
  );

  const renderList = (items: VendorRegistration[]) => {
    const displayItems = maxItems ? items.slice(0, maxItems) : items;
    
    if (displayItems.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No registrations found</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {displayItems.map(renderRegistrationCard)}
        {maxItems && items.length > maxItems && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/vendors")}
          >
            View all {items.length} registrations
          </Button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!showTabs) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription>
                {pendingRegistrations.length} pending review
              </CardDescription>
            </div>
            {pendingRegistrations.length > 0 && (
              <Badge variant="destructive" className="text-sm">
                {pendingRegistrations.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {renderList(pendingRegistrations)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>
          Review and manage vendor registration submissions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="relative">
              Pending
              {pendingRegistrations.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs h-5 px-1.5">
                  {pendingRegistrations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved
              <Badge variant="secondary" className="ml-2 text-xs h-5 px-1.5">
                {approvedRegistrations.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected
              <Badge variant="secondary" className="ml-2 text-xs h-5 px-1.5">
                {rejectedRegistrations.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            {renderList(pendingRegistrations)}
          </TabsContent>
          <TabsContent value="approved" className="mt-4">
            {renderList(approvedRegistrations)}
          </TabsContent>
          <TabsContent value="rejected" className="mt-4">
            {renderList(rejectedRegistrations)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default VendorRegistrationsList;
