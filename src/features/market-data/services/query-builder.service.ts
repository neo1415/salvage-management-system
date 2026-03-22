/**
 * Query Builder Service
 * 
 * Constructs source-specific search queries for Nigerian e-commerce platforms.
 * Adapts queries based on property type and source-specific URL formats.
 * 
 * Requirements: 1.2-1.4, 10.5
 */

import type { PropertyIdentifier } from '../types';

export interface SearchQuery {
  source: string;
  url: string;
  params: Record<string, string>;
}

/**
 * Source base URLs for Nigerian e-commerce platforms
 */
const SOURCE_BASE_URLS: Record<string, string> = {
  jiji: 'https://jiji.ng',
  jumia: 'https://www.jumia.com.ng',
  cars45: 'https://cars45.com',
  cheki: 'https://cheki.com.ng',
};

/**
 * Build search query for any property type
 * Detects property type and delegates to specific builder
 */
export function buildSearchQuery(
  property: PropertyIdentifier,
  source: string
): SearchQuery {
  switch (property.type) {
    case 'vehicle':
      if (!property.make || !property.model || !property.year) {
        throw new Error('Vehicle properties require make, model, and year');
      }
      return buildVehicleQuery(property.make, property.model, property.year, source);

    case 'electronics':
      if (!property.brand || !property.productModel) {
        throw new Error('Electronics properties require brand and productModel');
      }
      return buildElectronicsQuery(
        property.brand,
        property.productModel,
        property.productType || 'electronics',
        source
      );

    case 'building':
      if (!property.location || !property.propertyType) {
        throw new Error('Building properties require location and propertyType');
      }
      return buildBuildingQuery(
        property.location,
        property.propertyType,
        property.size || 0,
        source
      );

    default:
      throw new Error(`Unsupported property type: ${property.type}`);
  }
}

/**
 * Build vehicle search query
 * Format: {make} {model} {year}
 */
export function buildVehicleQuery(
  make: string,
  model: string,
  year: number,
  source: string
): SearchQuery {
  const baseUrl = SOURCE_BASE_URLS[source];
  if (!baseUrl) {
    throw new Error(`Unknown source: ${source}`);
  }

  // Normalize inputs
  const normalizedMake = make.trim();
  const normalizedModel = model.trim();

  // Build search term
  const searchTerm = `${normalizedMake} ${normalizedModel} ${year}`;

  switch (source) {
    case 'jiji':
      return {
        source,
        url: `${baseUrl}/cars`,
        params: {
          q: searchTerm,
        },
      };

    case 'jumia':
      return {
        source,
        url: `${baseUrl}/automobiles`,
        params: {
          q: searchTerm,
        },
      };

    case 'cars45':
      return {
        source,
        url: `${baseUrl}/listing`,
        params: {
          make: normalizedMake.toLowerCase(),
          model: normalizedModel.toLowerCase(),
          year: year.toString(),
        },
      };

    case 'cheki':
      return {
        source,
        url: `${baseUrl}/cars-for-sale`,
        params: {
          make: normalizedMake.toLowerCase(),
          model: normalizedModel.toLowerCase(),
          year_from: year.toString(),
          year_to: year.toString(),
        },
      };

    default:
      throw new Error(`Unsupported source for vehicles: ${source}`);
  }
}

/**
 * Build electronics search query
 * Format: {brand} {model} {type}
 */
export function buildElectronicsQuery(
  brand: string,
  model: string,
  type: string,
  source: string
): SearchQuery {
  const baseUrl = SOURCE_BASE_URLS[source];
  if (!baseUrl) {
    throw new Error(`Unknown source: ${source}`);
  }

  // Normalize inputs
  const normalizedBrand = brand.trim();
  const normalizedModel = model.trim();
  const normalizedType = type.trim();

  // Build search term
  const searchTerm = `${normalizedBrand} ${normalizedModel} ${normalizedType}`;

  switch (source) {
    case 'jiji':
      return {
        source,
        url: `${baseUrl}/electronics-technology`,
        params: {
          q: searchTerm,
        },
      };

    case 'jumia':
      return {
        source,
        url: `${baseUrl}/electronics`,
        params: {
          q: searchTerm,
        },
      };

    case 'cars45':
      // Cars45 doesn't sell electronics
      throw new Error('Cars45 does not support electronics searches');

    case 'cheki':
      // Cheki doesn't sell electronics
      throw new Error('Cheki does not support electronics searches');

    default:
      throw new Error(`Unsupported source for electronics: ${source}`);
  }
}

/**
 * Build building/property search query
 * Format: {location} {type} {size}
 */
export function buildBuildingQuery(
  location: string,
  type: string,
  size: number,
  source: string
): SearchQuery {
  const baseUrl = SOURCE_BASE_URLS[source];
  if (!baseUrl) {
    throw new Error(`Unknown source: ${source}`);
  }

  // Normalize inputs
  const normalizedLocation = location.trim();
  const normalizedType = type.trim();

  // Build search term
  const searchTerm = size > 0
    ? `${normalizedType} ${normalizedLocation} ${size}sqm`
    : `${normalizedType} ${normalizedLocation}`;

  switch (source) {
    case 'jiji':
      return {
        source,
        url: `${baseUrl}/real-estate`,
        params: {
          q: searchTerm,
        },
      };

    case 'jumia':
      // Jumia doesn't sell real estate
      throw new Error('Jumia does not support building searches');

    case 'cars45':
      // Cars45 doesn't sell real estate
      throw new Error('Cars45 does not support building searches');

    case 'cheki':
      // Cheki doesn't sell real estate
      throw new Error('Cheki does not support building searches');

    default:
      throw new Error(`Unsupported source for buildings: ${source}`);
  }
}

/**
 * Encode query parameters for URL
 */
export function encodeQueryParams(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/**
 * Build full URL with query parameters
 */
export function buildFullUrl(query: SearchQuery): string {
  const paramString = encodeQueryParams(query.params);
  return paramString ? `${query.url}?${paramString}` : query.url;
}

/**
 * Validate property identifier has required fields
 */
export function validatePropertyIdentifier(property: PropertyIdentifier): void {
  if (!property.type) {
    throw new Error('Property type is required');
  }

  switch (property.type) {
    case 'vehicle':
      if (!property.make) throw new Error('Vehicle make is required');
      if (!property.model) throw new Error('Vehicle model is required');
      if (!property.year) throw new Error('Vehicle year is required');
      if (property.year < 1900 || property.year > new Date().getFullYear() + 1) {
        throw new Error('Vehicle year must be between 1900 and next year');
      }
      break;

    case 'electronics':
      if (!property.brand) throw new Error('Electronics brand is required');
      if (!property.productModel) throw new Error('Electronics model is required');
      break;

    case 'building':
      if (!property.location) throw new Error('Building location is required');
      if (!property.propertyType) throw new Error('Building property type is required');
      if (property.size && property.size < 0) {
        throw new Error('Building size must be positive');
      }
      break;

    default:
      throw new Error(`Unsupported property type: ${property.type}`);
  }
}

/**
 * Get supported sources for a property type
 */
export function getSupportedSources(propertyType: string): string[] {
  switch (propertyType) {
    case 'vehicle':
      return ['jiji', 'jumia', 'cars45', 'cheki'];
    case 'electronics':
      return ['jiji', 'jumia'];
    case 'building':
      return ['jiji'];
    default:
      return [];
  }
}

/**
 * Check if a source supports a property type
 */
export function isSourceSupported(source: string, propertyType: string): boolean {
  const supportedSources = getSupportedSources(propertyType);
  return supportedSources.includes(source);
}
