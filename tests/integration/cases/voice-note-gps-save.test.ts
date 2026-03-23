/**
 * Integration Test: Voice Note and GPS Coordinates Save
 * 
 * Verifies that voice note transcriptions and GPS coordinates
 * are properly saved to the database when creating a case.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq, sql } from 'drizzle-orm';
import { createCase, type CreateCaseInput } from '@/features/cases/services/case.service';
import { DeviceType } from '@/lib/utils/audit-logger';

describe('Voice Note and GPS Coordinates Save', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const [testUser] = await db
      .insert(users)
      .values({
        email: 'test-voice-gps@example.com',
        phone: '+2341234567890',
        fullName: 'Test User',
        dateOfBirth: new Date('1990-01-01'),
        role: 'claims_adjuster',
        passwordHash: 'test-hash',
      })
      .returning();
    
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Cleanup: Delete test cases
    await db
      .delete(salvageCases)
      .where(eq(salvageCases.createdBy, testUserId));
    
    // Cleanup: Delete test user
    await db
      .delete(users)
      .where(eq(users.id, testUserId));
  });

  it('should save voice note transcription as array', async () => {
    // Arrange
    const voiceTranscription = 'This is a test voice note. The vehicle has front bumper damage and scratches on the left door.';
    
    const input: CreateCaseInput = {
      claimReference: `TEST-VOICE-${Date.now()}`,
      assetType: 'vehicle',
      assetDetails: {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        vin: 'TEST123456789',
      },
      marketValue: 5000000,
      photos: [Buffer.from('fake-image-data-1'), Buffer.from('fake-image-data-2'), Buffer.from('fake-image-data-3')],
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Lagos, Nigeria',
      voiceNotes: [voiceTranscription],
      createdBy: testUserId,
      status: 'pending_approval',
    };

    // Act
    const result = await createCase(input, '127.0.0.1', DeviceType.DESKTOP, 'test-agent');

    // Assert
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.voiceNotes).toBeDefined();
    expect(result.voiceNotes).toHaveLength(1);
    expect(result.voiceNotes![0]).toBe(voiceTranscription);

    // Verify in database
    const [savedCase] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, result.id))
      .limit(1);

    expect(savedCase).toBeDefined();
    expect(savedCase.voiceNotes).toBeDefined();
    expect(savedCase.voiceNotes).toHaveLength(1);
    expect(savedCase.voiceNotes![0]).toBe(voiceTranscription);
  });

  it('should save GPS coordinates as PostGIS point', async () => {
    // Arrange
    const testLatitude = 6.5244;
    const testLongitude = 3.3792;
    
    const input: CreateCaseInput = {
      claimReference: `TEST-GPS-${Date.now()}`,
      assetType: 'vehicle',
      assetDetails: {
        make: 'Honda',
        model: 'Accord',
        year: 2019,
      },
      marketValue: 4500000,
      photos: [Buffer.from('fake-image-data-1'), Buffer.from('fake-image-data-2'), Buffer.from('fake-image-data-3')],
      gpsLocation: {
        latitude: testLatitude,
        longitude: testLongitude,
      },
      locationName: 'Victoria Island, Lagos',
      createdBy: testUserId,
      status: 'pending_approval',
    };

    // Act
    const result = await createCase(input, '127.0.0.1', DeviceType.MOBILE, 'test-agent');

    // Assert
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.gpsLocation).toBeDefined();
    expect(result.gpsLocation.latitude).toBe(testLatitude);
    expect(result.gpsLocation.longitude).toBe(testLongitude);

    // Verify in database using PostGIS functions
    const [savedCase] = await db.execute(sql`
      SELECT 
        id,
        claim_reference,
        ST_X(gps_location) as latitude,
        ST_Y(gps_location) as longitude,
        ST_AsText(gps_location) as point_text
      FROM salvage_cases
      WHERE id = ${result.id}
    `);

    expect(savedCase).toBeDefined();
    expect(savedCase.latitude).toBeCloseTo(testLatitude, 6);
    expect(savedCase.longitude).toBeCloseTo(testLongitude, 6);
    expect(savedCase.point_text).toContain(`${testLatitude}`);
    expect(savedCase.point_text).toContain(`${testLongitude}`);
  });

  it('should save both voice notes and GPS coordinates together', async () => {
    // Arrange
    const voiceTranscription = 'Multiple damages observed. Rear bumper completely detached. Engine appears functional.';
    const testLatitude = 6.4281;
    const testLongitude = 3.4219;
    
    const input: CreateCaseInput = {
      claimReference: `TEST-BOTH-${Date.now()}`,
      assetType: 'vehicle',
      assetDetails: {
        make: 'Mercedes',
        model: 'C-Class',
        year: 2021,
        mileage: 45000,
        condition: 'good',
      },
      marketValue: 8000000,
      photos: [Buffer.from('fake-image-data-1'), Buffer.from('fake-image-data-2'), Buffer.from('fake-image-data-3')],
      gpsLocation: {
        latitude: testLatitude,
        longitude: testLongitude,
      },
      locationName: 'Lekki Phase 1, Lagos',
      voiceNotes: [voiceTranscription],
      createdBy: testUserId,
      status: 'pending_approval',
    };

    // Act
    const result = await createCase(input, '127.0.0.1', DeviceType.MOBILE, 'test-agent');

    // Assert - Voice Notes
    expect(result.voiceNotes).toBeDefined();
    expect(result.voiceNotes).toHaveLength(1);
    expect(result.voiceNotes![0]).toBe(voiceTranscription);

    // Assert - GPS Coordinates
    expect(result.gpsLocation).toBeDefined();
    expect(result.gpsLocation.latitude).toBe(testLatitude);
    expect(result.gpsLocation.longitude).toBe(testLongitude);

    // Verify both in database
    const [savedCase] = await db.execute(sql`
      SELECT 
        id,
        claim_reference,
        voice_notes,
        ST_X(gps_location) as latitude,
        ST_Y(gps_location) as longitude,
        location_name
      FROM salvage_cases
      WHERE id = ${result.id}
    `);

    expect(savedCase).toBeDefined();
    expect(Array.isArray(savedCase.voice_notes)).toBe(true);
    expect((savedCase.voice_notes as string[]).length).toBe(1);
    expect((savedCase.voice_notes as string[])[0]).toBe(voiceTranscription);
    expect(savedCase.latitude).toBeCloseTo(testLatitude, 6);
    expect(savedCase.longitude).toBeCloseTo(testLongitude, 6);
    expect(savedCase.location_name).toBe('Lekki Phase 1, Lagos');
  });

  it('should handle empty voice notes array', async () => {
    // Arrange
    const input: CreateCaseInput = {
      claimReference: `TEST-NO-VOICE-${Date.now()}`,
      assetType: 'vehicle',
      assetDetails: {
        make: 'Nissan',
        model: 'Altima',
        year: 2018,
      },
      marketValue: 3500000,
      photos: [Buffer.from('fake-image-data-1'), Buffer.from('fake-image-data-2'), Buffer.from('fake-image-data-3')],
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Ikeja, Lagos',
      voiceNotes: [], // Empty array
      createdBy: testUserId,
      status: 'pending_approval',
    };

    // Act
    const result = await createCase(input, '127.0.0.1', DeviceType.DESKTOP, 'test-agent');

    // Assert
    expect(result).toBeDefined();
    expect(result.voiceNotes).toBeDefined();
    expect(result.voiceNotes).toHaveLength(0);

    // Verify in database
    const [savedCase] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, result.id))
      .limit(1);

    expect(savedCase).toBeDefined();
    expect(savedCase.voiceNotes).toBeDefined();
    expect(savedCase.voiceNotes).toHaveLength(0);
  });

  it('should handle multiple voice note entries', async () => {
    // Arrange
    const voiceNotes = [
      'First observation: Front damage is severe.',
      'Second observation: Side mirrors are intact.',
      'Third observation: Interior is in good condition.',
    ];
    
    const input: CreateCaseInput = {
      claimReference: `TEST-MULTI-VOICE-${Date.now()}`,
      assetType: 'vehicle',
      assetDetails: {
        make: 'Ford',
        model: 'Explorer',
        year: 2020,
      },
      marketValue: 6000000,
      photos: [Buffer.from('fake-image-data-1'), Buffer.from('fake-image-data-2'), Buffer.from('fake-image-data-3')],
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Surulere, Lagos',
      voiceNotes,
      createdBy: testUserId,
      status: 'pending_approval',
    };

    // Act
    const result = await createCase(input, '127.0.0.1', DeviceType.MOBILE, 'test-agent');

    // Assert
    expect(result.voiceNotes).toBeDefined();
    expect(result.voiceNotes).toHaveLength(3);
    expect(result.voiceNotes).toEqual(voiceNotes);

    // Verify in database
    const [savedCase] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, result.id))
      .limit(1);

    expect(savedCase.voiceNotes).toHaveLength(3);
    expect(savedCase.voiceNotes).toEqual(voiceNotes);
  });
});
