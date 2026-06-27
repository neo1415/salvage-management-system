import { createCipheriv } from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { EncryptionService } from '@/features/kyc/services/encryption.service';

const TEST_KEY = 'a'.repeat(64);

describe('EncryptionService', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  it('round-trips authenticated ciphertext and rejects tampering', () => {
    const service = new EncryptionService();
    const encrypted = service.encrypt('12345678901');
    expect(service.decrypt(encrypted)).toBe('12345678901');

    const parts = encrypted.split(':');
    parts[3] = `${parts[3].slice(0, -2)}${parts[3].endsWith('00') ? '01' : '00'}`;
    expect(() => service.decrypt(parts.join(':'))).toThrow();
  });

  it('decrypts and upgrades legacy AES-256-CBC values', () => {
    const key = Buffer.from(TEST_KEY, 'hex');
    const iv = Buffer.alloc(16, 7);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const data = Buffer.concat([
      cipher.update('12345678901', 'utf8'),
      cipher.final(),
    ]);
    const legacy = `${iv.toString('hex')}:${data.toString('hex')}`;
    const service = new EncryptionService();

    expect(service.decrypt(legacy)).toBe('12345678901');
    const upgraded = service.reencryptIfLegacy(legacy);
    expect(upgraded).toMatch(/^v2:/);
    expect(service.decrypt(upgraded)).toBe('12345678901');
  });
});
