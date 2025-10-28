import { useEffect } from 'react';
import { websocketService } from '@/services/websocket';
import type { MRF, SRF, RFQ, Quotation } from '@/types';

// Hook for listening to real-time MRF updates
export function useRealtimeMRFs(
  onCreated?: (mrf: MRF) => void,
  onUpdated?: (mrf: MRF) => void,
  onApproved?: (mrf: MRF) => void,
  onRejected?: (mrf: MRF) => void
) {
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (onCreated) {
      unsubscribers.push(
        websocketService.on('mrf_created', onCreated)
      );
    }

    if (onUpdated) {
      unsubscribers.push(
        websocketService.on('mrf_updated', onUpdated)
      );
    }

    if (onApproved) {
      unsubscribers.push(
        websocketService.on('mrf_approved', onApproved)
      );
    }

    if (onRejected) {
      unsubscribers.push(
        websocketService.on('mrf_rejected', onRejected)
      );
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [onCreated, onUpdated, onApproved, onRejected]);
}

// Hook for listening to real-time RFQ updates
export function useRealtimeRFQs(
  onCreated?: (rfq: RFQ) => void,
  onUpdated?: (rfq: RFQ) => void
) {
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (onCreated) {
      unsubscribers.push(
        websocketService.on('rfq_created', onCreated)
      );
    }

    if (onUpdated) {
      unsubscribers.push(
        websocketService.on('rfq_updated', onUpdated)
      );
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [onCreated, onUpdated]);
}

// Hook for listening to real-time quotation updates
export function useRealtimeQuotations(
  onSubmitted?: (quotation: Quotation) => void,
  onApproved?: (quotation: Quotation) => void
) {
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (onSubmitted) {
      unsubscribers.push(
        websocketService.on('quotation_submitted', onSubmitted)
      );
    }

    if (onApproved) {
      unsubscribers.push(
        websocketService.on('quotation_approved', onApproved)
      );
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [onSubmitted, onApproved]);
}

// Hook for listening to real-time notifications
export function useRealtimeNotifications(
  onNotification: (notification: {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: string;
  }) => void
) {
  useEffect(() => {
    const unsubscribe = websocketService.on('notification', onNotification);
    return unsubscribe;
  }, [onNotification]);
}

// Generic hook for any WebSocket event
export function useWebSocketEvent<T = any>(
  event: string,
  callback: (payload: T) => void
) {
  useEffect(() => {
    const unsubscribe = websocketService.on(event as any, callback);
    return unsubscribe;
  }, [event, callback]);
}
