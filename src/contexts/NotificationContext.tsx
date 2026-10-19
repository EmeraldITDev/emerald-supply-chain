import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { notificationApi } from "@/services/api";
import { getScmRole } from "@/utils/scmRole";
import { playNotificationSound } from "@/utils/notificationSound";
import { 
  NotificationService, 
  type AppNotification, 
  type NotificationEvent, 
  type NotificationPreferences 
} from "@/services/notificationService";

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  preferences: NotificationPreferences;
  addNotification: (event: NotificationEvent, data: any) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => Promise<void>;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverUnreadCount, setServerUnreadCount] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    NotificationService.getDefaultPreferences()
  );
  const preferencesRef = useRef(preferences);
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  // Load preferences on mount
  useEffect(() => {
    const loadedPreferences = NotificationService.loadPreferences();
    setPreferences(loadedPreferences);
  }, []);

  // Fetch notifications from backend API
  useEffect(() => {
    if (!user) {
      knownIdsRef.current = null;
      return;
    }

    const fetchNotifications = async () => {
      try {
        const response = await notificationApi.getAll({ limit: 50 });
        if (response.success && response.data && Array.isArray(response.data.notifications)) {
          const transformedNotifications: AppNotification[] = response.data.notifications.map((n: any) => ({
            id: String(n.id),
            type: n.type || 'info',
            title: n.title,
            message: n.message,
            timestamp: n.created_at,
            read: Boolean(n.is_read ?? n.read ?? false),
            actionUrl: n.action_url,
            priority: (['low', 'medium', 'high'].includes(n.priority) ? n.priority : 'medium') as AppNotification['priority'],
            event: 'system' as NotificationEvent,
            data: {
              entity_type: n.entity_type,
              entity_id: n.entity_id,
            },
          }));

          // Play sound for newly arrived notifications after the initial load
          if (knownIdsRef.current !== null) {
            const hasNew = transformedNotifications.some((n) => !knownIdsRef.current!.has(n.id));
            if (hasNew && preferencesRef.current.enableSoundNotifications) {
              void playNotificationSound();
            }
          }
          knownIdsRef.current = new Set(transformedNotifications.map((n) => n.id));

          setNotifications(transformedNotifications);
          setServerUnreadCount(Number(response.data.unread_count ?? 0));
        }
      } catch (error) {
        console.error("Failed to fetch notifications from backend", error);
        // Fallback to localStorage if backend fails
        const savedNotifications = localStorage.getItem("app_notifications");
        if (savedNotifications) {
          try {
            setNotifications(JSON.parse(savedNotifications));
          } catch (e) {
            console.error("Failed to parse saved notifications", e);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
    
    // Poll for new notifications every 30 seconds while tab is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchNotifications();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("app_notifications", JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (event: NotificationEvent, data: any) => {
    if (!user) return;

    const newNotifications = NotificationService.createNotificationsForEvent(
      event,
      getScmRole(user) as import("./AuthContext").UserRole,
      data,
      preferencesRef.current
    );

    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev]);
      knownIdsRef.current = new Set([
        ...(knownIdsRef.current ?? []),
        ...newNotifications.map((n) => n.id),
      ]);

      if (preferencesRef.current.enableSoundNotifications) {
        void playNotificationSound();
      }
    }
  };

  const markAsRead = async (id: string) => {
    // Optimistically update UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setServerUnreadCount((prev) => (prev != null && prev > 0 ? prev - 1 : prev));
    
    // Update backend
    try {
      await notificationApi.markAsRead(id);
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const markAllAsRead = async () => {
    // Optimistically update UI
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setServerUnreadCount(0);
    
    // Update backend
    try {
      await notificationApi.markAllAsRead();
    } catch (error) {
      console.error("Failed to mark all notifications as read", error);
    }
  };

  const clearNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    knownIdsRef.current?.delete(id);
    try {
      await notificationApi.delete(id);
    } catch (error) {
      console.error("Failed to delete notification", error);
    }
  };

  const clearAllNotifications = async () => {
    setNotifications([]);
    setServerUnreadCount(0);
    knownIdsRef.current = new Set();
    localStorage.setItem("app_notifications", "[]");
    try {
      const response = await notificationApi.deleteAll();
      if (!response.success) {
        throw new Error(response.error || "Failed to clear notifications");
      }
    } catch (error) {
      console.error("Failed to delete all notifications", error);
      throw error;
    }
  };

  const updatePreferences = (newPreferences: Partial<NotificationPreferences>) => {
    const updated = { ...preferencesRef.current, ...newPreferences };
    preferencesRef.current = updated;
    setPreferences(updated);
    NotificationService.savePreferences(updated);
  };

  const localUnread = notifications.filter((n) => !n.read).length;
  const unreadCount = serverUnreadCount != null ? serverUnreadCount : localUnread;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        preferences,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAllNotifications,
        updatePreferences,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
