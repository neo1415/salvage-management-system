import { describe, expect, it } from 'vitest';
import { shouldApplyTotalLossCap } from '@/features/cases/services/ai-assessment-enhanced.service';

describe('non-vehicle total-loss cap decisions', () => {
  it('does not let an AI-only electronics total-loss flag flatten a priced repair estimate', () => {
    const decision = shouldApplyTotalLossCap({
      itemType: 'electronics',
      aiTotalLoss: true,
      damageCalculationTotalLoss: false,
      totalDeductionPercent: 0.55,
      partPricesFound: 2,
      damagePercentage: 72,
    });

    expect(decision.applyCap).toBe(false);
    expect(decision.aiOnlyNonVehicleReview).toBe(true);
    expect(decision.reason).toBe('none');
  });

  it('applies the cap when non-vehicle repair math crosses the total-loss threshold', () => {
    const decision = shouldApplyTotalLossCap({
      itemType: 'machinery',
      aiTotalLoss: false,
      damageCalculationTotalLoss: false,
      totalDeductionPercent: 0.74,
      partPricesFound: 3,
      damagePercentage: 76,
    });

    expect(decision.applyCap).toBe(true);
    expect(decision.aiOnlyNonVehicleReview).toBe(false);
    expect(decision.reason).toBe('damage_calculation');
  });

  it('preserves AI total-loss override for vehicles', () => {
    const decision = shouldApplyTotalLossCap({
      itemType: 'vehicle',
      aiTotalLoss: true,
      damageCalculationTotalLoss: false,
      totalDeductionPercent: 0.45,
      partPricesFound: 1,
      damagePercentage: 65,
    });

    expect(decision.applyCap).toBe(true);
    expect(decision.reason).toBe('ai_vehicle');
  });

  it('allows a non-vehicle cap for extreme high-damage cases with no part evidence', () => {
    const decision = shouldApplyTotalLossCap({
      itemType: 'electronics',
      aiTotalLoss: true,
      damageCalculationTotalLoss: false,
      totalDeductionPercent: 0.62,
      partPricesFound: 0,
      damagePercentage: 88,
    });

    expect(decision.applyCap).toBe(true);
    expect(decision.reason).toBe('ai_unpriced_high_damage');
  });
});
