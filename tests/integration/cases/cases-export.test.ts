/**
 * Integration tests for Cases Export API
 * 
 * Tests CSV and PDF export functionality with filters
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.7
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

describe('Cases Export API', () => {
  let testUserId: string;
  let testCaseIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const [testUser] = await db
      .insert(users)
      .values({
        email: 'test-export-adjuster@test.com',
        fullName: 'Test Export Adjuster',
        role: 'adjuster',
        password: 'hashed_password',
      })
      .returning();
    testUserId = testUser.id;

    // Create test cases
    const testCasesData = [
      {
        claimReference: 'TEST-EXPORT-001',
        assetType: 'vehicle' as const,
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        marketValue: 5000000,
        reservePrice: 4000000,
        locationName: 'Lagos',
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        photos: ['photo1.jpg'],
        status: 'approved' as const,
        createdBy: testUserId,
      },
      {
        claimReference: 'TEST-EXPORT-002',
        assetType: 'electronics' as const,
        assetDetails: { brand: 'Samsung', model: 'Galaxy S21' },
        marketValue: 300000,
        reservePrice: 250000,
        locationName: 'Abuja',
        gpsLocation: { latitude: 9.0765, longitude: 7.3986 },
        photos: ['photo2.jpg'],
        status: 'pending_approval' as const,
        createdBy: testUserId,
      },
      {
        claimReference: 'TEST-EXPORT-003',
        assetType: 'property' as const,
        assetDetails: { propertyType: 'Land', size: '500 sqm' },
        marketValue: 10000000,
        reservePrice: 8000000,
        locationName: 'Port Harcourt',
        gpsLocation: { latitude: 4.8156, longitude: 7.0498 },
        photos: ['photo3.jpg'],
        status: 'draft' as const,
        createdBy: testUserId,
      },
    ];

    const insertedCases = await db
      .insert(salvageCases)
      .values(testCasesData)
      .returning();
    testCaseIds = insertedCases.map(c => c.id);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testCaseIds.length > 0) {
      await db.delete(salvageCases).where(eq(salvageCases.createdBy, testUserId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  describe('CSV Export', () => {
    it('should export all cases to CSV', async () => {
      const response = await fetch('/api/cases/export?format=csv&createdByMe=true', {
        headers: {
          // Mock authentication would be needed here
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('.csv');
    });

    it('should include correct columns in CSV', async () => {
      const response = await fetch('/api/cases/export?format=csv&createdByMe=true');
      const csv = await response.text();

      // Check headers
      expect(csv).toContain('Claim Reference');
      expect(csv).toContain('Asset Type');
      expect(csv).toContain('Status');
      expect(csv).toContain('Created Date');
      expect(csv).toContain('Adjuster Name');
      expect(csv).toContain('Market Value');
      expect(csv).toContain('Reserve Price');
      expect(csv).toContain('Location');
    });

    it('should respect status filter', async () => {
      const response = await fetch('/api/cases/export?format=csv&status=approved&createdByMe=true');
      const csv = await response.text();

      expect(csv).toContain('TEST-EXPORT-001');
      expect(csv).not.toContain('TEST-EXPORT-002');
      expect(csv).not.toContain('TEST-EXPORT-003');
    });

    it('should respect search filter', async () => {
      const response = await fetch('/api/cases/export?format=csv&search=toyota&createdByMe=true');
      const csv = await response.text();

      expect(csv).toContain('TEST-EXPORT-001');
      expect(csv).not.toContain('TEST-EXPORT-002');
    });

    it('should format currency values with Naira symbol', async () => {
      const response = await fetch('/api/cases/export?format=csv&createdByMe=true');
      const csv = await response.text();

      expect(csv).toContain('₦5,000,000');
      expect(csv).toContain('₦4,000,000');
    });

    it('should generate filename with status and date', async () => {
      const response = await fetch('/api/cases/export?format=csv&status=approved&createdByMe=true');
      const contentDisposition = response.headers.get('Content-Disposition');

      expect(contentDisposition).toMatch(/cases-approved-\d{4}-\d{2}-\d{2}\.csv/);
    });
  });

  describe('PDF Export', () => {
    it('should export cases to PDF', async () => {
      const response = await fetch('/api/cases/export?format=pdf&createdByMe=true');

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('.pdf');
    });

    it('should generate filename with status and date', async () => {
      const response = await fetch('/api/cases/export?format=pdf&status=pending_approval&createdByMe=true');
      const contentDisposition = response.headers.get('Content-Disposition');

      expect(contentDisposition).toMatch(/cases-pending_approval-\d{4}-\d{2}-\d{2}\.pdf/);
    });
  });

  describe('Error Handling', () => {
    it('should return error for invalid format', async () => {
      const response = await fetch('/api/cases/export?format=invalid&createdByMe=true');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid format');
    });

    it('should return error when no data to export', async () => {
      const response = await fetch('/api/cases/export?format=csv&status=sold&createdByMe=true');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('No data to export');
    });

    it('should require authentication', async () => {
      const response = await fetch('/api/cases/export?format=csv', {
        headers: {
          // No authentication headers
        },
      });

      expect(response.status).toBe(401);
    });
  });
});
