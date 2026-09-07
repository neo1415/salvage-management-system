/** Missing prices must stay missing; an explicit numeric zero is a distinct value. */
export function parseValuationNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[^\d.-]/g, '');
  if (!/\d/.test(cleaned)) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function salvageDisplayValue(value: unknown, status?: string): number | undefined {
  return status === 'repair_pricing_pending' ? undefined : parseValuationNumber(value);
}
