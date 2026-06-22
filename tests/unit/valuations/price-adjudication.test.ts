import { beforeEach, describe, expect, it } from 'vitest';
import {
  PriceAdjudicationService,
} from '@/features/valuations/services/price-adjudication.service';
import { getDefaultValuationPolicyConfig } from '@/features/valuations/services/valuation-policy.service';
import type { ExtractedPrice, PriceExtractionResult } from '@/features/internet-search/services/price-extraction.service';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';

function price(overrides: Partial<ExtractedPrice>): ExtractedPrice {
  return {
    price: 1_000_000,
    currency: 'NGN',
    originalText: 'NGN1,000,000',
    confidence: 80,
    sourceQuality: 'medium',
    source: 'example.com',
    url: 'https://example.com/listing',
    title: 'Listing',
    snippet: 'Price NGN1,000,000',
    ...overrides,
  };
}

function priceData(prices: ExtractedPrice[]): PriceExtractionResult {
  return {
    prices,
    confidence: 80,
    currency: 'NGN',
    extractedAt: new Date(),
  };
}

describe('PriceAdjudicationService', () => {
  const service = new PriceAdjudicationService();
  const policy = getDefaultValuationPolicyConfig();

  beforeEach(() => {
    process.env.PRICE_ADJUDICATION_AI_ENABLED = 'false';
  });

  it('rejects cheap low-trust marketplace evidence for Rolex and Cartier jewelry', async () => {
    const item: ItemIdentifier = {
      type: 'jewelry',
      jewelryType: 'Watch, Bracelet',
      brand: 'Rolex, Cartier',
      material: 'Gold',
      condition: 'Brand New',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({ price: 52_005, source: 'www.jumia.com.ng', url: 'https://www.jumia.com.ng/item', title: 'Rolex Cartier watch bracelet' }),
        price({ price: 15_000_000, source: 'pololuxury.com', url: 'https://pololuxury.com/item', title: 'Rolex Submariner Cartier Love Bracelet' }),
      ]),
    });

    expect(result.selectedPrice).toBe(15_000_000);
    expect(result.rejectedPrices.some((entry) => entry.source.includes('jumia'))).toBe(true);
    expect(result.manualReviewRequired).toBe(true);
  });

  it('keeps low specialist prices from high-quality sources but requires review', async () => {
    const item: ItemIdentifier = {
      type: 'jewelry',
      jewelryType: 'Watch',
      brand: 'Rolex',
      material: 'Gold',
      condition: 'Heavily Used',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({
          price: 750_000,
          source: 'authorized-appraiser.example',
          sourceQuality: 'high',
          confidence: 92,
          title: 'Damaged Rolex appraised salvage value',
        }),
      ]),
    });

    expect(result.selectedPrice).toBe(750_000);
    expect(result.priceData.prices).toHaveLength(1);
    expect(result.manualReviewRequired).toBe(true);
  });

  it('rejects replica and accessory-only listings even when the numeric price is plausible', async () => {
    const item: ItemIdentifier = {
      type: 'electronics',
      brand: 'Apple',
      model: 'iPhone 15 Pro',
      condition: 'Foreign Used (Tokunbo)',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({ price: 950_000, title: 'iPhone 15 Pro replica', snippet: 'copy phone' }),
        price({ price: 1_100_000, source: 'store.example.com', title: 'Apple iPhone 15 Pro 256GB' }),
      ]),
    });

    expect(result.priceData.prices).toHaveLength(1);
    expect(result.priceData.prices[0].price).toBe(1_100_000);
    expect(result.rejectedPrices[0].rejectionReason).toContain('counterfeit');
  });

  it('requires review when accepted market evidence is not source-diverse', async () => {
    const item: ItemIdentifier = {
      type: 'furniture',
      furnitureType: '3-seater sofa',
      material: 'leather',
      condition: 'Nigerian Used',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({ price: 250_000, source: 'same-source.ng', url: 'https://same-source.ng/a' }),
        price({ price: 270_000, source: 'same-source.ng', url: 'https://same-source.ng/b' }),
      ]),
    });

    expect(result.manualReviewRequired).toBe(true);
    expect(result.reviewReasons.join(' ')).toContain('source-diverse');
  });

  it('requires review for excessive price spread', async () => {
    const item: ItemIdentifier = {
      type: 'machinery',
      brand: 'CAT',
      machineryType: 'Generator',
      model: '100kVA',
      condition: 'Foreign Used (Tokunbo)',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({ price: 1_000_000, source: 'source-a.ng' }),
        price({ price: 4_500_000, source: 'source-b.ng' }),
        price({ price: 8_000_000, source: 'source-c.ng' }),
      ]),
    });

    expect(result.manualReviewRequired).toBe(true);
    expect(result.reviewReasons.join(' ')).toContain('Accepted prices vary');
  });

  it('keeps part prices above configured attention thresholds but requires review', async () => {
    const item: ItemIdentifier = {
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry',
      year: 2018,
    };

    const result = await service.adjudicate({
      item,
      mode: 'part',
      partName: 'headlight',
      policy,
      priceData: priceData([
        price({ price: 80_000_000, source: 'parts.example.com', title: 'Toyota Camry headlight' }),
        price({ price: 450_000, source: 'parts2.example.com', title: 'Toyota Camry headlight replacement' }),
      ]),
    });

    expect(result.priceData.prices).toHaveLength(2);
    expect(result.manualReviewRequired).toBe(true);
    expect(result.reviewReasons.join(' ')).toContain('part attention threshold');
  });

  it('returns no selected price when every candidate fails relevance checks', async () => {
    const item: ItemIdentifier = {
      type: 'jewelry',
      jewelryType: 'Rolex Submariner',
      brand: 'Rolex',
      material: 'steel',
      condition: 'Heavily Used',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({ price: 65_000, source: 'jiji.ng', title: 'Rolex inspired watch replica' }),
      ]),
    });

    expect(result.selectedPrice).toBeUndefined();
    expect(result.manualReviewRequired).toBe(true);
    expect(result.reviewReasons.join(' ')).toContain('No accepted market evidence');
  });
});
