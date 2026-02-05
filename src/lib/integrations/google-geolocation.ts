/**
 * Google Maps Geolocation API Integration
 * Provides accurate location data using Google's geolocation service
 * 
 * Uses Google Maps Geolocation API to determine location from:
 * - GPS coordinates
 * - WiFi access points
 * - Cell tower information
 * 
 * Much more accurate than browser geolocation, especially indoors.
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
 * Get accurate geolocation using Google Maps Geolocation API
 * Falls back to browser geolocation if API fails or is unavailable
 */
export async function getAccurateGeolocation(): Promise<GeolocationResult> {
  // Try Google API first if online and API key is available
  if (navigator.onLine && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    try {
      const googleLocation = await getGoogleGeolocation();
      return googleLocation;
    } catch (error) {
      console.warn('Google Geolocation API failed, falling back to browser geolocation:', error);
    }
  }

  // Fallback to browser geolocation
  return await getBrowserGeolocation();
}

/**
 * Get location using Google Maps Geolocation API
 * Requires internet connection and API key
 */
async function getGoogleGeolocation(): Promise<GeolocationResult> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  try {
    // Call Google Maps Geolocation API
    const response = await fetch(
      `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          considerIp: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Google Geolocation API request failed');
    }

    const data = await response.json();

    if (!data.location) {
      throw new Error('No location data returned from Google API');
    }

    // Get location name using reverse geocoding
    let locationName: string | undefined;
    try {
      locationName = await reverseGeocode(data.location.lat, data.location.lng);
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      locationName = `${data.location.lat.toFixed(6)}, ${data.location.lng.toFixed(6)}`;
    }

    return {
      latitude: data.location.lat,
      longitude: data.location.lng,
      accuracy: data.accuracy || 0,
      locationName,
      source: 'google-api',
    };
  } catch (error) {
    console.error('Error getting Google geolocation:', error);
    throw error;
  }
}

/**
 * Get location using browser Geolocation API
 * Works offline but less accurate
 */
async function getBrowserGeolocation(): Promise<GeolocationResult> {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser');
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 30000, // 30 seconds
        maximumAge: 0, // No cache
      });
    });

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
