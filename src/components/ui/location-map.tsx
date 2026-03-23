/**
 * LocationMap Component
 * 
 * Reusable component for displaying embedded Google Maps with location markers.
 * Supports both GPS coordinates and address-based geocoding.
 * 
 * Features:
 * - GPS coordinates (preferred)
 * - Address string fallback
 * - Responsive design
 * - Fallback UI when API key not configured
 * - External map link when embedded map unavailable
 */

'use client';

import React from 'react';

interface LocationMapProps {
  /** GPS latitude (preferred) */
  latitude?: number;
  /** GPS longitude (preferred) */
  longitude?: number;
  /** Address string for geocoding (fallback) */
  address?: string;
  /** Optional CSS class name */
  className?: string;
  /** Map height (default: 300px) */
  height?: string;
}

export function LocationMap({
  latitude,
  longitude,
  address,
  className = '',
  height = '300px',
}: LocationMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasValidApiKey = apiKey && apiKey !== 'your-google-maps-api-key';
  
  // Check if we have location data
  const hasCoordinates = latitude !== undefined && longitude !== undefined;
  const hasAddress = address && address.trim().length > 0;
  const hasLocationData = hasCoordinates || hasAddress;

  // Generate map URL
  const getMapUrl = () => {
    if (!hasValidApiKey) return null;
    
    if (hasCoordinates) {
      // Use coordinates (preferred)
      return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${latitude},${longitude}&zoom=15&maptype=roadmap`;
    } else if (hasAddress) {
      // Use address for geocoding
      return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(address)}&zoom=15&maptype=roadmap`;
    }
    
    return null;
  };

  // Generate external link URL
  const getExternalLinkUrl = () => {
    if (hasCoordinates) {
      return `https://www.google.com/maps?q=${latitude},${longitude}`;
    } else if (hasAddress) {
      return `https://www.google.com/maps/search/${encodeURIComponent(address)}`;
    }
    return null;
  };

  const mapUrl = getMapUrl();
  const externalLinkUrl = getExternalLinkUrl();

  // No location data available
  if (!hasLocationData) {
    return (
      <div 
        className={`relative bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center p-4">
          <svg 
            className="w-12 h-12 text-gray-400 mx-auto mb-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
            />
          </svg>
          <p className="text-gray-600 text-sm">Location data unavailable</p>
        </div>
      </div>
    );
  }

  // API key not configured - show fallback with external link
  if (!hasValidApiKey) {
    return (
      <div 
        className={`relative bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center p-4">
          <svg 
            className="w-12 h-12 text-gray-400 mx-auto mb-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
            />
          </svg>
          <p className="text-gray-600 text-sm mb-2">Interactive map unavailable</p>
          {externalLinkUrl && (
            <a
              href={externalLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#800020] hover:underline font-medium text-sm inline-flex items-center gap-1"
            >
              View on Google Maps
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Render embedded map
  return (
    <div 
      className={`relative bg-gray-200 rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    >
      <iframe
        src={mapUrl || ''}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Location map"
        className="w-full h-full"
      />
    </div>
  );
}
