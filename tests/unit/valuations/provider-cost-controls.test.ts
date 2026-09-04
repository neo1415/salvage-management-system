import { afterEach, describe, expect, it, vi } from 'vitest';
import { isClaudePriceAdjudicationEnabled, isGeminiPriceAdjudicationEnabled, isPriceAdjudicationAiEnabled } from '@/lib/ai/provider-cost-controls';

describe('price research provider controls', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses configured research providers by default', () => {
    vi.stubEnv('GEMINI_API_KEY', 'configured-key');
    vi.stubEnv('CLAUDE_API_KEY', 'sk-ant-configured');
    vi.stubEnv('PRICE_ADJUDICATION_AI_ENABLED', '');
    vi.stubEnv('GEMINI_PRICE_ADJUDICATION_ENABLED', '');
    vi.stubEnv('CLAUDE_PRICE_ADJUDICATION_ENABLED', '');
    expect(isPriceAdjudicationAiEnabled()).toBe(true);
    expect(isGeminiPriceAdjudicationEnabled()).toBe(true);
    expect(isClaudePriceAdjudicationEnabled()).toBe(true);
  });

  it('honours an explicit master opt-out', () => {
    vi.stubEnv('GEMINI_API_KEY', 'configured-key');
    vi.stubEnv('CLAUDE_API_KEY', 'sk-ant-configured');
    vi.stubEnv('PRICE_ADJUDICATION_AI_ENABLED', 'false');
    expect(isGeminiPriceAdjudicationEnabled()).toBe(false);
    expect(isClaudePriceAdjudicationEnabled()).toBe(false);
  });

  it('does not enable an unconfigured provider', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('CLAUDE_API_KEY', '');
    vi.stubEnv('PRICE_ADJUDICATION_AI_ENABLED', '');
    expect(isPriceAdjudicationAiEnabled()).toBe(false);
  });
});
