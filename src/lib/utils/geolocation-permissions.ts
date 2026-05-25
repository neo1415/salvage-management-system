/**
 * Geolocation Permission Utilities
 * 
 * Provides utilities for checking and requesting geolocation permissions
 * before launching embedded widgets that require location access.
 */

export interface GeolocationPermissionResult {
  granted: boolean;
  error?: string;
  needsPrompt?: boolean;
}

/**
 * Check if geolocation permission is already granted
 */
export async function checkGeolocationPermission(): Promise<GeolocationPermissionResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      granted: false,
      error: 'Geolocation is not supported by your browser',
      needsPrompt: false,
    };
  }

  // Check if Permissions API is available
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      
      if (result.state === 'granted') {
        return { granted: true };
      }
      
      if (result.state === 'denied') {
        return {
          granted: false,
          error: 'Location permission is denied',
          needsPrompt: false,
        };
      }
      
      // State is 'prompt' - need to request
      return {
        granted: false,
        needsPrompt: true,
      };
    } catch (error) {
      console.warn('Permissions API query failed:', error);
      // Fall through to direct check
    }
  }

  // Fallback: Permissions API not available, assume we need to prompt
  return {
    granted: false,
    needsPrompt: true,
  };
}

/**
 * Request geolocation permission by attempting to get current position
 * Does not store coordinates - only used for permission preflight
 */
export async function requestGeolocationPermission(): Promise<GeolocationPermissionResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      granted: false,
      error: 'Geolocation is not supported by your browser',
      needsPrompt: false,
    };
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({
        granted: false,
        error: 'Location permission request timed out',
        needsPrompt: false,
      });
    }, 10000); // 10 second timeout

    navigator.geolocation.getCurrentPosition(
      () => {
        // Success - permission granted
        // Immediately discard position data (not stored)
        clearTimeout(timeoutId);
        resolve({ granted: true });
      },
      (error) => {
        clearTimeout(timeoutId);
        
        if (error.code === error.PERMISSION_DENIED) {
          resolve({
            granted: false,
            error: 'Location permission was denied',
            needsPrompt: false,
          });
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          resolve({
            granted: false,
            error: 'Location information is unavailable',
            needsPrompt: false,
          });
        } else if (error.code === error.TIMEOUT) {
          resolve({
            granted: false,
            error: 'Location request timed out',
            needsPrompt: false,
          });
        } else {
          resolve({
            granted: false,
            error: 'An unknown error occurred while requesting location',
            needsPrompt: false,
          });
        }
      },
      {
        timeout: 8000,
        maximumAge: 0,
        enableHighAccuracy: false,
      }
    );
  });
}

/**
 * Get user-friendly instructions for enabling geolocation
 */
export function getGeolocationPermissionInstructions(): string {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  
  if (userAgent.includes('chrome') || userAgent.includes('edg')) {
    return 'Click the lock icon in the address bar, then allow location access for this site.';
  }
  
  if (userAgent.includes('firefox')) {
    return 'Click the location icon in the address bar, then select "Allow" for location access.';
  }
  
  if (userAgent.includes('safari')) {
    return 'Go to Safari > Settings for This Website, then allow location access.';
  }
  
  return 'Check your browser settings to allow location access for this site.';
}
