import { describe, expect, it } from 'vitest';

import {
  buildRuleBasedPickupComparison,
  derivePickupComparisonStatusFromScores,
} from '@/features/pickups/services/pickup-evidence-comparison.service';

describe('pickup evidence comparison thresholds', () => {
  it('does not escalate acceptable angle-tolerant matches into discrepancies', () => {
    const status = derivePickupComparisonStatusFromScores('matches_expected', {
      identity: 88,
      quantity: 86,
      condition: 84,
      overall: 86,
    });

    expect(status).toBe('matches_expected');
  });

  it('routes uncertain comparison to review instead of material discrepancy', () => {
    const status = derivePickupComparisonStatusFromScores('material_discrepancy', {
      identity: 80,
      quantity: 76,
      condition: 74,
      overall: 77,
    });

    expect(status).toBe('review_needed');
  });

  it('flags clear quantity loss as material discrepancy', () => {
    const status = derivePickupComparisonStatusFromScores('review_needed', {
      identity: 90,
      quantity: 45,
      condition: 78,
      overall: 70,
    });

    expect(status).toBe('material_discrepancy');
  });

  it('adds score bands to rule-based fallback comparisons', () => {
    const comparison = buildRuleBasedPickupComparison({
      originalPhotoCount: 5,
      pickupPhotoCount: 2,
      hasAiAssessment: true,
    });

    expect(comparison.status).toBe('review_needed');
    expect(comparison.overallMatchScore).toBeLessThan(70);
    expect(comparison.reviewBand).toBe('major_review');
  });
});
