import { describe, it, expect } from 'vitest';
import { fc, test } from '@fast-check/vitest';
import { encryptBVN, decryptBVN, maskBVN } from '../../../src/features/vendors/services/bvn-verification.service';

/**
 * Property 5: BVN Security (Encryption and Masking)
 * Validates: Requirements 4.8, 4.9, NFR4.3
 * 
 * This test verifies that:
 * 1. BVN encryption → decryption produces the original value (round-trip)
 * 2. BVN masking shows only the last 4 digits
 * 3. Encrypted BVNs are different from original BVNs
 */

describe('Property 5: BVN Security (Encryption and Masking)', () => {
  // Property test: Encryption round-trip
  test.prop([fc.string({ minLength: 11, maxLength: 11 }).filter(s => /^\d{11}$/.test(s))])(
    'encrypt → decrypt produces original BVN',
    (bvn) => {
      // Encrypt the BVN
      const encrypted = encryptBVN(bvn);

      // Decrypt the encrypted BVN
      const decrypted = decryptBVN(encrypted);

      // Verify round-trip: decrypted should equal original
      expect(decrypted).toBe(bvn);
    }
  );

  // Property test: Encrypted BVN is different from original
  test.prop([fc.string({ minLength: 11, maxLength: 11 }).filter(s => /^\d{11}$/.test(s))])(
    'encrypted BVN is different from original',
    (bvn) => {
      const encrypted = encryptBVN(bvn);

      // Encrypted value should not equal original
      expect(encrypted).not.toBe(bvn);

      // Encrypted value should contain IV separator
      expect(encrypted).toContain(':');
    }
  );

  // Property test: BVN masking shows only last 4 digits
  test.prop([fc.string({ minLength: 11, maxLength: 11 }).filter(s => /^\d{11}$/.test(s))])(
    'maskBVN shows only last 4 digits',
    (bvn) => {
      const masked = maskBVN(bvn);

      // Masked BVN should have same length as original
      expect(masked.length).toBe(bvn.length);

      // Last 4 digits should match
      expect(masked.slice(-4)).toBe(bvn.slice(-4));

      // First 7 characters should be asterisks
      expect(masked.slice(0, 7)).toBe('*******');

      // Should not contain original first 7 digits
      expect(masked).not.toContain(bvn.slice(0, 7));
    }
  );

  // Property test: Multiple encryptions produce different ciphertexts
  test.prop([fc.string({ minLength: 11, maxLength: 11 }).filter(s => /^\d{11}$/.test(s))])(
    'multiple encryptions of same BVN produce different ciphertexts (due to random IV)',
    (bvn) => {
      const encrypted1 = encryptBVN(bvn);
      const encrypted2 = encryptBVN(bvn);

      // Different ciphertexts due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to same original
      expect(decryptBVN(encrypted1)).toBe(bvn);
      expect(decryptBVN(encrypted2)).toBe(bvn);
    }
  );

  // Unit test: Edge cases
  it('should handle edge case: empty string masking', () => {
    const masked = maskBVN('');
    expect(masked).toBe('****');
  });

  it('should handle edge case: short string masking', () => {
    const masked = maskBVN('123');
    expect(masked).toBe('****');
  });

  it('should handle edge case: exact 11-digit BVN', () => {
    const bvn = '12345678901';
    const encrypted = encryptBVN(bvn);
    const decrypted = decryptBVN(encrypted);
    expect(decrypted).toBe(bvn);
  });

  it('should handle edge case: test BVN', () => {
    const testBVN = '12345678901';
    const masked = maskBVN(testBVN);
    expect(masked).toBe('*******8901');
  });
});
