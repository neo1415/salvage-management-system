/**
 * Browser GPS Geolocation Integration
 * Provides accurate location data using device GPS
 * 
 * Uses browser's navigator.geolocation API with high accuracy mode enabled.
 * This provides 5-50m accuracy using actual GPS hardware.
 * 
 * NOTE: Google Geolocation API was removed because without WiFi/cell tower data,
 * it falls back to IP-based geolocation which is extremely inaccurate (100km+ radius).
 */

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  accuracy: number; // Accuracy in meters
  locationName?: string;
  source: 'google-api' | 'browser';
}

export interface GeolocationError {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'API_ERROR' | 'NETWORK_ERROR';
  message: string;
}

/**
 * Get accurate geolocation using browser GPS ONLY
 * Browser GPS is far more accurate (5-15m) than Google API IP-based fallback (100km+)
 * 
 * REMOVED: Google Geolocation API fallback because it uses IP-based location
 * which is extremely inaccurate (100km+ radius) and causes wildly inconsistent results
 */
export async function getAccurateGeolocation(): Promise<GeolocationResult> {
  
  // Log diagnostic info
  console.log('🌍 Online status:', navigator.onLine);
  console.log('🌍 Browser geolocation available:', isGeolocationAvailable());
  
  // Use browser GPS - this is the most accurate method available
  if (!isGeolocationAvailable()) {
    throw {
      code: 'API_ERROR',
      message: 'Geolocation is not supported by your browser',
    } as GeolocationError;
  }

  console.log('🌍 Using browser GPS (most accurate method)...');
  try {
    const browserLocation = await getBrowserGeolocation();
    console.log('✅ Browser GPS succeeded:', browserLocation);
    return browserLocation;
  } catch (error) {
    console.error('❌ Browser GPS failed:', error);
    throw error;
  }
}

/**
 * Get location using browser Geolocation API
 * This is the MOST ACCURATE method available (5-50m accuracy)
 * Works both online and offline
 */
async function getBrowserGeolocation(): Promise<GeolocationResult> {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser');
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, // Use GPS, not WiFi/IP
        timeout: 30000, // 30 seconds - give GPS time to get accurate fix
        maximumAge: 0, // No cache - always get fresh location
      });
    });

    console.log('📍 GPS Accuracy:', position.coords.accuracy + 'm');

    // Get location name using reverse geocoding (if online)
    let locationName: string | undefined;
    if (navigator.onLine) {
      try {
        locationName = await reverseGeocode(
          position.coords.latitude,
          position.coords.longitude
        );
      } catch (error) {
        console.warn('Reverse geocoding failed:', error);
        locationName = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
      }
    } else {
      locationName = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
    }

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      locationName,
      source: 'browser',
    };
  } catch (error) {
    // Convert GeolocationPositionError to our error format
    if (error && typeof error === 'object' && 'code' in error) {
      const geoError = error as GeolocationPositionError;
      const errorMap: Record<number, GeolocationError> = {
        1: {
          code: 'PERMISSION_DENIED',
          message: 'Location permission denied. Please enable location access in your browser settings.',
        },
        2: {
          code: 'POSITION_UNAVAILABLE',
          message: 'Location unavailable. Please check your device GPS settings.',
        },
        3: {
          code: 'TIMEOUT',
          message: 'Location request timed out. Please try again or move to an area with better GPS signal.',
        },
      };

      throw errorMap[geoError.code] || {
        code: 'API_ERROR',
        message: 'Failed to get location',
      };
    }

    throw {
      code: 'API_ERROR',
      message: error instanceof Error ? error.message : 'Failed to get location',
    };
  }
}

/**
 * Reverse geocode coordinates to human-readable address
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */
async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          'User-Agent': 'NEM-Salvage-Management-System',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();
    return data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }
}

/**
 * Check if geolocation is available
 */
export function isGeolocationAvailable(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Check if Google Maps API is configured
 */
export function isGoogleMapsConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

/**
 * Get user-friendly error message from GeolocationError
 */
export function getGeolocationErrorMessage(error: GeolocationError): string {
  return error.message;
}
