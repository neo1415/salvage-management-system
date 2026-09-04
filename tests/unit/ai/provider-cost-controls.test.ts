import { afterEach, describe, expect, it } from 'vitest';
import { isClaudeDamageFallbackEnabled } from '@/lib/ai/provider-cost-controls';

const originalKey = process.env.CLAUDE_API_KEY;
const originalFlag = process.env.CLAUDE_DAMAGE_FALLBACK_ENABLED;

describe('Claude damage fallback cost control', () => {
  afterEach(() => {
    if (originalKey === undefined) delete process.env.CLAUDE_API_KEY;
    else process.env.CLAUDE_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.CLAUDE_DAMAGE_FALLBACK_ENABLED;
    else process.env.CLAUDE_DAMAGE_FALLBACK_ENABLED = originalFlag;
  });

  it('enables fallback by default when a real key is configured', () => {
    process.env.CLAUDE_API_KEY = 'sk-ant-configured';
    delete process.env.CLAUDE_DAMAGE_FALLBACK_ENABLED;
    expect(isClaudeDamageFallbackEnabled()).toBe(true);
  });

  it('honors the explicit cost-off switch', () => {
    process.env.CLAUDE_API_KEY = 'sk-ant-configured';
    process.env.CLAUDE_DAMAGE_FALLBACK_ENABLED = 'false';
    expect(isClaudeDamageFallbackEnabled()).toBe(false);
  });

  it('does not enable fallback for a missing or placeholder key', () => {
    process.env.CLAUDE_API_KEY = 'your-claude-api-key';
    delete process.env.CLAUDE_DAMAGE_FALLBACK_ENABLED;
    expect(isClaudeDamageFallbackEnabled()).toBe(false);
  });
});
