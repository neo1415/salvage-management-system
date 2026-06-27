function enabled(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === 'true';
}

export function isClaudeDamageFallbackEnabled(): boolean {
  return enabled('CLAUDE_DAMAGE_FALLBACK_ENABLED');
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
