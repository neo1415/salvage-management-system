import { describe, expect, it } from 'vitest';
import { formatExportIpAddress } from '@/lib/export/export-ip';
import { mapCaseToExportRow } from '@/lib/export/case-export';

describe('formatExportIpAddress', () => {
  it('returns full IP for system_admin', () => {
    expect(formatExportIpAddress('192.168.1.10', 'system_admin')).toBe('192.168.1.10');
  });

  it('redacts IP for non-admin roles', () => {
    expect(formatExportIpAddress('192.168.1.10', 'finance_officer')).toBe('redacted');
  });

  it('returns unknown for admin when IP missing', () => {
    expect(formatExportIpAddress(null, 'system_admin')).toBe('unknown');
  });
});

describe('mapCaseToExportRow', () => {
  it('formats currency and flattens asset details', () => {
    const row = mapCaseToExportRow({
      id: 'case-1',
      claimReference: 'CLM-001',
      policyNumber: 'POL-123',
      insuranceClass: 'motor',
      brokerName: 'Broker A',
      agencyName: null,
      branchName: 'Lagos',
      assetType: 'vehicle',
      assetDetails: { make: 'Toyota', model: 'Camry', year: 2018 },
      marketValue: '1500000',
      estimatedSalvageValue: '500000',
      reservePrice: '400000',
      damageSeverity: 'moderate',
      gpsLocation: { x: 3.3792, y: 6.5244 },
      locationName: 'Lagos Yard',
      locationAccuracyMeters: '12',
      locationSource: 'gps',
      locationCapturedAt: new Date('2026-01-01T10:00:00Z'),
      locationManualOverride: false,
      photos: ['https://example.com/1.jpg'],
      voiceNotes: [],
      status: 'approved',
      createdBy: 'user-1',
      approvedBy: 'user-2',
      createdAt: new Date('2026-01-01T09:00:00Z'),
      updatedAt: new Date('2026-01-02T09:00:00Z'),
      approvedAt: new Date('2026-01-02T08:00:00Z'),
      vehicleMileage: 120000,
      vehicleCondition: 'fair',
      aiAssessment: {
        confidenceScore: 0.91,
        damagePercentage: 35,
        recommendation: 'repair',
        analysisMethod: 'gemini',
        manualReviewRequired: false,
      },
      aiEstimates: {
        marketValue: 1500000,
        repairCost: 400000,
        salvageValue: 500000,
        reservePrice: 400000,
        confidence: 0.88,
      },
      managerOverrides: null,
      createdByName: 'Adjuster One',
      approvedByName: 'Manager One',
    });

    expect(row.marketValue).toMatch(/^NGN /);
    expect(row.assetMake).toBe('Toyota');
    expect(row.assetModel).toBe('Camry');
    expect(row.branchName).toBe('Lagos');
    expect(row.createdByName).toBe('Adjuster One');
    expect(row.photoCount).toBe('1');
  });
});
