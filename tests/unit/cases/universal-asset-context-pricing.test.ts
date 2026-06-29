import { describe, expect, it } from 'vitest';

import {
  buildUniversalSearchIdentifier,
  buildUniversalProviderContext,
  calculateNonVehicleDamagePercentage,
  enrichItemInfoWithAiIdentification,
  estimateKnownBulkUnitMarketValue,
  hasExplicitNoCommercialRecovery,
  scaleBulkInternetSearchPrice,
  type UniversalItemInfo,
} from '@/features/cases/services/ai-assessment-enhanced.service';
import { QueryBuilderService } from '@/features/internet-search/services/query-builder.service';
import { validateSummary as validateGeminiSummary } from '@/lib/integrations/gemini-damage-detection';

describe('universal asset assessment context and pricing', () => {
  const queryBuilder = new QueryBuilderService();

  it('builds cement searches from product identity, not quantity or damage notes', () => {
    const query = queryBuilder.buildMarketQuery({
      type: 'building_materials',
      brand: 'Lafarge',
      model: '25kg bagged cement',
      description: 'Lafarge Lafarge 25kg bagged cement fire damaged warehouse',
      quantity: '20',
      unitOfMeasure: 'bags',
    });

    expect(query).toContain('Lafarge 25kg bagged cement');
    expect(query).toContain('bag cement retail wholesale');
    expect(query).toContain('price Nigeria');
    expect(query).not.toContain('fire');
    expect(query).not.toContain('20 bags');
    expect(query).not.toMatch(/Lafarge.*Lafarge/i);
  });

  it('scales internet search unit prices by visible bulk quantity', () => {
    const scaled = scaleBulkInternetSearchPrice({
      type: 'building_materials',
      condition: 'Nigerian Used',
      brand: 'Lafarge',
      model: '25kg bagged cement',
      quantity: '10',
      unitOfMeasure: 'bags',
    }, 11900);

    expect(scaled.unitPrice).toBe(11900);
    expect(scaled.quantity).toBe(10);
    expect(scaled.totalValue).toBe(119000);
  });

  it('extracts bag quantity from notes only, not 25kg pack size in model', () => {
    const enriched = enrichItemInfoWithAiIdentification({
      type: 'building_materials',
      condition: 'Poor',
      make: 'Larfarge cement',
    }, {
      itemDetails: {
        detectedMake: 'Lafarge',
        detectedModel: '25kg bagged cement',
        notes: 'Approximately 20–25 bags visible across photos. All bags show fire damage.',
      },
    });

    expect(enriched?.quantity).toBe('20');
    expect(enriched?.description).toBe('Lafarge 25kg bagged cement');
    expect(enriched?.description).not.toMatch(/Lafarge.*Lafarge/i);
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

  it('builds a market search identifier for unbranded agricultural produce', () => {
    const identifier = buildUniversalSearchIdentifier({
      type: 'agriculture',
      condition: 'Nigerian Used',
      description: 'yellow maize cobs',
      quantity: '120',
      unitOfMeasure: 'bags',
    });

    expect(identifier).toMatchObject({
      type: 'agriculture',
      model: 'yellow maize cobs',
      quantity: '120',
      unitOfMeasure: 'bags',
    });
  });

  it('does not use vehicle-only Tokunbo language for furniture searches', () => {
    const query = queryBuilder.buildMarketQuery({
      type: 'furniture',
      furnitureType: 'leather sofa set',
      condition: 'Foreign Used (Tokunbo)',
    });

    expect(query).toContain('used good condition');
    expect(query).not.toContain('tokunbo');
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

  it('preserves declared furniture-set specifications in market search context', () => {
    const enriched = enrichItemInfoWithAiIdentification({
      type: 'furniture',
      condition: 'Brand New',
      description: 'Sofa, Table Leather, wood 3 seater, 1 seater',
      model: 'Sofa, Table',
      material: 'Leather, wood',
      size: '3 seater, 1 seater',
    }, {
      itemDetails: {
        detectedModel: 'Sofa, armchair, coffee table, and side cabinet',
      },
    });

    const identifier = buildUniversalSearchIdentifier(enriched!);
    expect(identifier?.type).toBe('furniture');
    if (identifier?.type !== 'furniture') throw new Error('Expected furniture identifier');
    expect(identifier.furnitureType).toContain('Sofa, Table');
    expect(identifier.furnitureType).toContain('side cabinet');
    expect(identifier.size).toBe('3 seater, 1 seater');
    expect(queryBuilder.buildMarketQuery(identifier)).toContain('complete set');
  });

  it('uses damaged-component evidence for non-vehicle damage percentage', () => {
    const percentage = calculateNonVehicleDamagePercentage([
      { severity: 'severe', confidence: 95 },
      { severity: 'severe', confidence: 90 },
      { severity: 'severe', confidence: 95 },
    ], { structural: 0, mechanical: 0, cosmetic: 90, electrical: 0, interior: 0 });

    expect(percentage).toBeGreaterThan(80);
  });

  it('recognizes explicit total commercial loss without inventing a 10% remainder', () => {
    expect(hasExplicitNoCommercialRecovery({
      itemType: 'furniture',
      aiTotalLoss: false,
      summary: 'All components are unusable and beyond repair with no resale value.',
      damagedParts: Array.from({ length: 7 }, () => ({ severity: 'severe' as const })),
    })).toBe(true);
  });

  it('keeps long luxury-item summaries instead of truncating at the old 500-character limit', () => {
    const longSummary = 'Two luxury items recovered from a fire scene. '.repeat(18);
    const result = validateGeminiSummary(longSummary, 'test-request');

    expect(result.length).toBeGreaterThan(500);
    expect(result).toBe(longSummary);
  });
});
