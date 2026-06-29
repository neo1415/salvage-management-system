import { describe, expect, it } from 'vitest';
import { DamageCalculationService } from '@/features/valuations/services/damage-calculation.service';
import type { DamageInput } from '@/features/valuations/types';

describe('damage calculation with bounded part-price searches', () => {
  const service = new DamageCalculationService();

  it('does not charge whole-asset deductions for parts deferred by the search budget', async () => {
    const basePrice = 23_000_000;
    const damages: DamageInput[] = Array.from({ length: 25 }, (_, index) => ({
      component: `part-${index + 1}`,
      damageLevel: 'severe',
    }));
    const partPrices = damages.map((damage, index) => index < 7
      ? {
          component: damage.component,
          partPrice: 250_000,
          confidence: 90,
          source: 'internet_search' as const,
        }
      : {
          component: damage.component,
          source: 'not_found' as const,
          evidence: { reason: 'part_search_budget_cap' },
        });

    const result = await service.calculateSalvageValueWithPartPrices(
      basePrice,
      damages,
      partPrices,
      'Toyota'
    );

    expect(result.totalDeductionPercent).toBeLessThan(0.9);
    expect(result.salvageValue).toBeGreaterThan(basePrice * 0.1);
  });

  it('does not add labour a second time to a complete repair estimate', async () => {
    const damages: DamageInput[] = [{
      component: 'left front door',
      damageLevel: 'moderate',
      recommendedAction: 'repair',
    }];

    const result = await service.calculateSalvageValueWithPartPrices(
      10_000_000,
      damages,
      [{
        component: 'left front door',
        partPrice: 200_000,
        action: 'repair',
        confidence: 90,
        source: 'internet_search',
      }]
    );

    expect(result.totalDeductionAmount).toBe(200_000);
  });

  it('adds configured installation and logistics load to a replacement part price', async () => {
    const damages: DamageInput[] = [{
      component: 'left front door',
      damageLevel: 'severe',
      recommendedAction: 'replace',
    }];

    const result = await service.calculateSalvageValueWithPartPrices(
      10_000_000,
      damages,
      [{
        component: 'left front door',
        partPrice: 200_000,
        action: 'replace',
        confidence: 90,
        source: 'internet_search',
      }]
    );

    expect(result.totalDeductionAmount).toBeGreaterThan(200_000);
  });
});
