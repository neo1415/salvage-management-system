import { describe, expect, it } from 'vitest';

import {
  buildUniversalProviderContext,
  enrichItemInfoWithAiIdentification,
  estimateKnownBulkUnitMarketValue,
  type UniversalItemInfo,
} from '@/features/cases/services/ai-assessment-enhanced.service';
import { QueryBuilderService } from '@/features/internet-search/services/query-builder.service';
import { validateSummary as validateGeminiSummary } from '@/lib/integrations/gemini-damage-detection';

describe('universal asset assessment context and pricing', () => {
  const queryBuilder = new QueryBuilderService();

  it('builds cement searches from bag quantity instead of generic goods-in-transit text', () => {
    const query = queryBuilder.buildMarketQuery({
      type: 'goods_in_transit',
      brand: 'Dangote',
      description: 'cement',
      quantity: '10',
      unitOfMeasure: 'bags',
    });

    expect(query).toContain('Dangote cement 10 bags');
    expect(query).toContain('50kg bag cement');
    expect(query).toContain('price Nigeria');
    expect(query).not.toContain('goods_in_transit');
  });

  it('estimates known Dangote cement bags conservatively when search evidence is unavailable', () => {
    const value = estimateKnownBulkUnitMarketValue({
      type: 'goods_in_transit',
      condition: 'Nigerian Used',
      brand: 'Dangote',
      description: '10 bags of cement',
      quantity: '10',
      unitOfMeasure: 'bags',
    });

    expect(value).toBe(110000);
  });

  it('uses AI-identified commodity text before quantity-only agriculture context', () => {
    const itemInfo: UniversalItemInfo = {
      type: 'agriculture',
      condition: 'Brand New',
      description: 'maize',
      quantity: '120',
    };

    const enriched = enrichItemInfoWithAiIdentification(itemInfo, {
      itemDetails: {
        detectedMake: 'Agriculture - Maize/Corn',
        detectedModel: 'Dried maize cobs stored on pallets',
        notes: 'Large bulk quantity of maize cobs in flooded warehouse',
      },
    });
    const context = buildUniversalProviderContext(enriched);

    expect(context.make).toContain('Agriculture');
    expect(context.model).toContain('maize');
    expect(context.model).not.toBe('120');
  });

  it('builds scrap searches around scrap value and weight units, not stock packaging', () => {
    const query = queryBuilder.buildMarketQuery({
      type: 'scrap',
      description: 'mixed ferrous scrap metal steel pipes angle iron',
      quantity: '750',
      unitOfMeasure: 'kg',
      packagingType: 'soot contamination',
    });

    expect(query).toContain('scrap metal price per kg tonne Nigeria');
    expect(query).toContain('mixed ferrous scrap metal');
  });

  it('builds furniture context from type, material, and size even without brand', () => {
    const context = buildUniversalProviderContext({
      type: 'furniture',
      condition: 'Brand New',
      description: 'Sofa table shelf leather wood 3 seater 1 seater',
      material: 'leather, wood',
      model: 'Sofa, table, shelf',
    });

    expect(context.make).toBe('leather, wood');
    expect(context.model).toContain('Sofa table shelf');
    expect(context.itemType).toBe('furniture');
  });

  it('keeps long luxury-item summaries instead of truncating at the old 500-character limit', () => {
    const longSummary = 'Two luxury items recovered from a fire scene. '.repeat(18);
    const result = validateGeminiSummary(longSummary, 'test-request');

    expect(result.length).toBeGreaterThan(500);
    expect(result).toBe(longSummary);
  });
});
