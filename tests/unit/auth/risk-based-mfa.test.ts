import { describe, expect, it } from 'vitest';
import { getLoginContextHashes } from '@/lib/auth/risk-based-mfa';

describe('risk-based MFA login context hashing', () => {
  it('hashes equivalent browser patch versions into the same device context', () => {
    const first = getLoginContextHashes({
      userId: 'user-1',
      ipAddress: '197.210.10.45',
      userAgent: 'Mozilla/5.0 Chrome/149.0.1234.1 Safari/537.36',
    });

    const second = getLoginContextHashes({
      userId: 'user-1',
      ipAddress: '197.210.10.45',
      userAgent: 'Mozilla/5.0 Chrome/149.0.9999.8 Safari/537.36',
    });

    expect(first.deviceFingerprintHash).toBe(second.deviceFingerprintHash);
    expect(first.ipPrefixHash).toBe(second.ipPrefixHash);
    expect(first.deviceFingerprintHash).toHaveLength(64);
    expect(first.ipPrefixHash).toHaveLength(64);
  });

  it('changes IP prefix hash when the network prefix changes', () => {
    const first = getLoginContextHashes({
      userId: 'user-1',
      ipAddress: '197.210.10.45',
      userAgent: 'Mozilla/5.0 Chrome/149.0.1234.1 Safari/537.36',
    });

    const second = getLoginContextHashes({
      userId: 'user-1',
      ipAddress: '197.210.11.45',
      userAgent: 'Mozilla/5.0 Chrome/149.0.1234.1 Safari/537.36',
    });

    expect(first.deviceFingerprintHash).toBe(second.deviceFingerprintHash);
    expect(first.ipPrefixHash).not.toBe(second.ipPrefixHash);
  });
});

