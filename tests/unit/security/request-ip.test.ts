import { describe, expect, it } from 'vitest';
import {
  getClientIpFromHeaders,
  isTemporarilyBlockedIp,
  normalizeIpAddress,
} from '@/lib/security/request-ip';

function headers(values: Record<string, string>): Headers {
  const headers = new Headers();
  Object.entries(values).forEach(([key, value]) => headers.set(key, value));
  return headers;
}

describe('request IP helpers', () => {
  it('normalizes a single IPv4 address', () => {
    expect(normalizeIpAddress('203.0.113.9')).toBe('203.0.113.9');
  });

  it('uses the first comma-separated forwarding value', () => {
    expect(normalizeIpAddress('203.0.113.9, 198.51.100.4')).toBe('203.0.113.9');
  });

  it('trims whitespace around forwarded values', () => {
    expect(normalizeIpAddress('  203.0.113.9  ')).toBe('203.0.113.9');
  });

  it('removes an IPv4 port suffix', () => {
    expect(normalizeIpAddress('203.0.113.9:443')).toBe('203.0.113.9');
  });

  it('removes brackets from bracketed IPv6 values', () => {
    expect(normalizeIpAddress('[2001:db8::1]')).toBe('2001:db8::1');
  });

  it('returns null for malformed and empty values', () => {
    expect(normalizeIpAddress('not-an-ip')).toBeNull();
    expect(normalizeIpAddress('')).toBeNull();
    expect(normalizeIpAddress('   ')).toBeNull();
    expect(normalizeIpAddress(null)).toBeNull();
  });

  it('detects the temporary blocked IP', () => {
    expect(isTemporarilyBlockedIp('83.140.108.177')).toBe(true);
    expect(isTemporarilyBlockedIp('203.0.113.9')).toBe(false);
  });

  it('selects Vercel forwarded IP before equivalent fallback headers', () => {
    expect(
      getClientIpFromHeaders(headers({
        'x-forwarded-for': '203.0.113.9',
        'x-vercel-forwarded-for': '198.51.100.4',
        'x-real-ip': '192.0.2.8',
      }))
    ).toBe('203.0.113.9');
  });

  it('documents the app-level trust limitation for misleading forwarded values', () => {
    expect(
      getClientIpFromHeaders(headers({
        'x-forwarded-for': '10.0.0.1, 83.140.108.177',
      }))
    ).toBe('10.0.0.1');
  });
});
