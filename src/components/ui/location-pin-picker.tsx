'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
    __googleMapsLoadingPromise?: Promise<void>;
  }
}

interface LocationPinPickerProps {
  latitude?: number;
  longitude?: number;
  label?: string;
  height?: string;
  onChange: (location: {
    latitude: number;
    longitude: number;
    formattedAddress?: string;
  }) => void;
}

const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792 }; // Lagos fallback

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__googleMapsLoadingPromise) return window.__googleMapsLoadingPromise;

  window.__googleMapsLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });

  return window.__googleMapsLoadingPromise;
}

export function LocationPinPicker({
  latitude,
  longitude,
  label,
  height = '260px',
  onChange,
}: LocationPinPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasValidApiKey = !!apiKey && apiKey !== 'your-google-maps-api-key';
  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number';
  const center = {
    lat: typeof latitude === 'number' ? latitude : DEFAULT_CENTER.lat,
    lng: typeof longitude === 'number' ? longitude : DEFAULT_CENTER.lng,
  };

  useEffect(() => {
    if (!hasValidApiKey || !mapRef.current) return;

    let cancelled = false;

    loadGoogleMaps(apiKey!)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google?.maps) return;

        geocoderRef.current = new window.google.maps.Geocoder();
        const map = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: hasCoordinates ? 17 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });
        const marker = new window.google.maps.Marker({
          position: center,
          map,
          draggable: true,
          title: label || 'Selected location',
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        setIsLoading(false);

        const commitPosition = async (position: { lat: number; lng: number }) => {
          marker.setPosition(position);
          map.panTo(position);

          let formattedAddress: string | undefined;
          try {
            const response = await geocoderRef.current.geocode({ location: position });
            formattedAddress = response?.results?.[0]?.formatted_address;
          } catch {
            formattedAddress = undefined;
          }

          onChange({
            latitude: position.lat,
            longitude: position.lng,
            formattedAddress,
          });
        };

        map.addListener('click', (event: any) => {
          const clicked = event.latLng;
          if (!clicked) return;
          void commitPosition({ lat: clicked.lat(), lng: clicked.lng() });
        });

        marker.addListener('dragend', () => {
          const next = marker.getPosition();
          if (!next) return;
          void commitPosition({ lat: next.lat(), lng: next.lng() });
        });
      })
      .catch(() => {
        setIsLoading(false);
        setLoadError('Map pin confirmation is unavailable. Use a full address or GPS.');
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, hasValidApiKey]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return;
    }

    const position = { lat: latitude, lng: longitude };
    markerRef.current.setPosition(position);
    mapInstanceRef.current.panTo(position);
    mapInstanceRef.current.setZoom(17);
  }, [latitude, longitude]);

  if (!hasValidApiKey) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MapPin className="h-4 w-4 text-[var(--brand-primary)]" />
            Confirm exact pin
          </p>
          <p className="text-xs text-gray-500">
            Click the map or drag the marker to the actual inspection/pickup point.
          </p>
        </div>
        {hasCoordinates && (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            Pin set
          </span>
        )}
      </div>
      {loadError ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{loadError}</div>
      ) : (
        <div className="relative overflow-hidden rounded-lg bg-gray-100" style={{ height }}>
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gray-50 text-sm text-gray-600">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--brand-primary)]" />
              <span>Loading map...</span>
            </div>
          )}
          <div
            ref={mapRef}
            className="h-full w-full"
            aria-label="Map for confirming exact location pin"
          />
        </div>
      )}
    </div>
  );
}
