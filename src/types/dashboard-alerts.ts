// Dashboard Alert Types for real-time updates

export type AlertType = 
  | 'new_vendor_registration'
  | 'new_mrf'
  | 'new_mrn'
  | 'document_pending_approval'
  | 'rfq_quote_received'
  | 'grn_submitted'
  | 'po_pending'
  | 'payment_pending'
  | 'document_expiring'
  | 'registration_cycle_ending'
  | 'vehicle_pending_approval';

export type AlertPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface DashboardAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  priority: AlertPriority;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  relatedId?: string;
  relatedType?: string;
  targetRoles: string[];
  metadata?: Record<string, any>;
}

export interface AlertSummary {
  totalUnread: number;
  byType: Record<AlertType, number>;
  byPriority: Record<AlertPriority, number>;
  recentAlerts: DashboardAlert[];
}

export interface AlertPreferences {
  enableInApp: boolean;
  enableSound: boolean;
  enableDesktop: boolean;
  mutedTypes: AlertType[];
  priorityThreshold: AlertPriority;
}
