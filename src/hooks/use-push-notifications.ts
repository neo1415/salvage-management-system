'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface PushNotificationState {
  permission: NotificationPermission;
  isSubscribed: boolean;
  isSupported: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const { data: session } = useSession();
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    isSubscribed: false,
    isSupported: false,
    isLoading: true,
    error: null,
  });

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = () => {
      const isSupported =
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window;

      setState((prev) => ({
        ...prev,
        isSupported,
        permission: isSupported ? Notification.permission : 'denied',
        isLoading: false,
      }));
    };

    checkSupport();
  }, []);

  // Check if user is already subscribed
  useEffect(() => {
    const checkSubscription = async () => {
      if (!state.isSupported || !session?.user?.id) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        setState((prev) => ({
          ...prev,
          isSubscribed: !!subscription,
        }));
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    checkSubscription();
  }, [state.isSupported, session?.user?.id]);

  // Request permission and subscribe
  const subscribe = useCallback(async () => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: 'Push notifications are not supported in this browser',
      }));
      return false;
    }

    if (!session?.user?.id) {
      setState((prev) => ({
        ...prev,
        error: 'You must be logged in to enable push notifications',
      }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        setState((prev) => ({
          ...prev,
          permission,
          isLoading: false,
          error: 'Permission denied for push notifications',
        }));
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured');
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Send subscription to server
      const response = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
            auth: arrayBufferToBase64(subscription.getKey('auth')!),
          },
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription to server');
      }

      setState((prev) => ({
        ...prev,
        permission: 'granted',
        isSubscribed: true,
        isLoading: false,
      }));

      console.log('✅ Successfully subscribed to push notifications');
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe',
      }));
      return false;
    }
  }, [state.isSupported, session?.user?.id]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!state.isSupported || !session?.user?.id) {
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove subscription from server
        await fetch(
          `/api/notifications/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
          {
            method: 'DELETE',
          }
        );
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      console.log('✅ Successfully unsubscribed from push notifications');
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe',
      }));
      return false;
    }
  }, [state.isSupported, session?.user?.id]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
