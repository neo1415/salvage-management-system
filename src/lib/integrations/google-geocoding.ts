/**
 * Forward geocoding via Google Geocoding API.
 * Used when users type an address (laptop GPS is often weak; address → coords is more reliable).
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

function getGoogleMapsApiKey(): string | undefined {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  );
}

/**
 * Resolve a human-readable address to coordinates.
 * Returns null when the API key is missing or no results are found.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (trimmed.length < 3) {
    return null;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    console.warn('Google Maps API key not configured — geocoding skipped');
    return null;
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', trimmed);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('region', 'ng');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Geocoding request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    status: string;
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat: number; lng: number } };
    }>;
  };

  if (data.status !== 'OK' || !data.results?.length) {
    return null;
  }

  const location = data.results[0].geometry?.location;
  if (!location) {
    return null;
  }

  return {
    latitude: location.lat,
    longitude: location.lng,
    formattedAddress: data.results[0].formatted_address,
  };
}

export function isGeocodingConfigured(): boolean {
  return !!getGoogleMapsApiKey();
}
