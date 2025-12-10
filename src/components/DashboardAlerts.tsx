import { useState, useEffect } from "react";
import { Bell, FileText, Package, Users, AlertTriangle, Clock, CheckCircle, X, ChevronRight, Truck, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import type { DashboardAlert, AlertType, AlertPriority } from "@/types/dashboard-alerts";

interface DashboardAlertsProps {
  userRole: string;
  maxAlerts?: number;
  compact?: boolean;
}

export const DashboardAlerts = ({ userRole, maxAlerts = 10, compact = false }: DashboardAlertsProps) => {
  const navigate = useNavigate();
  const { vendorRegistrations, mrfRequests, mrns, rfqs, quotations, vehicles } = useApp();
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    const stored = localStorage.getItem("dismissedAlerts");
    return stored ? JSON.parse(stored) : [];
  });

  // Generate alerts based on current data
  useEffect(() => {
    const generatedAlerts: DashboardAlert[] = [];
    const now = new Date();

    // New vendor registrations (for Procurement/Admin)
    if (['procurement', 'admin', 'supply_chain_director'].includes(userRole)) {
      vendorRegistrations
        .filter(v => v.status === "Pending")
        .forEach(reg => {
          generatedAlerts.push({
            id: `vendor-reg-${reg.id}`,
            type: 'new_vendor_registration',
            title: 'New Vendor Registration',
            message: `${reg.companyName} has submitted a registration application`,
            priority: 'medium',
            timestamp: reg.submittedDate,
            read: false,
            actionUrl: '/vendors',
            actionLabel: 'Review',
            relatedId: reg.id,
            relatedType: 'vendor_registration',
            targetRoles: ['procurement', 'admin', 'supply_chain_director'],
          });
        });
    }

    // New MRFs pending (for Executive)
    if (['executive', 'chairman', 'admin'].includes(userRole)) {
      mrfRequests
        .filter(m => m.currentStage === 'executive' && m.status.includes('Pending'))
        .forEach(mrf => {
          generatedAlerts.push({
            id: `mrf-pending-${mrf.id}`,
            type: 'new_mrf',
            title: 'MRF Pending Approval',
            message: `${mrf.title} requires executive approval (₦${parseInt(mrf.estimatedCost).toLocaleString()})`,
            priority: parseFloat(mrf.estimatedCost) > 1000000 ? 'high' : 'medium',
            timestamp: mrf.date,
            read: false,
            actionUrl: '/executive',
            actionLabel: 'Review',
            relatedId: mrf.id,
            relatedType: 'mrf',
            targetRoles: ['executive', 'chairman', 'admin'],
          });
        });
    }

    // New MRNs pending (for Procurement)
    if (['procurement', 'admin', 'supply_chain_director'].includes(userRole)) {
      mrns
        .filter(m => m.status === 'Pending' || m.status === 'Under Review')
        .forEach(mrn => {
          generatedAlerts.push({
            id: `mrn-pending-${mrn.id}`,
            type: 'new_mrn',
            title: 'New Material Request',
            message: `${mrn.requesterName} submitted ${mrn.title}`,
            priority: mrn.urgency === 'High' ? 'high' : 'medium',
            timestamp: mrn.submittedDate,
            read: false,
            actionUrl: '/procurement',
            actionLabel: 'Review',
            relatedId: mrn.id,
            relatedType: 'mrn',
            targetRoles: ['procurement', 'admin', 'supply_chain_director'],
          });
        });
    }

    // RFQ quotes received (for Procurement)
    if (['procurement', 'admin', 'supply_chain_director'].includes(userRole)) {
      const pendingQuotes = quotations.filter(q => q.status === 'Pending');
      if (pendingQuotes.length > 0) {
        const rfqIds = [...new Set(pendingQuotes.map(q => q.rfqId))];
        rfqIds.forEach(rfqId => {
          const rfq = rfqs.find(r => r.id === rfqId);
          const quoteCount = pendingQuotes.filter(q => q.rfqId === rfqId).length;
          if (rfq) {
            generatedAlerts.push({
              id: `rfq-quotes-${rfqId}`,
              type: 'rfq_quote_received',
              title: 'New Quotations Received',
              message: `${quoteCount} quote(s) received for ${rfq.mrfTitle}`,
              priority: 'high',
              timestamp: pendingQuotes[0].submittedDate,
              read: false,
              actionUrl: '/procurement',
              actionLabel: 'Compare Quotes',
              relatedId: rfqId,
              relatedType: 'rfq',
              targetRoles: ['procurement', 'admin', 'supply_chain_director'],
            });
          }
        });
      }
    }

    // PO pending signing (for Supply Chain Director)
    if (['supply_chain_director', 'admin'].includes(userRole)) {
      mrfRequests
        .filter(m => m.currentStage === 'supply_chain' && m.unsignedPOUrl && !m.signedPOUrl)
        .forEach(mrf => {
          generatedAlerts.push({
            id: `po-pending-${mrf.id}`,
            type: 'po_pending',
            title: 'PO Pending Signature',
            message: `${mrf.poNumber} requires your review and signature`,
            priority: 'high',
            timestamp: mrf.date,
            read: false,
            actionUrl: '/supply-chain',
            actionLabel: 'Sign PO',
            relatedId: mrf.id,
            relatedType: 'po',
            targetRoles: ['supply_chain_director', 'admin'],
          });
        });
    }

    // Vehicles pending approval (for Logistics)
    if (['logistics', 'admin', 'supply_chain_director'].includes(userRole)) {
      vehicles
        .filter(v => v.approvalStatus === 'pending')
        .forEach(vehicle => {
          generatedAlerts.push({
            id: `vehicle-pending-${vehicle.id}`,
            type: 'vehicle_pending_approval',
            title: 'Vehicle Pending Approval',
            message: `${vehicle.name} (${vehicle.plate}) from ${vehicle.vendorName || 'Internal'} requires approval`,
            priority: 'medium',
            timestamp: new Date().toISOString(),
            read: false,
            actionUrl: '/logistics',
            actionLabel: 'Review',
            relatedId: vehicle.id,
            relatedType: 'vehicle',
            targetRoles: ['logistics', 'admin', 'supply_chain_director'],
          });
        });
    }

    // Filter out dismissed alerts and sort by timestamp
    const filteredAlerts = generatedAlerts
      .filter(a => !dismissedIds.includes(a.id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxAlerts);

    setAlerts(filteredAlerts);
  }, [vendorRegistrations, mrfRequests, mrns, rfqs, quotations, vehicles, userRole, dismissedIds, maxAlerts]);

  const dismissAlert = (alertId: string) => {
    const newDismissed = [...dismissedIds, alertId];
    setDismissedIds(newDismissed);
    localStorage.setItem("dismissedAlerts", JSON.stringify(newDismissed));
  };

  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'new_vendor_registration': return <Users className="h-4 w-4" />;
      case 'new_mrf': case 'new_mrn': return <FileText className="h-4 w-4" />;
      case 'rfq_quote_received': return <Receipt className="h-4 w-4" />;
      case 'po_pending': return <Package className="h-4 w-4" />;
      case 'vehicle_pending_approval': return <Truck className="h-4 w-4" />;
      case 'document_pending_approval': return <AlertTriangle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: AlertPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-secondary text-secondary-foreground';
    }
  };

  const getTimeSince = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  if (alerts.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {alerts.slice(0, 5).map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between p-3 bg-card border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
            onClick={() => alert.actionUrl && navigate(alert.actionUrl)}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${getPriorityColor(alert.priority)}`}>
                {getAlertIcon(alert.type)}
              </div>
              <div>
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs text-muted-foreground">{getTimeSince(alert.timestamp)}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                dismissAlert(alert.id);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Live Alerts
            <Badge variant="secondary" className="ml-2">{alerts.length}</Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between p-4 bg-accent/30 border rounded-lg hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-full ${getPriorityColor(alert.priority)} flex-shrink-0`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold">{alert.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {alert.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getTimeSince(alert.timestamp)}
                      </span>
                      {alert.actionUrl && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => navigate(alert.actionUrl!)}
                        >
                          {alert.actionLabel || 'View'} <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => dismissAlert(alert.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
