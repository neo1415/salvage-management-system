function enabled(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === 'true';
}

function configured(name: string, placeholder: string): boolean {
  const value = process.env[name]?.trim();
  return Boolean(value && value !== placeholder);
}

export function isClaudeDamageFallbackEnabled(): boolean {
  const override = process.env.CLAUDE_DAMAGE_FALLBACK_ENABLED?.trim().toLowerCase();
  if (override === 'false') return false;
  if (override === 'true') return true;
  return configured('CLAUDE_API_KEY', 'your-claude-api-key');
}

export function isPriceAdjudicationAiEnabled(): boolean {
  const override = process.env.PRICE_ADJUDICATION_AI_ENABLED?.trim().toLowerCase();
  if (override === 'false') return false;
  if (override === 'true') return true;
  return configured('GEMINI_API_KEY', 'your-gemini-api-key')
    || configured('CLAUDE_API_KEY', 'your-claude-api-key');
}

export function isGeminiPriceAdjudicationEnabled(): boolean {
  const override = process.env.GEMINI_PRICE_ADJUDICATION_ENABLED?.trim().toLowerCase();
  return isPriceAdjudicationAiEnabled()
    && override !== 'false'
    && configured('GEMINI_API_KEY', 'your-gemini-api-key');
}

export function isClaudePriceAdjudicationEnabled(): boolean {
  const override = process.env.CLAUDE_PRICE_ADJUDICATION_ENABLED?.trim().toLowerCase();
  return isPriceAdjudicationAiEnabled()
    && override !== 'false'
    && configured('CLAUDE_API_KEY', 'your-claude-api-key');
}

export function isClaudePickupFallbackEnabled(): boolean {
  return enabled('CLAUDE_PICKUP_FALLBACK_ENABLED');
}

export function isClaudeKycFallbackEnabled(): boolean {
  return enabled('CLAUDE_KYC_FALLBACK_ENABLED');
}
