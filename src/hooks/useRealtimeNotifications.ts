import { useEffect, useCallback, useRef } from 'react';
import { websocketService } from '@/services/websocket';
import { useNotifications } from '@/contexts/NotificationContext';
import { useToast } from '@/hooks/use-toast';
import type { NotificationEvent } from '@/services/notificationService';

interface RealtimeNotificationConfig {
  enableToasts?: boolean;
  enableSound?: boolean;
}

/**
 * Hook to connect real-time WebSocket events to the notification system
 * This bridges the WebSocket service with the NotificationContext
 */
export function useRealtimeNotifications(config: RealtimeNotificationConfig = {}) {
  const { enableToasts = true } = config;
  const { addNotification } = useNotifications();
  const { toast } = useToast();
  const connectedRef = useRef(false);

  // Map WebSocket events to notification events
  const mapWebSocketToNotification = useCallback((wsEvent: string): NotificationEvent | null => {
    const eventMap: Record<string, NotificationEvent> = {
      'mrf_created': 'mrf_approved_by_executive',
      'mrf_approved': 'mrf_approved_by_executive',
      'mrf_rejected': 'mrf_rejected_by_executive',
      'quotation_submitted': 'po_generated',
      'quotation_approved': 'po_generated',
      'vendor_registered': 'mrn_converted_to_mrf',
      'notification': 'mrn_converted_to_mrf',
    };
    return eventMap[wsEvent] || null;
  }, []);

  // Handle incoming WebSocket messages
  const handleWebSocketEvent = useCallback((eventType: string, payload: any) => {
    const notificationEvent = mapWebSocketToNotification(eventType);
    
    if (notificationEvent) {
      // Add to notification context
      addNotification(notificationEvent, payload);
      
      // Show toast if enabled
      if (enableToasts) {
        toast({
          title: payload.title || 'New Update',
          description: payload.message || 'You have a new notification',
        });
      }
    }
  }, [addNotification, enableToasts, mapWebSocketToNotification, toast]);

  // Connect to WebSocket and subscribe to events
  useEffect(() => {
    if (connectedRef.current) return;
    
    // Connect to WebSocket
    websocketService.connect();
    connectedRef.current = true;

    // Subscribe to all notification-relevant events
    const events = [
      'mrf_created',
      'mrf_updated',
      'mrf_approved',
      'mrf_rejected',
      'srf_created',
      'srf_updated',
      'rfq_created',
      'rfq_updated',
      'quotation_submitted',
      'quotation_approved',
      'vendor_registered',
      'notification',
    ] as const;

    const unsubscribers = events.map(event => 
      websocketService.on(event, (payload) => handleWebSocketEvent(event, payload))
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
      // Don't disconnect on cleanup - might be used elsewhere
    };
  }, [handleWebSocketEvent]);

  return {
    isConnected: websocketService.isConnected(),
    connect: () => websocketService.connect(),
    disconnect: () => websocketService.disconnect(),
  };
}

/**
 * Hook to send real-time notifications via WebSocket
 * Use this when you want to broadcast events to other users
 */
export function useSendRealtimeNotification() {
  const send = useCallback((eventType: string, payload: any) => {
    if (websocketService.isConnected()) {
      websocketService.send({
        type: eventType,
        payload,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.warn('WebSocket not connected. Notification not sent.');
    }
  }, []);

  return { send };
}
