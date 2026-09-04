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
  return enabled('PRICE_ADJUDICATION_AI_ENABLED');
}

export function isGeminiPriceAdjudicationEnabled(): boolean {
  return isPriceAdjudicationAiEnabled() && enabled('GEMINI_PRICE_ADJUDICATION_ENABLED');
}

export function isClaudePriceAdjudicationEnabled(): boolean {
  return isPriceAdjudicationAiEnabled() && enabled('CLAUDE_PRICE_ADJUDICATION_ENABLED');
}

export function isClaudePickupFallbackEnabled(): boolean {
  return enabled('CLAUDE_PICKUP_FALLBACK_ENABLED');
}

export function isClaudeKycFallbackEnabled(): boolean {
  return enabled('CLAUDE_KYC_FALLBACK_ENABLED');
}
