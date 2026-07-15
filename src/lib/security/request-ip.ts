export const TEMPORARILY_BLOCKED_IPS = new Set([
  // TEMPORARY CONTAINMENT ONLY: best-effort app-level block after threat-intel
  // reports. Move durable deny rules to Vercel Firewall/WAF.
  '83.140.108.177',
]);

export function firstForwardedAddress(value: string | null): string | null {
  return value
    ?.split(',')
    .map((part) => part.trim())
    .find(Boolean) ?? null;
}

export function normalizeIpAddress(value: string | null): string | null {
  const firstAddress = firstForwardedAddress(value);
  if (!firstAddress) return null;

  const withoutIpv6Brackets = firstAddress.startsWith('[')
    ? firstAddress.slice(1, firstAddress.indexOf(']') > 0 ? firstAddress.indexOf(']') : undefined)
    : firstAddress;

  const withoutIpv4Port = /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(withoutIpv6Brackets)
    ? withoutIpv6Brackets.split(':')[0]
    : withoutIpv6Brackets;

  const normalized = withoutIpv4Port.toLowerCase();
  return isPlausibleIpAddress(normalized) ? normalized : null;
}

function isPlausibleIpAddress(value: string): boolean {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return value.split('.').every((octet) => Number(octet) <= 255);
  }

  return value.includes(':') && /^[0-9a-f:.%]+$/.test(value);
}

export function getClientIpFromHeaders(headers: Headers): string {
  return (
    normalizeIpAddress(headers.get('x-forwarded-for')) ||
    normalizeIpAddress(headers.get('x-vercel-forwarded-for')) ||
    normalizeIpAddress(headers.get('x-real-ip')) ||
    'unknown'
  );
}

export function isTemporarilyBlockedIp(ipAddress: string): boolean {
  return TEMPORARILY_BLOCKED_IPS.has(ipAddress);
}
