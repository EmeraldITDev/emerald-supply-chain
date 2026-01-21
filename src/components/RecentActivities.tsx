import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, CheckCircle, XCircle, Send, ShoppingCart, DollarSign, Package, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dashboardApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  entityId?: string;
  entityType?: string;
  status?: string;
}

interface RecentActivitiesProps {
  limit?: number;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'mrf_created':
    case 'mrf_approved':
    case 'mrf_rejected':
      return <FileText className="h-4 w-4" />;
    case 'rfq_sent':
      return <Send className="h-4 w-4" />;
    case 'quotation_submitted':
    case 'quotation_approved':
    case 'quotation_rejected':
      return <ShoppingCart className="h-4 w-4" />;
    case 'po_generated':
      return <FileText className="h-4 w-4" />;
    case 'payment_processed':
      return <DollarSign className="h-4 w-4" />;
    case 'grn_received':
      return <Package className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getActivityColor = (type: string) => {
  if (type.includes('approved') || type.includes('processed') || type.includes('received')) {
    return 'bg-success/10 text-success';
  }
  if (type.includes('rejected')) {
    return 'bg-destructive/10 text-destructive';
  }
  return 'bg-info/10 text-info';
};

export const RecentActivities = ({ limit = 10 }: RecentActivitiesProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      try {
        const response = await dashboardApi.getRecentActivities(user?.role || 'employee');
        if (response.success && response.data) {
          setActivities(response.data.slice(0, limit));
        } else {
          // Silently fail if endpoint doesn't exist yet (backend not implemented)
          console.warn('Recent activities endpoint not available:', response.error);
          setActivities([]);
        }
      } catch (error: any) {
        // Handle 404 or class not found errors gracefully
        if (error?.message?.includes('Activity') || error?.message?.includes('404') || error?.message?.includes('not found')) {
          console.warn('Recent activities endpoint not implemented yet');
          setActivities([]);
        } else {
          console.error('Failed to fetch activities:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    if (user?.role) {
      fetchActivities();
      // Refresh every 30 seconds
      const interval = setInterval(fetchActivities, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.role, limit, toast]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>Your recent workflow activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>Your recent workflow activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent activities</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
        <CardDescription>Your recent workflow activities</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                      {activity.user && (
                        <p className="text-xs text-muted-foreground mt-1">by {activity.user}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {activity.status && (
                        <Badge variant="outline" className="text-xs">
                          {activity.status}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
