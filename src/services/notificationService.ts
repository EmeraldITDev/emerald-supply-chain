import type { UserRole } from "@/contexts/AuthContext";

export interface NotificationRule {
  event: NotificationEvent;
  roles: UserRole[];
  title: string;
  getMessage: (data: any) => string;
  actionUrl?: (data: any) => string;
  priority: "low" | "medium" | "high";
}

export type NotificationEvent =
  | "mrn_converted_to_mrf"
  | "mrf_approved_by_executive"
  | "mrf_rejected_by_executive"
  | "mrf_sent_to_chairman"
  | "mrf_approved_by_chairman"
  | "po_generated"
  | "po_sent_to_supply_chain"
  | "po_rejected_by_supply_chain"
  | "po_signed"
  | "po_sent_to_finance"
  | "payment_processing"
  | "payment_completed";

export interface AppNotification {
  id: string;
  type: "approval" | "reminder" | "alert" | "success" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  priority: "low" | "medium" | "high";
  event: NotificationEvent;
  data?: any;
}

export interface NotificationPreferences {
  enableEmailNotifications: boolean;
  enableInAppNotifications: boolean;
  enableSoundNotifications: boolean;
  mutedEvents: NotificationEvent[];
}

// Role-based notification rules
export const notificationRules: NotificationRule[] = [
  // MRN to MRF Conversion - Employee sees this
  {
    event: "mrn_converted_to_mrf",
    roles: ["employee"],
    title: "MRN Converted to MRF",
    getMessage: (data) => `Your material request ${data.mrnId} has been converted to MRF ${data.mrfId}`,
    actionUrl: (data) => `/dashboard`,
    priority: "medium",
  },
  
  // Executive Approval - Employee and Chairman see this
  {
    event: "mrf_approved_by_executive",
    roles: ["employee"],
    title: "MRF Approved",
    getMessage: (data) => `Your MRF ${data.mrfId} has been approved by Executive`,
    actionUrl: (data) => `/dashboard`,
    priority: "high",
  },
  
  // Executive Approval - Procurement Manager sees this
  {
    event: "mrf_approved_by_executive",
    roles: ["procurement"],
    title: "MRF Ready for PO",
    getMessage: (data) => `MRF ${data.mrfId} approved - Please upload Purchase Order`,
    actionUrl: (data) => `/procurement`,
    priority: "high",
  },
  
  // Executive Rejection - Employee sees this
  {
    event: "mrf_rejected_by_executive",
    roles: ["employee"],
    title: "MRF Rejected",
    getMessage: (data) => `Your MRF ${data.mrfId} was rejected: ${data.reason}`,
    actionUrl: (data) => `/dashboard`,
    priority: "high",
  },
  
  // High Value MRF sent to Chairman
  {
    event: "mrf_sent_to_chairman",
    roles: ["chairman"],
    title: "High-Value MRF Approval Required",
    getMessage: (data) => `MRF ${data.mrfId} (₦${data.amount}) requires your approval`,
    actionUrl: (data) => `/chairman-dashboard`,
    priority: "high",
  },
  
  // Chairman Approval
  {
    event: "mrf_approved_by_chairman",
    roles: ["employee", "procurement"],
    title: "MRF Approved by Chairman",
    getMessage: (data) => `High-value MRF ${data.mrfId} has been approved by Chairman`,
    actionUrl: (data) => `/procurement`,
    priority: "high",
  },
  
  // PO Generated - Employee sees this
  {
    event: "po_generated",
    roles: ["employee"],
    title: "Purchase Order Generated",
    getMessage: (data) => `PO ${data.poNumber} has been generated for your MRF ${data.mrfId}`,
    actionUrl: (data) => `/dashboard`,
    priority: "medium",
  },
  
  // PO sent to Supply Chain
  {
    event: "po_sent_to_supply_chain",
    roles: ["supply_chain_director"],
    title: "PO Ready for Review",
    getMessage: (data) => `Purchase Order ${data.poNumber} ready for review and signature`,
    actionUrl: (data) => `/supply-chain-dashboard`,
    priority: "high",
  },
  
  // PO Rejected by Supply Chain - Procurement sees this
  {
    event: "po_rejected_by_supply_chain",
    roles: ["procurement"],
    title: "PO Rejected",
    getMessage: (data) => `PO ${data.poNumber} rejected by Supply Chain - Revision required`,
    actionUrl: (data) => `/procurement`,
    priority: "high",
  },
  
  // PO Signed - Employee and Procurement see this
  {
    event: "po_signed",
    roles: ["employee", "procurement"],
    title: "PO Signed",
    getMessage: (data) => `Purchase Order ${data.poNumber} has been signed and sent to Finance`,
    actionUrl: (data) => `/dashboard`,
    priority: "medium",
  },
  
  // PO sent to Finance
  {
    event: "po_sent_to_finance",
    roles: ["finance"],
    title: "PO Ready for Payment",
    getMessage: (data) => `Purchase Order ${data.poNumber} ready for payment processing`,
    actionUrl: (data) => `/finance-dashboard`,
    priority: "high",
  },
  
  // Payment Processing - Employee sees this
  {
    event: "payment_processing",
    roles: ["employee"],
    title: "Payment Processing",
    getMessage: (data) => `Payment for PO ${data.poNumber} is being processed`,
    actionUrl: (data) => `/dashboard`,
    priority: "low",
  },
  
  // Payment Completed - Everyone sees this
  {
    event: "payment_completed",
    roles: ["employee", "procurement", "supply_chain_director", "finance", "executive", "chairman"],
    title: "Payment Completed",
    getMessage: (data) => `Payment for PO ${data.poNumber} has been completed`,
    actionUrl: (data) => `/dashboard`,
    priority: "medium",
  },
];

export class NotificationService {
  private static getNotificationRulesForRole(role: UserRole, event: NotificationEvent): NotificationRule[] {
    return notificationRules.filter(
      (rule) => rule.event === event && rule.roles.includes(role)
    );
  }

  static shouldNotifyRole(role: UserRole, event: NotificationEvent): boolean {
    return this.getNotificationRulesForRole(role, event).length > 0;
  }

  static createNotificationsForEvent(
    event: NotificationEvent,
    userRole: UserRole,
    data: any,
    preferences: NotificationPreferences
  ): AppNotification[] {
    // Check if user has muted this event
    if (preferences.mutedEvents.includes(event)) {
      return [];
    }

    // Check if in-app notifications are enabled
    if (!preferences.enableInAppNotifications) {
      return [];
    }

    const rules = this.getNotificationRulesForRole(userRole, event);
    
    return rules.map((rule) => ({
      id: `${event}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.getNotificationType(rule.priority),
      title: rule.title,
      message: rule.getMessage(data),
      timestamp: new Date().toISOString(),
      read: false,
      actionUrl: rule.actionUrl ? rule.actionUrl(data) : undefined,
      priority: rule.priority,
      event,
      data,
    }));
  }

  private static getNotificationType(priority: string): AppNotification["type"] {
    switch (priority) {
      case "high":
        return "alert";
      case "medium":
        return "approval";
      case "low":
        return "info";
      default:
        return "info";
    }
  }

  static getDefaultPreferences(): NotificationPreferences {
    return {
      enableEmailNotifications: true,
      enableInAppNotifications: true,
      enableSoundNotifications: false,
      mutedEvents: [],
    };
  }

  static savePreferences(preferences: NotificationPreferences) {
    localStorage.setItem("notification_preferences", JSON.stringify(preferences));
  }

  static loadPreferences(): NotificationPreferences {
    const stored = localStorage.getItem("notification_preferences");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse notification preferences", e);
      }
    }
    return this.getDefaultPreferences();
  }
}
