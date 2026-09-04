import { describe, expect, it } from 'vitest';
import { getGeminiDamageTimeoutMs } from '@/lib/integrations/gemini-damage-detection';

describe('Gemini damage timeout', () => {
  it('uses a practical default and accepts an in-range override', () => {
    expect(getGeminiDamageTimeoutMs(undefined)).toBe(45000);
    expect(getGeminiDamageTimeoutMs('60000')).toBe(60000);
  });

  it('bounds invalid and extreme values', () => {
    expect(getGeminiDamageTimeoutMs('not-a-number')).toBe(45000);
    expect(getGeminiDamageTimeoutMs('100')).toBe(10000);
    expect(getGeminiDamageTimeoutMs('999999')).toBe(90000);
  });
});
