export function isProviderQuotaError(error: unknown): boolean {
  const value = error as {status?:number;message?:string} | null;
  return value?.status === 429 || /\b429\b|resource[_\s-]?exhausted|quota(?:\s+or\s+rate)?\s*(?:exceeded|exhausted|limit)|rate.?limit.*(?:reached|exceeded)/i.test(value?.message || String(error));
}
export function logProviderFailure(provider: string, stage: string, error: unknown): void {
  const value=error as {status?:number;name?:string;error?:{error?:{type?:string}};request_id?:string};
  console.warn('[AI provider failure]', {provider,stage,status:value?.status,errorType:value?.error?.error?.type || value?.name || 'unknown',quota:isProviderQuotaError(error),requestId:value?.request_id});
}
