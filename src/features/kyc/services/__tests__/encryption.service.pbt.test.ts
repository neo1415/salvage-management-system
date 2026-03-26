import { describe, it, beforeAll } from 'vitest';
import { expect } from 'vitest';
import fc from 'fast-check';
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
          const iv1 = ct1.split(':')[0];
          const iv2 = ct2.split(':')[0];
          expect(iv1).not.toBe(iv2);
        }
      ),
      { numRuns: 100 }
    );
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
