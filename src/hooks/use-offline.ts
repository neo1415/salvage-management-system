'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to detect online/offline status
 * @returns boolean indicating if the user is offline
 */
export function useOffline(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOffline;
}

/**
 * Hook to get online/offline status with additional info
 * @returns object with offline status and connection info
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState({
    isOffline: false,
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
  });

  useEffect(() => {
    const updateStatus = () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      
      setStatus({
        isOffline: !navigator.onLine,
        effectiveType: connection?.effectiveType || 'unknown',
        downlink: connection?.downlink || 0,
        rtt: connection?.rtt || 0,
      });
    };

    // Set initial state
    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    // Listen to connection changes if available
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateStatus);
    }

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      if (connection) {
        connection.removeEventListener('change', updateStatus);
      }
    };
  }, []);

  return status;
}
