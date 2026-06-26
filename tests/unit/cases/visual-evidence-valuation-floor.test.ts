import { describe, expect, it } from 'vitest';
import { computeVisualEvidenceDeductionFloor } from '@/features/cases/services/ai-assessment-enhanced.service';

describe('visual evidence valuation floor', () => {
  it('prevents severe multi-zone vehicle damage from being priced like a minor repair list', () => {
    const floor = computeVisualEvidenceDeductionFloor({
      itemType: 'vehicle',
      damagePercentage: 50,
      aiTotalLoss: false,
      damagedParts: [
        { part: 'front bumper and radiator support', severity: 'severe', confidence: 94 },
        { part: 'hood and front body panels', severity: 'severe', confidence: 92 },
        { part: 'rear quarter panel', severity: 'severe', confidence: 90 },
        { part: 'trunk and rear bumper', severity: 'severe', confidence: 89 },
        { part: 'suspension and wheel assembly', severity: 'severe', confidence: 88 },
      ],
    });

    expect(floor).toBeGreaterThanOrEqual(0.7);
    expect(floor).toBeLessThanOrEqual(0.9);
  });

  it('does not override bulk stock recovery logic', () => {
    const floor = computeVisualEvidenceDeductionFloor({
      itemType: 'goods_in_transit',
      damagePercentage: 90,
      aiTotalLoss: true,
      damagedParts: [
        { part: 'water contaminated bags', severity: 'severe', confidence: 96 },
      ],
    });

    expect(floor).toBe(0);
  });

  it('uses a lower evidence floor for jewelry because material value may remain', () => {
    const floor = computeVisualEvidenceDeductionFloor({
      itemType: 'jewelry',
      damagePercentage: 70,
      aiTotalLoss: false,
      damagedParts: [
        { part: 'gold bracelet soot contamination', severity: 'severe', confidence: 92 },
        { part: 'watch crystal and bracelet damage', severity: 'severe', confidence: 90 },
      ],
    });

    expect(floor).toBeGreaterThan(0.35);
    expect(floor).toBeLessThan(0.7);
  });
});
