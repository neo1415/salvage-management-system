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
});
