import { describe, expect, it } from 'vitest';
import { buildUniversalItemInfoFromCase } from '@/features/cases/services/case-item-info';

describe('buildUniversalItemInfoFromCase', () => {
  it('preserves saved vehicle quality tiers as the same market-search condition used by adjuster AI', () => {
    const itemInfo = buildUniversalItemInfoFromCase({
      assetType: 'vehicle',
      marketValue: 25000000,
      assetDetails: {
        make: 'Toyota',
        model: 'Camry',
        year: 2018,
        mileage: 200000,
        condition: 'good',
      },
    });

    expect(itemInfo).toMatchObject({
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry',
      year: 2018,
      mileage: 200000,
      condition: 'Foreign Used (Tokunbo)',
      marketValue: 25000000,
    });
  });

  it('keeps already-normalized universal conditions unchanged', () => {
    const itemInfo = buildUniversalItemInfoFromCase({
      assetType: 'vehicle',
      assetDetails: {
        make: 'Toyota',
        model: 'Camry',
        year: 2018,
        condition: 'Nigerian Used',
      },
    });

    expect(itemInfo?.condition).toBe('Nigerian Used');
  });
});
