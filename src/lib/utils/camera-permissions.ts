/**
 * Camera Permission Utilities
 * 
 * Handles camera permission checks and requests for KYC verification.
 * Ensures users are properly prompted for camera access before third-party widgets load.
 */

export interface PermissionCheckResult {
  granted: boolean;
  error?: string;
  needsPrompt?: boolean;
}

/**
 * Check if camera permission is granted
 */
export async function checkCameraPermission(): Promise<PermissionCheckResult> {
  try {
    // Check if browser supports camera API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        granted: false,
        error: 'Your browser does not support camera access. Please use Chrome, Edge, or Safari.',
      };
    }

    // Check permission state if available
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        
        if (permissionStatus.state === 'granted') {
          return { granted: true };
        }
        
        if (permissionStatus.state === 'denied') {
          return {
            granted: false,
            error: 'Camera access is blocked. Please enable camera permissions in your browser settings.',
          };
        }
        
        // State is 'prompt' - needs user interaction
        return { granted: false, needsPrompt: true };
      } catch (permError) {
        // Permissions API might not support 'camera' query on some browsers
        console.warn('Permissions API query failed:', permError);
        return { granted: false, needsPrompt: true };
      }
    }

    // Fallback: assume we need to prompt
    return { granted: false, needsPrompt: true };
  } catch (error) {
    console.error('Camera permission check failed:', error);
    return {
      granted: false,
      error: 'Unable to check camera permissions. Please ensure you are using HTTPS.',
    };
  }
}

/**
 * Request camera permission by attempting to access the camera
 * This will trigger the browser's permission prompt
 */
export async function requestCameraPermission(): Promise<PermissionCheckResult> {
  try {
    // Request camera access - this triggers the browser prompt
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: true,
      audio: false 
    });

    // Immediately stop the stream - we just needed to trigger the permission
    stream.getTracks().forEach(track => track.stop());

    return { granted: true };
  } catch (error) {
    const err = error as Error & { name?: string };
    
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return {
        granted: false,
        error: 'Camera access was denied. Please click "Allow" when prompted, or enable camera permissions in your browser settings.',
      };
    }
    
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return {
        granted: false,
        error: 'No camera found on your device. Please connect a camera to continue.',
      };
    }
    
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return {
        granted: false,
        error: 'Camera is already in use by another application. Please close other apps using the camera.',
      };
    }
    
    if (err.name === 'OverconstrainedError') {
      return {
        granted: false,
        error: 'Camera does not meet the required specifications.',
      };
    }
    
    if (err.name === 'SecurityError') {
      return {
        granted: false,
        error: 'Camera access is blocked due to security settings. Please ensure you are using HTTPS.',
      };
    }

    return {
      granted: false,
      error: `Camera access failed: ${err.message || 'Unknown error'}`,
    };
  }
}

/**
 * Get instructions for enabling camera permissions based on browser
 */
export function getCameraPermissionInstructions(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    return 'Click the camera icon in the address bar, then select "Always allow" and click "Done".';
  }
  
  if (userAgent.includes('edg')) {
    return 'Click the lock icon in the address bar, find "Camera" and set it to "Allow".';
  }
  
  if (userAgent.includes('firefox')) {
    return 'Click the camera icon in the address bar, then select "Allow" and check "Remember this decision".';
  }
  
  if (userAgent.includes('safari')) {
    return 'Go to Safari > Settings > Websites > Camera, and set this website to "Allow".';
  }
  
  return 'Please enable camera permissions in your browser settings for this website.';
}
