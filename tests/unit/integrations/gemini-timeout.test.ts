import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGeminiDamageTimeoutMs } from '@/lib/integrations/gemini-damage-detection';

describe('Gemini damage timeout', () => {
  beforeEach(() => vi.stubEnv('GEMINI_DAMAGE_TIMEOUT_MS', undefined));
  afterEach(() => vi.unstubAllEnvs());
  it('uses a practical default and accepts an in-range override', () => {
    expect(getGeminiDamageTimeoutMs(undefined)).toBe(75000);
    expect(getGeminiDamageTimeoutMs('60000')).toBe(60000);
  });

  it('bounds invalid and extreme values', () => {
    expect(getGeminiDamageTimeoutMs('not-a-number')).toBe(75000);
    expect(getGeminiDamageTimeoutMs('100')).toBe(10000);
    expect(getGeminiDamageTimeoutMs('999999')).toBe(90000);
  });
});
