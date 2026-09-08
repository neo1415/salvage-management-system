/** Public provider errors must never expose response bodies or request identifiers. */
export function providerErrorMessage(provider: 'Claude' | 'Gemini', error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|timed out|abort/i.test(message)) return `${provider} API request timed out before completing. Provider work may still have been billed. Ask the administrator to inspect the request logs.`;
  if (/overloaded|\b529\b|\b503\b/i.test(message)) return `${provider} API is overloaded. Retry later.`;
  if (/specified (?:workspace )?API usage limits|spend limit|spending limit/i.test(message)) {
    return `${provider} API spending limit reached. The account administrator must review organization and workspace limits in the provider console; a credit balance alone does not remove this limit.`;
  }
  if (/credit balance|insufficient.*credit/i.test(message)) return `${provider} API credit balance is insufficient. Ask the account administrator to review API billing.`;
  if (/429|quota|rate.?limit|resource_exhausted/i.test(message)) return `${provider} API quota or rate limit reached. Retry when capacity is available.`;
  if (/401|403|authentication|api.key/i.test(message)) return `${provider} API authentication is unavailable. Ask the account administrator to check the configured API key.`;
  return `${provider} API is temporarily unavailable. Try again later or ask the account administrator to check the integration.`;
}
