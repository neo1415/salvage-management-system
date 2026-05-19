import crypto from 'crypto';

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function extractVendorIdFromDojahReference(reference?: string | null): string | undefined {
  if (!reference) return undefined;
  const match = reference.match(UUID_PATTERN);
  return match?.[0];
}

export function buildDojahReference(vendorId: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `nem-${vendorId}-${suffix}`;
}
