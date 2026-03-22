/**
 * Case Service
 * 
 * Handles salvage case creation, validation, and management.
 * Integrates with AI assessment, image compression, and audit logging.
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq } from 'drizzle-orm';
import { assessDamageEnhanced, type EnhancedDamageAssessment, type VehicleInfo, type UniversalItemInfo } from './ai-assessment-enhanced.service';
import { uploadFile, getSalvageCaseFolder, TRANSFORMATION_PRESETS } from '@/lib/storage/cloudinary';
import { logAction, AuditActionType, AuditEntityType, type DeviceType } from '@/lib/utils/audit-logger';
import { mapQualityToUniversalCondition } from '@/features/valuations/services/condition-mapping.service';

/**
 * Asset types (must match database assetTypeEnum)
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
  mileage?: number;
  condition?: 'excellent' | 'good' | 'fair' | 'poor' | 'Brand New' | 'Nigerian Used' | 'Foreign Used (Tokunbo)';
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
  model: string;
  storage?: string;
  color?: string;
  serialNumber?: string;
  condition?: 'Brand New' | 'Foreign Used (Tokunbo)' | 'Nigerian Used' | 'Heavily Used';
}

/**
 * Appliance-specific details
 */
export interface ApplianceDetails {
  brand: string;
  model: string;
  type?: string;
  size?: string;
  condition?: 'Brand New' | 'Foreign Used (Tokunbo)' | 'Nigerian Used' | 'Heavily Used';
}

/**
 * Asset details union type
 */
export type AssetDetails = VehicleDetails | PropertyDetails | ElectronicsDetails | ApplianceDetails;

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
  // AI assessment results from frontend (optional - only present when frontend ran assessment)
  aiAssessmentResult?: {
    damageSeverity: 'minor' | 'moderate' | 'severe';
    confidenceScore: number;
    labels: string[];
    estimatedSalvageValue: number;
    reservePrice: number;
    damageScore?: {
      structural: number;
      mechanical: number;
      cosmetic: number;
      electrical: number;
      interior: number;
    };
    confidence?: {
      overall: number;
      vehicleDetection: number;
      damageDetection: number;
      valuationAccuracy: number;
      photoQuality: number;
      reasons: string[];
    };
    estimatedRepairCost?: number;
    isRepairable?: boolean;
    isTotalLoss?: boolean; // NEW: Total loss indicator
    priceSource?: string; // NEW: Price source (database, internet_search, etc.)
    recommendation?: string;
    warnings?: string[];
    analysisMethod?: 'gemini' | 'vision' | 'neutral' | 'mock';
    qualityTier?: string;
  };
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
  damageSeverity: 'minor' | 'moderate' | 'severe' | 'none';
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

    // Determine case status
    const status = input.status || 'pending_approval';
    const isDraft = status === 'draft';

    // CRITICAL FIX: Use AI assessment from frontend if provided
    // The frontend runs AI assessment in real-time during photo upload
    // Backend should use those results instead of creating mock data
    let aiAssessment: EnhancedDamageAssessment | null = null;
    
    // Only run AI assessment for draft cases that don't have assessment yet
    // For non-draft cases, the frontend has already run the assessment
    if (isDraft) {
      console.log('⚠️ Skipping AI assessment for draft case - will be processed when submitted for approval');
    } else if (input.aiAssessmentResult) {
      console.log('✅ Using AI assessment from frontend:', {
        severity: input.aiAssessmentResult.damageSeverity,
        confidence: input.aiAssessmentResult.confidenceScore,
        salvageValue: input.aiAssessmentResult.estimatedSalvageValue,
      });
      
      // Use the REAL AI assessment results from frontend
      aiAssessment = {
        damageSeverity: input.aiAssessmentResult.damageSeverity,
        confidenceScore: input.aiAssessmentResult.confidenceScore,
        labels: input.aiAssessmentResult.labels,
        damagePercentage: input.aiAssessmentResult.damageScore 
          ? ((input.aiAssessmentResult.damageScore.structural || 0) + 
             (input.aiAssessmentResult.damageScore.mechanical || 0) + 
             (input.aiAssessmentResult.damageScore.cosmetic || 0) + 
             (input.aiAssessmentResult.damageScore.electrical || 0) + 
             (input.aiAssessmentResult.damageScore.interior || 0)) / 5
          : 50,
        processedAt: new Date(),
        damageScore: input.aiAssessmentResult.damageScore || {
          structural: 50,
          mechanical: 50,
          cosmetic: 50,
          electrical: 50,
          interior: 50,
        },
        confidence: input.aiAssessmentResult.confidence || {
          overall: input.aiAssessmentResult.confidenceScore,
          vehicleDetection: input.aiAssessmentResult.confidenceScore,
          damageDetection: input.aiAssessmentResult.confidenceScore,
          valuationAccuracy: input.aiAssessmentResult.confidenceScore,
          photoQuality: input.aiAssessmentResult.confidenceScore,
          reasons: ['Frontend assessment completed'],
        },
        estimatedSalvageValue: input.aiAssessmentResult.estimatedSalvageValue,
        estimatedRepairCost: input.aiAssessmentResult.estimatedRepairCost || input.marketValue * 0.7,
        reservePrice: input.aiAssessmentResult.reservePrice,
        isRepairable: input.aiAssessmentResult.isRepairable ?? true,
        isTotalLoss: input.aiAssessmentResult.isTotalLoss, // NEW: Store isTotalLoss field
        priceSource: input.aiAssessmentResult.priceSource, // NEW: Store price source
        recommendation: input.aiAssessmentResult.recommendation || 'Assess for salvage auction',
        warnings: input.aiAssessmentResult.warnings || [],
        analysisMethod: input.aiAssessmentResult.analysisMethod || 'gemini' as const,
        photoCount: photoUrls.length,
        qualityTier: (input.aiAssessmentResult.qualityTier || 'fair') as any,
        marketValue: input.marketValue,
      };
      
      console.log('🎯 Using frontend severity assessment:', aiAssessment.damageSeverity);
    } else {
      console.log('⚠️ No AI assessment from frontend - using fallback values');
      
      // Fallback: Create minimal assessment if frontend didn't provide one
      aiAssessment = {
        damageSeverity: 'moderate' as const,
        confidenceScore: 50,
        labels: [],
        damagePercentage: 50,
        processedAt: new Date(),
        damageScore: {
          structural: 50,
          mechanical: 50,
          cosmetic: 50,
          electrical: 50,
          interior: 50,
        },
        confidence: {
          overall: 50,
          vehicleDetection: 50,
          damageDetection: 50,
          valuationAccuracy: 50,
          photoQuality: 50,
          reasons: ['No frontend assessment available'],
        },
        estimatedSalvageValue: input.marketValue * 0.3,
        estimatedRepairCost: input.marketValue * 0.7,
        reservePrice: input.marketValue * 0.25,
        isRepairable: true,
        recommendation: 'Assess for salvage auction',
        warnings: [],
        analysisMethod: 'mock' as const,
        photoCount: photoUrls.length,
        qualityTier: 'fair' as const,
        marketValue: input.marketValue,
      };
    }
    
    const caseValues = {
      claimReference: input.claimReference,
      assetType: input.assetType,
      assetDetails: input.assetDetails,
      marketValue: input.marketValue.toString(),
      // AI assessment fields are nullable for draft cases
      estimatedSalvageValue: aiAssessment ? aiAssessment.estimatedSalvageValue.toString() : null,
      reservePrice: aiAssessment ? aiAssessment.reservePrice.toString() : null,
      damageSeverity: aiAssessment?.damageSeverity || null,
      aiAssessment: aiAssessment ? {
        labels: aiAssessment.labels,
        confidenceScore: aiAssessment.confidenceScore,
        damagePercentage: aiAssessment.damagePercentage,
        processedAt: aiAssessment.processedAt,
        // Enhanced fields for accuracy
        damageScore: aiAssessment.damageScore,
        confidence: aiAssessment.confidence,
        estimatedRepairCost: aiAssessment.estimatedRepairCost,
        isRepairable: aiAssessment.isRepairable,
        isTotalLoss: aiAssessment.isTotalLoss, // NEW: Store total loss indicator
        priceSource: aiAssessment.priceSource, // NEW: Store price source
        recommendation: aiAssessment.recommendation,
        warnings: aiAssessment.warnings,
        analysisMethod: aiAssessment.analysisMethod,
        photoCount: aiAssessment.photoCount,
      } : null,
      gpsLocation: [input.gpsLocation.latitude, input.gpsLocation.longitude] as [number, number],
      locationName: input.locationName,
      photos: photoUrls,
      voiceNotes: input.voiceNotes || [],
      status,
      createdBy: input.createdBy,
    };
    
    // DEBUG: Log what we're about to store in database
    console.log('💾 Storing case in database with values:', {
      claimReference: caseValues.claimReference,
      damageSeverity: caseValues.damageSeverity,
      estimatedSalvageValue: caseValues.estimatedSalvageValue,
      reservePrice: caseValues.reservePrice,
      aiAssessmentConfidence: caseValues.aiAssessment?.confidenceScore,
    });
    
    const [createdCase] = await db
      .insert(salvageCases)
      .values(caseValues)
      .returning();
    
    // DEBUG: Verify what was actually stored in database
    console.log('✅ Case stored successfully in database:', {
      id: createdCase.id,
      claimReference: createdCase.claimReference,
      damageSeverity: createdCase.damageSeverity,
      estimatedSalvageValue: createdCase.estimatedSalvageValue,
      reservePrice: createdCase.reservePrice,
      aiConfidence: (createdCase.aiAssessment as any)?.confidenceScore,
    });

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
        isDraft: isDraft,
      },
    });

    // Log AI assessment completion only if assessment was performed
    if (aiAssessment) {
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
          estimatedRepairCost: aiAssessment.estimatedRepairCost,
          isRepairable: aiAssessment.isRepairable,
          analysisMethod: aiAssessment.analysisMethod,
          warnings: aiAssessment.warnings
        },
      });
    }

    console.log(`Case created successfully: ${createdCase.id}`);

    // Parse GPS location from point tuple format
    const [latitude, longitude] = createdCase.gpsLocation;

    return {
      id: createdCase.id,
      claimReference: createdCase.claimReference,
      assetType: createdCase.assetType as AssetType,
      assetDetails: createdCase.assetDetails as AssetDetails,
      marketValue: parseFloat(createdCase.marketValue),
      // Handle nullable AI assessment fields for draft cases
      estimatedSalvageValue: createdCase.estimatedSalvageValue ? parseFloat(createdCase.estimatedSalvageValue) : 0,
      reservePrice: createdCase.reservePrice ? parseFloat(createdCase.reservePrice) : 0,
      damageSeverity: (createdCase.damageSeverity || 'none') as 'none' | 'minor' | 'moderate' | 'severe',
      aiAssessment: createdCase.aiAssessment as {
        labels: string[];
        confidenceScore: number;
        damagePercentage: number;
        processedAt: Date;
      } || {
        labels: [],
        confidenceScore: 0,
        damagePercentage: 0,
        processedAt: new Date(),
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
