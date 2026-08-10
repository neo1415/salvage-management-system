import { describe, expect, it } from 'vitest';
import { sanitizeAuctionCaseForViewer } from '@/features/auctions/services/public-auction-case';

describe('sanitizeAuctionCaseForViewer', () => {
  const caseRecord = {
    id: 'case-1',
    assetType: 'vehicle',
    assetDetails: { make: 'Toyota', model: 'Camry' },
    damageSeverity: 'severe',
    photos: ['photo-1.jpg'],
    marketValue: '25000000',
    estimatedSalvageValue: '5000000',
    reservePrice: '3500000',
    aiAssessment: {
      itemDetails: { detectedMake: 'Toyota', detectedModel: 'Camry' },
      damagedParts: [
        {
          part: 'front windscreen',
          damageType: 'shattered',
          severity: 'severe',
          confidence: 98,
          recommendedAction: 'replace',
        },
      ],
      recommendation: 'Severe collision damage is visible across the front of the vehicle.',
      confidenceScore: 91,
      damagePercentage: 74,
      estimatedRepairCost: 9_000_000,
      valuationEvidence: { marketValue: 25_000_000 },
    },
    aiEstimates: { marketValue: 25000000 },
    managerOverrides: { marketValue: 24000000 },
    claimReference: 'CLM-001',
    policyNumber: 'POL-001',
  };

  it('retains public damage evidence while removing valuation, claim, and policy data', () => {
    const result = sanitizeAuctionCaseForViewer(caseRecord, false);

    expect(result).toEqual({
      id: 'case-1',
      assetType: 'vehicle',
      assetDetails: { make: 'Toyota', model: 'Camry' },
      damageSeverity: 'severe',
      photos: ['photo-1.jpg'],
      aiAssessment: {
        itemDetails: { detectedMake: 'Toyota', detectedModel: 'Camry' },
        damagedParts: [
          {
            part: 'front windscreen',
            damageType: 'shattered',
            severity: 'severe',
            confidence: 98,
            recommendedAction: 'replace',
          },
        ],
        recommendation: 'Severe collision damage is visible across the front of the vehicle.',
        confidenceScore: 91,
        damagePercentage: 74,
      },
    });

    expect(JSON.stringify(result)).not.toContain('estimatedRepairCost');
    expect(JSON.stringify(result)).not.toContain('valuationEvidence');
    expect(JSON.stringify(result)).not.toContain('25000000');
  });

  it('retains the complete case for authorized staff', () => {
    expect(sanitizeAuctionCaseForViewer(caseRecord, true)).toBe(caseRecord);
  });

  it('handles a missing case without throwing', () => {
    expect(sanitizeAuctionCaseForViewer(null, false)).toBeNull();
  });
});
