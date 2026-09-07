import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/features/valuations/services/valuation-policy.service', () => ({ getValuationPolicyConfig: async () => ({ repairCostMultipliers: { laborPercent: 20, paintAndMaterialsPercent: 10, logisticsPercent: 5 } }) }));
import { DamageCalculationService } from '@/features/valuations/services/damage-calculation.service';
import { ValuationUnavailableError } from '@/features/valuations/services/valuation-unavailable';
import { formatConditionForDisplay } from '@/features/valuations/services/condition-mapping.service';

describe('component cost valuation across assets', () => {
  it.each(['bumper', 'screen', 'pump', 'roof', 'furniture panel', 'hull', 'general asset casing'])('does not turn severe %s damage into whole-asset loss', async component => {
    const result = await new DamageCalculationService().calculateSalvageValueWithPartPrices(32_000_000,
      [{ component, damageLevel: 'severe', recommendedAction: 'replace' }],
      [{ component: component.toUpperCase(), partPrice: 1_000_000, source: 'internet_search', confidence: 90 }]);
    expect(result.totalDeductionAmount).toBe(1_350_000);
    expect(result.salvageValue).toBe(30_650_000);
    expect(result.isTotalLoss).toBe(false);
  });
  it('requires review for missing evidence, including deferred components', async () => {
    const service = new DamageCalculationService();
    vi.spyOn(service, 'getDeduction').mockRejectedValue(new ValuationUnavailableError());
    for (const prices of [undefined, [{ component: 'bumper', source: 'not_found' as const, evidence: { reason: 'part_search_budget_cap' } }]]) {
      await expect(service.calculateSalvageValueWithPartPrices(32_000_000, [{ component: 'bumper', damageLevel: 'severe' }], prices)).rejects.toBeInstanceOf(ValuationUnavailableError);
    }
  });
  it('uses database repair costs without severe minimums', async () => {
    const service = new DamageCalculationService();
    vi.spyOn(service, 'getDeduction').mockResolvedValue({ component: 'bumper', damageLevel: 'severe', repairCostLow: 900_000, repairCostHigh: 1_100_000, valuationDeductionLow: .35, valuationDeductionHigh: .45 });
    const result = await service.calculateSalvageValue(32_000_000, [{ component: 'bumper', damageLevel: 'severe' }]);
    expect(result.totalDeductionAmount).toBe(1_000_000);
  });
  it('ignores unrelated and duplicate prices and preserves complete service costs', async () => {
    const result = await new DamageCalculationService().calculateSalvageValueWithPartPrices(1_000_000,
      [{ component: 'screen', damageLevel: 'minor' }, { component: ' SCREEN ', damageLevel: 'severe', recommendedAction: 'repair' }],
      [{ component: 'screen', partPrice: 100_000, source: 'internet_search' }, { component: 'screen', partPrice: 100_000, source: 'internet_search' }, { component: 'other', partPrice: 900_000, source: 'internet_search' }]);
    expect(result.totalDeductionAmount).toBe(100_000);
    expect(result.deductions).toHaveLength(1);
  });
  it('keeps economic total-loss classification and caps', async () => {
    const result = await new DamageCalculationService().calculateSalvageValueWithPartPrices(1_000_000, [{ component: 'structure', damageLevel: 'severe' }], [{ component: 'structure', partPrice: 2_000_000, source: 'internet_search' }]);
    expect(result.isTotalLoss).toBe(true);
    expect(result.salvageValue).toBe(100_000);
  });
  it('has finite confidence without damage and rejects invalid market values', async () => {
    const service = new DamageCalculationService();
    expect((await service.calculateSalvageValue(1_000_000, [])).confidence).toBe(0);
    await expect(service.calculateSalvageValue(0, [])).rejects.toBeInstanceOf(ValuationUnavailableError);
  });
  it.each(['excellent', 'good', 'fair', 'poor'] as const)('does not infer usage history from %s', quality => {
    expect(formatConditionForDisplay(quality).marketTerm).toBeUndefined();
    expect(formatConditionForDisplay(quality).label.toLowerCase()).toBe(quality);
  });
});
