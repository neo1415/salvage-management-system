/**
 * Integration Test: Case Creation API
 * 
 * Tests the complete case creation flow including:
 * - Input validation
 * - Photo upload to Cloudinary
 * - AI damage assessment
 * - Database record creation
 * - Audit logging
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createCase, ValidationError, type CreateCaseInput } from '@/features/cases/services/case.service';
import { DeviceType } from '@/lib/utils/audit-logger';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';

// Mock Cloudinary upload to avoid actual uploads during tests
vi.mock('@/lib/storage/cloudinary', () => ({
  uploadFile: vi.fn(async () => ({
    publicId: 'test-photo-id',
    url: 'https://res.cloudinary.com/test/image/upload/test-photo.jpg',
    secureUrl: 'https://res.cloudinary.com/test/image/upload/test-photo.jpg',
    format: 'jpg',
    width: 1920,
    height: 1080,
    bytes: 1024 * 1024,
    createdAt: new Date().toISOString(),
  })),
  getSalvageCaseFolder: vi.fn((caseId: string) => `salvage-cases/${caseId}`),
  TRANSFORMATION_PRESETS: {
    COMPRESSED: {
      quality: 'auto:eco',
      fetch_format: 'auto',
      flags: 'lossy',
    },
  },
}));

// Mock AI assessment to avoid actual API calls during tests
vi.mock('@/features/cases/services/ai-assessment.service', () => ({
  assessDamage: vi.fn(async (imageUrls: string[], marketValue: number) => ({
    labels: ['damage', 'dent', 'scratch'],
    confidenceScore: 85,
    damagePercentage: 50,
    processedAt: new Date(),
    damageSeverity: 'moderate' as const,
    estimatedSalvageValue: marketValue * 0.5,
    reservePrice: marketValue * 0.5 * 0.7,
  })),
}));

describe('Integration Test: Case Creation API', () => {
  let testUserId: string;
  const testClaimRef = 'TEST-CLAIM-' + Date.now();

  beforeAll(async () => {
    // Create a test user for the cases
    const [testUser] = await db
      .insert(users)
      .values({
        email: `test-${Date.now()}@example.com`,
        phone: `+234${Date.now().toString().slice(-10)}`,
        passwordHash: await hash('Test123!@#', 12),
        fullName: 'Test User',
        dateOfBirth: new Date('1990-01-01'),
        role: 'claims_adjuster',
        status: 'verified_tier_1',
      })
      .returning();
    
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await db.delete(salvageCases).where(eq(salvageCases.createdBy, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  it('should create a case with valid vehicle data', async () => {
    const input: CreateCaseInput = {
      claimReference: testClaimRef,
      assetType: 'vehicle',
      assetDetails: {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        vin: 'VIN123456789',
      },
      marketValue: 5000000,
      photos: [
        Buffer.from('fake-photo-1'),
        Buffer.from('fake-photo-2'),
        Buffer.from('fake-photo-3'),
      ],
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Lagos, Nigeria',
      voiceNotes: ['Front bumper damaged', 'Windshield cracked'],
      createdBy: testUserId,
      status: 'pending_approval',
    };

    const result = await createCase(
      input,
      '192.168.1.1',
      DeviceType.MOBILE,
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
    );

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.claimReference).toBe(testClaimRef);
    expect(result.assetType).toBe('vehicle');
    expect(result.marketValue).toBe(5000000);
    expect(result.estimatedSalvageValue).toBeGreaterThan(0);
    expect(result.reservePrice).toBeGreaterThan(0);
    expect(result.damageSeverity).toBe('moderate');
    expect(result.aiAssessment).toBeDefined();
    expect(result.aiAssessment.confidenceScore).toBe(85);
    expect(result.photos).toHaveLength(3);
    expect(result.gpsLocation.latitude).toBe(6.5244);
    expect(result.gpsLocation.longitude).toBe(3.3792);
    expect(result.status).toBe('pending_approval');
  });

  it('should reject case with duplicate claim reference', async () => {
    const input: CreateCaseInput = {
      claimReference: testClaimRef, // Same as previous test
      assetType: 'vehicle',
      assetDetails: {
        make: 'Honda',
        model: 'Accord',
        year: 2021,
      },
      marketValue: 6000000,
      photos: [
        Buffer.from('fake-photo-1'),
        Buffer.from('fake-photo-2'),
        Buffer.from('fake-photo-3'),
      ],
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Lagos, Nigeria',
      createdBy: testUserId,
    };

    await expect(
      createCase(
        input,
        '192.168.1.1',
        DeviceType.MOBILE,
        'Mozilla/5.0'
      )
    ).rejects.toThrow(ValidationError);
  });

  it('should reject case with insufficient photos', async () => {
    const input: CreateCaseInput = {
      claimReference: 'TEST-CLAIM-INSUFFICIENT-PHOTOS-' + Date.now(),
      assetType: 'vehicle',
      assetDetails: {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
      },
      marketValue: 5000000,
      photos: [
        Buffer.from('fake-photo-1'),
        Buffer.from('fake-photo-2'),
      ], // Only 2 photos, need at least 3
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Lagos, Nigeria',
      createdBy: testUserId,
    };

    await expect(
      createCase(
        input,
        '192.168.1.1',
        DeviceType.MOBILE,
        'Mozilla/5.0'
      )
    ).rejects.toThrow(ValidationError);
  });

  it('should reject case with invalid market value', async () => {
    const input: CreateCaseInput = {
      claimReference: 'TEST-CLAIM-INVALID-VALUE-' + Date.now(),
      assetType: 'vehicle',
      assetDetails: {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
      },
      marketValue: -5000000, // Negative value
      photos: [
        Buffer.from('fake-photo-1'),
        Buffer.from('fake-photo-2'),
        Buffer.from('fake-photo-3'),
      ],
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Lagos, Nigeria',
      createdBy: testUserId,
    };

    await expect(
      createCase(
        input,
        '192.168.1.1',
        DeviceType.MOBILE,
        'Mozilla/5.0'
      )
    ).rejects.toThrow(ValidationError);
  });

  it('should reject case with missing required vehicle details', async () => {
    const input: CreateCaseInput = {
      claimReference: 'TEST-CLAIM-MISSING-DETAILS-' + Date.now(),
      assetType: 'vehicle',
      assetDetails: {
        make: '', // Empty make
        model: 'Camry',
        year: 2020,
      },
      marketValue: 5000000,
      photos: [
        Buffer.from('fake-photo-1'),
        Buffer.from('fake-photo-2'),
        Buffer.from('fake-photo-3'),
      ],
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Lagos, Nigeria',
      createdBy: testUserId,
    };

    await expect(
      createCase(
        input,
        '192.168.1.1',
        DeviceType.MOBILE,
        'Mozilla/5.0'
      )
    ).rejects.toThrow(ValidationError);
  });

  it('should create case with property asset type', async () => {
    const propertyClaimRef = 'TEST-CLAIM-PROPERTY-' + Date.now();
    
    const input: CreateCaseInput = {
      claimReference: propertyClaimRef,
      assetType: 'property',
      assetDetails: {
        propertyType: 'Residential',
        address: '123 Main Street, Lagos, Nigeria',
      },
      marketValue: 10000000,
      photos: [
        Buffer.from('fake-photo-1'),
        Buffer.from('fake-photo-2'),
        Buffer.from('fake-photo-3'),
      ],
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Lagos, Nigeria',
      createdBy: testUserId,
    };

    const result = await createCase(
      input,
      '192.168.1.1',
      DeviceType.DESKTOP,
      'Mozilla/5.0'
    );

    expect(result).toBeDefined();
    expect(result.assetType).toBe('property');
    expect((result.assetDetails as any).propertyType).toBe('Residential');
    expect((result.assetDetails as any).address).toBe('123 Main Street, Lagos, Nigeria');
  });

  it('should create case with electronics asset type', async () => {
    const electronicsClaimRef = 'TEST-CLAIM-ELECTRONICS-' + Date.now();
    
    const input: CreateCaseInput = {
      claimReference: electronicsClaimRef,
      assetType: 'electronics',
      assetDetails: {
        brand: 'Samsung',
        serialNumber: 'SN123456789',
      },
      marketValue: 500000,
      photos: [
        Buffer.from('fake-photo-1'),
        Buffer.from('fake-photo-2'),
        Buffer.from('fake-photo-3'),
      ],
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Lagos, Nigeria',
      createdBy: testUserId,
    };

    const result = await createCase(
      input,
      '192.168.1.1',
      DeviceType.TABLET,
      'Mozilla/5.0'
    );

    expect(result).toBeDefined();
    expect(result.assetType).toBe('electronics');
    expect((result.assetDetails as any).brand).toBe('Samsung');
    expect((result.assetDetails as any).serialNumber).toBe('SN123456789');
  });
});
