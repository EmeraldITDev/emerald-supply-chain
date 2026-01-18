import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { notificationApi } from "@/services/api";
import { 
  NotificationService, 
  type AppNotification, 
  type NotificationEvent, 
  type NotificationPreferences 
} from "@/services/notificationService";

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  addNotification: (event: NotificationEvent, data: any) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    NotificationService.getDefaultPreferences()
  );

  // Load preferences and notifications on mount
  useEffect(() => {
    const loadedPreferences = NotificationService.loadPreferences();
    setPreferences(loadedPreferences);
  }, []);

  // Fetch notifications from backend API
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const response = await notificationApi.getAll({ limit: 50 });
        if (response.success && response.data && response.data.notifications) {
          // Transform backend notifications to AppNotification format
          const transformedNotifications: AppNotification[] = response.data.notifications.map((n: any) => ({
            id: n.id,
            type: n.type || 'info',
            title: n.title,
            message: n.message,
            timestamp: n.created_at,
            read: n.read || false,
            actionUrl: n.action_url,
            priority: 'medium' as const,
            event: 'system' as NotificationEvent,
            data: {
              entity_type: n.entity_type,
              entity_id: n.entity_id,
            },
          }));
          setNotifications(transformedNotifications);
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
      }
    };

    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
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
      user.role,
      data,
      preferences
    );

    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev]);

      // Play sound if enabled
      if (preferences.enableSoundNotifications) {
        playNotificationSound();
      }
    }
  };

  const markAsRead = async (id: string) => {
    // Optimistically update UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    
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
    
    // Update backend
    try {
      await notificationApi.markAllAsRead();
    } catch (error) {
      console.error("Failed to mark all notifications as read", error);
    }
  };

  const clearNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const updatePreferences = (newPreferences: Partial<NotificationPreferences>) => {
    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    NotificationService.savePreferences(updated);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const playNotificationSound = () => {
    // Simple notification sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.warn("Could not play notification sound", e);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
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
