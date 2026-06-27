import { describe, it, beforeAll } from 'vitest';
import { expect } from 'vitest';
import fc from 'fast-check';
import { createCipheriv } from 'crypto';
import { EncryptionService } from '../encryption.service';

// Valid 64-char hex key for testing (32 bytes)
const TEST_KEY = 'a'.repeat(64);

describe('EncryptionService — Property-Based Tests', () => {
  let enc: EncryptionService;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    enc = new EncryptionService();
  });

  // Feature: tier-2-kyc-dojah-integration, Property 1: NIN encryption round-trip
  it('Property 1: decrypt(encrypt(nin)) === nin for all valid 11-digit NINs', () => {
    // Validates: Requirements 1.7, 11.1, 11.9
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{11}$/),
        (nin) => {
          expect(enc.decrypt(enc.encrypt(nin))).toBe(nin);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: tier-2-kyc-dojah-integration, Property 11: IV uniqueness
  it('Property 11: two encryptions of the same plaintext produce different IVs', () => {
    // Validates: Requirements 11.3
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{11}$/),
        (nin) => {
          const ct1 = enc.encrypt(nin);
          const ct2 = enc.encrypt(nin);
          const iv1 = ct1.split(':')[1];
          const iv2 = ct2.split(':')[1];
          expect(iv1).not.toBe(iv2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('authenticates ciphertext and rejects tampering', () => {
    const ciphertext = enc.encrypt('12345678901');
    const parts = ciphertext.split(':');
    expect(parts[0]).toBe('v2');
    const lastByte = parts[3].slice(-2) === '00' ? '01' : '00';
    parts[3] = `${parts[3].slice(0, -2)}${lastByte}`;
    expect(() => enc.decrypt(parts.join(':'))).toThrow();
  });

  it('decrypts and upgrades legacy AES-256-CBC values', () => {
    const key = Buffer.from(TEST_KEY, 'hex');
    const iv = Buffer.alloc(16, 7);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update('12345678901', 'utf8'), cipher.final()]);
    const legacy = `${iv.toString('hex')}:${encrypted.toString('hex')}`;

    expect(enc.decrypt(legacy)).toBe('12345678901');
    expect(enc.isLegacyCiphertext(legacy)).toBe(true);
    const upgraded = enc.reencryptIfLegacy(legacy);
    expect(upgraded.startsWith('v2:')).toBe(true);
    expect(enc.decrypt(upgraded)).toBe('12345678901');
  });

  // Feature: tier-2-kyc-dojah-integration, Property 12: NIN/BVN masking
  it('Property 12: mask(value) returns same-length string with first (N-4) chars as asterisks', () => {
    // Validates: Requirements 11.8
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }),
        (value) => {
          const masked = enc.mask(value);
          // Same length
          expect(masked.length).toBe(value.length);
          // Last 4 chars unchanged
          expect(masked.slice(-4)).toBe(value.slice(-4));
          // First (N-4) chars are asterisks
          const asteriskPart = masked.slice(0, masked.length - 4);
          expect(asteriskPart).toBe('*'.repeat(masked.length - 4));
        }
      ),
      { numRuns: 100 }
    );
  });
});
