/**
 * Case Service
 * 
 * Handles salvage case creation, validation, and management.
 * Integrates with AI assessment, image compression, and audit logging.
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq } from 'drizzle-orm';
import { assessDamage, type DamageAssessmentResult } from './ai-assessment.service';
import { uploadFile, getSalvageCaseFolder, TRANSFORMATION_PRESETS } from '@/lib/storage/cloudinary';
import { logAction, AuditActionType, AuditEntityType, type DeviceType } from '@/lib/utils/audit-logger';

/**
 * Asset types
 */
export type AssetType = 'vehicle' | 'property' | 'electronics';

/**
 * Vehicle-specific details
 */
export interface VehicleDetails {
  make: string;
  model: string;
  year: number;
  vin?: string;
}

/**
 * Property-specific details
 */
export interface PropertyDetails {
  propertyType: string;
  address: string;
}

/**
 * Electronics-specific details
 */
export interface ElectronicsDetails {
  brand: string;
  serialNumber?: string;
}

/**
 * Asset details union type
 */
export type AssetDetails = VehicleDetails | PropertyDetails | ElectronicsDetails;

/**
 * GPS coordinates
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Case creation input
 */
export interface CreateCaseInput {
  claimReference: string;
  assetType: AssetType;
  assetDetails: AssetDetails;
  marketValue: number;
  photos: Buffer[]; // Photo buffers to upload
  gpsLocation: GeoPoint;
  locationName: string;
  voiceNotes?: string[]; // Voice-to-text transcriptions
  createdBy: string; // User ID
  status?: 'draft' | 'pending_approval';
}

/**
 * Case creation result
 */
export interface CreateCaseResult {
  id: string;
  claimReference: string;
  assetType: AssetType;
  assetDetails: AssetDetails;
  marketValue: number;
  estimatedSalvageValue: number;
  reservePrice: number;
  damageSeverity: 'minor' | 'moderate' | 'severe';
  aiAssessment: {
    labels: string[];
    confidenceScore: number;
    damagePercentage: number;
    processedAt: Date;
  };
  gpsLocation: GeoPoint;
  locationName: string;
  photos: string[]; // Cloudinary URLs
  voiceNotes?: string[];
  status: 'draft' | 'pending_approval';
  createdBy: string;
  createdAt: Date;
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: string[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate case creation input
 */
async function validateCaseInput(input: CreateCaseInput): Promise<string[]> {
  const errors: string[] = [];

  // Validate claim reference
  if (!input.claimReference || input.claimReference.trim() === '') {
    errors.push('Claim reference is required');
  } else {
    // Check uniqueness
    const existing = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.claimReference, input.claimReference))
      .limit(1);

    if (existing.length > 0) {
      errors.push('Claim reference must be unique');
    }
  }

  // Validate asset type
  const validAssetTypes: AssetType[] = ['vehicle', 'property', 'electronics'];
  if (!validAssetTypes.includes(input.assetType)) {
    errors.push('Asset type must be one of: vehicle, property, electronics');
  }

  // Validate asset details based on type
  if (input.assetType === 'vehicle') {
    const vehicleDetails = input.assetDetails as VehicleDetails;
    if (!vehicleDetails.make || vehicleDetails.make.trim() === '') {
      errors.push('Vehicle make is required');
    }
    if (!vehicleDetails.model || vehicleDetails.model.trim() === '') {
      errors.push('Vehicle model is required');
    }
    if (!vehicleDetails.year || vehicleDetails.year < 1900 || vehicleDetails.year > new Date().getFullYear() + 1) {
      errors.push('Vehicle year must be valid');
    }
  } else if (input.assetType === 'property') {
    const propertyDetails = input.assetDetails as PropertyDetails;
    if (!propertyDetails.propertyType || propertyDetails.propertyType.trim() === '') {
      errors.push('Property type is required');
    }
    if (!propertyDetails.address || propertyDetails.address.trim() === '') {
      errors.push('Property address is required');
    }
  } else if (input.assetType === 'electronics') {
    const electronicsDetails = input.assetDetails as ElectronicsDetails;
    if (!electronicsDetails.brand || electronicsDetails.brand.trim() === '') {
      errors.push('Electronics brand is required');
    }
  }

  // Validate market value
  if (!input.marketValue || input.marketValue <= 0) {
    errors.push('Market value must be positive');
  }

  // Validate photos
  if (!input.photos || input.photos.length < 3) {
    errors.push('At least 3 photos are required');
  } else if (input.photos.length > 10) {
    errors.push('Maximum 10 photos allowed');
  }

  // Validate photo sizes (max 5MB each)
  const maxPhotoSize = 5 * 1024 * 1024; // 5MB
  input.photos?.forEach((photo, index) => {
    if (photo.length > maxPhotoSize) {
      errors.push(`Photo ${index + 1} exceeds 5MB limit`);
    }
  });

  // Validate GPS location
  if (!input.gpsLocation) {
    errors.push('GPS location is required');
  } else {
    if (
      typeof input.gpsLocation.latitude !== 'number' ||
      input.gpsLocation.latitude < -90 ||
      input.gpsLocation.latitude > 90
    ) {
      errors.push('GPS latitude must be between -90 and 90');
    }
    if (
      typeof input.gpsLocation.longitude !== 'number' ||
      input.gpsLocation.longitude < -180 ||
      input.gpsLocation.longitude > 180
    ) {
      errors.push('GPS longitude must be between -180 and 180');
    }
  }

  // Validate location name
  if (!input.locationName || input.locationName.trim() === '') {
    errors.push('Location name is required');
  }

  return errors;
}

/**
 * Create a new salvage case
 * 
 * @param input - Case creation input
 * @param ipAddress - IP address of the requester
 * @param deviceType - Device type of the requester
 * @param userAgent - User agent of the requester
 * @returns Created case result
 * 
 * @throws ValidationError if input validation fails
 * @throws Error if case creation fails
 */
export async function createCase(
  input: CreateCaseInput,
  ipAddress: string,
  deviceType: DeviceType,
  userAgent: string
): Promise<CreateCaseResult> {
  try {
    // Validate input
    const validationErrors = await validateCaseInput(input);
    if (validationErrors.length > 0) {
      throw new ValidationError('Case validation failed', validationErrors);
    }

    // Generate temporary case ID for folder structure
    const tempCaseId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const folder = getSalvageCaseFolder(tempCaseId);

    // Upload photos to Cloudinary with compression
    console.log(`Uploading ${input.photos.length} photos to Cloudinary...`);
    const photoUrls: string[] = [];
    
    for (let i = 0; i < input.photos.length; i++) {
      const photo = input.photos[i];
      const uploadResult = await uploadFile(photo, {
        folder,
        transformation: TRANSFORMATION_PRESETS.COMPRESSED,
        tags: [input.assetType, input.claimReference],
        compress: true, // Enable TinyPNG compression
        compressionPreset: 'MOBILE', // Use mobile preset for optimal data savings
      });
      
      photoUrls.push(uploadResult.secureUrl);
      console.log(`Uploaded photo ${i + 1}/${input.photos.length}: ${uploadResult.secureUrl}`);
    }

    // Call AI assessment service
    console.log('Running AI damage assessment...');
    const aiAssessment: DamageAssessmentResult = await assessDamage(
      photoUrls,
      input.marketValue
    );
    console.log(`AI assessment complete: ${aiAssessment.damageSeverity} damage, ${aiAssessment.confidenceScore}% confidence`);

    // Create case record
    const status = input.status || 'pending_approval';
    
    const [createdCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: input.claimReference,
        assetType: input.assetType,
        assetDetails: input.assetDetails,
        marketValue: input.marketValue.toString(),
        estimatedSalvageValue: aiAssessment.estimatedSalvageValue.toString(),
        reservePrice: aiAssessment.reservePrice.toString(),
        damageSeverity: aiAssessment.damageSeverity,
        aiAssessment: {
          labels: aiAssessment.labels,
          confidenceScore: aiAssessment.confidenceScore,
          damagePercentage: aiAssessment.damagePercentage,
          processedAt: aiAssessment.processedAt,
        },
        gpsLocation: [input.gpsLocation.latitude, input.gpsLocation.longitude] as [number, number],
        locationName: input.locationName,
        photos: photoUrls,
        voiceNotes: input.voiceNotes || [],
        status,
        createdBy: input.createdBy,
      })
      .returning();

    // Create audit log entry
    await logAction({
      userId: input.createdBy,
      actionType: AuditActionType.CASE_CREATED,
      entityType: AuditEntityType.CASE,
      entityId: createdCase.id,
      ipAddress,
      deviceType,
      userAgent,
      afterState: {
        claimReference: createdCase.claimReference,
        assetType: createdCase.assetType,
        marketValue: createdCase.marketValue,
        status: createdCase.status,
      },
    });

    // Log AI assessment completion
    await logAction({
      userId: input.createdBy,
      actionType: AuditActionType.AI_ASSESSMENT_COMPLETED,
      entityType: AuditEntityType.CASE,
      entityId: createdCase.id,
      ipAddress,
      deviceType,
      userAgent,
      afterState: {
        confidenceScore: aiAssessment.confidenceScore,
        damageSeverity: aiAssessment.damageSeverity,
        estimatedSalvageValue: aiAssessment.estimatedSalvageValue,
      },
    });

    console.log(`Case created successfully: ${createdCase.id}`);

    // Parse GPS location from point tuple format
    const [latitude, longitude] = createdCase.gpsLocation;

    return {
      id: createdCase.id,
      claimReference: createdCase.claimReference,
      assetType: createdCase.assetType as AssetType,
      assetDetails: createdCase.assetDetails as AssetDetails,
      marketValue: parseFloat(createdCase.marketValue),
      estimatedSalvageValue: parseFloat(createdCase.estimatedSalvageValue),
      reservePrice: parseFloat(createdCase.reservePrice),
      damageSeverity: createdCase.damageSeverity as 'minor' | 'moderate' | 'severe',
      aiAssessment: createdCase.aiAssessment as {
        labels: string[];
        confidenceScore: number;
        damagePercentage: number;
        processedAt: Date;
      },
      gpsLocation: {
        latitude,
        longitude,
      },
      locationName: createdCase.locationName,
      photos: createdCase.photos || [],
      voiceNotes: createdCase.voiceNotes || undefined,
      status: createdCase.status as 'draft' | 'pending_approval',
      createdBy: createdCase.createdBy,
      createdAt: createdCase.createdAt,
    };
  } catch (error) {
    console.error('Error creating case:', error);
    
    if (error instanceof ValidationError) {
      throw error;
    }
    
    throw new Error(`Failed to create case: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get case by ID
 */
export async function getCaseById(caseId: string) {
  const [caseRecord] = await db
    .select()
    .from(salvageCases)
    .where(eq(salvageCases.id, caseId))
    .limit(1);

  return caseRecord || null;
}

/**
 * Get case by claim reference
 */
export async function getCaseByClaimReference(claimReference: string) {
  const [caseRecord] = await db
    .select()
    .from(salvageCases)
    .where(eq(salvageCases.claimReference, claimReference))
    .limit(1);

  return caseRecord || null;
}
