'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
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

async function saveSubscription(subscription: PushSubscription) {
  const p256dh = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');

  if (!p256dh || !auth) {
    throw new Error('Push subscription keys are missing');
  }

  const response = await fetch('/api/notifications/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(p256dh),
        auth: arrayBufferToBase64(auth),
      },
      userAgent: navigator.userAgent,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save browser push subscription');
  }
}

/**
 * Keeps OS-level browser push subscriptions in sync for authenticated users.
 * It never prompts on page load; users still enable permission from browser/PWA UI
 * or the notification preferences modal.
 */
export function PushSubscriptionRegistrar() {
  const { data: session, status } = useSession();
  const attemptedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    if (status !== 'authenticated' || !userId || attemptedForUserRef.current === userId) return;

    attemptedForUserRef.current = userId;

    const syncSubscription = async () => {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured; OS push registration skipped.');
        return;
      }

      if (Notification.permission !== 'granted') {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();
        const subscription =
          existingSubscription ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
          }));

        await saveSubscription(subscription);
      } catch (error) {
        console.error('[Push] Failed to sync browser push subscription:', error);
      }
    };

    void syncSubscription();
  }, [session?.user?.id, status]);

  return null;
}
