/**
 * Property Test: Case Creation Field Validation
 * 
 * Validates: Requirements 12.3-12.8
 * 
 * Property 7: Case Creation Field Validation
 * For any salvage case creation, the system should validate that claim reference is unique,
 * asset type is one of (vehicle, property, electronics), market value is positive,
 * 3-10 photos are provided (max 5MB each), GPS coordinates are captured,
 * and all required asset details for the selected type are present.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for case validation
type AssetType = 'vehicle' | 'property' | 'electronics';

interface VehicleDetails {
  make: string;
  model: string;
  year: number;
  vin?: string;
}

interface PropertyDetails {
  propertyType: string;
  address: string;
}

interface ElectronicsDetails {
  brand: string;
  serialNumber?: string;
}

type AssetDetails = VehicleDetails | PropertyDetails | ElectronicsDetails;

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface CaseCreationData {
  claimReference: string;
  assetType: AssetType;
  assetDetails: AssetDetails;
  marketValue: number;
  photos: Array<{ size: number; url: string }>;
  gpsLocation: GeoPoint;
  locationName: string;
  voiceNotes?: string[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate case creation data
 */
function validateCaseCreation(data: CaseCreationData, existingClaimReferences: string[]): ValidationResult {
  const errors: string[] = [];

  // Requirement 12.3: Validate claim reference uniqueness
  if (!data.claimReference || data.claimReference.trim() === '') {
    errors.push('Claim reference is required');
  } else if (existingClaimReferences.includes(data.claimReference)) {
    errors.push('Claim reference must be unique');
  }

  // Requirement 12.4: Validate asset type
  const validAssetTypes: AssetType[] = ['vehicle', 'property', 'electronics'];
  if (!validAssetTypes.includes(data.assetType)) {
    errors.push('Asset type must be one of: vehicle, property, electronics');
  }

  // Requirement 12.5: Validate required asset details based on type
  if (data.assetType === 'vehicle') {
    const vehicleDetails = data.assetDetails as VehicleDetails;
    if (!vehicleDetails.make || vehicleDetails.make.trim() === '') {
      errors.push('Vehicle make is required');
    }
    if (!vehicleDetails.model || vehicleDetails.model.trim() === '') {
      errors.push('Vehicle model is required');
    }
    if (!vehicleDetails.year || vehicleDetails.year < 1900 || vehicleDetails.year > new Date().getFullYear() + 1) {
      errors.push('Vehicle year must be valid');
    }
  } else if (data.assetType === 'property') {
    const propertyDetails = data.assetDetails as PropertyDetails;
    if (!propertyDetails.propertyType || propertyDetails.propertyType.trim() === '') {
      errors.push('Property type is required');
    }
    if (!propertyDetails.address || propertyDetails.address.trim() === '') {
      errors.push('Property address is required');
    }
  } else if (data.assetType === 'electronics') {
    const electronicsDetails = data.assetDetails as ElectronicsDetails;
    if (!electronicsDetails.brand || electronicsDetails.brand.trim() === '') {
      errors.push('Electronics brand is required');
    }
  }

  // Requirement 12.6: Validate market value is positive
  if (!data.marketValue || data.marketValue <= 0) {
    errors.push('Market value must be positive');
  }

  // Requirement 12.7: Validate 3-10 photos are provided
  if (!data.photos || data.photos.length < 3) {
    errors.push('At least 3 photos are required');
  } else if (data.photos.length > 10) {
    errors.push('Maximum 10 photos allowed');
  }

  // Requirement 12.8: Validate photo sizes (max 5MB each)
  const maxPhotoSize = 5 * 1024 * 1024; // 5MB in bytes
  data.photos?.forEach((photo, index) => {
    if (photo.size > maxPhotoSize) {
      errors.push(`Photo ${index + 1} exceeds 5MB limit`);
    }
  });

  // Requirement 12.10: Validate GPS coordinates are captured
  if (!data.gpsLocation) {
    errors.push('GPS location is required');
  } else {
    if (typeof data.gpsLocation.latitude !== 'number' || 
        data.gpsLocation.latitude < -90 || 
        data.gpsLocation.latitude > 90) {
      errors.push('GPS latitude must be between -90 and 90');
    }
    if (typeof data.gpsLocation.longitude !== 'number' || 
        data.gpsLocation.longitude < -180 || 
        data.gpsLocation.longitude > 180) {
      errors.push('GPS longitude must be between -180 and 180');
    }
  }

  // Requirement 12.11: Validate location name
  if (!data.locationName || data.locationName.trim() === '') {
    errors.push('Location name is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

describe('Property Test: Case Creation Field Validation', () => {
  describe('Property 7: Case Creation Field Validation', () => {
    it('should validate claim reference uniqueness', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 10 }),
          (claimRef, existingRefs) => {
            const data: CaseCreationData = {
              claimReference: claimRef,
              assetType: 'vehicle',
              assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
              marketValue: 5000000,
              photos: [
                { size: 1024 * 1024, url: 'photo1.jpg' },
                { size: 1024 * 1024, url: 'photo2.jpg' },
                { size: 1024 * 1024, url: 'photo3.jpg' },
              ],
              gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
              locationName: 'Lagos, Nigeria',
            };

            const result = validateCaseCreation(data, existingRefs);

            // If claim reference exists in the list, validation should fail
            if (existingRefs.includes(claimRef)) {
              expect(result.valid).toBe(false);
              expect(result.errors).toContain('Claim reference must be unique');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate asset type is one of vehicle, property, electronics', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('vehicle', 'property', 'electronics', 'invalid' as AssetType),
          (assetType) => {
            const data: CaseCreationData = {
              claimReference: 'CLAIM-001',
              assetType,
              assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
              marketValue: 5000000,
              photos: [
                { size: 1024 * 1024, url: 'photo1.jpg' },
                { size: 1024 * 1024, url: 'photo2.jpg' },
                { size: 1024 * 1024, url: 'photo3.jpg' },
              ],
              gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
              locationName: 'Lagos, Nigeria',
            };

            const result = validateCaseCreation(data, []);

            const validTypes = ['vehicle', 'property', 'electronics'];
            if (!validTypes.includes(assetType)) {
              expect(result.valid).toBe(false);
              expect(result.errors.some(e => e.includes('Asset type must be one of'))).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate market value is positive', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.double({ min: 0.01, max: 100000000, noNaN: true }),
            fc.double({ min: -100000000, max: 0, noNaN: true }),
            fc.constant(0)
          ),
          (marketValue) => {
            const data: CaseCreationData = {
              claimReference: 'CLAIM-001',
              assetType: 'vehicle',
              assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
              marketValue,
              photos: [
                { size: 1024 * 1024, url: 'photo1.jpg' },
                { size: 1024 * 1024, url: 'photo2.jpg' },
                { size: 1024 * 1024, url: 'photo3.jpg' },
              ],
              gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
              locationName: 'Lagos, Nigeria',
            };

            const result = validateCaseCreation(data, []);

            if (marketValue <= 0) {
              expect(result.valid).toBe(false);
              expect(result.errors).toContain('Market value must be positive');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate 3-10 photos are provided', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 15 }),
          (photoCount) => {
            const photos = Array.from({ length: photoCount }, (_, i) => ({
              size: 1024 * 1024,
              url: `photo${i + 1}.jpg`,
            }));

            const data: CaseCreationData = {
              claimReference: 'CLAIM-001',
              assetType: 'vehicle',
              assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
              marketValue: 5000000,
              photos,
              gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
              locationName: 'Lagos, Nigeria',
            };

            const result = validateCaseCreation(data, []);

            if (photoCount < 3) {
              expect(result.valid).toBe(false);
              expect(result.errors).toContain('At least 3 photos are required');
            } else if (photoCount > 10) {
              expect(result.valid).toBe(false);
              expect(result.errors).toContain('Maximum 10 photos allowed');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate photo sizes (max 5MB each)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.integer({ min: 1, max: 10 * 1024 * 1024 }), // 1 byte to 10MB
            { minLength: 3, maxLength: 10 }
          ),
          (photoSizes) => {
            const photos = photoSizes.map((size, i) => ({
              size,
              url: `photo${i + 1}.jpg`,
            }));

            const data: CaseCreationData = {
              claimReference: 'CLAIM-001',
              assetType: 'vehicle',
              assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
              marketValue: 5000000,
              photos,
              gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
              locationName: 'Lagos, Nigeria',
            };

            const result = validateCaseCreation(data, []);

            const maxSize = 5 * 1024 * 1024; // 5MB
            const hasOversizedPhoto = photoSizes.some(size => size > maxSize);

            if (hasOversizedPhoto) {
              expect(result.valid).toBe(false);
              expect(result.errors.some(e => e.includes('exceeds 5MB limit'))).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate GPS coordinates are captured', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          (latitude, longitude) => {
            const data: CaseCreationData = {
              claimReference: 'CLAIM-001',
              assetType: 'vehicle',
              assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
              marketValue: 5000000,
              photos: [
                { size: 1024 * 1024, url: 'photo1.jpg' },
                { size: 1024 * 1024, url: 'photo2.jpg' },
                { size: 1024 * 1024, url: 'photo3.jpg' },
              ],
              gpsLocation: { latitude, longitude },
              locationName: 'Lagos, Nigeria',
            };

            const result = validateCaseCreation(data, []);

            // Valid GPS coordinates should not produce GPS-related errors
            const hasGpsError = result.errors.some(e => 
              e.includes('GPS') || e.includes('latitude') || e.includes('longitude')
            );
            expect(hasGpsError).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate required vehicle details', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.integer({ min: 1800, max: 2030 }),
          (make, model, year) => {
            const data: CaseCreationData = {
              claimReference: 'CLAIM-001',
              assetType: 'vehicle',
              assetDetails: { make, model, year },
              marketValue: 5000000,
              photos: [
                { size: 1024 * 1024, url: 'photo1.jpg' },
                { size: 1024 * 1024, url: 'photo2.jpg' },
                { size: 1024 * 1024, url: 'photo3.jpg' },
              ],
              gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
              locationName: 'Lagos, Nigeria',
            };

            const result = validateCaseCreation(data, []);

            const currentYear = new Date().getFullYear();
            
            if (!make || make.trim() === '') {
              expect(result.errors).toContain('Vehicle make is required');
            }
            if (!model || model.trim() === '') {
              expect(result.errors).toContain('Vehicle model is required');
            }
            if (year < 1900 || year > currentYear + 1) {
              expect(result.errors).toContain('Vehicle year must be valid');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate required property details', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 200 }),
          (propertyType, address) => {
            const data: CaseCreationData = {
              claimReference: 'CLAIM-001',
              assetType: 'property',
              assetDetails: { propertyType, address },
              marketValue: 5000000,
              photos: [
                { size: 1024 * 1024, url: 'photo1.jpg' },
                { size: 1024 * 1024, url: 'photo2.jpg' },
                { size: 1024 * 1024, url: 'photo3.jpg' },
              ],
              gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
              locationName: 'Lagos, Nigeria',
            };

            const result = validateCaseCreation(data, []);

            if (!propertyType || propertyType.trim() === '') {
              expect(result.errors).toContain('Property type is required');
            }
            if (!address || address.trim() === '') {
              expect(result.errors).toContain('Property address is required');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate required electronics details', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          (brand) => {
            const data: CaseCreationData = {
              claimReference: 'CLAIM-001',
              assetType: 'electronics',
              assetDetails: { brand },
              marketValue: 5000000,
              photos: [
                { size: 1024 * 1024, url: 'photo1.jpg' },
                { size: 1024 * 1024, url: 'photo2.jpg' },
                { size: 1024 * 1024, url: 'photo3.jpg' },
              ],
              gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
              locationName: 'Lagos, Nigeria',
            };

            const result = validateCaseCreation(data, []);

            if (!brand || brand.trim() === '') {
              expect(result.errors).toContain('Electronics brand is required');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid case creation data', () => {
      fc.assert(
        fc.property(
          fc.record({
            claimReference: fc.string({ minLength: 5, maxLength: 50 }),
            assetType: fc.constantFrom('vehicle' as const, 'property' as const, 'electronics' as const),
            marketValue: fc.double({ min: 1000, max: 100000000, noNaN: true }),
            photoCount: fc.integer({ min: 3, max: 10 }),
            latitude: fc.double({ min: -90, max: 90, noNaN: true }),
            longitude: fc.double({ min: -180, max: 180, noNaN: true }),
            locationName: fc.string({ minLength: 5, maxLength: 100 }),
          }),
          (input) => {
            let assetDetails: AssetDetails;
            
            if (input.assetType === 'vehicle') {
              assetDetails = {
                make: 'Toyota',
                model: 'Camry',
                year: 2020,
                vin: 'VIN123456',
              };
            } else if (input.assetType === 'property') {
              assetDetails = {
                propertyType: 'Residential',
                address: '123 Main St, Lagos',
              };
            } else {
              assetDetails = {
                brand: 'Samsung',
                serialNumber: 'SN123456',
              };
            }

            const photos = Array.from({ length: input.photoCount }, (_, i) => ({
              size: 2 * 1024 * 1024, // 2MB each
              url: `photo${i + 1}.jpg`,
            }));

            const data: CaseCreationData = {
              claimReference: input.claimReference,
              assetType: input.assetType,
              assetDetails,
              marketValue: input.marketValue,
              photos,
              gpsLocation: { latitude: input.latitude, longitude: input.longitude },
              locationName: input.locationName,
            };

            const result = validateCaseCreation(data, []);

            // Valid data should pass validation
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
