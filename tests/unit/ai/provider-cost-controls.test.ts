import { afterEach, describe, expect, it } from 'vitest';
import {
  isClaudeDamageFallbackEnabled,
  isClaudeKycFallbackEnabled,
  isClaudePickupFallbackEnabled,
  isClaudePriceAdjudicationEnabled,
  isGeminiPriceAdjudicationEnabled,
  isPriceAdjudicationAiEnabled,
} from '@/lib/ai/provider-cost-controls';

const ENV_KEYS = [
  'CLAUDE_DAMAGE_FALLBACK_ENABLED',
  'CLAUDE_KYC_FALLBACK_ENABLED',
  'CLAUDE_PICKUP_FALLBACK_ENABLED',
  'CLAUDE_PRICE_ADJUDICATION_ENABLED',
  'GEMINI_PRICE_ADJUDICATION_ENABLED',
  'PRICE_ADJUDICATION_AI_ENABLED',
] as const;

describe('AI provider cost controls', () => {
  afterEach(() => {
    ENV_KEYS.forEach((key) => delete process.env[key]);
  });

  it('keeps every paid Claude workflow disabled by default', () => {
    expect(isClaudeDamageFallbackEnabled()).toBe(false);
    expect(isClaudePickupFallbackEnabled()).toBe(false);
    expect(isClaudeKycFallbackEnabled()).toBe(false);
    expect(isClaudePriceAdjudicationEnabled()).toBe(false);
  });

  it('requires both the adjudication master switch and provider switch', () => {
    process.env.CLAUDE_PRICE_ADJUDICATION_ENABLED = 'true';
    process.env.GEMINI_PRICE_ADJUDICATION_ENABLED = 'true';

    expect(isPriceAdjudicationAiEnabled()).toBe(false);
    expect(isClaudePriceAdjudicationEnabled()).toBe(false);
    expect(isGeminiPriceAdjudicationEnabled()).toBe(false);

    process.env.PRICE_ADJUDICATION_AI_ENABLED = 'true';

    expect(isPriceAdjudicationAiEnabled()).toBe(true);
    expect(isClaudePriceAdjudicationEnabled()).toBe(true);
    expect(isGeminiPriceAdjudicationEnabled()).toBe(true);
  });
});
